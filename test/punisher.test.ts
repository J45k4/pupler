import { readFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, expect, test } from "bun:test"

import { projectRoot, TestServer } from "./support/test-server"
import { compareReleaseVersions } from "../src/api/update"
import { resolvePublicOrigin } from "../src/config"

let server: TestServer | null = null

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
	expect((await server.call("/api/update", { method: "POST" })).response.status).toBe(409)
	expect((await server.call("/api/update", { headers: { Authorization: "Bearer invalid", Cookie: server.sessionCookie } })).response.status).toBe(401)
	expect(compareReleaseVersions("v0.0.3", "v0.0.2")).toBe(1)
	expect(compareReleaseVersions("v0.0.2", "v0.0.2")).toBe(0)
	expect(compareReleaseVersions("v0.0.3", "v0.0.3-local.1")).toBe(1)
	expect(compareReleaseVersions("dev", "v0.0.2")).toBeNull()
})
