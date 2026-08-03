import { createHash, randomBytes } from "node:crypto";

import { db } from "../db";
import {
	empty,
	assertKnownFields,
	expectString,
	expectNullableString,
	HttpError,
	json,
	readJsonObject,
	requireBodyField,
	utcNow,
	type JsonObject,
} from "./core";

const SESSION_COOKIE_NAME = "pupler_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;

const PUBLIC_USER_SELECT = {
	id: true,
	name: true,
	username: true,
	email: true,
	is_admin: true,
	created_at: true,
	updated_at: true,
} as const;

const hashSessionToken = (token: string) =>
	createHash("sha256").update(token).digest("hex");

const parseCookieHeader = (header: string | null) => {
	const cookies = new Map<string, string>();
	if (!header) return cookies;

	for (const cookie of header.split(";")) {
		const [rawName, ...rawValueParts] = cookie.split("=");
		const name = rawName?.trim();
		if (!name) continue;
		cookies.set(name, rawValueParts.join("=").trim());
	}

	return cookies;
};

const readSessionToken = (req: Request) =>
	parseCookieHeader(req.headers.get("cookie")).get(SESSION_COOKIE_NAME) ?? null;

const isSecureRequest = (req: Request) => {
	const url = new URL(req.url);
	return url.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
};

const sessionCookie = (token: string, req: Request) =>
	[
		`${SESSION_COOKIE_NAME}=${token}`,
		"HttpOnly",
		"Path=/",
		"SameSite=Lax",
		`Max-Age=${SESSION_TTL_SECONDS}`,
		...(isSecureRequest(req) ? ["Secure"] : []),
	].join("; ");

const clearSessionCookie = (req: Request) =>
	[
		`${SESSION_COOKIE_NAME}=`,
		"HttpOnly",
		"Path=/",
		"SameSite=Lax",
		"Max-Age=0",
		...(isSecureRequest(req) ? ["Secure"] : []),
	].join("; ");

const parseLoginValues = (body: JsonObject) => ({
	username: requireBodyField(body, "username", expectString).trim(),
	password: requireBodyField(body, "password", expectString),
});

const parsePasswordChangeValues = (body: JsonObject) => ({
	currentPassword: requireBodyField(body, "current_password", expectString),
	newPassword: requireBodyField(body, "new_password", expectString),
});

const verifyPassword = async (password: string, passwordHash: string | null) => {
	if (!passwordHash) return false;
	try {
		return await Bun.password.verify(password, passwordHash);
	} catch {
		return false;
	}
};

export const resolveAuthenticatedUser = async (req: Request) => {
	const token = readSessionToken(req);
	if (!token) return null;

	const now = utcNow();
	const tokenHash = hashSessionToken(token);
	const session = await db.client.userSession.findUnique({
		where: { token_hash: tokenHash },
		include: { user: { select: PUBLIC_USER_SELECT } },
	});
	if (!session) return null;

	if (Date.parse(session.expires_at) <= Date.parse(now)) {
		await db.client.userSession.delete({ where: { id: session.id } });
		return null;
	}

	await db.client.userSession.update({
		where: { id: session.id },
		data: { last_seen_at: now },
	});

	return session.user;
};

export const requireAuthenticatedUser = async (req: Request) => {
	const user = await resolveAuthenticatedUser(req);
	if (!user) throw new HttpError(401, "Authentication required");
	return user;
};

export const requireAdminUser = async (req: Request) => {
	const user = await requireAuthenticatedUser(req);
	if (!user.is_admin) throw new HttpError(403, "Administrator access required");
	return user;
};

const parseBootstrapValues = (body: JsonObject) => {
	assertKnownFields(body, ["name", "username", "password", "email"]);
	const name = requireBodyField(body, "name", expectString).trim();
	const username = requireBodyField(body, "username", expectString).trim();
	const password = requireBodyField(body, "password", expectString);
	const email = body.email === undefined ? null : expectNullableString(body.email, "email")?.trim() || null;
	if (!name || !username) throw new HttpError(400, "Name and username are required");
	if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
	return { name, username, password, email };
};

export const authBootstrapRoute = async (req: Request) => {
	if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
	const userCount = await db.client.user.count();
	if (userCount > 0) throw new HttpError(409, "Initial administrator already exists");
	const values = parseBootstrapValues(await readJsonObject(req));
	const now = utcNow();
	const user = await db.client.user.create({
		data: {
			name: values.name,
			username: values.username,
			email: values.email,
			password_hash: await Bun.password.hash(values.password),
			is_admin: true,
			created_at: now,
			updated_at: now,
		},
		select: PUBLIC_USER_SELECT,
	});
	return json(201, user);
};

export const authLoginRoute = async (req: Request) => {
	if (req.method !== "POST") {
		throw new HttpError(405, "Method not allowed for this route");
	}

	const { username, password } = parseLoginValues(await readJsonObject(req));
	if (!username) {
		throw new HttpError(400, "Field `username` cannot be empty");
	}

	const user = await db.client.user.findUnique({
		where: { username },
		select: {
			...PUBLIC_USER_SELECT,
			password_hash: true,
		},
	});
	if (!user || !(await verifyPassword(password, user.password_hash))) {
		throw new HttpError(401, "Invalid username or password");
	}

	const token = randomBytes(32).toString("base64url");
	const now = utcNow();
	const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
	await db.client.userSession.create({
		data: {
			user_id: user.id,
			token_hash: hashSessionToken(token),
			expires_at: expiresAt,
			created_at: now,
			last_seen_at: now,
		},
	});

	const { password_hash: _passwordHash, ...publicUser } = user;
	return Response.json(
		{
			user: publicUser,
			expires_at: expiresAt,
		},
		{
			status: 200,
			headers: { "Set-Cookie": sessionCookie(token, req) },
		},
	);
};

export const authLogoutRoute = async (req: Request) => {
	if (req.method !== "POST") {
		throw new HttpError(405, "Method not allowed for this route");
	}

	const token = readSessionToken(req);
	if (token) {
		await db.client.userSession.deleteMany({
			where: { token_hash: hashSessionToken(token) },
		});
	}

	return new Response(null, {
		status: 204,
		headers: { "Set-Cookie": clearSessionCookie(req) },
	});
};

export const authSessionRoute = async (req: Request) => {
	if (req.method !== "GET") {
		throw new HttpError(405, "Method not allowed for this route");
	}

	return json(200, {
		user: await requireAuthenticatedUser(req),
	});
};

export const authPasswordRoute = async (req: Request) => {
	if (req.method !== "POST") {
		throw new HttpError(405, "Method not allowed for this route");
	}

	const authUser = await requireAuthenticatedUser(req);
	const { currentPassword, newPassword } = parsePasswordChangeValues(
		await readJsonObject(req),
	);
	if (!newPassword.trim()) {
		throw new HttpError(400, "Field `new_password` cannot be empty");
	}
	if (newPassword.length < 8) {
		throw new HttpError(400, "New password must be at least 8 characters");
	}

	const user = await db.client.user.findUnique({
		where: { id: authUser.id },
		select: { id: true, password_hash: true },
	});
	if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
		throw new HttpError(401, "Current password is incorrect");
	}

	await db.client.user.update({
		where: { id: user.id },
		data: {
			password_hash: await Bun.password.hash(newPassword),
			updated_at: utcNow(),
		},
	});

	return empty(204);
};
