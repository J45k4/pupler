import { escapeHtml, renderPage, setStatus } from "../app"
import { attachModalControls, renderModal } from "../ui/modal"
import { SearchSelect, type SearchSelectOption } from "../ui/search-select"

type ExternalIntegration = {
	id: number
	provider: number
	name: string
}

type Client = {
	id: number
	name: string
	archived_at: string | null
}

type ImportSchedule = {
	id: number
	integration_id: number
	status: number
	name: string
	cadence: number
	timezone: string
	cursor_json: string | null
	params_json: string
	next_run_at: string | null
	last_run_at: string | null
}

type ClockifyImportOptions = {
	users?: Array<{ id: string; name: string; email: string | null }>
	clients: Array<{ id: string; name: string }>
	projects: Array<{
		id: string
		name: string
		client_id: string | null
		client_name: string | null
	}>
}

const PROVIDER_CLOCKIFY = 1
const SCHEDULE_STATUS_ACTIVE = 1
const SCHEDULE_STATUS_PAUSED = 2

type ScheduleParams = {
	lookback_days?: number | null
	dry_run?: boolean
	target_client_id?: number | null
	user_ids?: string[]
	client_ids?: string[]
	project_ids?: string[]
}

const cadenceOptions = [
	{ value: 1, label: "Manual" },
	{ value: 2, label: "Hourly" },
	{ value: 3, label: "Daily" },
	{ value: 4, label: "Weekly" },
]

const scheduleStatusOptions = [
	{ value: SCHEDULE_STATUS_ACTIVE, label: "Active" },
	{ value: SCHEDULE_STATUS_PAUSED, label: "Paused" },
]

const apiJson = async <T>(path: string, options: RequestInit = {}) => {
	const response = await fetch(path, {
		...options,
		headers: {
			...(options.body ? { "Content-Type": "application/json" } : {}),
			...(options.headers ?? {}),
		},
	})
	const body = (await response.json()) as T | { error?: string }
	if (!response.ok) {
		throw new Error(
			typeof body === "object" && body !== null && "error" in body
				? (body.error ?? "Request failed")
				: "Request failed",
		)
	}
	return body as T
}

const formatDateTime = (value: string | null | undefined) =>
	value
		? new Intl.DateTimeFormat(undefined, {
				dateStyle: "medium",
				timeStyle: "short",
			}).format(new Date(value))
		: "Not set"

const scheduleStatusLabel = (status: number) =>
	status === SCHEDULE_STATUS_ACTIVE ? "Active" : "Paused"

const cadenceLabel = (cadence: number) =>
	cadenceOptions.find((option) => option.value === cadence)?.label ??
	`Cadence ${cadence}`

const lookbackLabel = (params: ScheduleParams) =>
	params.lookback_days === null
		? "All history"
		: `${params.lookback_days ?? 14} day lookback`

const parseJson = <T>(value: string | null, fallback: T): T => {
	if (!value) return fallback
	try {
		return JSON.parse(value) as T
	} catch {
		return fallback
	}
}

const readLookbackDays = (data: FormData) => {
	const rawValue = String(data.get("lookback_days") ?? "").trim()
	return rawValue ? Number(rawValue) : null
}

const readStringList = (data: FormData, name: string) =>
	data
		.getAll(name)
		.map(String)
		.map((value) => value.trim())
		.filter(Boolean)

const readNullableId = (data: FormData, name: string) => {
	const rawValue = String(data.get(name) ?? "").trim()
	return rawValue ? Number(rawValue) : null
}

const readNextRunAt = (data: FormData) => {
	const rawValue = String(data.get("next_run_at") ?? "").trim()
	if (!rawValue) return null
	const timestamp = new Date(rawValue)
	if (Number.isNaN(timestamp.getTime())) {
		throw new Error("Next run time is invalid.")
	}
	return timestamp.toISOString()
}

const schedulePayloadFromForm = (data: FormData) => ({
	integration_id: Number(data.get("integration_id")),
	name: String(data.get("name") ?? ""),
	cadence: Number(data.get("cadence")),
	timezone: String(data.get("timezone") ?? "UTC"),
	lookback_days: readLookbackDays(data),
	dry_run: data.get("dry_run") === "on",
	target_client_id: readNullableId(data, "target_client_id"),
	user_ids: readStringList(data, "user_ids"),
	client_ids: readStringList(data, "client_ids"),
	project_ids: readStringList(data, "project_ids"),
	next_run_at: readNextRunAt(data),
})

