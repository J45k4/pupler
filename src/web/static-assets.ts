import { basename } from "node:path"

export const acceptsGzip = (header: string) => {
	const encodings = header
		.toLowerCase()
		.split(",")
		.map((value) => value.trim().split(";"))
	const encoding = encodings.find((value) => value[0] === "gzip") ?? encodings.find((value) => value[0] === "*")
	return !!encoding && !encoding.slice(1).some((value) => /^\s*q\s*=\s*0(?:\.0*)?\s*$/.test(value!))
}

export const compressedAssetRoutes = async (bundle: Bun.HTMLBundle) => {
	const routes: Record<string, (request: Request) => Response> = {}
	for (const file of bundle.files ?? []) {
		if (file.loader === "html") continue
		const content = new Uint8Array(await Bun.file(file.path).arrayBuffer())
		const compressed = ["js", "css"].includes(file.loader) ? Bun.gzipSync(content, { level: 9 }) : null
		routes[`/${basename(file.path)}`] = (request) => {
			if (!["GET", "HEAD"].includes(request.method)) return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } })
			const gzip = compressed !== null && acceptsGzip(request.headers.get("accept-encoding") ?? "")
			const headers = new Headers({
				...file.headers,
				"Cache-Control": "public, max-age=31536000, immutable",
				Vary: "Accept-Encoding",
			})
			const etag = `W/"${file.headers.etag.replaceAll('"', "")}"`
			headers.set("ETag", etag)
			if (gzip) headers.set("Content-Encoding", "gzip")
			if (
				request.headers
					.get("if-none-match")
					?.split(",")
					.some((value) => value.trim() === etag || value.trim() === "*")
			)
				return new Response(null, { status: 304, headers })
			const body = gzip ? compressed! : content
			headers.set("Content-Length", String(body.byteLength))
			return new Response(request.method === "HEAD" ? null : body, { headers })
		}
	}
	return routes
}
