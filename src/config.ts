import { deriveFilesPath } from "./api/core"

declare const PUPLER_BUILD_VERSION: string

const buildVersion = typeof PUPLER_BUILD_VERSION === "string" ? PUPLER_BUILD_VERSION : "dev"

type Environment = Record<string, string | undefined>

export const resolvePublicOrigin = (env: Environment = process.env) => {
	if (env.PUBLIC_ORIGIN === undefined) return undefined
	try {
		const url = new URL(env.PUBLIC_ORIGIN)
		if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error()
		return url.origin
	} catch {
		throw new Error("PUBLIC_ORIGIN must be an HTTP(S) origin such as https://pupler.example.com, without credentials, a path, query, or fragment")
	}
}

export const resolvePuplerVersion = (env: Environment = process.env) =>
	env.PUPLER_VERSION ?? buildVersion

export const versionPayload = (env: Environment = process.env) => ({
	version: resolvePuplerVersion(env),
})

export const resolveDatabasePath = (
	override?: string,
	env: Environment = process.env,
) =>
	override ??
	env.DB_PATH ??
	(env.DATA_PATH ? `${env.DATA_PATH}/pupler.db` : "pupler.db")

export const resolveFilesPath = (
	dbPath: string,
	env: Environment = process.env,
) => (env.DATA_PATH ? `${env.DATA_PATH}/files` : deriveFilesPath(dbPath))
