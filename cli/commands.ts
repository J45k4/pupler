import { existsSync, readFileSync } from "node:fs";

import { clearCliConfig, readCliConfig, resolveConfigPath, writeCliConfig } from "./config";
import { CliError } from "./error";
import {
	normalizeBaseUrl,
	requestBinary,
	requestBody,
	requestJson,
	resolveBaseUrl,
} from "./http";

type FieldType =
	| "string"
	| "integer"
	| "decimal"
	| "boolean"
	| "date"
	| "timestamp";

type FieldSpec = {
	type: FieldType;
	nullable?: boolean;
};

type ResourceConfig = {
	command: string;
	path: string;
	fields: Record<string, FieldSpec>;
	queryFields: Record<string, FieldSpec>;
	hasPicture?: boolean;
};

type FlagValue = string | boolean;
type ParsedArgs = {
	flags: Record<string, FlagValue>;
	positionals: string[];
};

export type GlobalOptions = {
	baseUrlOverride?: string;
	help: boolean;
	json: boolean;
};

export type CommandResult = {
	message?: string;
	payload?: unknown;
};

const RESOURCES: ResourceConfig[] = [
	{
		command: "ingredients",
		path: "/api/ingredients",
		fields: {
			name: { type: "string" },
			default_unit: { type: "string", nullable: true },
		},
		queryFields: {
			id: { type: "integer" },
			name: { type: "string", nullable: true },
			default_unit: { type: "string", nullable: true },
			created_at: { type: "timestamp" },
			updated_at: { type: "timestamp" },
		},
	},
	{
		command: "products",
		path: "/api/products",
		fields: {
			ingredient_id: { type: "integer", nullable: true },
			name: { type: "string" },
			category: { type: "string" },
			barcode: { type: "string", nullable: true },
			default_unit: { type: "string", nullable: true },
			is_perishable: { type: "boolean" },
		},
		queryFields: {
			id: { type: "integer" },
			ingredient_id: { type: "integer", nullable: true },
			name: { type: "string", nullable: true },
			category: { type: "string", nullable: true },
			barcode: { type: "string", nullable: true },
			default_unit: { type: "string", nullable: true },
			is_perishable: { type: "boolean" },
			created_at: { type: "timestamp" },
			updated_at: { type: "timestamp" },
		},
		hasPicture: true,
	},
	{
		command: "product-links",
		path: "/api/product-links",
		fields: {
			product_id: { type: "integer" },
			label: { type: "string" },
			url: { type: "string" },
		},
		queryFields: {
			id: { type: "integer" },
			product_id: { type: "integer" },
			label: { type: "string", nullable: true },
			url: { type: "string", nullable: true },
			created_at: { type: "timestamp" },
		},
	},
	{
		command: "receipts",
		path: "/api/receipts",
		fields: {
			store_name: { type: "string" },
			purchased_at: { type: "timestamp" },
			currency: { type: "string" },
			total_amount: { type: "decimal", nullable: true },
		},
		queryFields: {
			id: { type: "integer" },
			store_name: { type: "string", nullable: true },
			purchased_at: { type: "timestamp" },
			currency: { type: "string", nullable: true },
			total_amount: { type: "decimal", nullable: true },
			created_at: { type: "timestamp" },
			updated_at: { type: "timestamp" },
		},
		hasPicture: true,
	},
	{
		command: "receipt-items",
		path: "/api/receipt-items",
		fields: {
			receipt_id: { type: "integer" },
			product_id: { type: "integer" },
			quantity: { type: "decimal" },
			unit: { type: "string" },
			unit_price: { type: "decimal", nullable: true },
			line_total: { type: "decimal", nullable: true },
		},
		queryFields: {
			id: { type: "integer" },
			receipt_id: { type: "integer" },
			product_id: { type: "integer" },
			quantity: { type: "decimal", nullable: true },
			unit: { type: "string", nullable: true },
			unit_price: { type: "decimal", nullable: true },
			line_total: { type: "decimal", nullable: true },
			created_at: { type: "timestamp" },
		},
	},
	{
		command: "inventory-items",
		path: "/api/inventory-items",
		fields: {
			name: { type: "string" },
			ingredient_id: { type: "integer", nullable: true },
			product_id: { type: "integer", nullable: true },
			receipt_item_id: { type: "integer", nullable: true },
			container_id: { type: "integer", nullable: true },
			quantity: { type: "decimal" },
			unit: { type: "string" },
			purchased_at: { type: "timestamp", nullable: true },
			expires_at: { type: "timestamp", nullable: true },
			consumed_at: { type: "timestamp", nullable: true },
			notes: { type: "string", nullable: true },
		},
		queryFields: {
			id: { type: "integer", nullable: true },
			name: { type: "string", nullable: true },
			ingredient_id: { type: "integer", nullable: true },
			product_id: { type: "integer", nullable: true },
			receipt_item_id: { type: "integer", nullable: true },
			container_id: { type: "integer", nullable: true },
			quantity: { type: "decimal" },
			unit: { type: "string", nullable: true },
			purchased_at: { type: "timestamp", nullable: true },
			expires_at: { type: "timestamp", nullable: true },
			consumed_at: { type: "timestamp", nullable: true },
			notes: { type: "string", nullable: true },
			created_at: { type: "timestamp" },
			updated_at: { type: "timestamp" },
		},
	},
	{
		command: "recipes",
		path: "/api/recipes",
		fields: {
			name: { type: "string" },
			description: { type: "string", nullable: true },
			instructions: { type: "string", nullable: true },
			servings: { type: "integer", nullable: true },
			is_active: { type: "boolean" },
		},
		queryFields: {
			id: { type: "integer", nullable: true },
			name: { type: "string", nullable: true },
			description: { type: "string", nullable: true },
			instructions: { type: "string", nullable: true },
			servings: { type: "integer", nullable: true },
			is_active: { type: "boolean" },
			created_at: { type: "timestamp" },
			updated_at: { type: "timestamp" },
		},
	},
	{
		command: "recipe-ingredients",
		path: "/api/recipe-ingredients",
		fields: {
			recipe_id: { type: "integer" },
			name: { type: "string" },
			ingredient_id: { type: "integer", nullable: true },
			product_id: { type: "integer", nullable: true },
			quantity: { type: "decimal" },
			unit: { type: "string" },
			is_optional: { type: "boolean" },
			notes: { type: "string", nullable: true },
		},
		queryFields: {
			id: { type: "integer" },
			recipe_id: { type: "integer" },
			name: { type: "string", nullable: true },
			ingredient_id: { type: "integer", nullable: true },
			product_id: { type: "integer", nullable: true },
			quantity: { type: "decimal" },
			unit: { type: "string", nullable: true },
			is_optional: { type: "boolean" },
			notes: { type: "string", nullable: true },
			created_at: { type: "timestamp" },
		},
	},
	{
		command: "meal-plan-items",
		path: "/api/meal-plan-items",
		fields: {
			recipe_id: { type: "integer" },
			planned_date: { type: "date" },
			meal_type: { type: "string" },
			servings: { type: "integer" },
			status: { type: "string" },
		},
		queryFields: {
			id: { type: "integer" },
			recipe_id: { type: "integer" },
			planned_date: { type: "date" },
			meal_type: { type: "string", nullable: true },
			servings: { type: "integer" },
			status: { type: "string", nullable: true },
			created_at: { type: "timestamp" },
			updated_at: { type: "timestamp" },
		},
	},
	{
		command: "shopping-list-items",
		path: "/api/shopping-list-items",
		fields: {
			name: { type: "string" },
			ingredient_id: { type: "integer", nullable: true },
			product_id: { type: "integer", nullable: true },
			quantity: { type: "decimal" },
			unit: { type: "string" },
			done: { type: "boolean" },
			source_recipe_id: { type: "integer", nullable: true },
			notes: { type: "string", nullable: true },
		},
		queryFields: {
			id: { type: "integer", nullable: true },
			name: { type: "string", nullable: true },
			ingredient_id: { type: "integer", nullable: true },
			product_id: { type: "integer", nullable: true },
			quantity: { type: "decimal" },
			unit: { type: "string", nullable: true },
			done: { type: "boolean" },
			source_recipe_id: { type: "integer", nullable: true },
			notes: { type: "string", nullable: true },
			created_at: { type: "timestamp" },
			updated_at: { type: "timestamp" },
		},
	},
];

