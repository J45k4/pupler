import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

import { CliError } from "./error";

type CliConfig = {
	baseUrl?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

export const resolveConfigPath = (env: NodeJS.ProcessEnv = process.env) => {
	const explicitPath = env.PUPLER_CONFIG_PATH?.trim();
	if (explicitPath) {
		return explicitPath;
	}

	const xdgConfigHome = env.XDG_CONFIG_HOME?.trim();
	if (xdgConfigHome) {
		return join(xdgConfigHome, "pupler", "config.json");
	}

	const home = env.HOME?.trim() || homedir();
	return join(home, ".config", "pupler", "config.json");
};

export const readCliConfig = (
	env: NodeJS.ProcessEnv = process.env,
): CliConfig => {
	const path = resolveConfigPath(env);
	if (!existsSync(path)) {
		return {};
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		throw new CliError(
			`Failed to parse CLI config at ${path}: ${
				error instanceof Error ? error.message : "Unknown error"
			}`,
		);
	}

	if (!isRecord(parsed)) {
		throw new CliError(`CLI config at ${path} must contain a JSON object`);
	}

	const { baseUrl } = parsed;
	if (baseUrl !== undefined && typeof baseUrl !== "string") {
		throw new CliError(`CLI config at ${path} has an invalid \`baseUrl\` value`);
	}

	return { baseUrl };
};

export const writeCliConfig = (
	config: CliConfig,
	env: NodeJS.ProcessEnv = process.env,
) => {
	const path = resolveConfigPath(env);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(config, null, 4)}\n`);
	return path;
};

export const clearCliConfig = (env: NodeJS.ProcessEnv = process.env) => {
	const path = resolveConfigPath(env);
	rmSync(path, { force: true });
	return path;
};
