import { expect, mock, test } from "bun:test"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"

type WorkerEvent = { request: Request; respondWith: (response: Promise<Response> | Response) => void; waitUntil: (work: Promise<unknown>) => void }
const worker = (development: boolean) => {
	const handlers = new Map<string, (event: Partial<WorkerEvent>) => void>()
	const saved = new Map<string, Response>()
	const deleted: string[] = []
	const cache = {
		match: async (request: Request) => saved.get(request.url)?.clone(),
		put: async (request: Request, response: Response) => { saved.set(request.url, response.clone()) },
	}
	const open = mock(async () => cache)
	const network = mock(async () => new Response("fresh asset"))
	const claim = mock(async () => {})
	const skipWaiting = mock(async () => {})
	const source = readFileSync(new URL("../src/web/offline-worker.js", import.meta.url), "utf8").replace("__PUPLER_SHELL_VERSION__", "test").replace("__PUPLER_ENVIRONMENT__", development ? "development" : "production")
	runInNewContext(source, {
		URL, Request, fetch: network,
		self: { location: { origin: "http://localhost:5995" }, clients: { claim }, skipWaiting, addEventListener: (name: string, handler: (event: Partial<WorkerEvent>) => void) => handlers.set(name, handler) },
		caches: { open, keys: async () => ["pupler-shell-old", "pupler-shell-test", "unrelated"], delete: async (name: string) => { deleted.push(name); return true } },
	})
	const dispatch = async (name: string, request?: Request) => {
		let response: Promise<Response> | Response | undefined
		let work: Promise<unknown> | undefined
		handlers.get(name)!({ request, respondWith: value => { response = value }, waitUntil: value => { work = value } })
		await work
		return response
	}
	return { dispatch, saved, deleted, open, network, claim, skipWaiting }
}

test("development worker leaves assets and navigation to the network", async () => {
	const active = worker(true)
	await active.dispatch("install")
	expect(active.skipWaiting).toHaveBeenCalledTimes(1)
	for (const path of ["/_bun/asset/reused.css", "/_bun/asset/reused.js", "/receipts"]) expect(await active.dispatch("fetch", new Request(`http://localhost:5995${path}`))).toBeUndefined()
	expect(active.open).not.toHaveBeenCalled()
	expect(active.network).not.toHaveBeenCalled()
})

test("development activation removes only Pupler shell caches and takes control", async () => {
	const active = worker(true)
	await active.dispatch("activate")
	expect(active.deleted).toEqual(["pupler-shell-old", "pupler-shell-test"])
	expect(active.claim).toHaveBeenCalledTimes(1)
})

test("production still serves saved assets and caches missing assets", async () => {
	const active = worker(false)
	const cached = new Request("http://localhost:5995/app-hashed.css")
	active.saved.set(cached.url, new Response("saved asset"))
	expect(await (await active.dispatch("fetch", cached))?.text()).toBe("saved asset")
	expect(active.network).not.toHaveBeenCalled()
	const missing = new Request("http://localhost:5995/app-hashed.js")
	expect(await (await active.dispatch("fetch", missing))?.text()).toBe("fresh asset")
	expect(active.network).toHaveBeenCalledTimes(1)
	expect(await active.saved.get(missing.url)?.text()).toBe("fresh asset")
	await active.dispatch("activate")
	expect(active.deleted).toEqual(["pupler-shell-old"])
})