const RESOURCE_MAP = new Map(RESOURCES.map((resource) => [resource.command, resource]));
const RESOURCE_NAMES = RESOURCES.map((resource) => resource.command).join(", ");
const CRUD_COMMANDS = ["list", "get", "create", "replace", "update", "delete"];
const HELP_TEXT = `Pupler CLI

Usage:
  bun ./cli/cli.ts <resource> <command> [args] [flags]
  bun ./cli/cli.ts config <command> [args]

Resources:
  ${RESOURCE_NAMES}

Examples:
  bun ./cli/cli.ts config set-url http://localhost:5995
  bun ./cli/cli.ts ingredients create --name Sausage --default-unit pcs
  bun ./cli/cli.ts products list --barcode 6414893400012
  bun ./cli/cli.ts products create --name Milk --category food --is-perishable true --ingredient-id 1
  bun ./cli/cli.ts receipts create --store-name Prisma --purchased-at 2026-04-14T08:00:00Z --currency EUR
  bun ./cli/cli.ts receipt-items create --receipt-id 1 --product-id 2 --quantity 1 --unit pcs

Global flags:
  --base-url <url>   Override PUPLER_BASE_URL, the config file, or the default http://localhost:5995
  --json             Print raw JSON output
  --help             Show help
`;

const CONFIG_COMMANDS = ["show", "path", "get-url", "set-url", "clear-url"];

