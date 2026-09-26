import { afterEach, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { TestServer } from "./support/test-server"
import { receiptTotals } from "../src/mcp/receipts"

let server: TestServer
afterEach(async () => { await server?.close() })
const hash = (value: string) => createHash("sha256").update(value).digest("hex")
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64")
const sql = <T>(action: (db: Database) => T) => {
	const db = new Database(server.dbPath)
	try { return action(db) } finally { db.close() }
}
const postForm = (path: string, values: Record<string, string>, extraHeaders: Record<string, string> = {}) => fetch(`${server.baseUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", ...extraHeaders }, body: new URLSearchParams(values), redirect: "manual" })
const client = async () => {
	const response = await fetch(`${server.baseUrl}/oauth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_name: "Receipt test", redirect_uris: ["http://127.0.0.1:43123/callback"], token_endpoint_auth_method: "none" }) })
	expect(response.status).toBe(201)
	return response.json() as Promise<{ client_id: string; redirect_uris: string[] }>
}
const registerClient = (forwardedFor: string) => fetch(`${server.baseUrl}/oauth/register`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": forwardedFor }, body: JSON.stringify({ client_name: "Rate test", redirect_uris: ["http://127.0.0.1:43123/callback"] }) })
const pendingAuthorization = async (scope = "receipts:read receipts:write products:read products:write", cookie = server.sessionCookie) => {
	const registered = await client()
	const verifier = "v".repeat(43)
	const values = { response_type: "code", client_id: registered.client_id, redirect_uri: registered.redirect_uris[0]!, resource: `${server.baseUrl}/mcp`, scope, state: "state-for-test", code_challenge_method: "S256", code_challenge: createHash("sha256").update(verifier).digest("base64url") }
	const start = await fetch(`${server.baseUrl}/oauth/authorize?${new URLSearchParams(values)}`, { redirect: "manual" })
	expect(start.status).toBe(303)
	const location = start.headers.get("location")!
	const request = new URL(location, server.baseUrl).searchParams.get("request")!
	const consent = await fetch(`${server.baseUrl}${location}`, { headers: { Cookie: cookie }, redirect: "manual" })
	expect(consent.status).toBe(200)
	await consent.body?.cancel()
	// Provision the one-time form secret directly; test API behavior, not rendered HTML.
	const csrf = "test-form-secret"
	sql(db => db.query("UPDATE oauth_authorizations SET csrf_hash = ? WHERE id = ?").run(hash(csrf), request))
	return { ...values, verifier, request, csrf, cookie }
}
const approve = async (pending: Awaited<ReturnType<typeof pendingAuthorization>>, decision = "allow", scope = pending.scope) => {
	const body = new URLSearchParams({ request: pending.request, csrf: pending.csrf, decision })
	for (const permission of scope.split(" ")) body.append("scope", permission)
	return fetch(`${server.baseUrl}/oauth/authorize`, { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: pending.cookie, Origin: server.baseUrl }, body })
}
const connect = async (scope?: string, cookie?: string) => {
	const pending = await pendingAuthorization(scope, cookie)
	const approval = await approve(pending)
	expect(approval.status).toBe(303)
	const callback = new URL(approval.headers.get("location")!)
	expect(callback.searchParams.get("state")).toBe("state-for-test")
	expect(callback.searchParams.get("iss")).toBe(server.baseUrl)
	const exchange = { grant_type: "authorization_code", code: callback.searchParams.get("code")!, client_id: pending.client_id, redirect_uri: pending.redirect_uri, resource: pending.resource, code_verifier: pending.verifier }
	const response = await postForm("/oauth/token", exchange)
	expect(response.status).toBe(200)
	return { ...await response.json() as { access_token: string; refresh_token: string; scope: string }, client_id: pending.client_id, exchange }
}
const rpc = async (token: string, method: string, params: unknown) => {
	const response = await fetch(`${server.baseUrl}/mcp`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-11-25" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })
	return { response, body: await response.json() as any }
}
const tool = (token: string, name: string, args: unknown = {}) => rpc(token, "tools/call", { name, arguments: args })
const receiptInput = (key: string = crypto.randomUUID()) => ({ store_name: "Test shop", purchased_at: "2026-09-26T12:30:00Z", currency: "EUR", total_amount: 5, idempotency_key: key, lines: [{ new_product: { name: "Milk", category: "food", default_unit: "pcs", is_perishable: true }, quantity: 2, unit: "pcs", unit_price: 2.5, line_total: 5 }] })

test("registration limits each trusted proxy client separately", async () => {
	server = await TestServer.start({ trustedProxyIps: "127.0.0.1" })
	for (let index = 0; index < 20; index++) expect((await registerClient("198.51.100.10")).status).toBe(201)
	expect((await registerClient("198.51.100.99, 198.51.100.10")).status).toBe(429)
	expect((await registerClient("198.51.100.11")).status).toBe(201)
	expect(sql(db => db.query("SELECT COUNT(*) AS count FROM oauth_clients").get() as { count: number })).toEqual({ count: 21 })
}, 20000)

test("registration ignores forwarded addresses from untrusted peers", async () => {
	server = await TestServer.start()
	for (let index = 0; index < 20; index++) expect((await registerClient(`198.51.100.${index + 1}`)).status).toBe(201)
	expect((await registerClient("198.51.100.99")).status).toBe(429)
	expect(sql(db => db.query("SELECT COUNT(*) AS count FROM oauth_clients").get() as { count: number })).toEqual({ count: 20 })
}, 20000)

test("OAuth discovery, SDK initialization, browser authorization, PKCE, refresh and replay revocation", async () => {
	server = await TestServer.start()
	const missing = await fetch(`${server.baseUrl}/mcp`)
	expect(missing.status).toBe(401)
	expect(missing.headers.get("www-authenticate")).toContain("oauth-protected-resource/mcp")
	const metadata = await (await fetch(`${server.baseUrl}/.well-known/oauth-protected-resource/mcp`)).json() as any
	expect(metadata.resource).toBe(`${server.baseUrl}/mcp`)
	const discovery = await (await fetch(`${server.baseUrl}/.well-known/oauth-authorization-server`)).json() as any
	expect(discovery.code_challenge_methods_supported).toEqual(["S256"])
	const connection = await connect()
	const sdk = new Client({ name: "test", version: "1" })
	await sdk.connect(new StreamableHTTPClientTransport(new URL(`${server.baseUrl}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${connection.access_token}` } } }))
	expect((await sdk.listTools()).tools.some(tool => tool.name === "create_receipt")).toBe(true)
	const account = await sdk.callTool({ name: "get_account", arguments: {} })
	expect((account.structuredContent as any).user.username).toBe("test")
	await sdk.close()
	expect((await postForm("/oauth/token", connection.exchange)).status).toBe(400)
	const refreshed = await postForm("/oauth/token", { grant_type: "refresh_token", refresh_token: connection.refresh_token, client_id: connection.client_id, resource: `${server.baseUrl}/mcp` })
	expect(refreshed.status).toBe(200)
	const next = await refreshed.json() as any
	expect(next.refresh_token).not.toBe(connection.refresh_token)
	expect((await tool(next.access_token, "get_account")).response.status).toBe(200)
	expect((await postForm("/oauth/token", { grant_type: "refresh_token", refresh_token: connection.refresh_token, client_id: connection.client_id })).status).toBe(400)
	expect((await tool(next.access_token, "get_account")).response.status).toBe(401)
}, 20000)

