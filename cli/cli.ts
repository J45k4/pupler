#!/usr/bin/env bun

import { printHuman, printJson } from "./format";
import { CliError } from "./error";
import { renderRootHelp, runCliCommand } from "./commands";

const extractGlobalOptions = (argv: string[]) => {
	let baseUrl: string | undefined;
	let json = false;
	let help = false;
	const remaining: string[] = [];

	for (let index = 0; index < argv.length; index += 1) {
		const current = argv[index];
		if (!current) {
			continue;
		}

		if (current === "--json") {
			json = true;
			continue;
		}

		if (current === "--help" || current === "-h") {
			help = true;
			continue;
		}

		if (current === "--base-url") {
			const next = argv[index + 1];
			if (!next) {
				throw new CliError("Flag `--base-url` requires a value");
			}
			baseUrl = next;
			index += 1;
			continue;
		}

		if (current.startsWith("--base-url=")) {
			baseUrl = current.slice("--base-url=".length);
			continue;
		}

		remaining.push(current);
	}

	return {
		args: remaining,
		options: {
			baseUrlOverride: baseUrl,
			help,
			json,
		},
	};
};

const main = async () => {
	const { args, options } = extractGlobalOptions(Bun.argv.slice(2));

	if (!args.length && options.help) {
		console.log(renderRootHelp());
		return;
	}

	const result = await runCliCommand(args, options);
	if (options.json && result.payload !== undefined) {
		printJson(result.payload);
		return;
	}

	if (result.payload !== undefined) {
		printHuman(result.payload);
	}

	if (result.message) {
		if (result.payload !== undefined) {
			console.log("");
		}
		console.log(result.message);
	}
};

try {
	await main();
} catch (error) {
	if (error instanceof CliError) {
		console.error(error.message);
		process.exit(error.exitCode);
	}

	console.error(error instanceof Error ? error.message : "Unknown CLI error");
	process.exit(1);
}