const toFlagName = (field: string) => field.replace(/_/g, "-");
const normalizeFlagName = (value: string) => value.replace(/-/g, "_");

const parseBoolean = (raw: string) => {
	const normalized = raw.trim().toLowerCase();
	if (["true", "1", "yes"].includes(normalized)) {
		return true;
	}
	if (["false", "0", "no"].includes(normalized)) {
		return false;
	}
	throw new CliError(`Invalid boolean value \`${raw}\``);
};

const parseInteger = (raw: string) => {
	const parsed = Number.parseInt(raw, 10);
	if (!Number.isInteger(parsed)) {
		throw new CliError(`Invalid integer value \`${raw}\``);
	}
	return parsed;
};

const parseDecimal = (raw: string) => {
	const parsed = Number.parseFloat(raw);
	if (!Number.isFinite(parsed)) {
		throw new CliError(`Invalid decimal value \`${raw}\``);
	}
	return parsed;
};

const parseArgs = (args: string[]): ParsedArgs => {
	const flags: Record<string, FlagValue> = {};
	const positionals: string[] = [];

	for (let index = 0; index < args.length; index += 1) {
		const current = args[index];
		if (!current) {
			continue;
		}

		if (!current.startsWith("--")) {
			positionals.push(current);
			continue;
		}

		const withoutPrefix = current.slice(2);
		const equalIndex = withoutPrefix.indexOf("=");
		if (equalIndex >= 0) {
			const key = normalizeFlagName(withoutPrefix.slice(0, equalIndex));
			flags[key] = withoutPrefix.slice(equalIndex + 1);
			continue;
		}

		const key = normalizeFlagName(withoutPrefix);
		const next = args[index + 1];
		if (next && !next.startsWith("--")) {
			flags[key] = next;
			index += 1;
			continue;
		}
		flags[key] = true;
	}

	return { flags, positionals };
};

const ensureStringFlag = (value: FlagValue | undefined, flagName: string) => {
	if (typeof value !== "string" || !value) {
		throw new CliError(`Flag \`--${toFlagName(flagName)}\` requires a value`);
	}
	return value;
};

const parseFieldValue = (fieldName: string, spec: FieldSpec, value: FlagValue) => {
	if (value === "null") {
		if (!spec.nullable) {
			throw new CliError(`Field \`${fieldName}\` cannot be null`);
		}
		return null;
	}

	switch (spec.type) {
		case "string":
		case "date":
		case "timestamp":
			if (value === true) {
				throw new CliError(`Flag \`--${toFlagName(fieldName)}\` requires a value`);
			}
			return value;
		case "integer":
			if (value === true) {
				throw new CliError(`Flag \`--${toFlagName(fieldName)}\` requires a value`);
			}
			return parseInteger(value);
		case "decimal":
			if (value === true) {
				throw new CliError(`Flag \`--${toFlagName(fieldName)}\` requires a value`);
			}
			return parseDecimal(value);
		case "boolean":
			return value === true ? true : parseBoolean(value);
	}
};