test("OAuth rejects wrong redirects, PKCE, resource, consent forgery, code replay and expired tokens", async () => {
	server = await TestServer.start()
	const registered = await client()
	const bad = await fetch(`${server.baseUrl}/oauth/authorize?${new URLSearchParams({ client_id: registered.client_id, redirect_uri: "https://evil.example/callback" })}`, { redirect: "manual" })
	expect(bad.status).toBe(400)
	expect(bad.headers.has("location")).toBe(false)
	const pending = await pendingAuthorization()
	const forged = await postForm("/oauth/authorize", { request: pending.request, csrf: "wrong", decision: "allow", scope: pending.scope }, { Cookie: server.sessionCookie, Origin: server.baseUrl })
	expect(forged.status).toBe(400)
	const cross = await postForm("/oauth/authorize", { request: pending.request, csrf: pending.csrf, decision: "allow", scope: pending.scope }, { Cookie: server.sessionCookie, Origin: "https://evil.example" })
	expect(cross.status).toBe(403)
	const approval = await approve(pending)
	const code = new URL(approval.headers.get("location")!).searchParams.get("code")!
	const exchange = { grant_type: "authorization_code", code, client_id: pending.client_id, redirect_uri: pending.redirect_uri, resource: pending.resource, code_verifier: pending.verifier }
	for (const changes of [{ code_verifier: "x".repeat(43) }, { resource: "https://evil.example/mcp" }, { redirect_uri: "http://127.0.0.1:99/callback" }, { client_id: "other" }]) expect((await postForm("/oauth/token", { ...exchange, ...changes })).status).toBe(400)
	const good = await postForm("/oauth/token", exchange)
	expect(good.status).toBe(200)
	const token = (await good.json() as any).access_token
	sql(db => db.query("UPDATE oauth_tokens SET expires_at = '2000-01-01T00:00:00Z' WHERE hash = ?").run(hash(token)))
	expect((await tool(token, "get_account")).response.status).toBe(401)
	const denied = await approve(await pendingAuthorization(), "deny")
	expect(new URL(denied.headers.get("location")!).searchParams.get("error")).toBe("access_denied")
	expect((await fetch(`${server.baseUrl}/mcp`, { headers: { Cookie: server.sessionCookie } })).status).toBe(401)
}, 20000)

