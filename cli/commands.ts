import { existsSync, readFileSync } from "node:fs"

import {
	clearCliConfig,
	readCliConfig,
	resolveConfigPath,
	writeCliConfig,
} from "./config"
import { CliError } from "./error"
import {
	normalizeBaseUrl,
	requestBinary,
	bootstrapCli,
	loginCli,
	requestBody,
	requestJson,
	resolveBaseUrl,
} from "./http"

type FieldType =
	"string" | "integer" | "decimal" | "boolean" | "date" | "timestamp"

type FieldSpec = {
	type: FieldType
	nullable?: boolean
}

type ResourceConfig = {
	command: string
	path: string
	fields: Record<string, FieldSpec>
	queryFields: Record<string, FieldSpec>
	hasPicture?: boolean
}

type FlagValue = string | true
type ParsedArgs = {
	flags: Record<string, FlagValue>
	positionals: string[]
}

export type GlobalOptions = {
	baseUrlOverride?: string
	username?: string
	password?: string
	help: boolean
	json: boolean
}

export type CommandResult = {
	message?: string
	payload?: unknown
}

const RESOURCES: ResourceConfig[] = [
	{
		command: "groups",
		path: "/api/groups",
		fields: {
			name: { type: "string" },
		},
		queryFields: {
			id: { type: "integer" },
			name: { type: "string" },
			created_at: { type: "timestamp" },
			updated_at: { type: "timestamp" },
		},
	},
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
			group_id: { type: "integer", nullable: true },
			store_name: { type: "string" },
			purchased_at: { type: "timestamp" },
			currency: { type: "string" },
			total_amount: { type: "decimal", nullable: true },
		},
		queryFields: {
			id: { type: "integer" },
			group_id: { type: "integer", nullable: true },
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
	{
		command: "todos",
		path: "/api/todos",
		fields: {
			title: { type: "string" },
			notes: { type: "string", nullable: true },
			status: { type: "integer" },
			due_at: { type: "timestamp", nullable: true },
			completed_at: { type: "timestamp", nullable: true },
		},
		queryFields: {
			id: { type: "integer" },
			title: { type: "string", nullable: true },
			notes: { type: "string", nullable: true },
			status: { type: "integer" },
			due_at: { type: "timestamp", nullable: true },
			completed_at: { type: "timestamp", nullable: true },
			created_at: { type: "timestamp" },
			updated_at: { type: "timestamp" },
		},
	},
	{
		command: "users",
		path: "/api/users",
		fields: {
			name: { type: "string" },
			username: { type: "string", nullable: true },
			email: { type: "string", nullable: true },
			password_hash: { type: "string", nullable: true },
			is_admin: { type: "boolean" },
		},
		queryFields: {
			id: { type: "integer" },
			name: { type: "string", nullable: true },
			username: { type: "string", nullable: true },
			email: { type: "string", nullable: true },
			is_admin: { type: "boolean" },
			created_at: { type: "timestamp" },
			updated_at: { type: "timestamp" },
		},
	},
	{
		command: "clients",
		path: "/api/clients",
		fields: {
			name: { type: "string" },
			color: { type: "string" },
			archived_at: { type: "timestamp", nullable: true },
		},
		queryFields: {
			id: { type: "integer" },
			name: { type: "string", nullable: true },
			color: { type: "string", nullable: true },
			archived_at: { type: "timestamp", nullable: true },
			created_at: { type: "timestamp" },
			updated_at: { type: "timestamp" },
		},
	},
	{
		command: "projects",
		path: "/api/projects",
		fields: {
			client_id: { type: "integer", nullable: true },
			name: { type: "string" },
			color: { type: "string" },
			archived_at: { type: "timestamp", nullable: true },
		},
		queryFields: {
			id: { type: "integer" },
			client_id: { type: "integer", nullable: true },
			name: { type: "string", nullable: true },
			color: { type: "string", nullable: true },
			archived_at: { type: "timestamp", nullable: true },
			created_at: { type: "timestamp" },
			updated_at: { type: "timestamp" },
		},
	},
	{
		command: "time-entries",
		path: "/api/time-entries",
		fields: {
			user_id: { type: "integer", nullable: true },
			project_id: { type: "integer", nullable: true },
			description: { type: "string", nullable: true },
			started_at: { type: "timestamp" },
			ended_at: { type: "timestamp", nullable: true },
		},
		queryFields: {
			id: { type: "integer" },
			user_id: { type: "integer", nullable: true },
			project_id: { type: "integer", nullable: true },
			description: { type: "string", nullable: true },
			started_at: { type: "timestamp", nullable: true },
			ended_at: { type: "timestamp", nullable: true },
			running: { type: "boolean" },
			from: { type: "timestamp" },
			to: { type: "timestamp" },
			created_at: { type: "timestamp" },
			updated_at: { type: "timestamp" },
		},
	},
]