const toDateTimeLocalValue = (value: string | null) => {
	if (!value) return ""
	const timestamp = Date.parse(value)
	if (Number.isNaN(timestamp)) return ""
	const date = new Date(timestamp)
	return new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000)
		.toISOString()
		.slice(0, 16)
}

const renderScheduleRows = (schedules: ImportSchedule[], clients: Client[]) => {
	const root = document.getElementById("import-schedules-list")
	if (!root) return
	if (!schedules.length) {
		root.innerHTML = '<div class="empty">No import schedules yet.</div>'
		return
	}

	const clientNames = new Map(
		clients.map((client) => [client.id, client.name]),
	)
	root.innerHTML = schedules
		.map((schedule) => {
			const params = parseJson<ScheduleParams>(schedule.params_json, {})
			const targetClientLabel = params.target_client_id
				? (clientNames.get(params.target_client_id) ??
					`Client ${params.target_client_id}`)
				: "Clockify clients"
			const cursor = parseJson<{ last_successful_to?: string }>(
				schedule.cursor_json,
				{},
			)
			return `
				<div class="integration-row">
					<div>
						<strong>${escapeHtml(schedule.name)}</strong>
						<div class="section-copy">
							${cadenceLabel(schedule.cadence)} · ${escapeHtml(schedule.timezone)} · ${lookbackLabel(params)}${params.dry_run ? " · dry run" : ""}
						</div>
						<div class="section-copy">Pupler client: ${escapeHtml(targetClientLabel)}</div>
						<div class="section-copy">${(params.user_ids?.length ?? 0) || (params.client_ids?.length ?? 0) || (params.project_ids?.length ?? 0) ? `${params.user_ids?.length ?? 0} users · ${params.client_ids?.length ?? 0} clients · ${params.project_ids?.length ?? 0} projects` : "All users, clients and projects"}</div>
						<div class="section-copy">Last run: ${formatDateTime(schedule.last_run_at)} · Last success: ${formatDateTime(cursor.last_successful_to)}</div>
					</div>
					<div class="integration-row__meta">
						<span class="tag">${scheduleStatusLabel(schedule.status)}</span>
						<span>Next ${formatDateTime(schedule.next_run_at)}</span>
						<a class="secondary" href="/import-schedules/${schedule.id}" data-link>Edit</a>
						<button class="secondary" type="button" data-run-schedule-id="${schedule.id}">Run</button>
					</div>
				</div>
			`
		})
		.join("")
}

const fillIntegrationSelect = (
	integrations: ExternalIntegration[],
	elementId = "import-schedule-integration",
	selectedId?: number,
) => {
	const select = document.getElementById(elementId)
	if (!(select instanceof HTMLSelectElement)) return
	select.innerHTML = integrations
		.map(
			(integration) =>
				`<option value="${integration.id}"${integration.id === selectedId ? " selected" : ""}>${escapeHtml(integration.name)}</option>`,
		)
		.join("")
}

const fillClientSelect = (
	clients: Client[],
	elementId: string,
	selectedId?: number | null,
) => {
	const select = document.getElementById(elementId)
	if (!(select instanceof HTMLSelectElement)) return
	select.innerHTML = [
		`<option value=""${selectedId ? "" : " selected"}>Use Clockify clients</option>`,
		...clients.map(
			(client) =>
				`<option value="${client.id}"${client.id === selectedId ? " selected" : ""}>${escapeHtml(client.name)}</option>`,
		),
	].join("")
}