test("receipt import saves original image and lines atomically, retries safely and supports editing", async () => {
	server = await TestServer.start()
	const connection = await connect()
	const prepared = await tool(connection.access_token, "prepare_receipt_image_upload", { filename: "receipt.png", content_type: "image/png" })
	const upload = prepared.body.result.structuredContent
	expect((await fetch(upload.upload_url, { method: "PUT", body: png })).status).toBe(200)
	expect((await fetch(upload.upload_url, { method: "PUT", body: png })).status).toBe(401)
	const preview = await tool(connection.access_token, "get_uploaded_receipt_image", { image_id: upload.image_id })
	expect(preview.body.result.content[0].data).toBe(png.toString("base64"))
	const input = { ...receiptInput(), image_id: upload.image_id }
	const first = await tool(connection.access_token, "create_receipt", input)
	expect(first.body.result.isError).not.toBe(true)
	const receipt = first.body.result.structuredContent
	expect(receipt.receipt_items).toHaveLength(1)
	expect(receipt.totals.difference).toBe(0)
	const retried = await tool(connection.access_token, "create_receipt", input)
	expect(retried.body.result.structuredContent.id).toBe(receipt.id)
	expect((await tool(connection.access_token, "create_receipt", { ...input, store_name: "Different" })).body.result.isError).toBe(true)
	expect(sql(db => db.query("SELECT count(*) AS n FROM receipts").get())).toEqual({ n: 1 })
	// Binary responses are verified through fetch; the app's authenticated endpoint serves the same bytes.
	const original = await fetch(`${server.baseUrl}/api/receipts/${receipt.id}/picture`, { headers: { Cookie: server.sessionCookie } })
	expect(Buffer.from(await original.arrayBuffer())).toEqual(png)
	const productId = receipt.receipt_items[0].product_id
	const append = { receipt_id: receipt.id, idempotency_key: "append", lines: [{ product_id: productId, quantity: 1, unit: "pcs", unit_price: -1, line_total: -1 }] }
	expect((await tool(connection.access_token, "add_receipt_lines", append)).body.result.structuredContent.receipt_items).toHaveLength(2)
	expect((await tool(connection.access_token, "add_receipt_lines", append)).body.result.structuredContent.receipt_items).toHaveLength(2)
	const changed = await tool(connection.access_token, "update_receipt", { receipt_id: receipt.id, changes: { total_amount: 4 } })
	expect(changed.body.result.structuredContent.totals.difference).toBe(0)
	expect((await tool(connection.access_token, "update_receipt_line", { line_id: receipt.receipt_items[0].id, changes: { quantity: 3, line_total: 7.5 } })).body.result.structuredContent.quantity).toBe(3)
	expect((await tool(connection.access_token, "search_products", { query: "Milk" })).body.result.structuredContent.products).toHaveLength(1)
	const replaced = (await tool(connection.access_token, "prepare_receipt_image_upload", { filename: "replacement.png", content_type: "image/png" })).body.result.structuredContent
	await fetch(replaced.upload_url, { method: "PUT", body: png })
	expect((await tool(connection.access_token, "replace_receipt_image", { receipt_id: receipt.id, image_id: replaced.image_id })).body.result.isError).not.toBe(true)
	expect((await tool(connection.access_token, "get_receipt_image", { receipt_id: receipt.id })).body.result.content[0].data).toBe(png.toString("base64"))
	expect((await tool(connection.access_token, "remove_receipt_image", { receipt_id: receipt.id })).body.result.structuredContent.success).toBe(true)
	expect((await tool(connection.access_token, "delete_receipt_line", { line_id: receipt.receipt_items[0].id })).body.result.structuredContent.success).toBe(true)
	expect((await tool(connection.access_token, "delete_receipt", { receipt_id: receipt.id })).body.result.structuredContent.success).toBe(true)
}, 20000)

