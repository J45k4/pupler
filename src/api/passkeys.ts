import { randomBytes } from "node:crypto"
import type { BunRequest } from "bun"
import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
	type AuthenticatorTransport,
} from "@simplewebauthn/server"

import { resolvePublicOrigin } from "../config"
import { db } from "../db"
import { createSessionResponse, hashSessionToken, PUBLIC_USER_SELECT, requireAuthenticatedUser } from "./auth"
import { empty, expectString, HttpError, json, parseIdParam, readJsonObject, requireBodyField, utcNow } from "./core"

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7
const CHALLENGE_TTL_MS = 1000 * 60 * 5
const RP_NAME = "Pupler"

const publicOrigin = resolvePublicOrigin()
const challenges = new Map<string, { challenge: string, expiresAt: number }>()

const relyingParty = (req: Request) => {
	const origin = publicOrigin ?? new URL(req.url).origin
	return { origin, rpID: new URL(origin).hostname }
}

const storeChallenge = (key: string, challenge: string) => {
	const now = Date.now()
	for (const [k, v] of challenges) if (v.expiresAt <= now) challenges.delete(k)
	challenges.set(key, { challenge, expiresAt: now + CHALLENGE_TTL_MS })
}

const takeChallenge = (key: string) => {
	const entry = challenges.get(key)
	challenges.delete(key)
	if (!entry || entry.expiresAt <= Date.now()) throw new HttpError(400, "Challenge expired, try again")
	return entry.challenge
}

const findInvite = async (token: string) => {
	const invite = await db.client.userInvite.findUnique({
		where: { token_hash: hashSessionToken(token) },
		include: { user: { select: PUBLIC_USER_SELECT } },
	})
	if (!invite || Date.parse(invite.expires_at) <= Date.now()) throw new HttpError(404, "Invite link is invalid or expired")
	return invite
}

type RegistrationUser = { id: number, name: string, username: string | null }

const registrationOptions = async (req: Request, user: RegistrationUser) => {
	const existing = await db.client.passkey.findMany({ where: { user_id: user.id }, select: { credential_id: true } })
	return generateRegistrationOptions({
		rpName: RP_NAME,
		rpID: relyingParty(req).rpID,
		userName: user.username ?? user.name,
		userDisplayName: user.name,
		userID: new TextEncoder().encode(String(user.id)),
		attestationType: "none",
		excludeCredentials: existing.map((c) => ({ id: c.credential_id })),
		authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
	})
}

const verifyRegistration = async (req: Request, challengeKey: string) => {
	const body = await readJsonObject(req)
	const { origin, rpID } = relyingParty(req)
	const verification = await verifyRegistrationResponse({
		response: body.response as never,
		expectedChallenge: takeChallenge(challengeKey),
		expectedOrigin: origin,
		expectedRPID: rpID,
		requireUserVerification: false,
	}).catch(() => null)
	if (!verification?.verified || !verification.registrationInfo) throw new HttpError(400, "Passkey registration failed")
	return verification.registrationInfo.credential
}

const savePasskey = async (userId: number, credential: Awaited<ReturnType<typeof verifyRegistration>>) => {
	const existing = await db.client.passkey.findUnique({ where: { credential_id: credential.id }, select: { id: true } })
	if (existing) throw new HttpError(409, "This passkey is already registered")
	return db.client.passkey.create({
		data: {
			user_id: userId,
			credential_id: credential.id,
			public_key: Buffer.from(credential.publicKey).toString("base64url"),
			counter: credential.counter,
			transports: credential.transports ? JSON.stringify(credential.transports) : null,
			created_at: utcNow(),
		},
	})
}

// Creating an invite replaces any earlier unused invite for the same user.
export const userInviteRoute = async (req: BunRequest<string>) => {
	if (req.method !== "POST") throw new HttpError(405, "Method not allowed for this route")
	const userId = parseIdParam(req.params.id ?? "")
	const user = await db.client.user.findUnique({ where: { id: userId }, select: { id: true } })
	if (!user) throw new HttpError(404, "User not found")
	const token = randomBytes(32).toString("base64url")
	const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString()
	await db.client.$transaction([
		db.client.userInvite.deleteMany({ where: { user_id: userId } }),
		db.client.userInvite.create({ data: { user_id: userId, token_hash: hashSessionToken(token), expires_at: expiresAt, created_at: utcNow() } }),
	])
	return json(201, { url: `${relyingParty(req).origin}/invite/${token}`, expires_at: expiresAt })
}

export const inviteDetailRoute = async (req: BunRequest<string>) => {
	if (req.method !== "GET") throw new HttpError(405, "Method not allowed for this route")
	const invite = await findInvite(req.params.token ?? "")
	return json(200, { user: { name: invite.user.name, username: invite.user.username }, expires_at: invite.expires_at })
}

export const inviteRegistrationOptionsRoute = async (req: BunRequest<string>) => {
	if (req.method !== "POST") throw new HttpError(405, "Method not allowed for this route")
	const token = req.params.token ?? ""
	const invite = await findInvite(token)
	const options = await registrationOptions(req, invite.user)
	storeChallenge(`invite:${invite.token_hash}`, options.challenge)
	return json(200, options as never)
}

