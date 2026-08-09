import type { BunRequest } from "bun"

import {
	assertKnownFields,
	expectInteger,
	expectString,
	HttpError,
	json,
	parseIdParam,
	readJsonObject,
	readOptionalBodyField,
	requireBodyField,
	utcNow,
	withErrorHandling,
	type Database,
	type JsonObject,
} from "./core"
import { decryptJson, encryptJson } from "./encryption"
import {
	ExternalIntegrationProvider,
	ExternalIntegrationStatus,
} from "./job-types"

const CLOCKIFY_FIELDS = [
	"name",
	"workspace_id",
	"api_key",
	"api_base_url",
	"reports_base_url",
]

type ClockifyOptionUser = {
	id: string
	name: string
	email: string | null
}

const optionalString = (value: unknown) =>
	typeof value === "string" && value.trim() ? value.trim() : null

const fetchClockifyWorkspaceUsers = async (
	configJson: string,
	credentialsEncryptedJson: string,
) => {
	const config = JSON.parse(configJson) as JsonObject
	const credentials = decryptJson(credentialsEncryptedJson)
	const workspaceId = optionalString(config.workspace_id)
	const apiKey = optionalString(credentials.api_key)
	const apiBaseUrl = optionalString(config.api_base_url) ?? "https://api.clockify.me/api/v1"
	if (!workspaceId || !apiKey) throw new HttpError(500, "Clockify integration configuration is invalid")

	const users: ClockifyOptionUser[] = []
	const pageSize = 200
	for (let page = 1; page < 1000; page += 1) {
		const url = new URL(`${apiBaseUrl.replace(/\/$/, "")}/workspaces/${encodeURIComponent(workspaceId)}/users`)
		url.searchParams.set("page", String(page))
		url.searchParams.set("page-size", String(pageSize))
		const response = await fetch(url, { headers: { "X-Api-Key": apiKey } })
		if (!response.ok) {
			const body = await response.text()
			throw new HttpError(502, `Clockify users request failed with status ${response.status}: ${body.slice(0, 500)}`)
		}
		const body = await response.json()
		if (!Array.isArray(body)) throw new HttpError(502, "Clockify users response is invalid")
		for (const rawUser of body) {
			if (!rawUser || typeof rawUser !== "object" || Array.isArray(rawUser)) continue
			const user = rawUser as Record<string, unknown>
			const id = optionalString(user.id)
			const email = optionalString(user.email)
			if (!id) continue
			users.push({ id, name: optionalString(user.name) ?? email ?? `Clockify user ${id}`, email })
		}
		if (body.length < pageSize) break
	}
	return users
}

const publicIntegration = <
	T extends {
		credentials_encrypted_json?: string
		config_json: string
	},
>(
	integration: T,
) => {
	const {
		credentials_encrypted_json: _credentials,
		config_json: configJson,
		...rest
	} = integration
	return {
		...rest,
		config: JSON.parse(configJson),
	}
}

const parseClockifyConfig = (body: JsonObject) => {
	assertKnownFields(body, CLOCKIFY_FIELDS)
	const workspaceId = requireBodyField(
		body,
		"workspace_id",
		expectString,
	).trim()
	const apiKey = requireBodyField(body, "api_key", expectString).trim()
	if (!workspaceId)
		throw new HttpError(400, "Field `workspace_id` cannot be empty")
	if (!apiKey) throw new HttpError(400, "Field `api_key` cannot be empty")

	const name = (
		readOptionalBodyField(body, "name", expectString) ?? "default"
	).trim()
	if (!name) throw new HttpError(400, "Field `name` cannot be empty")
	const apiBaseUrl = readOptionalBodyField(
		body,
		"api_base_url",
		expectString,
	)?.trim()
	const reportsBaseUrl = readOptionalBodyField(
		body,
		"reports_base_url",
		expectString,
	)?.trim()

	return {
		name,
		config: {
			workspace_id: workspaceId,
			api_base_url: apiBaseUrl || "https://api.clockify.me/api/v1",
			reports_base_url:
				reportsBaseUrl || "https://reports.api.clockify.me/v1",
		},
		credentials: {
			api_key: apiKey,
		},
	}
}

