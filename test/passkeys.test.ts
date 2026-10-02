import { afterEach, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { FakePasskey } from "./support/fake-passkey"
import { TestServer } from "./support/test-server"

let server: TestServer | undefined
afterEach(async () => {
	await server?.close()
	server = undefined
})

test("admins create single-use invite links that replace earlier ones", async () => {
	server = await TestServer.start()
	const created = await server.call<any>("/api/users", { method: "POST", body: { name: "Invited", username: "invited", password: "" } })
	expect(created.response.status).toBe(201)
	const first = await server.call<any>(`/api/users/${created.body.id}/invite`, { method: "POST", body: {} })
	expect(first.response.status).toBe(201)
	const firstToken = first.body.url.split("/invite/")[1]
	expect(firstToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
	const info = await server.call<any>(`/api/auth/invites/${firstToken}`, { headers: { Cookie: "" } })
	expect(info.response.status).toBe(200)
	expect(info.body.user).toEqual({ name: "Invited", username: "invited" })
	const options = await server.call<any>(`/api/auth/invites/${firstToken}/options`, { method: "POST", headers: { Cookie: "" }, body: {} })
	expect(options.response.status).toBe(200)
	expect(options.body.challenge).toBeString()
	const bad = await server.call(`/api/auth/invites/${firstToken}/verify`, { method: "POST", headers: { Cookie: "" }, body: { response: {} } })
	expect(bad.response.status).toBe(400)
	const second = await server.call<any>(`/api/users/${created.body.id}/invite`, { method: "POST", body: {} })
	const secondToken = second.body.url.split("/invite/")[1]
	expect((await server.call(`/api/auth/invites/${firstToken}`, { headers: { Cookie: "" } })).response.status).toBe(404)
	expect((await server.call(`/api/auth/invites/${secondToken}`, { headers: { Cookie: "" } })).response.status).toBe(200)
	expect((await server.call(`/api/users/${created.body.id}/invite`, { method: "POST", headers: { Cookie: "" }, body: {} })).response.status).toBe(401)
	expect((await server.call("/api/users/99999/invite", { method: "POST", body: {} })).response.status).toBe(404)
}, 20000)

test("passkey login rejects unknown challenges and credentials", async () => {
	server = await TestServer.start()
	const options = await server.call<any>("/api/auth/passkey/options", { method: "POST", headers: { Cookie: "" }, body: {} })
	expect(options.response.status).toBe(200)
	expect(options.body.challenge_id).toBeString()
	const unknown = await server.call("/api/auth/passkey/verify", { method: "POST", headers: { Cookie: "" }, body: { challenge_id: options.body.challenge_id, response: { id: "nope" } } })
	expect(unknown.response.status).toBe(401)
	const reused = await server.call("/api/auth/passkey/verify", { method: "POST", headers: { Cookie: "" }, body: { challenge_id: options.body.challenge_id, response: { id: "nope" } } })
	expect(reused.response.status).toBe(400)
}, 20000)

const anonymous = { Cookie: "" }

const inviteUser = async (server: TestServer, username = "invited") => {
	const created = await server.call<any>("/api/users", { method: "POST", body: { name: "Invited", username, password: "" } })
	const invite = await server.call<any>(`/api/users/${created.body.id}/invite`, { method: "POST", body: {} })
	return { userId: created.body.id as number, token: invite.body.url.split("/invite/")[1] as string }
}

const registerWith = async (server: TestServer, token: string, passkey: FakePasskey, overrides = {}) => {
	const options = await server.call<any>(`/api/auth/invites/${token}/options`, { method: "POST", headers: anonymous, body: {} })
	return server.call<any>(`/api/auth/invites/${token}/verify`, { method: "POST", headers: anonymous, body: { response: passkey.register(options.body, overrides) } })
}

const loginWith = async (server: TestServer, passkey: FakePasskey, overrides = {}) => {
	const options = await server.call<any>("/api/auth/passkey/options", { method: "POST", headers: anonymous, body: {} })
	return server.call<any>("/api/auth/passkey/verify", { method: "POST", headers: anonymous, body: { challenge_id: options.body.challenge_id, response: passkey.authenticate(options.body.options, overrides) } })
}

const sessionCookieOf = (response: Response) => response.headers.get("set-cookie")!.split(";")[0]!

const passkeyRows = (server: TestServer) => {
	const db = new Database(server.dbPath, { readonly: true })
	try {
		return db.query("SELECT user_id, credential_id, counter, last_used_at FROM passkeys").all() as { user_id: number, credential_id: string, counter: number, last_used_at: string | null }[]
	} finally { db.close() }
}

test("an invite registers a passkey, logs in and cannot be used again", async () => {
	server = await TestServer.start()
	const { userId, token } = await inviteUser(server)
	const passkey = new FakePasskey(server.baseUrl)
	const registered = await registerWith(server, token, passkey)
	expect(registered.response.status).toBe(200)
	expect(registered.body.user).toMatchObject({ id: userId, username: "invited" })
	const session = await server.call<any>("/api/auth/session", { headers: { Cookie: sessionCookieOf(registered.response) } })
	expect(session.body.user.id).toBe(userId)
	expect(passkeyRows(server)).toEqual([{ user_id: userId, credential_id: passkey.id, counter: 0, last_used_at: null }])

	expect((await server.call(`/api/auth/invites/${token}`, { headers: anonymous })).response.status).toBe(404)
	expect((await server.call(`/api/auth/invites/${token}/options`, { method: "POST", headers: anonymous, body: {} })).response.status).toBe(404)
	expect((await registerWith(server, token, new FakePasskey(server.baseUrl))).response.status).toBe(404)
	expect(passkeyRows(server)).toHaveLength(1)

	const replacement = await server.call<any>(`/api/users/${userId}/invite`, { method: "POST", body: {} })
	const second = new FakePasskey(server.baseUrl)
	expect((await registerWith(server, replacement.body.url.split("/invite/")[1], second)).response.status).toBe(200)
	expect(passkeyRows(server).map((row) => row.credential_id).sort()).toEqual([passkey.id, second.id].sort())
}, 20000)

test("passkey login creates a session and tracks the signature counter", async () => {
	server = await TestServer.start()
	const { userId, token } = await inviteUser(server)
	const passkey = new FakePasskey(server.baseUrl)
	await registerWith(server, token, passkey)

	const login = await loginWith(server, passkey, { counter: 5 })
	expect(login.response.status).toBe(200)
	expect(login.body.user.id).toBe(userId)
	const session = await server.call<any>("/api/auth/session", { headers: { Cookie: sessionCookieOf(login.response) } })
	expect(session.body.user.id).toBe(userId)
	const [row] = passkeyRows(server)
	expect(row!.counter).toBe(5)
	expect(row!.last_used_at).toBeString()

	expect((await loginWith(server, passkey, { counter: 5 })).response.status).toBe(401)
	expect((await loginWith(server, passkey, { counter: 6 })).response.status).toBe(200)
}, 20000)

test("passkeys signed for another origin or relying party are rejected", async () => {
	server = await TestServer.start()
	const { token } = await inviteUser(server)
	expect((await registerWith(server, token, new FakePasskey(server.baseUrl), { origin: "https://evil.example" })).response.status).toBe(400)
	expect((await registerWith(server, token, new FakePasskey(server.baseUrl), { rpId: "evil.example" })).response.status).toBe(400)
	expect(passkeyRows(server)).toHaveLength(0)

	const passkey = new FakePasskey(server.baseUrl)
	expect((await registerWith(server, token, passkey)).response.status).toBe(200)
	expect((await loginWith(server, passkey, { origin: "https://evil.example" })).response.status).toBe(401)
	const foreign = new FakePasskey("https://evil.example")
	Object.assign(foreign, { credentialId: passkey.credentialId })
	expect((await loginWith(server, foreign)).response.status).toBe(401)
}, 20000)

test("expired invites are rejected", async () => {
	server = await TestServer.start()
	const { token } = await inviteUser(server)
	const options = await server.call<any>(`/api/auth/invites/${token}/options`, { method: "POST", headers: anonymous, body: {} })
	const db = new Database(server.dbPath)
	try { db.query("UPDATE user_invites SET expires_at = ?").run(new Date(Date.now() - 1000).toISOString()) } finally { db.close() }
	expect((await server.call(`/api/auth/invites/${token}`, { headers: anonymous })).response.status).toBe(404)
	const verify = await server.call(`/api/auth/invites/${token}/verify`, { method: "POST", headers: anonymous, body: { response: new FakePasskey(server.baseUrl).register(options.body) } })
	expect(verify.response.status).toBe(404)
	expect(passkeyRows(server)).toHaveLength(0)
}, 20000)

test("concurrent registrations with one invite create a single passkey", async () => {
	server = await TestServer.start()
	const { token } = await inviteUser(server)
	const options = await server.call<any>(`/api/auth/invites/${token}/options`, { method: "POST", headers: anonymous, body: {} })
	const attempts = await Promise.all([new FakePasskey(server.baseUrl), new FakePasskey(server.baseUrl)].map((passkey) =>
		server!.call(`/api/auth/invites/${token}/verify`, { method: "POST", headers: anonymous, body: { response: passkey.register(options.body) } })))
	expect(attempts.map((a) => a.response.status).filter((s) => s === 200)).toHaveLength(1)
	expect(passkeyRows(server)).toHaveLength(1)
}, 20000)

test("users remove their own passkeys and sessions started with them end", async () => {
	server = await TestServer.start()
	const { userId, token } = await inviteUser(server)
	const phone = new FakePasskey(server.baseUrl)
	const phoneSession = { Cookie: sessionCookieOf((await registerWith(server, token, phone)).response) }
	const second = await server.call<any>(`/api/users/${userId}/invite`, { method: "POST", body: {} })
	const laptop = new FakePasskey(server.baseUrl)
	const laptopSession = { Cookie: sessionCookieOf((await registerWith(server, second.body.url.split("/invite/")[1], laptop)).response) }

	const listed = await server.call<any[]>("/api/auth/passkeys", { headers: laptopSession })
	expect(listed.body.map((p) => p.id)).toHaveLength(2)
	expect(listed.body[0].transports).toEqual(["internal"])
	expect(listed.body[0].public_key).toBeUndefined()
	expect(listed.body[0].credential_id).toBeUndefined()
	const phoneId = listed.body[0].id

	expect((await server.call<any[]>("/api/auth/passkeys")).body).toHaveLength(0)
	expect((await server.call(`/api/auth/passkeys/${phoneId}`, { method: "DELETE" })).response.status).toBe(404)

	expect((await server.call(`/api/auth/passkeys/${phoneId}`, { method: "DELETE", headers: laptopSession })).response.status).toBe(204)
	expect((await server.call("/api/auth/session", { headers: phoneSession })).response.status).toBe(401)
	expect((await server.call("/api/auth/session", { headers: laptopSession })).response.status).toBe(200)
	expect((await loginWith(server, phone)).response.status).toBe(401)
	expect((await loginWith(server, laptop)).response.status).toBe(200)

	const last = await server.call<any>(`/api/auth/passkeys/${listed.body[1].id}`, { method: "DELETE", headers: laptopSession })
	expect(last.response.status).toBe(409)
	expect(passkeyRows(server)).toHaveLength(1)
}, 20000)

test("admins list and remove a user's passkeys, including the last one", async () => {
	server = await TestServer.start()
	const { userId, token } = await inviteUser(server)
	const passkey = new FakePasskey(server.baseUrl)
	const session = { Cookie: sessionCookieOf((await registerWith(server, token, passkey)).response) }
	const listed = await server.call<any[]>(`/api/users/${userId}/passkeys`)
	expect(listed.body).toHaveLength(1)
	expect((await server.call(`/api/users/${userId}/passkeys`, { headers: session })).response.status).toBe(403)
	expect((await server.call(`/api/users/${userId}/passkeys/${listed.body[0].id}`, { method: "DELETE", headers: session })).response.status).toBe(403)
	expect((await server.call(`/api/users/${userId + 1}/passkeys/${listed.body[0].id}`, { method: "DELETE" })).response.status).toBe(404)
	expect((await server.call(`/api/users/${userId}/passkeys/${listed.body[0].id}`, { method: "DELETE" })).response.status).toBe(204)
	expect((await server.call("/api/auth/session", { headers: session })).response.status).toBe(401)
	expect((await loginWith(server, passkey)).response.status).toBe(401)
	expect(passkeyRows(server)).toHaveLength(0)
}, 20000)

test("users with a password can remove their last passkey", async () => {
	server = await TestServer.start()
	const created = await server.call<any>("/api/users", { method: "POST", body: { name: "Pw", username: "pw", password: "pw-password" } })
	const invite = await server.call<any>(`/api/users/${created.body.id}/invite`, { method: "POST", body: {} })
	const session = { Cookie: sessionCookieOf((await registerWith(server, invite.body.url.split("/invite/")[1], new FakePasskey(server.baseUrl))).response) }
	const password = { Cookie: sessionCookieOf((await server.call("/api/auth/login", { method: "POST", headers: anonymous, body: { username: "pw", password: "pw-password" } })).response) }
	const [passkey] = (await server.call<any[]>("/api/auth/passkeys", { headers: password })).body
	expect((await server.call(`/api/auth/passkeys/${passkey.id}`, { method: "DELETE", headers: password })).response.status).toBe(204)
	expect((await server.call("/api/auth/session", { headers: session })).response.status).toBe(401)
	expect((await server.call("/api/auth/session", { headers: password })).response.status).toBe(200)
}, 20000)

const addPasskey = async (server: TestServer, headers: Record<string, string>, passkey: FakePasskey, overrides = {}) => {
	const options = await server.call<any>("/api/auth/passkeys/options", { method: "POST", headers, body: {} })
	expect(options.response.status).toBe(200)
	return { options: options.body, added: await server.call<any>("/api/auth/passkeys", { method: "POST", headers, body: { response: passkey.register(options.body, overrides) } }) }
}

test("signed-in users add passkeys from settings and log in with them", async () => {
	server = await TestServer.start()
	const passkey = new FakePasskey(server.baseUrl)
	const { options, added } = await addPasskey(server, {}, passkey)
	expect(options.user.name).toBe("test")
	expect(options.excludeCredentials).toEqual([])
	expect(added.response.status).toBe(201)
	expect(added.body).toMatchObject({ transports: ["internal"], last_used_at: null })
	expect(added.body.public_key).toBeUndefined()
	const login = await loginWith(server, passkey)
	expect(login.response.status).toBe(200)
	expect(login.body.user.username).toBe("test")

	const second = await addPasskey(server, {}, new FakePasskey(server.baseUrl))
	expect(second.options.excludeCredentials.map((c: any) => c.id)).toEqual([passkey.id])
	expect((await server.call<any[]>("/api/auth/passkeys")).body).toHaveLength(2)
}, 20000)

test("adding a passkey rejects replays, foreign origins, other users' challenges and API keys", async () => {
	server = await TestServer.start()
	const passkey = new FakePasskey(server.baseUrl)
	const { options, added } = await addPasskey(server, {}, passkey)
	expect(added.response.status).toBe(201)
	const replay = await server.call("/api/auth/passkeys", { method: "POST", body: { response: passkey.register(options) } })
	expect(replay.response.status).toBe(400)

	const options2 = await server.call<any>("/api/auth/passkeys/options", { method: "POST", body: {} })
	expect((await server.call("/api/auth/passkeys", { method: "POST", body: { response: passkey.register(options2.body) } })).response.status).toBe(409)

	expect((await addPasskey(server, {}, new FakePasskey(server.baseUrl), { origin: "https://evil.example" })).added.response.status).toBe(400)

	const { token } = await inviteUser(server)
	const other = { Cookie: sessionCookieOf((await registerWith(server, token, new FakePasskey(server.baseUrl))).response) }
	const adminOptions = await server.call<any>("/api/auth/passkeys/options", { method: "POST", body: {} })
	const stolen = await server.call("/api/auth/passkeys", { method: "POST", headers: other, body: { response: new FakePasskey(server.baseUrl).register(adminOptions.body) } })
	expect(stolen.response.status).toBe(400)

	const key = await server.call<any>("/api/auth/api-keys", { method: "POST", body: { name: "k" } })
	const bearer = { Authorization: `Bearer ${key.body.key}`, Cookie: "" }
	expect((await server.call("/api/auth/passkeys/options", { method: "POST", headers: bearer, body: {} })).response.status).toBe(403)
	expect((await server.call("/api/auth/passkeys/options", { method: "POST", headers: anonymous, body: {} })).response.status).toBe(401)
	expect(passkeyRows(server)).toHaveLength(2)
}, 20000)