test("invalid lines roll back product, receipt and image claims; upload checks ownership, bytes and expiry", async () => {
	server = await TestServer.start()
	const connection = await connect()
	const upload = (await tool(connection.access_token, "prepare_receipt_image_upload", { filename: "receipt.png", content_type: "image/png" })).body.result.structuredContent
	expect((await fetch(upload.upload_url, { method: "PUT", body: "not an image" })).status).toBe(400)
	expect((await fetch(upload.upload_url, { method: "PUT", body: Buffer.alloc(10 * 1024 * 1024 + 1) })).status).toBe(413)
	expect((await fetch(upload.upload_url, { method: "PUT", body: png })).status).toBe(200)
	const input = receiptInput()
	const invalid = await tool(connection.access_token, "create_receipt", { ...input, image_id: upload.image_id, lines: [...input.lines, { product_id: 999999, quantity: 1, unit: "pcs" }] })
	expect(invalid.body.result.isError).toBe(true)
	expect(sql(db => db.query("SELECT count(*) AS n FROM receipts").get())).toEqual({ n: 0 })
	expect(sql(db => db.query("SELECT count(*) AS n FROM products").get())).toEqual({ n: 0 })
	expect(sql(db => db.query("SELECT consumed FROM mcp_uploads WHERE id = ?").get(upload.image_id))).toEqual({ consumed: 0 })
	const other = await connect()
	expect((await tool(other.access_token, "create_receipt", { ...input, image_id: upload.image_id })).body.result.isError).toBe(true)
	expect((await tool(other.access_token, "get_uploaded_receipt_image", { image_id: upload.image_id })).body.result.isError).toBe(true)
	const path = sql(db => db.query("SELECT path FROM mcp_uploads WHERE id = ?").get(upload.image_id)) as { path: string }
	sql(db => db.query("UPDATE mcp_uploads SET expires_at = '2000-01-01T00:00:00Z' WHERE id = ?").run(upload.image_id))
	await tool(connection.access_token, "prepare_receipt_image_upload", { filename: "next.png", content_type: "image/png" })
	expect(existsSync(join(server.filesPath, path.path))).toBe(false)
}, 20000)