const RESOURCE_MAP = new Map(
	RESOURCES.map((resource) => [resource.command, resource]),
)
const RESOURCE_NAMES = RESOURCES.map((resource) => resource.command).join(", ")
const CRUD_COMMANDS = ["list", "get", "create", "replace", "update", "delete"]
const TIME_ENTRY_COMMANDS = [...CRUD_COMMANDS, "start", "stop"]
const PROJECT_COMMANDS = [...CRUD_COMMANDS, "merge"]
const HELP_TEXT = `Pupler CLI

Usage:
  bun ./cli/cli.ts <resource> <command> [args] [flags]
  bun ./cli/cli.ts config <command> [args]

Resources:
  ${RESOURCE_NAMES}
  auth bootstrap
  integrations clockify configure
  imports clockify schedule|run

Examples:
  bun ./cli/cli.ts config set-url http://localhost:5995
  bun ./cli/cli.ts ingredients create --name Sausage --default-unit pcs
  bun ./cli/cli.ts groups create --name grocery
  bun ./cli/cli.ts products list --barcode 6414893400012
  bun ./cli/cli.ts products create --name Milk --category food --is-perishable true --ingredient-id 1
  bun ./cli/cli.ts receipts create --store-name Prisma --purchased-at 2026-04-14T08:00:00Z --currency EUR --group-id 1
  bun ./cli/cli.ts receipt-items create --receipt-id 1 --product-id 2 --quantity 1 --unit pcs

Global flags:
  --base-url <url>   Override PUPLER_BASE_URL, the config file, or the default http://localhost:5995
  --username <name>  Username for protected API requests
  --password <pass>  Password for protected API requests
  --json             Print raw JSON output
  --help             Show help
`

const CONFIG_COMMANDS = ["show", "path", "get-url", "set-url", "clear-url"]
const IMPORT_SCHEDULE_CADENCES: Record<string, number> = {
	manual: 1,
	hourly: 2,
	daily: 3,
	weekly: 4,
}
const JOB_STATUS = {
	Pending: 1,
	Running: 2,
	Completed: 3,
	Failed: 4,
} as const

const toFlagName = (field: string) => field.replace(/_/g, "-")
const normalizeFlagName = (value: string) => value.replace(/-/g, "_")

const describeFieldValue = (spec: FieldSpec) => {
	const base =
		spec.type === "boolean"
			? "true|false"
			: spec.type === "date"
				? "YYYY-MM-DD"
				: spec.type === "timestamp"
					? "ISO timestamp"
					: spec.type
	return `<${spec.nullable ? `${base}|null` : base}>`
}

const renderFieldFlags = (fields: Record<string, FieldSpec>) =>
	Object.entries(fields)
		.map(
			([field, spec]) =>
				`  --${toFlagName(field)} ${describeFieldValue(spec)}`,
		)
		.join("\n")

const renderResourceExamples = (resource: ResourceConfig) => {
	if (resource.command === "projects") {
		return `
Common project workflows:
  # Move all time entries from project 8 into keeper project 3, then archive project 8
  bun ./cli/cli.ts projects merge 3 --source-id 8

  # Delete the duplicate after moving its time entries
  bun ./cli/cli.ts projects merge 3 --source-id 8 --delete-source true --archive-source false
`
	}

	if (resource.command !== "inventory-items") {
		return ""
	}

	return `
Common inventory item workflows:
  # Find IDs before linking
  bun ./cli/cli.ts products list --name Milk
  bun ./cli/cli.ts receipt-items list --receipt-id 1
  bun ./cli/cli.ts inventory-items list --name Milk

  # Link an inventory item to a product or receipt line
  bun ./cli/cli.ts inventory-items update 7 --product-id 42
  bun ./cli/cli.ts inventory-items update 7 --receipt-item-id 17

  # Link both at once
  bun ./cli/cli.ts inventory-items update 7 --product-id 42 --receipt-item-id 17

  # Clear links or optional timestamps with null
  bun ./cli/cli.ts inventory-items update 7 --product-id null
  bun ./cli/cli.ts inventory-items update 7 --receipt-item-id null

  # Set or clear an expiration date
  bun ./cli/cli.ts inventory-items update 7 --expires-at 2026-05-01T00:00:00.000Z
  bun ./cli/cli.ts inventory-items update 7 --expires-at null

Notes:
  --product-id links to a products row.
  --receipt-item-id links to a receipt-items row.
  Timestamp flags expect ISO timestamp strings.
`
}