const fillClockifyFilterSelects = (
	options: ClockifyImportOptions,
	params: ScheduleParams,
) => {
	let userSelect: SearchSelect | null = null
	let clientSelect: SearchSelect | null = null
	let projectSelect: SearchSelect | null = null
	const projectOptions = () => {
		const selectedClientIds = new Set(clientSelect?.values ?? [])
		return options.projects
			.filter(
				(project) =>
					selectedClientIds.size === 0 ||
					(project.client_id !== null &&
						selectedClientIds.has(project.client_id)),
			)
			.map((project) => ({
				value: project.id,
				label: project.client_name
					? `${project.name} - ${project.client_name}`
					: project.name,
			}))
	}
	const syncProjectOptions = () => {
		if (!projectSelect) return
		projectSelect
			.setOptions(projectOptions())
			.setValues(projectSelect.values)
	}

	const clientRoot = document.getElementById("import-schedule-edit-clients")
	const userRoot = document.getElementById("import-schedule-edit-users")
	if (userRoot) {
		userSelect = new SearchSelect({
			multiple: true,
			name: "user_ids",
			placeholder: "Search users",
		})
		const userOptions: SearchSelectOption[] = (options.users ?? []).map((user) => ({
			value: user.id,
			label: user.email ? `${user.name} - ${user.email}` : user.name,
		}))
		userSelect.setOptions(userOptions).setValues(params.user_ids ?? [])
		userRoot.replaceChildren(userSelect.root)
	}

	if (clientRoot) {
		clientSelect = new SearchSelect({
			multiple: true,
			name: "client_ids",
			placeholder: "Search clients",
		})
		const clientOptions: SearchSelectOption[] = options.clients.map(
			(client) => ({
				value: client.id,
				label: client.name,
			}),
		)
		clientSelect
			.setOptions(clientOptions)
			.setValues(params.client_ids ?? [])
		clientRoot.replaceChildren(clientSelect.root)
		clientSelect.root.addEventListener("change", syncProjectOptions)
	}

	const projectRoot = document.getElementById("import-schedule-edit-projects")
	if (projectRoot) {
		projectSelect = new SearchSelect({
			multiple: true,
			name: "project_ids",
			placeholder: "Search projects",
		})
		projectSelect
			.setOptions(projectOptions())
			.setValues(params.project_ids ?? [])
		projectRoot.replaceChildren(projectSelect.root)
	}
}

const loadImportSchedulesPage = async () => {
	setStatus("import-schedules-status", "Loading schedules...")
	try {
		const [integrations, schedules, clients] = await Promise.all([
			apiJson<ExternalIntegration[]>("/api/external-integrations"),
			apiJson<ImportSchedule[]>("/api/import-schedules"),
			apiJson<Client[]>(
				"/api/clients?archived_at=null&sort=name&order=asc",
			),
		])
		fillIntegrationSelect(
			integrations.filter(
				(integration) => integration.provider === PROVIDER_CLOCKIFY,
			),
		)
		fillClientSelect(clients, "import-schedule-target-client")
		renderScheduleRows(schedules, clients)
		setStatus("import-schedules-status", "Schedules loaded.")
	} catch (error) {
		setStatus(
			"import-schedules-status",
			error instanceof Error
				? error.message
				: "Failed to load schedules.",
			true,
		)
	}
}

const attachImportScheduleEvents = () => {
	const scheduleModal = attachModalControls({
		modalId: "schedule-create-modal",
		openButtonId: "schedule-create-button",
		closeSelector: "[data-close-schedule-modal]",
		focusSelector: "select[name='integration_id']",
		onOpen: () => setStatus("clockify-schedule-status", ""),
	})

	const scheduleForm = document.getElementById("clockify-schedule-form")
	scheduleForm?.addEventListener("submit", async (event) => {
		event.preventDefault()
		if (!(scheduleForm instanceof HTMLFormElement)) return
		const data = new FormData(scheduleForm)
		setStatus("clockify-schedule-status", "Creating schedule...")
		try {
			await apiJson("/api/import-schedules", {
				method: "POST",
				body: JSON.stringify(schedulePayloadFromForm(data)),
			})
			scheduleForm.reset()
			scheduleModal.close()
			setStatus("clockify-schedule-status", "Schedule created.")
			await loadImportSchedulesPage()
		} catch (error) {
			setStatus(
				"clockify-schedule-status",
				error instanceof Error
					? error.message
					: "Failed to create schedule.",
				true,
			)
		}
	})

	document
		.getElementById("import-schedules-list")
		?.addEventListener("click", async (event) => {
			const target = event.target
			if (!(target instanceof HTMLElement)) return
			const button = target.closest("[data-run-schedule-id]")
			if (!(button instanceof HTMLButtonElement)) return
			const scheduleId = button.dataset.runScheduleId
			if (!scheduleId) return
			button.disabled = true
			setStatus("import-schedules-status", "Queueing import job...")
			try {
				await apiJson(`/api/import-schedules/${scheduleId}/run`, {
					method: "POST",
					body: JSON.stringify({}),
				})
				setStatus("import-schedules-status", "Import job queued.")
				await loadImportSchedulesPage()
			} catch (error) {
				setStatus(
					"import-schedules-status",
					error instanceof Error
						? error.message
						: "Failed to queue import job.",
					true,
				)
			} finally {
				button.disabled = false
			}
		})
}

const setSelectValue = (id: string, value: number) => {
	const select = document.getElementById(id)
	if (select instanceof HTMLSelectElement) {
		select.value = String(value)
	}
}