export const inviteRegistrationVerifyRoute = async (req: BunRequest<string>) => {
	if (req.method !== "POST") throw new HttpError(405, "Method not allowed for this route")
	const token = req.params.token ?? ""
	const invite = await findInvite(token)
	const credential = await verifyRegistration(req, `invite:${invite.token_hash}`)
	// Deleting the invite first makes the link single use even under concurrent requests.
	const consumed = await db.client.userInvite.deleteMany({ where: { id: invite.id } })
	if (consumed.count !== 1) throw new HttpError(404, "Invite link is invalid or expired")
	const passkey = await savePasskey(invite.user_id, credential)
	return createSessionResponse(invite.user, req, passkey.id)
}

export const passkeyLoginOptionsRoute = async (req: Request) => {
	if (req.method !== "POST") throw new HttpError(405, "Method not allowed for this route")
	const options = await generateAuthenticationOptions({ rpID: relyingParty(req).rpID, userVerification: "preferred" })
	const challengeId = randomBytes(16).toString("base64url")
	storeChallenge(`login:${challengeId}`, options.challenge)
	return json(200, { challenge_id: challengeId, options: options as never })
}

export const passkeyLoginVerifyRoute = async (req: Request) => {
	if (req.method !== "POST") throw new HttpError(405, "Method not allowed for this route")
	const body = await readJsonObject(req)
	const challengeId = requireBodyField(body, "challenge_id", expectString)
	const response = body.response as { id?: unknown } | undefined
	const expectedChallenge = takeChallenge(`login:${challengeId}`)
	if (typeof response?.id !== "string") throw new HttpError(400, "Field `response` is required")
	const passkey = await db.client.passkey.findUnique({
		where: { credential_id: response.id },
		include: { user: { select: PUBLIC_USER_SELECT } },
	})
	if (!passkey) throw new HttpError(401, "Unknown passkey")
	const { origin, rpID } = relyingParty(req)
	const verification = await verifyAuthenticationResponse({
		response: response as never,
		expectedChallenge,
		expectedOrigin: origin,
		expectedRPID: rpID,
		requireUserVerification: false,
		credential: {
			id: passkey.credential_id,
			publicKey: Buffer.from(passkey.public_key, "base64url"),
			counter: passkey.counter,
			transports: passkey.transports ? JSON.parse(passkey.transports) as AuthenticatorTransport[] : undefined,
		},
	}).catch(() => null)
	if (!verification?.verified) throw new HttpError(401, "Passkey verification failed")
	await db.client.passkey.update({
		where: { id: passkey.id },
		data: { counter: verification.authenticationInfo.newCounter, last_used_at: utcNow() },
	})
	return createSessionResponse(passkey.user, req, passkey.id)
}

const PASSKEY_SELECT = { id: true, transports: true, created_at: true, last_used_at: true } as const

const listPasskeys = async (userId: number) => {
	const passkeys = await db.client.passkey.findMany({ where: { user_id: userId }, select: PASSKEY_SELECT, orderBy: { id: "asc" } })
	return passkeys.map((p) => ({ ...p, transports: p.transports ? JSON.parse(p.transports) as string[] : [] }))
}

// Deleting a passkey cascades to the sessions it started, so a lost device is signed out too.
const deletePasskey = async (userId: number, passkeyId: number) => {
	const result = await db.client.passkey.deleteMany({ where: { id: passkeyId, user_id: userId } })
	if (!result.count) throw new HttpError(404, "Passkey not found")
	return empty(204)
}

const accountUser = async (req: Request) => {
	if (req.headers.has("authorization")) throw new HttpError(403, "Sign in with the browser to manage passkeys")
	return requireAuthenticatedUser(req)
}

export const passkeysCollectionRoute = async (req: Request) => {
	const user = await accountUser(req)
	if (req.method === "GET") return json(200, await listPasskeys(user.id))
	if (req.method !== "POST") throw new HttpError(405, "Method not allowed for this route")
	const passkey = await savePasskey(user.id, await verifyRegistration(req, `add:${user.id}`))
	return json(201, (await listPasskeys(user.id)).find((p) => p.id === passkey.id)!)
}

export const passkeyRegistrationOptionsRoute = async (req: Request) => {
	const user = await accountUser(req)
	if (req.method !== "POST") throw new HttpError(405, "Method not allowed for this route")
	const options = await registrationOptions(req, user)
	storeChallenge(`add:${user.id}`, options.challenge)
	return json(200, options as never)
}

export const passkeyDetailRoute = async (req: BunRequest<string>) => {
	const user = await accountUser(req)
	if (req.method !== "DELETE") throw new HttpError(405, "Method not allowed for this route")
	const passkeyId = parseIdParam(req.params.id ?? "")
	const account = await db.client.user.findUnique({ where: { id: user.id }, select: { password_hash: true, _count: { select: { passkeys: true } } } })
	if (!account?.password_hash && account?._count.passkeys === 1) {
		throw new HttpError(409, "Cannot remove your only passkey without a password; add another passkey first")
	}
	return deletePasskey(user.id, passkeyId)
}

export const userPasskeysCollectionRoute = async (req: BunRequest<string>) => {
	if (req.method !== "GET") throw new HttpError(405, "Method not allowed for this route")
	return json(200, await listPasskeys(parseIdParam(req.params.id ?? "")))
}

export const userPasskeyDetailRoute = async (req: BunRequest<string>) => {
	if (req.method !== "DELETE") throw new HttpError(405, "Method not allowed for this route")
	return deletePasskey(parseIdParam(req.params.id ?? ""), parseIdParam(req.params.passkeyId ?? ""))
}