const parseBoolean = (raw: string) => {
	const normalized = raw.trim().toLowerCase()
	if (["true", "1", "yes"].includes(normalized)) {
		return true
	}
	if (["false", "0", "no"].includes(normalized)) {
		return false
	}
	throw new CliError(`Invalid boolean value \`${raw}\``)
}

const parseInteger = (raw: string) => {
	const parsed = Number.parseInt(raw, 10)
	if (!Number.isInteger(parsed)) {
		throw new CliError(`Invalid integer value \`${raw}\``)
	}
	return parsed
}

const parseDecimal = (raw: string) => {
	const parsed = Number.parseFloat(raw)
	if (!Number.isFinite(parsed)) {
		throw new CliError(`Invalid decimal value \`${raw}\``)
	}
	return parsed
}

const parseArgs = (args: string[]): ParsedArgs => {
	const flags: Record<string, FlagValue> = {}
	const positionals: string[] = []

	for (let index = 0; index < args.length; index += 1) {
		const current = args[index]
		if (!current) {
			continue
		}

		if (!current.startsWith("--")) {
			positionals.push(current)
			continue
		}

		const withoutPrefix = current.slice(2)
		const equalIndex = withoutPrefix.indexOf("=")
		if (equalIndex >= 0) {
			const key = normalizeFlagName(withoutPrefix.slice(0, equalIndex))
			flags[key] = withoutPrefix.slice(equalIndex + 1)
			continue
		}

		const key = normalizeFlagName(withoutPrefix)
		const next = args[index + 1]
		if (next && !next.startsWith("--")) {
			flags[key] = next
			index += 1
			continue
		}
		flags[key] = true
	}

	return { flags, positionals }
}

const ensureStringFlag = (value: FlagValue | undefined, flagName: string) => {
	if (typeof value !== "string" || !value) {
		throw new CliError(
			`Flag \`--${toFlagName(flagName)}\` requires a value`,
		)
	}
	return value
}

const parseFieldValue = (
	fieldName: string,
	spec: FieldSpec,
	value: FlagValue,
) => {
	if (value === "null") {
		if (!spec.nullable) {
			throw new CliError(`Field \`${fieldName}\` cannot be null`)
		}
		return null
	}

	switch (spec.type) {
		case "string":
		case "date":
		case "timestamp":
			if (value === true) {
				throw new CliError(
					`Flag \`--${toFlagName(fieldName)}\` requires a value`,
				)
			}
			return value
		case "integer":
			if (value === true) {
				throw new CliError(
					`Flag \`--${toFlagName(fieldName)}\` requires a value`,
				)
			}
			return parseInteger(value)
		case "decimal":
			if (value === true) {
				throw new CliError(
					`Flag \`--${toFlagName(fieldName)}\` requires a value`,
				)
			}
			return parseDecimal(value)
		case "boolean":
			return value === true ? true : parseBoolean(value)
	}
}

const parseDataPayload = (
	resource: ResourceConfig,
	rawData: FlagValue | undefined,
) => {
	if (rawData === undefined) {
		return {}
	}

	const source = ensureStringFlag(rawData, "data")
	const jsonSource = source.startsWith("@")
		? readFileSync(source.slice(1), "utf8")
		: source

	let parsed: unknown
	try {
		parsed = JSON.parse(jsonSource)
	} catch (error) {
		throw new CliError(
			error instanceof Error
				? error.message
				: "Failed to parse JSON data",
		)
	}

	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new CliError("`--data` must contain a JSON object")
	}

	for (const key of Object.keys(parsed)) {
		if (!resource.fields[key]) {
			throw new CliError(
				`Unknown field \`${key}\` for resource \`${resource.command}\``,
			)
		}
	}

	return parsed as Record<string, unknown>
}

const buildPayload = (
	resource: ResourceConfig,
	flags: Record<string, FlagValue>,
) => {
	const payload = parseDataPayload(resource, flags.data)

	for (const [key, value] of Object.entries(flags)) {
		if (key === "data") {
			continue
		}

		const field = resource.fields[key]
		if (!field) {
			throw new CliError(
				`Unknown flag \`--${toFlagName(key)}\` for resource \`${resource.command}\``,
			)
		}

		payload[key] = parseFieldValue(key, field, value)
	}

	if (Object.keys(payload).length === 0) {
		throw new CliError("No fields provided")
	}

	return payload
}