test("OAuth scope and connection ownership checks prevent privilege escalation and revocation stops uploads", async () => {
	server = await TestServer.start()
	const read = await connect("receipts:read products:read")
	expect((await tool(read.access_token, "create_receipt", receiptInput())).response.status).toBe(403)
	const writer = await connect("receipts:read receipts:write products:read")
	expect((await tool(writer.access_token, "create_receipt", receiptInput())).body.result.isError).toBe(true)
	expect((await server.call("/api/auth/connections", { headers: { Authorization: `Bearer ${writer.access_token}` } })).response.status).toBe(401)
	const all = await connect()
	const upload = (await tool(all.access_token, "prepare_receipt_image_upload", { filename: "receipt.png", content_type: "image/png" })).body.result.structuredContent
	const connections = await server.call<any[]>("/api/auth/connections")
	const grantId = sql(db => db.query("SELECT grant_id FROM oauth_tokens WHERE hash = ?").get(hash(all.access_token))) as { grant_id: string }
	expect(connections.body.some(connection => connection.id === grantId.grant_id)).toBe(true)
	await server.call("/api/users", { method: "POST", body: { name: "Other", username: "other", password: "other-password" } })
	const login = await server.call("/api/auth/login", { method: "POST", body: { username: "other", password: "other-password" } })
	const otherCookie = login.response.headers.get("set-cookie")!.split(";")[0]!
	expect((await server.call(`/api/auth/connections/${grantId.grant_id}`, { method: "DELETE", headers: { Cookie: otherCookie } })).response.status).toBe(404)
	expect((await server.call(`/api/auth/connections/${grantId.grant_id}`, { method: "DELETE" })).response.status).toBe(204)
	expect((await tool(all.access_token, "list_receipts")).response.status).toBe(401)
	expect((await fetch(upload.upload_url, { method: "PUT", body: png })).status).toBe(401)
	expect((await postForm("/oauth/token", { grant_type: "refresh_token", refresh_token: all.refresh_token, client_id: all.client_id })).status).toBe(400)
}, 20000)

test("receipt totals use currency rounding and preserve the printed total", () => {
	expect(receiptTotals("EUR", 0.3, [{ quantity: 1, unit_price: 0.1, line_total: null }, { quantity: 1, unit_price: 0.2, line_total: null }]).difference).toBe(0)
	expect(receiptTotals("EUR", 5, [{ quantity: 1, unit_price: 4, line_total: null }])).toMatchObject({ reported_total: 5, calculated_total: 4, difference: 1 })
	expect(receiptTotals("JPY", 10, [{ quantity: 1, unit_price: 10.2, line_total: null }]).difference).toBe(0)
	expect(receiptTotals("EUR", 5, [{ quantity: 1, unit_price: null, line_total: null }]).calculated_total).toBeNull()
})

test("simultaneous retries commit a single receipt and product", async () => {
	server = await TestServer.start()
	const connection = await connect()
	const input = receiptInput("concurrent-import")
	const results = await Promise.all([tool(connection.access_token, "create_receipt", input), tool(connection.access_token, "create_receipt", input)])
	for (const result of results) expect(result.body.result.isError).not.toBe(true)
	expect(results[0]!.body.result.structuredContent.id).toBe(results[1]!.body.result.structuredContent.id)
	expect(sql(db => db.query("SELECT count(*) AS n FROM receipts").get())).toEqual({ n: 1 })
	expect(sql(db => db.query("SELECT count(*) AS n FROM products").get())).toEqual({ n: 1 })
}, 20000)

test("deleting an account revokes its tokens and leaves abandoned image uploads available for cleanup", async () => {
	server = await TestServer.start()
	const user = await server.call<{ id: number }>("/api/users", { method: "POST", body: { name: "Uploader", username: "uploader", password: "uploader-password" } })
	const login = await server.call("/api/auth/login", { method: "POST", body: { username: "uploader", password: "uploader-password" } })
	const connection = await connect(undefined, login.response.headers.get("set-cookie")!.split(";")[0]!)
	const upload = (await tool(connection.access_token, "prepare_receipt_image_upload", { filename: "receipt.png", content_type: "image/png" })).body.result.structuredContent
	await fetch(upload.upload_url, { method: "PUT", body: png })
	const path = sql(db => db.query("SELECT path FROM mcp_uploads WHERE id = ?").get(upload.image_id)) as { path: string }
	expect((await server.call(`/api/users/${user.body.id}`, { method: "DELETE" })).response.status).toBe(204)
	expect((await tool(connection.access_token, "list_receipts")).response.status).toBe(401)
	expect(sql(db => db.query("SELECT grant_id FROM mcp_uploads WHERE id = ?").get(upload.image_id))).toEqual({ grant_id: null })
	sql(db => db.query("UPDATE mcp_uploads SET expires_at = '2000-01-01T00:00:00Z' WHERE id = ?").run(upload.image_id))
	const admin = await connect()
	await tool(admin.access_token, "prepare_receipt_image_upload", { filename: "next.png", content_type: "image/png" })
	expect(existsSync(join(server.filesPath, path.path))).toBe(false)
}, 20000)
