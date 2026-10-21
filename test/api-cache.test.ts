import { expect, test } from "bun:test"
import { ApiReadCache, apiReadCache } from "../src/react/api-cache"
import { apiFetch } from "../src/react/api"

const deferred = <T,>() => Promise.withResolvers<T>()

test("page reads share requests, reuse fresh data, and refresh stale data", async () => {
	let now = 0
	const cache = new ApiReadCache(15_000, 2, () => now)
	const pending = deferred<number>()
	let calls = 0
	const load = () => { calls++; return pending.promise }
	const first = cache.read("items", load, new AbortController().signal)
	const second = cache.read("items", load, new AbortController().signal)
	pending.resolve(1)
	expect(await first).toBe(1)
	expect(await second).toBe(1)
	expect(calls).toBe(1)
	expect(await cache.read("items", async () => 2, new AbortController().signal)).toBe(1)
	now = 15_001
	expect(cache.peek<number>("items")).toBe(1)
	expect(await cache.read("items", async () => 2, new AbortController().signal)).toBe(2)
	expect(await cache.read("items", async () => 3, new AbortController().signal, true)).toBe(3)
	cache.write("other", 4)
	cache.write("third", 5)
	expect(cache.peek("items")).toBeNull()
	now += 5 * 60_000
	expect(cache.peek("third")).toBeNull()
})

test("leaving one page preserves a shared read and leaving the last reader aborts it", async () => {
	const cache = new ApiReadCache()
	const pending = deferred<number>()
	const first = new AbortController()
	const second = new AbortController()
	let networkSignal: AbortSignal | undefined
	const load = (signal: AbortSignal) => { networkSignal = signal; return pending.promise }
	const a = cache.read("items", load, first.signal).catch(error => error)
	const b = cache.read("items", load, second.signal).catch(error => error)
	await Promise.resolve()
	first.abort()
	expect(networkSignal?.aborted).toBe(false)
	second.abort()
	expect(networkSignal?.aborted).toBe(true)
	expect(await a).toBeInstanceOf(DOMException)
	expect(await b).toBeInstanceOf(DOMException)
	pending.resolve(1)
	await Promise.resolve()
	expect(cache.peek("items")).toBeNull()
	expect(await cache.read("items", async () => 2, new AbortController().signal)).toBe(2)
})

test("mutation and account invalidation prevent older responses from repopulating the cache", async () => {
	const cache = new ApiReadCache()
	cache.write("private", "old user")
	const pending = deferred<string>()
	const read = cache.read("items", () => pending.promise, new AbortController().signal)
	cache.clear()
	expect(cache.peek("private")).toBeNull()
	cache.write("items", "updated")
	pending.resolve("outdated")
	expect(await read).toBe("outdated")
	expect(cache.peek<string>("items")).toBe("updated")
})

test("failed reads are retriable and already-aborted reads do not start a request", async () => {
	const cache = new ApiReadCache()
	await expect(cache.read("items", async () => { throw new Error("offline") }, new AbortController().signal)).rejects.toThrow("offline")
	expect(await cache.read("items", async () => 1, new AbortController().signal)).toBe(1)
	const controller = new AbortController()
	controller.abort()
	let called = false
	await expect(cache.read("other", async () => { called = true }, controller.signal)).rejects.toBeInstanceOf(DOMException)
	expect(called).toBe(false)
})

test("JSON and multipart mutations invalidate page data and authentication failures clear private data", async () => {
	const originalFetch = globalThis.fetch
	const requests: RequestInit[] = []
	try {
		globalThis.fetch = (async (_input: RequestInfo | URL, options?: RequestInit) => {
			requests.push(options ?? {})
			return Response.json({ ok: true })
		}) as typeof fetch
		apiReadCache.write("items", [1])
		await apiFetch("/api/items", { method: "POST", body: JSON.stringify({ name: "Item" }) })
		expect(apiReadCache.peek("items")).toBeNull()
		expect(new Headers(requests[0]!.headers).get("content-type")).toBe("application/json")
		apiReadCache.write("items", [1])
		const form = new FormData()
		form.set("file", new File(["image"], "photo.png", { type: "image/png" }))
		await apiFetch("/api/items/1/pictures", { method: "POST", body: form })
		expect(new Headers(requests[1]!.headers).has("content-type")).toBe(false)
		expect(requests[1]!.body).toBe(form)
		expect(apiReadCache.peek("items")).toBeNull()
		apiReadCache.write("items", [1])
		globalThis.fetch = (async (_input: RequestInfo | URL, _options?: RequestInit) => Response.json({ error: "Authentication required" }, { status: 401 })) as typeof fetch
		await expect(apiFetch("/api/items")).rejects.toMatchObject({ status: 401 })
		expect(apiReadCache.peek("items")).toBeNull()
	} finally {
		globalThis.fetch = originalFetch
		apiReadCache.clear()
	}
})