const buildQuery = (
	resource: ResourceConfig,
	flags: Record<string, FlagValue>,
) => {
	const query: Record<string, string | number | boolean | null> = {}

	for (const [key, value] of Object.entries(flags)) {
		if (key === "sort" || key === "order") {
			query[key] = ensureStringFlag(value, key)
			continue
		}

		const field = resource.queryFields[key]
		if (!field) {
			throw new CliError(
				`Unknown flag \`--${toFlagName(key)}\` for resource \`${resource.command}\``,
			)
		}

		query[key] = parseFieldValue(key, field, value) as
			string | number | boolean | null
	}

	return query
}

const requireId = (
	positionals: string[],
	resource: string,
	command: string,
) => {
	const rawId = positionals[0]
	if (!rawId) {
		throw new CliError(`Missing id for \`${resource} ${command}\``)
	}
	return parseInteger(rawId)
}

const ensureNoExtraPositionals = (positionals: string[], count: number) => {
	if (positionals.length > count) {
		throw new CliError(`Unexpected argument \`${positionals[count]}\``)
	}
}

const resolveRequestBaseUrl = (globalOptions: GlobalOptions) =>
	resolveBaseUrl(globalOptions.baseUrlOverride)

const renderResourceHelp = (resource: ResourceConfig) => {
	const fields = renderFieldFlags(resource.fields)
	const commands =
		resource.command === "time-entries"
			? [...TIME_ENTRY_COMMANDS]
			: resource.command === "projects"
				? [...PROJECT_COMMANDS]
				: [...CRUD_COMMANDS]
	if (resource.hasPicture) {
		commands.push("picture")
	}
	return `Pupler CLI: ${resource.command}

Usage:
  bun ./cli/cli.ts ${resource.command} <command> [args] [flags]

Commands:
  ${commands.join(", ")}

Writable flags:
${fields}
${renderResourceExamples(resource)}
`
}

const renderCommandHelp = (resource: ResourceConfig, command: string) => {
	const writableFlags = renderFieldFlags(resource.fields)
	const filterFlags = renderFieldFlags(resource.queryFields)
	const examples = renderResourceExamples(resource)

	switch (command) {
		case "list":
			return `Usage: bun ./cli/cli.ts ${resource.command} list [filters]

Filters:
${filterFlags}
  --sort
  --order
${examples}
`
		case "get":
			return `Usage: bun ./cli/cli.ts ${resource.command} get <id>`
		case "create":
			return `Usage: bun ./cli/cli.ts ${resource.command} create [flags]

Writable flags:
${writableFlags}
  --data @payload.json
${examples}
`
		case "replace":
			return `Usage: bun ./cli/cli.ts ${resource.command} replace <id> [flags]

Writable flags:
${writableFlags}
  --data @payload.json
${examples}
`
		case "update":
			return `Usage: bun ./cli/cli.ts ${resource.command} update <id> [flags]

Writable flags:
${writableFlags}
  --data @payload.json
${examples}
`
		case "delete":
			return `Usage: bun ./cli/cli.ts ${resource.command} delete <id>`
		case "start":
			if (resource.command !== "time-entries") {
				throw new CliError(`Unknown command \`${command}\``)
			}
			return `Usage: bun ./cli/cli.ts time-entries start --project-id <integer> [flags]

Writable flags:
  --project-id <integer>
  --description <string|null>
  --started-at <ISO timestamp>
`
		case "stop":
			if (resource.command !== "time-entries") {
				throw new CliError(`Unknown command \`${command}\``)
			}
			return `Usage: bun ./cli/cli.ts time-entries stop <id> [flags]

Writable flags:
  --ended-at <ISO timestamp>
`
		case "merge":
			if (resource.command !== "projects") {
				throw new CliError(`Unknown command \`${command}\``)
			}
			return `Usage: bun ./cli/cli.ts projects merge <keeper-id> --source-id <integer> [flags]

Flags:
  --source-id <integer>
  --archive-source <true|false>
  --delete-source <true|false>
`
		default:
			throw new CliError(`Unknown command \`${command}\``)
	}
}

const renderPictureHelp = (resource: ResourceConfig) => `Usage:
  bun ./cli/cli.ts ${resource.command} picture upload <id> --file /path/to/file
  bun ./cli/cli.ts ${resource.command} picture get <id> --output /path/to/output
  bun ./cli/cli.ts ${resource.command} picture delete <id>
`

