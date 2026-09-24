import { readFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, expect, test } from "bun:test"

import { projectRoot, TestServer } from "./support/test-server"
import { compareReleaseVersions } from "../src/api/update"
import { resolvePublicOrigin } from "../src/config"

let server: TestServer | null = null

test("time ownership isolates cookies and API keys while preserving administrator access", async () => {
	server = await TestServer.start()
	const project = await server.call<{ id: number }>("/api/projects", { method: "POST", body: { name: "Ownership" } })
	const accounts = []
	for (const username of ["alice", "bob"]) {
		const user = await server.call<{ id: number }>("/api/users", { method: "POST", body: { name: username, username, password: "ownership-password", is_admin: false } })
		const login = await server.call("/api/auth/login", { method: "POST", body: { username, password: "ownership-password" } })
		accounts.push({ id: user.body.id, headers: { Cookie: login.response.headers.get("set-cookie")!.split(";")[0]! } })
	}
	const [alice, bob] = accounts
	const key = await server.call<{ key: string }>("/api/auth/api-keys", { method: "POST", headers: alice!.headers, body: { name: "Ownership" } })
	const bobEntry = await server.call<{ id: number; user_id: number }>("/api/time-entries/start", { method: "POST", headers: bob!.headers, body: { project_id: project.body.id } })
	expect(bobEntry.body.user_id).toBe(bob!.id)
	const unassigned = await server.call<{ id: number }>("/api/time-entries", { method: "POST", body: { project_id: project.body.id, started_at: "2026-01-01T00:00:00.000Z", ended_at: "2026-01-01T01:00:00.000Z" } })
	for (const headers of [alice!.headers, { Cookie: "", Authorization: `Bearer ${key.body.key}` }]) {
		const own = await server.call<{ id: number; user_id: number }>("/api/time-entries/start", { method: "POST", headers, body: { project_id: project.body.id } })
		expect(own.response.status).toBe(201)
		expect(own.body.user_id).toBe(alice!.id)
		const listed = await server.call<Array<{ user_id: number }>>("/api/time-entries", { headers })
		expect(listed.body.every(entry => entry.user_id === alice!.id)).toBe(true)
		for (const id of [bobEntry.body.id, unassigned.body.id]) {
			for (const method of ["GET", "PUT", "PATCH", "DELETE"]) expect((await server.call(`/api/time-entries/${id}`, { method, headers, ...(method === "PUT" || method === "PATCH" ? { body: {} } : {}) })).response.status).toBe(404)
			expect((await server.call(`/api/time-entries/${id}/stop`, { method: "POST", headers, body: {} })).response.status).toBe(404)
		}
		for (const owner of [bob!.id, null]) {
			expect((await server.call("/api/time-entries/start", { method: "POST", headers, body: { user_id: owner } })).response.status).toBe(403)
			expect((await server.call("/api/time-entries", { method: "POST", headers, body: { user_id: owner } })).response.status).toBe(403)
			for (const method of ["PUT", "PATCH"]) expect((await server.call(`/api/time-entries/${own.body.id}`, { method, headers, body: { user_id: owner } })).response.status).toBe(403)
			for (const path of ["/api/time-entries", "/api/time-report"]) expect((await server.call(`${path}?user_id=${owner}`, { headers })).response.status).toBe(403)
		}
		const report = await server.call<{ period: { user_id: number }; running_entry: { id: number } }>("/api/time-report", { headers })
		expect(report.body.period.user_id).toBe(alice!.id)
		expect(report.body.running_entry.id).toBe(own.body.id)
		expect((await server.call(`/api/time-entries/${own.body.id}`, { method: "PATCH", headers, body: { description: "Mine" } })).response.status).toBe(200)
		expect((await server.call(`/api/time-entries/${own.body.id}/stop`, { method: "POST", headers, body: {} })).response.status).toBe(200)
		expect((await server.call(`/api/time-entries/${own.body.id}`, { method: "DELETE", headers })).response.status).toBe(204)
	}
	const other = await server.call<{ ended_at: string | null }>(`/api/time-entries/${bobEntry.body.id}`)
	expect(other.body.ended_at).toBeNull()
	expect((await server.call(`/api/time-entries/${bobEntry.body.id}/stop`, { method: "POST", body: {} })).response.status).toBe(200)
}, 20000)

afterEach(async () => {
	await server?.close()
	server = null
})

const protectedPaths = [...readFileSync(join(projectRoot, "src/main.ts"), "utf8").matchAll(/"(\/(?:api\/[^"\s]+|version))":/g)]
	.map((match) => match[1]!)
	.filter((path) => !["/api/auth/login", "/api/auth/logout", "/api/auth/session", "/api/*"].includes(path))
	.map((path) => path.replaceAll(":id", "1").replaceAll(":pictureId", "1"))

test("every protected HTTP route rejects unauthenticated requests before method or input handling", async () => {
	server = await TestServer.start()
	const credentials: Record<string, string>[] = [
		{},
		{ Cookie: "pupler_session=invalid" },
		{ Authorization: "Bearer invalid", Cookie: server.sessionCookie },
	]
	for (const path of protectedPaths) {
		for (const method of ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"]) {
			for (const headers of credentials) {
				const response = await fetch(`${server.baseUrl}${path}`, { method, headers })
				expect(response.status, `${method} ${path} with ${JSON.stringify(headers)}`).toBe(401)
				await response.body?.cancel()
			}
		}
	}
})