const parseDataPayload = (
	resource: ResourceConfig,
	rawData: FlagValue | undefined,
) => {
	if (rawData === undefined) {
		return {};
	}

	const source = ensureStringFlag(rawData, "data");
	const jsonSource = source.startsWith("@")
		? readFileSync(source.slice(1), "utf8")
		: source;

	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonSource);
	} catch (error) {
		throw new CliError(
			error instanceof Error ? error.message : "Failed to parse JSON data",
		);
	}

	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new CliError("`--data` must contain a JSON object");
	}

	for (const key of Object.keys(parsed)) {
		if (!resource.fields[key]) {
			throw new CliError(
				`Unknown field \`${key}\` for resource \`${resource.command}\``,
			);
		}
	}

	return parsed as Record<string, unknown>;
};

const buildPayload = (
	resource: ResourceConfig,
	flags: Record<string, FlagValue>,
) => {
	const payload = parseDataPayload(resource, flags.data);

	for (const [key, value] of Object.entries(flags)) {
		if (key === "data") {
			continue;
		}

		const field = resource.fields[key];
		if (!field) {
			throw new CliError(
				`Unknown flag \`--${toFlagName(key)}\` for resource \`${resource.command}\``,
			);
		}

		payload[key] = parseFieldValue(key, field, value);
	}

	if (Object.keys(payload).length === 0) {
		throw new CliError("No fields provided");
	}

	return payload;
};

const buildQuery = (
	resource: ResourceConfig,
	flags: Record<string, FlagValue>,
) => {
	const query: Record<string, string | number | boolean | null> = {};

	for (const [key, value] of Object.entries(flags)) {
		if (key === "sort" || key === "order") {
			query[key] = ensureStringFlag(value, key);
			continue;
		}

		const field = resource.queryFields[key];
		if (!field) {
			throw new CliError(
				`Unknown flag \`--${toFlagName(key)}\` for resource \`${resource.command}\``,
			);
		}

		query[key] = parseFieldValue(key, field, value) as
			| string
			| number
			| boolean
			| null;
	}

	return query;
};

const requireId = (positionals: string[], resource: string, command: string) => {
	const rawId = positionals[0];
	if (!rawId) {
		throw new CliError(`Missing id for \`${resource} ${command}\``);
	}
	return parseInteger(rawId);
};

const ensureNoExtraPositionals = (positionals: string[], count: number) => {
	if (positionals.length > count) {
		throw new CliError(`Unexpected argument \`${positionals[count]}\``);
	}
};

const resolveRequestBaseUrl = (globalOptions: GlobalOptions) =>
	resolveBaseUrl(globalOptions.baseUrlOverride);

const renderResourceHelp = (resource: ResourceConfig) => {
	const fields = Object.keys(resource.fields)
		.map((field) => `  --${toFlagName(field)}`)
		.join("\n");
	const commands = [...CRUD_COMMANDS];
	if (resource.hasPicture) {
		commands.push("picture");
	}
	return `Pupler CLI: ${resource.command}

Usage:
  bun ./cli/cli.ts ${resource.command} <command> [args] [flags]

Commands:
  ${commands.join(", ")}

Writable flags:
${fields}
`;
};