const runPictureCommand = async (
	resource: ResourceConfig,
	args: string[],
	globalOptions: GlobalOptions,
): Promise<CommandResult> => {
	if (!resource.hasPicture) {
		throw new CliError(
			`Resource \`${resource.command}\` does not support pictures`,
		)
	}

	const action = args[0]
	if (!action || action === "help" || globalOptions.help) {
		return { message: renderPictureHelp(resource) }
	}

	const parsed = parseArgs(args.slice(1))
	const id = requireId(
		parsed.positionals,
		`${resource.command} picture`,
		action,
	)
	ensureNoExtraPositionals(parsed.positionals, 1)
	const baseUrl = resolveRequestBaseUrl(globalOptions)

	if (action === "upload") {
		const filePath = ensureStringFlag(parsed.flags.file, "file")
		if (!existsSync(filePath)) {
			throw new CliError(`File not found: ${filePath}`)
		}

		const formData = new FormData()
		formData.set("file", Bun.file(filePath))
		const response = await requestBody({
			baseUrl,
			path: `${resource.path}/${id}/picture`,
			method: "POST",
			body: formData,
		})
		return { payload: response.data }
	}

	if (action === "get") {
		const outputPath = ensureStringFlag(parsed.flags.output, "output")
		const { bytes, contentType } = await requestBinary({
			baseUrl,
			path: `${resource.path}/${id}/picture`,
		})
		await Bun.write(outputPath, bytes)
		return {
			message: `Saved picture to ${outputPath}`,
			payload: {
				content_type: contentType,
				output_path: outputPath,
				size: bytes.byteLength,
			},
		}
	}

	if (action === "delete") {
		await requestJson({
			baseUrl,
			path: `${resource.path}/${id}/picture`,
			method: "DELETE",
		})
		return {
			message: `Deleted picture for ${resource.command} ${id}`,
			payload: { id, ok: true },
		}
	}

	throw new CliError(`Unknown picture command \`${action}\``)
}

const buildTimeEntryStartPayload = (flags: Record<string, FlagValue>) => {
	const allowedFields: Record<string, FieldSpec> = {
		user_id: { type: "integer", nullable: true },
		project_id: { type: "integer", nullable: true },
		description: { type: "string", nullable: true },
		started_at: { type: "timestamp" },
	}
	const payload: Record<string, unknown> = {}

	for (const [key, value] of Object.entries(flags)) {
		const field = allowedFields[key]
		if (!field) {
			throw new CliError(
				`Unknown flag \`--${toFlagName(key)}\` for \`time-entries start\``,
			)
		}
		payload[key] = parseFieldValue(key, field, value)
	}

	return payload
}

const buildTimeEntryStopPayload = (flags: Record<string, FlagValue>) => {
	const allowedFields: Record<string, FieldSpec> = {
		ended_at: { type: "timestamp" },
	}
	const payload: Record<string, unknown> = {}

	for (const [key, value] of Object.entries(flags)) {
		const field = allowedFields[key]
		if (!field) {
			throw new CliError(
				`Unknown flag \`--${toFlagName(key)}\` for \`time-entries stop\``,
			)
		}
		payload[key] = parseFieldValue(key, field, value)
	}

	return payload
}

const runTimeEntryCommand = async (
	resource: ResourceConfig,
	command: string,
	args: string[],
	globalOptions: GlobalOptions,
): Promise<CommandResult> => {
	if (globalOptions.help || command === "help") {
		return { message: renderCommandHelp(resource, command) }
	}

	const baseUrl = resolveRequestBaseUrl(globalOptions)
	const parsed = parseArgs(args)

	if (command === "start") {
		ensureNoExtraPositionals(parsed.positionals, 0)
		const payload = await requestJson({
			baseUrl,
			path: `${resource.path}/start`,
			method: "POST",
			body: buildTimeEntryStartPayload(parsed.flags),
		})
		return { payload }
	}

	if (command === "stop") {
		const id = requireId(parsed.positionals, resource.command, command)
		ensureNoExtraPositionals(parsed.positionals, 1)
		const payload = await requestJson({
			baseUrl,
			path: `${resource.path}/${id}/stop`,
			method: "POST",
			body: buildTimeEntryStopPayload(parsed.flags),
		})
		return { payload }
	}

	throw new CliError(`Unknown command \`${command}\``)
}

const buildProjectMergePayload = (flags: Record<string, FlagValue>) => {
	const allowedFields: Record<string, FieldSpec> = {
		source_id: { type: "integer" },
		archive_source: { type: "boolean" },
		delete_source: { type: "boolean" },
	}
	const payload: Record<string, unknown> = {}

	for (const [key, value] of Object.entries(flags)) {
		const field = allowedFields[key]
		if (!field) {
			throw new CliError(
				`Unknown flag \`--${toFlagName(key)}\` for \`projects merge\``,
			)
		}
		payload[key] = parseFieldValue(key, field, value)
	}

	if (payload.source_id === undefined) {
		throw new CliError("Flag `--source-id` requires a value")
	}

	return payload
}

