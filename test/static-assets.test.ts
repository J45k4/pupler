import { expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { acceptsGzip, compressedAssetRoutes } from "../src/web/static-assets"

test("asset encoding negotiation respects explicit gzip rejection", () => {
	for (const header of ["gzip", "br, gzip;q=0.8", "GZIP; q=0.01", "*;q=1"]) expect(acceptsGzip(header)).toBe(true)
	for (const header of ["", "br", "gzip;q=0", "gzip; q=0.000, *;q=1", "*;q=0"]) expect(acceptsGzip(header)).toBe(false)
})

test("production assets compress once and serve negotiated, cacheable and conditional responses", async () => {
	const directory = await mkdtemp(join(tmpdir(), "pupler-assets-"))
	try {
		const path = join(directory, "app-abc123.js")
		const script = "console.log('Pupler');\n".repeat(500)
		await writeFile(path, script)
		const routes = await compressedAssetRoutes({
			index: "index.html",
			files: [{ path, loader: "js", isEntry: true, headers: { etag: "abc123", "content-type": "text/javascript;charset=utf-8" } }],
		})
		const serve = routes["/app-abc123.js"]!
		const compressed = serve(new Request("http://localhost/app-abc123.js", { headers: { "Accept-Encoding": "gzip" } }))
		expect(compressed.headers.get("Content-Encoding")).toBe("gzip")
		expect(compressed.headers.get("Vary")).toBe("Accept-Encoding")
		expect(compressed.headers.get("Cache-Control")).toContain("immutable")
		const bytes = new Uint8Array(await compressed.arrayBuffer())
		expect(bytes.byteLength).toBeLessThan(script.length / 5)
		expect(new TextDecoder().decode(Bun.gunzipSync(bytes))).toBe(script)
		const plain = serve(new Request("http://localhost/app-abc123.js", { headers: { "Accept-Encoding": "gzip;q=0" } }))
		expect(plain.headers.get("Content-Encoding")).toBeNull()
		expect(await plain.text()).toBe(script)
		const cached = serve(
			new Request("http://localhost/app-abc123.js", { headers: { "If-None-Match": compressed.headers.get("ETag")! } }),
		)
		expect(cached.status).toBe(304)
		expect(await cached.text()).toBe("")
		const head = serve(new Request("http://localhost/app-abc123.js", { method: "HEAD", headers: { "Accept-Encoding": "gzip" } }))
		expect(await head.text()).toBe("")
		expect(head.headers.get("Content-Length")).toBe(String(bytes.byteLength))
		expect(serve(new Request("http://localhost/app-abc123.js", { method: "POST" })).status).toBe(405)
	} finally {
		await rm(directory, { recursive: true, force: true })
	}
})
