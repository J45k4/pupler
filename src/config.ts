import { deriveFilesPath } from "./api/core";

type Environment = Record<string, string | undefined>;

export const resolvePuplerVersion = (env: Environment = process.env) =>
	env.PUPLER_VERSION ?? "dev";

export const versionPayload = (env: Environment = process.env) => ({
	version: resolvePuplerVersion(env),
});

export const resolveDatabasePath = (
	override?: string,
	env: Environment = process.env,
) =>
	override ??
	env.DB_PATH ??
	(env.DATA_PATH ? `${env.DATA_PATH}/pupler.db` : "pupler.db");

export const resolveFilesPath = (
	dbPath: string,
	env: Environment = process.env,
) => (env.DATA_PATH ? `${env.DATA_PATH}/files` : deriveFilesPath(dbPath));