const runProjectCommand = async (
	resource: ResourceConfig,
	command: string,
	args: string[],
	globalOptions: GlobalOptions,
): Promise<CommandResult> => {
	if (globalOptions.help || command === "help") {
		return { message: renderCommandHelp(resource, command) }
	}

	if (command !== "merge") {
		throw new CliError(`Unknown command \`${command}\``)
	}

	const parsed = parseArgs(args)
	const id = requireId(parsed.positionals, resource.command, command)
	ensureNoExtraPositionals(parsed.positionals, 1)
	const payload = await requestJson({
		baseUrl: resolveRequestBaseUrl(globalOptions),
		path: `${resource.path}/${id}/merge`,
		method: "POST",
		body: buildProjectMergePayload(parsed.flags),
	})
	return { payload }
}

const runResourceCommand = async (
	resource: ResourceConfig,
	command: string,
	args: string[],
	globalOptions: GlobalOptions,
): Promise<CommandResult> => {
	if (command === "picture") {
		return runPictureCommand(resource, args, globalOptions)
	}

	if (
		resource.command === "time-entries" &&
		["start", "stop"].includes(command)
	) {
		return runTimeEntryCommand(resource, command, args, globalOptions)
	}

	if (resource.command === "projects" && command === "merge") {
		return runProjectCommand(resource, command, args, globalOptions)
	}

	if (!CRUD_COMMANDS.includes(command)) {
		throw new CliError(`Unknown command \`${command}\``)
	}

	if (globalOptions.help || command === "help") {
		return { message: renderCommandHelp(resource, command) }
	}

	const baseUrl = resolveRequestBaseUrl(globalOptions)

	if (command === "list") {
		const parsed = parseArgs(args)
		const payload = await requestJson({
			baseUrl,
			path: resource.path,
			query: buildQuery(resource, parsed.flags),
		})
		return { payload }
	}

	if (command === "get") {
		const parsed = parseArgs(args)
		const id = requireId(parsed.positionals, resource.command, command)
		ensureNoExtraPositionals(parsed.positionals, 1)
		const payload = await requestJson({
			baseUrl,
			path: `${resource.path}/${id}`,
		})
		return { payload }
	}

	if (command === "create") {
		const parsed = parseArgs(args)
		const payload = await requestJson({
			baseUrl,
			path: resource.path,
			method: "POST",
			body: buildPayload(resource, parsed.flags),
		})
		return { payload }
	}

	if (command === "replace" || command === "update") {
		const parsed = parseArgs(args)
		const id = requireId(parsed.positionals, resource.command, command)
		ensureNoExtraPositionals(parsed.positionals, 1)
		const payload = await requestJson({
			baseUrl,
			path: `${resource.path}/${id}`,
			method: command === "replace" ? "PUT" : "PATCH",
			body: buildPayload(resource, parsed.flags),
		})
		return { payload }
	}

	const parsed = parseArgs(args)
	const id = requireId(parsed.positionals, resource.command, command)
	ensureNoExtraPositionals(parsed.positionals, 1)
	await requestJson({
		baseUrl,
		path: `${resource.path}/${id}`,
		method: "DELETE",
	})
	return {
		message: `Deleted ${resource.command} ${id}`,
		payload: { id, ok: true },
	}
}

const renderConfigHelp = () => `Pupler CLI: config

Usage:
  bun ./cli/cli.ts config show
  bun ./cli/cli.ts config path
  bun ./cli/cli.ts config get-url
  bun ./cli/cli.ts config set-url <url>
  bun ./cli/cli.ts config clear-url

Commands:
  ${CONFIG_COMMANDS.join(", ")}
`

const runAuthCommand = async (
	args: string[],
	globalOptions: GlobalOptions,
): Promise<CommandResult> => {
	const command = args[0]
	if (globalOptions.help || command !== "bootstrap") {
		return {
			message:
				"Usage: bun ./cli/cli.ts auth bootstrap --name <name> --username <username> --password <password> [--email <email>]",
		}
	}
	const parsed = parseArgs(args.slice(1))
	const name = ensureStringFlag(parsed.flags.name, "name")
	const username = ensureStringFlag(parsed.flags.username, "username")
	const password = ensureStringFlag(parsed.flags.password, "password")
	const email =
		parsed.flags.email === undefined
			? null
			: ensureStringFlag(parsed.flags.email, "email")
	const payload = await bootstrapCli(resolveRequestBaseUrl(globalOptions), {
		name,
		username,
		password,
		email,
	})
	return { payload }
}