const loadImportScheduleDetailPage = async (scheduleId: number) => {
	setStatus("import-schedule-detail-status", "Loading schedule...")
	try {
		const [integrations, schedule, clients] = await Promise.all([
			apiJson<ExternalIntegration[]>("/api/external-integrations"),
			apiJson<ImportSchedule>(`/api/import-schedules/${scheduleId}`),
			apiJson<Client[]>(
				"/api/clients?archived_at=null&sort=name&order=asc",
			),
		])
		const clockifyIntegrations = integrations.filter(
			(integration) => integration.provider === PROVIDER_CLOCKIFY,
		)
		fillIntegrationSelect(
			clockifyIntegrations,
			"import-schedule-edit-integration",
			schedule.integration_id,
		)
		const params = parseJson<ScheduleParams>(schedule.params_json, {})
		fillClientSelect(
			clients,
			"import-schedule-edit-target-client",
			params.target_client_id ?? null,
		)
		const options = await apiJson<ClockifyImportOptions>(
			`/api/external-integrations/${schedule.integration_id}/clockify-options`,
		)
		fillClockifyFilterSelects(options, params)
		const form = document.getElementById("import-schedule-edit-form")
		if (!(form instanceof HTMLFormElement)) return
		const fields = form.elements
		const name = fields.namedItem("name")
		const timezone = fields.namedItem("timezone")
		const lookbackDays = fields.namedItem("lookback_days")
		const nextRunAt = fields.namedItem("next_run_at")
		const dryRun = fields.namedItem("dry_run")
		if (name instanceof HTMLInputElement) name.value = schedule.name
		if (timezone instanceof HTMLInputElement)
			timezone.value = schedule.timezone
		if (lookbackDays instanceof HTMLInputElement) {
			lookbackDays.value =
				params.lookback_days === null
					? ""
					: String(params.lookback_days ?? 14)
		}
		if (nextRunAt instanceof HTMLInputElement) {
			nextRunAt.value = toDateTimeLocalValue(schedule.next_run_at)
		}
		if (dryRun instanceof HTMLInputElement) {
			dryRun.checked = params.dry_run ?? false
		}
		setSelectValue("import-schedule-edit-status", schedule.status)
		setSelectValue("import-schedule-edit-cadence", schedule.cadence)
		setStatus("import-schedule-detail-status", "Schedule loaded.")
	} catch (error) {
		setStatus(
			"import-schedule-detail-status",
			error instanceof Error ? error.message : "Failed to load schedule.",
			true,
		)
	}
}

const attachImportScheduleDetailEvents = (scheduleId: number) => {
	const form = document.getElementById("import-schedule-edit-form")
	form?.addEventListener("submit", async (event) => {
		event.preventDefault()
		if (!(form instanceof HTMLFormElement)) return
		const data = new FormData(form)
		setStatus("import-schedule-detail-status", "Saving schedule...")
		try {
			await apiJson(`/api/import-schedules/${scheduleId}`, {
				method: "PATCH",
				body: JSON.stringify({
					...schedulePayloadFromForm(data),
					status: Number(data.get("status")),
				}),
			})
			setStatus("import-schedule-detail-status", "Schedule saved.")
			await loadImportScheduleDetailPage(scheduleId)
		} catch (error) {
			setStatus(
				"import-schedule-detail-status",
				error instanceof Error
					? error.message
					: "Failed to save schedule.",
				true,
			)
		}
	})

	document
		.getElementById("import-schedule-run-button")
		?.addEventListener("click", async () => {
			setStatus("import-schedule-detail-status", "Queueing import job...")
			try {
				await apiJson(`/api/import-schedules/${scheduleId}/run`, {
					method: "POST",
					body: JSON.stringify({}),
				})
				setStatus("import-schedule-detail-status", "Import job queued.")
				await loadImportScheduleDetailPage(scheduleId)
			} catch (error) {
				setStatus(
					"import-schedule-detail-status",
					error instanceof Error
						? error.message
						: "Failed to queue import job.",
					true,
				)
			}
		})
}