export const clockifyIntegrationRoute = (db: Database) =>
	withErrorHandling(async (req: Request) => {
		if (req.method !== "POST") {
			throw new HttpError(405, "Method not allowed for this route")
		}

		const values = parseClockifyConfig(await readJsonObject(req))
		const now = utcNow()
		const integration = await db.client.externalIntegration.upsert({
			where: {
				provider_name: {
					provider: ExternalIntegrationProvider.Clockify,
					name: values.name,
				},
			},
			create: {
				provider: ExternalIntegrationProvider.Clockify,
				name: values.name,
				status: ExternalIntegrationStatus.Active,
				config_json: JSON.stringify(values.config),
				credentials_encrypted_json: encryptJson(values.credentials),
				created_at: now,
				updated_at: now,
			},
			update: {
				status: ExternalIntegrationStatus.Active,
				config_json: JSON.stringify(values.config),
				credentials_encrypted_json: encryptJson(values.credentials),
				updated_at: now,
			},
		})

		return json(200, publicIntegration(integration))
	})

export const externalIntegrationsCollectionRoute = (db: Database) =>
	withErrorHandling(async (req: Request) => {
		if (req.method !== "GET") {
			throw new HttpError(405, "Method not allowed for this route")
		}

		const integrations = await db.client.externalIntegration.findMany({
			orderBy: [{ provider: "asc" }, { name: "asc" }],
		})
		return json(200, integrations.map(publicIntegration))
	})

export const externalIntegrationDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const id = parseIdParam(req.params.id ?? "")
		const integration = await db.client.externalIntegration.findUnique({
			where: { id },
		})
		if (!integration) throw new HttpError(404, "Resource not found")

		if (req.method === "GET") {
			return json(200, publicIntegration(integration))
		}
		if (req.method === "PATCH") {
			const body = await readJsonObject(req)
			assertKnownFields(body, ["status"])
			const status = requireBodyField(body, "status", expectInteger)
			if (
				!Object.values(ExternalIntegrationStatus).includes(
					status as ExternalIntegrationStatus,
				)
			) {
				throw new HttpError(
					400,
					"Field `status` must be a valid integration status",
				)
			}
			return json(
				200,
				publicIntegration(
					await db.client.externalIntegration.update({
						where: { id },
						data: { status, updated_at: utcNow() },
					}),
				),
			)
		}
		throw new HttpError(405, "Method not allowed for this route")
	})

export const clockifyIntegrationOptionsRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		if (req.method !== "GET") {
			throw new HttpError(405, "Method not allowed for this route")
		}
		const integrationId = parseIdParam(req.params.id ?? "")
		const integration = await db.client.externalIntegration.findUnique({
			where: { id: integrationId },
		})
		if (!integration) throw new HttpError(404, "Resource not found")
		if (integration.provider !== ExternalIntegrationProvider.Clockify) {
			throw new HttpError(
				400,
				"Integration must be a Clockify integration",
			)
		}

		const links = await db.client.clockifyProjectLink.findMany({
			where: { integration_id: integrationId },
			orderBy: [
				{ clockify_client_name: "asc" },
				{ clockify_name: "asc" },
				{ clockify_project_id: "asc" },
			],
		})
		const timeEntryLinks = await db.client.clockifyTimeEntryLink.findMany({
			where: { integration_id: integrationId, clockify_user_id: { not: null } },
			select: {
				clockify_user_id: true,
				time_entry: { select: { user: { select: { name: true, email: true } } } },
			},
		})
		const clients = new Map<string, { id: string; name: string }>()
		const users = new Map<string, ClockifyOptionUser>()
		for (const link of links) {
			if (!link.clockify_client_id) continue
			clients.set(link.clockify_client_id, {
				id: link.clockify_client_id,
				name: link.clockify_client_name ?? "No client",
			})
		}
		for (const link of timeEntryLinks) {
			if (!link.clockify_user_id) continue
			const user = link.time_entry.user
			users.set(link.clockify_user_id, {
				id: link.clockify_user_id,
				name: user?.name ?? user?.email ?? `Clockify user ${link.clockify_user_id}`,
				email: user?.email ?? null,
			})
		}
		for (const user of await fetchClockifyWorkspaceUsers(integration.config_json, integration.credentials_encrypted_json)) {
			users.set(user.id, user)
		}

		return json(200, {
			users: [...users.values()].sort((left, right) => left.name.localeCompare(right.name)),
			clients: [...clients.values()],
			projects: links.map((link) => ({
				id: link.clockify_project_id,
				name: link.clockify_name,
				client_id: link.clockify_client_id,
				client_name: link.clockify_client_name,
			})),
		})
	})