const renderCommandHelp = (resource: ResourceConfig, command: string) => {
	const writableFlags = Object.keys(resource.fields)
		.map((field) => `  --${toFlagName(field)}`)
		.join("\n");
	const filterFlags = Object.keys(resource.queryFields)
		.map((field) => `  --${toFlagName(field)}`)
		.join("\n");

	switch (command) {
		case "list":
			return `Usage: bun ./cli/cli.ts ${resource.command} list [filters]

Filters:
${filterFlags}
  --sort
  --order
`;
		case "get":
			return `Usage: bun ./cli/cli.ts ${resource.command} get <id>`;
		case "create":
			return `Usage: bun ./cli/cli.ts ${resource.command} create [flags]

Writable flags:
${writableFlags}
  --data @payload.json
`;
		case "replace":
			return `Usage: bun ./cli/cli.ts ${resource.command} replace <id> [flags]

Writable flags:
${writableFlags}
  --data @payload.json
`;
		case "update":
			return `Usage: bun ./cli/cli.ts ${resource.command} update <id> [flags]

Writable flags:
${writableFlags}
  --data @payload.json
`;
		case "delete":
			return `Usage: bun ./cli/cli.ts ${resource.command} delete <id>`;
		default:
			throw new CliError(`Unknown command \`${command}\``);
	}
};

const renderPictureHelp = (resource: ResourceConfig) => `Usage:
  bun ./cli/cli.ts ${resource.command} picture upload <id> --file /path/to/file
  bun ./cli/cli.ts ${resource.command} picture get <id> --output /path/to/output
  bun ./cli/cli.ts ${resource.command} picture delete <id>
`;

const runPictureCommand = async (
	resource: ResourceConfig,
	args: string[],
	globalOptions: GlobalOptions,
): Promise<CommandResult> => {
	if (!resource.hasPicture) {
		throw new CliError(`Resource \`${resource.command}\` does not support pictures`);
	}

	const action = args[0];
	if (!action || action === "help" || globalOptions.help) {
		return { message: renderPictureHelp(resource) };
	}

	const parsed = parseArgs(args.slice(1));
	const id = requireId(parsed.positionals, `${resource.command} picture`, action);
	ensureNoExtraPositionals(parsed.positionals, 1);
	const baseUrl = resolveRequestBaseUrl(globalOptions);

	if (action === "upload") {
		const filePath = ensureStringFlag(parsed.flags.file, "file");
		if (!existsSync(filePath)) {
			throw new CliError(`File not found: ${filePath}`);
		}

		const formData = new FormData();
		formData.set("file", Bun.file(filePath));
		const response = await requestBody({
			baseUrl,
			path: `${resource.path}/${id}/picture`,
			method: "POST",
			body: formData,
		});
		return { payload: response.data };
	}

	if (action === "get") {
		const outputPath = ensureStringFlag(parsed.flags.output, "output");
		const { bytes, contentType } = await requestBinary({
			baseUrl,
			path: `${resource.path}/${id}/picture`,
		});
		await Bun.write(outputPath, bytes);
		return {
			message: `Saved picture to ${outputPath}`,
			payload: {
				content_type: contentType,
				output_path: outputPath,
				size: bytes.byteLength,
			},
		};
	}

	if (action === "delete") {
		await requestJson({
			baseUrl,
			path: `${resource.path}/${id}/picture`,
			method: "DELETE",
		});
		return {
			message: `Deleted picture for ${resource.command} ${id}`,
			payload: { id, ok: true },
		};
	}

	throw new CliError(`Unknown picture command \`${action}\``);
};

const runResourceCommand = async (
	resource: ResourceConfig,
	command: string,
	args: string[],
	globalOptions: GlobalOptions,
): Promise<CommandResult> => {
	if (command === "picture") {
		return runPictureCommand(resource, args, globalOptions);
	}

	if (!CRUD_COMMANDS.includes(command)) {
		throw new CliError(`Unknown command \`${command}\``);
	}

	if (globalOptions.help || command === "help") {
		return { message: renderCommandHelp(resource, command) };
	}

	const baseUrl = resolveRequestBaseUrl(globalOptions);

	if (command === "list") {
		const parsed = parseArgs(args);
		const payload = await requestJson({
			baseUrl,
			path: resource.path,
			query: buildQuery(resource, parsed.flags),
		});
		return { payload };
	}

	if (command === "get") {
		const parsed = parseArgs(args);
		const id = requireId(parsed.positionals, resource.command, command);
		ensureNoExtraPositionals(parsed.positionals, 1);
		const payload = await requestJson({
			baseUrl,
			path: `${resource.path}/${id}`,
		});
		return { payload };
	}

	if (command === "create") {
		const parsed = parseArgs(args);
		const payload = await requestJson({
			baseUrl,
			path: resource.path,
			method: "POST",
			body: buildPayload(resource, parsed.flags),
		});
		return { payload };
	}

	if (command === "replace" || command === "update") {
		const parsed = parseArgs(args);
		const id = requireId(parsed.positionals, resource.command, command);
		ensureNoExtraPositionals(parsed.positionals, 1);
		const payload = await requestJson({
			baseUrl,
			path: `${resource.path}/${id}`,
			method: command === "replace" ? "PUT" : "PATCH",
			body: buildPayload(resource, parsed.flags),
		});
		return { payload };
	}

	const parsed = parseArgs(args);
	const id = requireId(parsed.positionals, resource.command, command);
	ensureNoExtraPositionals(parsed.positionals, 1);
	await requestJson({
		baseUrl,
		path: `${resource.path}/${id}`,
		method: "DELETE",
	});
	return {
		message: `Deleted ${resource.command} ${id}`,
		payload: { id, ok: true },
	};
};