test("cookie-authenticated mutations reject cross-origin browser requests", async () => {
	server = await TestServer.start()
	for (const path of ["/api/auth/logout", "/api/products", "/api/auth/password"]) {
		for (const headers of [
			{ Origin: "https://evil.example" },
			{ "Sec-Fetch-Site": "cross-site" },
		] as Record<string, string>[]) {
			const response = await server.call(path, { method: "POST", headers, body: {} })
			expect(response.response.status).toBe(403)
		}
	}
	const session = await server.call("/api/auth/session")
	expect(session.response.status).toBe(200)
	expect(session.response.headers.get("cache-control")).toBe("no-store")
})

test("PUBLIC_ORIGIN permits HTTPS proxy mutations and rejects other origins and forged forwarding headers", async () => {
	const publicOrigin = "https://pupler.example.com:8443"
	server = await TestServer.start({ publicOrigin: `${publicOrigin}/` })
	const createProduct = (headers: Record<string, string>) => server!.call("/api/products", {
		method: "POST", headers,
		body: { name: "Proxy test", category: "food", default_unit: "pcs", is_perishable: false },
	})
	expect((await createProduct({ Origin: publicOrigin, "Sec-Fetch-Site": "same-origin" })).response.status).toBe(201)
	for (const origin of [server.baseUrl, "http://pupler.example.com:8443", "https://pupler.example.com", "https://evil.example", "null"]) {
		expect((await createProduct({ Origin: origin, "X-Forwarded-Host": "pupler.example.com:8443", "X-Forwarded-Proto": "https" })).response.status).toBe(403)
	}
	expect((await createProduct({ Origin: publicOrigin, "Sec-Fetch-Site": "cross-site" })).response.status).toBe(403)
	const login = await fetch(`${server.baseUrl}/api/auth/login`, {
		method: "POST", headers: { Origin: publicOrigin, "Content-Type": "application/json" },
		body: JSON.stringify({ username: "test", password: "test-password" }),
	})
	expect(login.status).toBe(200)
})

test("PUBLIC_ORIGIN rejects invalid configuration", () => {
	expect(resolvePublicOrigin({})).toBeUndefined()
	expect(resolvePublicOrigin({ PUBLIC_ORIGIN: "https://pupler.example.com/" })).toBe("https://pupler.example.com")
	for (const value of ["", "pupler.example.com", "*", "null", "ftp://pupler.example.com", "https://user:password@pupler.example.com", "https://pupler.example.com/path", "https://pupler.example.com?query=1", "https://pupler.example.com#fragment"]) {
		expect(() => resolvePublicOrigin({ PUBLIC_ORIGIN: value })).toThrow("PUBLIC_ORIGIN must be")
	}
})

test("active content cannot be uploaded or served inline as an image", async () => {
	server = await TestServer.start()
	const created = await server.call<{ id: number }>("/api/products", {
		method: "POST",
		body: { name: "Security test", category: "food", barcode: "security-test", default_unit: "pcs", is_perishable: false },
	})
	expect(created.response.status).toBe(201)
	const svg = new FormData()
	svg.set("file", new File(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], "attack.svg", { type: "image/svg+xml" }))
	const upload = await server.call(`/api/products/${created.body.id}/picture`, { method: "POST", body: svg })
	expect(upload.response.status).toBe(400)
	const image = new FormData()
	image.set("file", new File([new Uint8Array([137, 80, 78, 71])], "safe.png", { type: "image/png" }))
	expect((await server.call(`/api/products/${created.body.id}/picture`, { method: "POST", body: image })).response.status).toBe(200)
	const response = await fetch(`${server.baseUrl}/api/products/${created.body.id}/picture`, { headers: { Cookie: server.sessionCookie } })
	expect(response.headers.get("x-content-type-options")).toBe("nosniff")
	expect(response.headers.get("content-security-policy")).toBe("sandbox")
})

test("in-app updates are admin-only and unavailable in source-server mode", async () => {
	server = await TestServer.start()
	const response = await server.call<{ supported: boolean; version: string }>("/api/update")
	expect(response.response.status).toBe(200)
	expect(response.body.supported).toBe(false)
	const checked = await server.call<{ supported: boolean; available: boolean }>("/api/update?check=1")
	expect(checked.response.status).toBe(200)
	expect(checked.body.supported).toBe(false)
	expect(checked.body.available).toBe(false)
	expect((await server.call("/api/update?check=1", { headers: { Cookie: "" } })).response.status).toBe(401)
	await server.call("/api/users", { method: "POST", body: { name: "Viewer", username: "update-viewer", password: "viewer-password", is_admin: false } })
	const login = await server.call("/api/auth/login", { method: "POST", body: { username: "update-viewer", password: "viewer-password" } })
	const cookie = login.response.headers.get("set-cookie")!.split(";")[0]!
	expect((await server.call("/api/update?check=1", { headers: { Cookie: cookie } })).response.status).toBe(403)
	expect((await server.call("/api/update", { method: "POST" })).response.status).toBe(409)
	expect((await server.call("/api/update", { headers: { Authorization: "Bearer invalid", Cookie: server.sessionCookie } })).response.status).toBe(401)
	expect(compareReleaseVersions("v0.0.3", "v0.0.2")).toBe(1)
	expect(compareReleaseVersions("v0.0.2", "v0.0.2")).toBe(0)
	expect(compareReleaseVersions("v0.0.3", "v0.0.3-local.1")).toBe(1)
	expect(compareReleaseVersions("dev", "v0.0.2")).toBeNull()
})