const runConfigCommand = async (
	args: string[],
	globalOptions: GlobalOptions,
): Promise<CommandResult> => {
	const command = args[0]
	if (!command || command === "help" || globalOptions.help) {
		return { message: renderConfigHelp() }
	}

	if (!CONFIG_COMMANDS.includes(command)) {
		throw new CliError(`Unknown config command \`${command}\``)
	}

	if (command === "path") {
		ensureNoExtraPositionals(args.slice(1), 0)
		return {
			payload: {
				config_path: resolveConfigPath(),
			},
		}
	}

	if (command === "show") {
		ensureNoExtraPositionals(args.slice(1), 0)
		const config = readCliConfig()
		return {
			payload: {
				config_path: resolveConfigPath(),
				base_url: config.baseUrl ?? null,
			},
		}
	}

	if (command === "get-url") {
		ensureNoExtraPositionals(args.slice(1), 0)
		const config = readCliConfig()
		if (!config.baseUrl) {
			return {
				message: "No configured base URL",
				payload: {
					base_url: null,
				},
			}
		}
		return {
			payload: {
				base_url: config.baseUrl,
			},
		}
	}

	if (command === "set-url") {
		const url = args[1]
		if (!url) {
			throw new CliError("Missing URL for `config set-url`")
		}
		ensureNoExtraPositionals(args.slice(1), 1)
		const normalized = normalizeBaseUrl(url)
		const path = writeCliConfig({ baseUrl: normalized })
		return {
			message: `Saved base URL to ${path}`,
			payload: {
				base_url: normalized,
				config_path: path,
			},
		}
	}

	ensureNoExtraPositionals(args.slice(1), 0)
	const path = clearCliConfig()
	return {
		message: `Cleared configured base URL from ${path}`,
		payload: {
			base_url: null,
			config_path: path,
		},
	}
}

const renderIntegrationsHelp = () => `Pupler CLI: integrations

Usage:
  bun ./cli/cli.ts integrations clockify configure --workspace-id <id> --api-key-env <env>

Commands:
  clockify configure
`

const runIntegrationsCommand = async (
	args: string[],
	globalOptions: GlobalOptions,
): Promise<CommandResult> => {
	if (!args.length || args[0] === "help" || globalOptions.help) {
		return { message: renderIntegrationsHelp() }
	}
	if (args[0] !== "clockify" || args[1] !== "configure") {
		throw new CliError(`Unknown integrations command \`${args.join(" ")}\``)
	}
	const parsed = parseArgs(args.slice(2))
	ensureNoExtraPositionals(parsed.positionals, 0)
	const apiKeyEnv =
		parsed.flags.api_key_env === undefined
			? undefined
			: ensureStringFlag(parsed.flags.api_key_env, "api_key_env")
	const apiKey =
		parsed.flags.api_key === undefined
			? apiKeyEnv
				? process.env[apiKeyEnv]
				: undefined
			: ensureStringFlag(parsed.flags.api_key, "api_key")
	if (!apiKey) {
		throw new CliError(
			apiKeyEnv
				? `Environment variable \`${apiKeyEnv}\` is not set`
				: "Provide `--api-key-env` or `--api-key`",
		)
	}
	const payload = await requestJson({
		baseUrl: resolveRequestBaseUrl(globalOptions),
		path: "/api/external-integrations/clockify",
		method: "POST",
		body: {
			name:
				parsed.flags.name === undefined
					? "default"
					: ensureStringFlag(parsed.flags.name, "name"),
			workspace_id: ensureStringFlag(
				parsed.flags.workspace_id,
				"workspace_id",
			),
			api_key: apiKey,
			...(parsed.flags.api_base_url === undefined
				? {}
				: {
						api_base_url: ensureStringFlag(
							parsed.flags.api_base_url,
							"api_base_url",
						),
					}),
			...(parsed.flags.reports_base_url === undefined
				? {}
				: {
						reports_base_url: ensureStringFlag(
							parsed.flags.reports_base_url,
							"reports_base_url",
						),
					}),
		},
	})
	return { payload }
}

const parseCadence = (value: FlagValue | undefined) => {
	const raw =
		value === undefined ? "manual" : ensureStringFlag(value, "cadence")
	const cadence = IMPORT_SCHEDULE_CADENCES[raw.trim().toLowerCase()]
	if (!cadence) {
		throw new CliError(
			"Cadence must be one of manual, hourly, daily, weekly",
		)
	}
	return cadence
}

const renderImportsHelp = () => `Pupler CLI: imports

Usage:
  bun ./cli/cli.ts imports clockify schedule --integration-id <id> --name <name> [flags]
  bun ./cli/cli.ts imports clockify run --schedule-id <id> [--no-wait]

Clockify schedule flags:
  --cadence <manual|hourly|daily|weekly>
  --timezone <timezone>
  --lookback-days <integer|null>
  --dry-run true|false
  --next-run-at <ISO timestamp|null>
`