export const renderImportSchedulesPage = () => {
	renderPage(`
		<section class="workspace workspace--single">
			<div class="card panel">
				<div class="section-header">
					<h2>Schedules</h2>
					<button id="schedule-create-button" class="primary" type="button">Create Schedule</button>
				</div>
				<div id="import-schedules-status" class="status" role="status"></div>
				<div id="import-schedules-list" class="integration-list"></div>
			</div>
		</section>

		${renderModal({
			id: "schedule-create-modal",
			title: "Create Schedule",
			closeDataAttribute: "data-close-schedule-modal",
			children: `
			<form id="clockify-schedule-form" class="integration-schedule-form">
				<div class="row">
					<label>
						Integration
						<select id="import-schedule-integration" name="integration_id" required></select>
					</label>
					<label>
						Name
						<input name="name" type="text" value="Daily Clockify" required />
					</label>
				</div>
				<div class="row">
					<label>
						Cadence
						<select name="cadence">
							${cadenceOptions.map((option) => `<option value="${option.value}">${option.label}</option>`).join("")}
						</select>
					</label>
					<label>
						Timezone
						<input name="timezone" type="text" value="Europe/Helsinki" required />
					</label>
				</div>
				<div class="row">
					<label>
						Lookback Days
						<input name="lookback_days" type="number" min="1" value="14" placeholder="Blank imports all history" />
					</label>
					<label>
						Next Run At
						<input name="next_run_at" type="datetime-local" />
					</label>
				</div>
				<label>
					Pupler Client
					<select id="import-schedule-target-client" name="target_client_id"></select>
				</label>
				<label class="checkbox-line">
					<input name="dry_run" type="checkbox" />
					Dry run
				</label>
				<div class="actions">
					<button class="primary" type="submit">Create</button>
					<button class="secondary" type="button" data-close-schedule-modal>Cancel</button>
				</div>
				<div id="clockify-schedule-status" class="status" role="status"></div>
			</form>
			`,
		})}
	`)

	attachImportScheduleEvents()
	void loadImportSchedulesPage()
}

export const renderImportScheduleDetailPage = (
	params: Record<string, string>,
) => {
	const scheduleId = Number(params.id)
	renderPage(`
		<section class="page-heading page-heading--compact">
			<div>
				<h1 class="page-title">Edit Import Schedule</h1>
			</div>
			<div class="actions">
				<a class="secondary" href="/import-schedules" data-link>Back</a>
				<button id="import-schedule-run-button" class="secondary" type="button">Run</button>
			</div>
		</section>

		<section class="workspace workspace--single">
			<div class="card panel">
				<div class="section-header">
					<h2>Schedule</h2>
					<div id="import-schedule-detail-status" class="status" role="status"></div>
				</div>
				<form id="import-schedule-edit-form" class="integration-schedule-form">
					<div class="row">
						<label>
							Status
							<select id="import-schedule-edit-status" name="status">
								${scheduleStatusOptions
									.map(
										(option) =>
											`<option value="${option.value}">${option.label}</option>`,
									)
									.join("")}
							</select>
						</label>
						<label>
							Integration
							<select id="import-schedule-edit-integration" name="integration_id" required></select>
						</label>
					</div>
					<div class="row">
						<label>
							Name
							<input name="name" type="text" required />
						</label>
						<label>
							Cadence
							<select id="import-schedule-edit-cadence" name="cadence">
								${cadenceOptions.map((option) => `<option value="${option.value}">${option.label}</option>`).join("")}
							</select>
						</label>
					</div>
					<div class="row">
						<label>
							Timezone
							<input name="timezone" type="text" required />
						</label>
						<label>
							Lookback Days
							<input name="lookback_days" type="number" min="1" placeholder="Blank imports all history" />
						</label>
					</div>
					<div class="row">
						<label>
							Next Run At
							<input name="next_run_at" type="datetime-local" />
						</label>
						<label>
							Pupler Client
							<select id="import-schedule-edit-target-client" name="target_client_id"></select>
						</label>
					</div>
					<div class="row">
						<label class="checkbox-line">
							<input name="dry_run" type="checkbox" />
							Dry run
						</label>
					</div>
					<div class="row">
						<label>
							Users (all when empty)
							<div id="import-schedule-edit-users"></div>
						</label>
						<label>
							Clients
							<div id="import-schedule-edit-clients"></div>
						</label>
					</div>
					<div class="row">
						<label>
							Projects
							<div id="import-schedule-edit-projects"></div>
						</label>
					</div>
					<div class="actions">
						<button class="primary" type="submit">Save</button>
					</div>
				</form>
			</div>
		</section>
	`)

	if (!Number.isInteger(scheduleId)) {
		setStatus("import-schedule-detail-status", "Invalid schedule id.", true)
		return
	}
	attachImportScheduleDetailEvents(scheduleId)
	void loadImportScheduleDetailPage(scheduleId)
}
