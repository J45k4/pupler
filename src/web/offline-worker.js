const shellCache = "pupler-shell-__PUPLER_SHELL_VERSION__"
const development = "__PUPLER_ENVIRONMENT__" === "development"
self.addEventListener("install", (event) => {
	if (development) {
		event.waitUntil(self.skipWaiting())
		return
	}
	event.waitUntil(
		(async () => {
			const cache = await caches.open(shellCache)
			const response = await fetch("/", { cache: "reload" })
			if (!response.ok) throw new Error("Could not save Pupler for offline use")
			const html = await response.clone().text()
			const assets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
				.map((match) => new URL(match[1], self.location.origin))
				.filter((url) => url.origin === self.location.origin && /\.(js|css|png)$/.test(url.pathname))
			assets.push(new URL("/favicon.png", self.location.origin))
			await cache.put("/", response)
			await cache.addAll(assets.map((url) => new Request(url.href, { cache: "force-cache" })))
			await self.skipWaiting()
		})(),
	)
})
self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) if (key.startsWith("pupler-shell-") && (development || key !== shellCache)) await caches.delete(key)
			await self.clients.claim()
		})(),
	)
})
self.addEventListener("fetch", (event) => {
	// Bun's development asset URLs can outlive their contents across rebuilds.
	if (development) return
	const url = new URL(event.request.url)
	if (
		event.request.method !== "GET" ||
		url.origin !== self.location.origin ||
		url.pathname.startsWith("/api/") ||
		url.pathname === "/version"
	)
		return
	if (
		event.request.mode === "navigate" &&
		!url.pathname.startsWith("/oauth/") &&
		!url.pathname.startsWith("/.well-known/") &&
		url.pathname !== "/mcp"
	) {
		event.respondWith(
			fetch(event.request)
				.then(async (response) => {
					if (response.ok && response.headers.get("content-type")?.includes("text/html"))
						await (await caches.open(shellCache)).put("/", response.clone())
					if (response.status >= 500) return (await (await caches.open(shellCache)).match("/")) || response
					return response
				})
				.catch(async () => (await caches.open(shellCache)).match("/")),
		)
	} else if (/\.(js|css|png)$/.test(url.pathname)) {
		event.respondWith(
			(async () => {
				const cache = await caches.open(shellCache)
				const saved = await cache.match(event.request)
				if (saved) return saved
				const response = await fetch(event.request)
				if (response.ok) await cache.put(event.request, response.clone())
				return response
			})(),
		)
	}
})