const waitForJob = async (baseUrl: string, jobId: number) => {
	for (;;) {
		const job = (await requestJson({
			baseUrl,
			path: `/api/jobs/${jobId}`,
		})) as { status: number; error_message?: string | null }
		if (job.status === JOB_STATUS.Completed) return job
		if (job.status === JOB_STATUS.Failed) {
			throw new CliError(job.error_message ?? `Job ${jobId} failed`)
		}
		await Bun.sleep(1000)
	}
}

const runImportsCommand = async (
	args: string[],
	globalOptions: GlobalOptions,
): Promise<CommandResult> => {
	if (!args.length || args[0] === "help" || globalOptions.help) {
		return { message: renderImportsHelp() }
	}
	if (args[0] !== "clockify") {
		throw new CliError(`Unknown imports provider \`${args[0]}\``)
	}
	const command = args[1]
	if (!command) return { message: renderImportsHelp() }
	const parsed = parseArgs(args.slice(2))
	const baseUrl = resolveRequestBaseUrl(globalOptions)

	if (command === "schedule") {
		ensureNoExtraPositionals(parsed.positionals, 0)
		const payload = await requestJson({
			baseUrl,
			path: "/api/import-schedules",
			method: "POST",
			body: {
				integration_id: parseInteger(
					ensureStringFlag(
						parsed.flags.integration_id,
						"integration_id",
					),
				),
				name: ensureStringFlag(parsed.flags.name, "name"),
				cadence: parseCadence(parsed.flags.cadence),
				timezone:
					parsed.flags.timezone === undefined
						? "UTC"
						: ensureStringFlag(parsed.flags.timezone, "timezone"),
				lookback_days:
					parsed.flags.lookback_days === undefined
						? 14
						: ensureStringFlag(
									parsed.flags.lookback_days,
									"lookback_days",
							  ) === "null"
							? null
							: parseInteger(
									ensureStringFlag(
										parsed.flags.lookback_days,
										"lookback_days",
									),
								),
				dry_run:
					parsed.flags.dry_run === undefined
						? false
						: parseBoolean(
								ensureStringFlag(
									parsed.flags.dry_run,
									"dry_run",
								),
							),
				next_run_at:
					parsed.flags.next_run_at === undefined
						? null
						: parseFieldValue(
								"next_run_at",
								{ type: "timestamp", nullable: true },
								parsed.flags.next_run_at,
							),
			},
		})
		return { payload }
	}

	if (command === "run") {
		ensureNoExtraPositionals(parsed.positionals, 0)
		const scheduleId = parseInteger(
			ensureStringFlag(parsed.flags.schedule_id, "schedule_id"),
		)
		const job = (await requestJson({
			baseUrl,
			path: `/api/import-schedules/${scheduleId}/run`,
			method: "POST",
			body: {},
		})) as { id: number }
		if (parsed.flags.no_wait !== undefined) {
			return { payload: job }
		}
		return { payload: await waitForJob(baseUrl, job.id) }
	}

	throw new CliError(`Unknown imports clockify command \`${command}\``)
}

export const renderRootHelp = () => HELP_TEXT

export const runCliCommand = async (
	args: string[],
	globalOptions: GlobalOptions,
): Promise<CommandResult> => {
	if (!args.length || args[0] === "help") {
		return { message: renderRootHelp() }
	}

	if (args[0] === "config") {
		return runConfigCommand(args.slice(1), globalOptions)
	}
	if (args[0] === "auth") {
		return runAuthCommand(args.slice(1), globalOptions)
	}

	const baseUrl = resolveRequestBaseUrl(globalOptions)
	const username = globalOptions.username ?? process.env.PUPLER_USERNAME
	const password = globalOptions.password ?? process.env.PUPLER_PASSWORD
	if (!globalOptions.help && (username || password)) {
		if (!username || !password)
			throw new CliError("Both --username and --password are required")
		await loginCli(baseUrl, username, password)
	}
	if (args[0] === "integrations") {
		return runIntegrationsCommand(args.slice(1), globalOptions)
	}
	if (args[0] === "imports") {
		return runImportsCommand(args.slice(1), globalOptions)
	}

	const resourceName = args[0]
	const resource = resourceName ? RESOURCE_MAP.get(resourceName) : undefined
	if (!resource) {
		throw new CliError(`Unknown resource \`${resourceName}\``)
	}

	if (args.length === 1 || args[1] === "help") {
		return { message: renderResourceHelp(resource) }
	}

	const command = args[1]
	if (!command) {
		return { message: renderResourceHelp(resource) }
	}

	return runResourceCommand(resource, command, args.slice(2), globalOptions)
}