const renderConfigHelp = () => `Pupler CLI: config

Usage:
  bun ./cli/cli.ts config show
  bun ./cli/cli.ts config path
  bun ./cli/cli.ts config get-url
  bun ./cli/cli.ts config set-url <url>
  bun ./cli/cli.ts config clear-url

Commands:
  ${CONFIG_COMMANDS.join(", ")}
`;

const runConfigCommand = async (
	args: string[],
	globalOptions: GlobalOptions,
): Promise<CommandResult> => {
	const command = args[0];
	if (!command || command === "help" || globalOptions.help) {
		return { message: renderConfigHelp() };
	}

	if (!CONFIG_COMMANDS.includes(command)) {
		throw new CliError(`Unknown config command \`${command}\``);
	}

	if (command === "path") {
		ensureNoExtraPositionals(args.slice(1), 0);
		return {
			payload: {
				config_path: resolveConfigPath(),
			},
		};
	}

	if (command === "show") {
		ensureNoExtraPositionals(args.slice(1), 0);
		const config = readCliConfig();
		return {
			payload: {
				config_path: resolveConfigPath(),
				base_url: config.baseUrl ?? null,
			},
		};
	}

	if (command === "get-url") {
		ensureNoExtraPositionals(args.slice(1), 0);
		const config = readCliConfig();
		if (!config.baseUrl) {
			return {
				message: "No configured base URL",
				payload: {
					base_url: null,
				},
			};
		}
		return {
			payload: {
				base_url: config.baseUrl,
			},
		};
	}

	if (command === "set-url") {
		const url = args[1];
		if (!url) {
			throw new CliError("Missing URL for `config set-url`");
		}
		ensureNoExtraPositionals(args.slice(1), 1);
		const normalized = normalizeBaseUrl(url);
		const path = writeCliConfig({ baseUrl: normalized });
		return {
			message: `Saved base URL to ${path}`,
			payload: {
				base_url: normalized,
				config_path: path,
			},
		};
	}

	ensureNoExtraPositionals(args.slice(1), 0);
	const path = clearCliConfig();
	return {
		message: `Cleared configured base URL from ${path}`,
		payload: {
			base_url: null,
			config_path: path,
		},
	};
};

export const renderRootHelp = () => HELP_TEXT;

export const runCliCommand = async (
	args: string[],
	globalOptions: GlobalOptions,
): Promise<CommandResult> => {
	if (!args.length || args[0] === "help") {
		return { message: renderRootHelp() };
	}

	if (args[0] === "config") {
		return runConfigCommand(args.slice(1), globalOptions);
	}

	const resourceName = args[0];
	const resource = resourceName ? RESOURCE_MAP.get(resourceName) : undefined;
	if (!resource) {
		throw new CliError(`Unknown resource \`${resourceName}\``);
	}

	if (args.length === 1 || args[1] === "help") {
		return { message: renderResourceHelp(resource) };
	}

	const command = args[1];
	if (!command) {
		return { message: renderResourceHelp(resource) };
	}

	return runResourceCommand(resource, command, args.slice(2), globalOptions);
};
