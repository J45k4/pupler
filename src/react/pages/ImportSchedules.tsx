import { useState } from "react"
import { apiFetch } from "../api"
import { Empty, Modal, Status, toDateTimeLocalValue, useApi } from "../lib"
import type { ExternalIntegration } from "./Integrations"

export type ImportSchedule = {
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

type ScheduleClient = { id: number; name: string; archived_at: string | null }

type ScheduleParams = {
	lookback_days?: number | null
	dry_run?: boolean
	target_client_id?: number | null
	user_ids?: string[]
	client_ids?: string[]
	project_ids?: string[]
}

type ClockifyOptions = {
	users?: Array<{ id: string; name: string; email: string | null }>
	clients: Array<{ id: string; name: string }>
	projects: Array<{ id: string; name: string; client_id: string | null; client_name: string | null }>
}

const PROVIDER_CLOCKIFY = 1
const STATUS_ACTIVE = 1
const STATUS_PAUSED = 2

const cadenceOptions = [
	{ value: 1, label: "Manual" },
	{ value: 2, label: "Hourly" },
	{ value: 3, label: "Daily" },
	{ value: 4, label: "Weekly" },
]

const formatDateTime = (value: string | null | undefined) =>
	value
		? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
		: "Not set"

const parseJson = <T,>(value: string | null, fallback: T): T => {
	if (!value) return fallback
	try {
		return JSON.parse(value) as T
	} catch {
		return fallback
	}
}

const lookbackLabel = (params: ScheduleParams) =>
	params.lookback_days === null ? "All history" : `${params.lookback_days ?? 14} day lookback`

export const ImportSchedulesPage = ({ link }: { link: (p: string) => string }) => {
	const { data: integrations } = useApi<ExternalIntegration[]>("/api/external-integrations")
	const { data: schedules, loading: sLoading, error: sError, reload } = useApi<ImportSchedule[]>("/api/import-schedules")
	const { data: clients } = useApi<ScheduleClient[]>("/api/clients?archived_at=null&sort=name&order=asc")

	const [status, setStatus] = useState("Loading schedules...")
	const [statusError, setStatusError] = useState(false)
	const [modalOpen, setModalOpen] = useState(false)
	const [modalStatus, setModalStatus] = useState("")

	const [integrationId, setIntegrationId] = useState("")
	const [name, setName] = useState("Daily Clockify")
	const [cadence, setCadence] = useState("3")
	const [timezone, setTimezone] = useState("Europe/Helsinki")
	const [lookbackDays, setLookbackDays] = useState("14")
	const [nextRunAt, setNextRunAt] = useState("")
	const [targetClientId, setTargetClientId] = useState("")
	const [dryRun, setDryRun] = useState(false)

	const clockifyIntegrations = (integrations ?? []).filter((i) => i.provider === PROVIDER_CLOCKIFY)
	const clientNames = new Map((clients ?? []).map((c) => [c.id, c.name]))
	const rows = schedules ?? []

	const run = async (id: number) => {
		try {
			await apiFetch(`/api/import-schedules/${id}/run`, { method: "POST", body: "{}" })
			setStatus("Import job queued.")
			setStatusError(false)
			reload()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to queue import job.")
			setStatusError(true)
		}
	}

	const create = async (event: React.FormEvent) => {
		event.preventDefault()
		try {
			const lookback = lookbackDays.trim() ? Number(lookbackDays) : null
			const next = nextRunAt.trim() ? new Date(nextRunAt) : null
			if (next && Number.isNaN(next.getTime())) throw new Error("Next run time is invalid.")
			await apiFetch("/api/import-schedules", {
				method: "POST",
				body: JSON.stringify({
					integration_id: Number(integrationId),
					name,
					cadence: Number(cadence),
					timezone,
					lookback_days: lookback,
					dry_run: dryRun,
					target_client_id: targetClientId ? Number(targetClientId) : null,
					user_ids: [],
					client_ids: [],
					project_ids: [],
					next_run_at: next ? next.toISOString() : null,
				}),
			})
			setModalOpen(false)
			setStatus("Schedule created.")
			setStatusError(false)
			reload()
		} catch (err) {
			setModalStatus(err instanceof Error ? err.message : "Failed to create schedule.")
		}
	}

	return (
		<>
			<section className="workspace workspace--single">
				<div className="card panel">
					<div className="section-header">
						<h2>Schedules</h2>
						<button id="schedule-create-button" className="primary" type="button" onClick={() => { setModalStatus(""); setModalOpen(true) }}>
							Create Schedule
						</button>
					</div>
					<Status message={sLoading ? "Loading schedules..." : (sError ?? status) || "Schedules loaded."} error={!!sError || statusError} />
					<div id="import-schedules-list" className="integration-list">
						{!sLoading && !sError && rows.length === 0 ? <Empty message="No import schedules yet." /> : null}
						{rows.map((schedule) => {
							const params = parseJson<ScheduleParams>(schedule.params_json, {})
							const target = params.target_client_id
								? (clientNames.get(params.target_client_id) ?? `Client ${params.target_client_id}`)
								: "Clockify clients"
							const cursor = parseJson<{ last_successful_to?: string }>(schedule.cursor_json, {})
							return (
								<div key={schedule.id} className="integration-row">
									<div>
										<strong>{schedule.name}</strong>
										<div className="section-copy">
											{cadenceOptions.find((o) => o.value === schedule.cadence)?.label ?? `Cadence ${schedule.cadence}`} · {schedule.timezone} · {lookbackLabel(params)}
											{params.dry_run ? " · dry run" : ""}
										</div>
										<div className="section-copy">Pupler client: {target}</div>
										<div className="section-copy">
											{(params.user_ids?.length ?? 0) || (params.client_ids?.length ?? 0) || (params.project_ids?.length ?? 0)
												? `${params.user_ids?.length ?? 0} users · ${params.client_ids?.length ?? 0} clients · ${params.project_ids?.length ?? 0} projects`
												: "All users, clients and projects"}
										</div>
										<div className="section-copy">
											Last run: {formatDateTime(schedule.last_run_at)} · Last success: {formatDateTime(cursor.last_successful_to)}
										</div>
									</div>
									<div className="integration-row__meta">
										<span className="tag">{schedule.status === STATUS_ACTIVE ? "Active" : "Paused"}</span>
										<span>Next {formatDateTime(schedule.next_run_at)}</span>
										<a className="secondary" href={link(`/import-schedules/${schedule.id}`)} data-link="">
											Edit
										</a>
										<button className="secondary" type="button" onClick={() => void run(schedule.id)}>
											Run
										</button>
									</div>
								</div>
							)
						})}
					</div>
				</div>
			</section>
			<Modal id="schedule-create-modal" title="Create Schedule" open={modalOpen} onClose={() => setModalOpen(false)}>
				<form id="clockify-schedule-form" className="integration-schedule-form" onSubmit={create}>
					<div className="row">
						<label>
							Integration
							<select name="integration_id" required value={integrationId} onChange={(e) => setIntegrationId(e.target.value)}>
								<option value="">Pick integration</option>
								{clockifyIntegrations.map((i) => (
									<option key={i.id} value={String(i.id)}>
										{i.name}
									</option>
								))}
							</select>
						</label>
						<label>
							Name
							<input name="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} />
						</label>
					</div>
					<div className="row">
						<label>
							Cadence
							<select name="cadence" value={cadence} onChange={(e) => setCadence(e.target.value)}>
								{cadenceOptions.map((o) => (
									<option key={o.value} value={String(o.value)}>
										{o.label}
									</option>
								))}
							</select>
						</label>
						<label>
							Timezone
							<input name="timezone" type="text" required value={timezone} onChange={(e) => setTimezone(e.target.value)} />
						</label>
					</div>
					<div className="row">
						<label>
							Lookback Days
							<input name="lookback_days" type="number" min="1" placeholder="Blank imports all history" value={lookbackDays} onChange={(e) => setLookbackDays(e.target.value)} />
						</label>
						<label>
							Next Run At
							<input name="next_run_at" type="datetime-local" value={nextRunAt} onChange={(e) => setNextRunAt(e.target.value)} />
						</label>
					</div>
					<label>
						Pupler Client
						<select name="target_client_id" value={targetClientId} onChange={(e) => setTargetClientId(e.target.value)}>
							<option value="">Use Clockify clients</option>
							{(clients ?? []).map((c) => (
								<option key={c.id} value={String(c.id)}>
									{c.name}
								</option>
							))}
						</select>
					</label>
					<label className="checkbox-line">
						<input name="dry_run" type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
						Dry run
					</label>
					<div className="actions">
						<button className="primary" type="submit">
							Create
						</button>
						<button className="secondary" type="button" onClick={() => setModalOpen(false)}>
							Cancel
						</button>
					</div>
					<Status message={modalStatus} error={!!modalStatus} />
				</form>
			</Modal>
		</>
	)
}

export const ImportScheduleDetailPage = ({ id, link }: { id: string; link: (p: string) => string }) => {
	const scheduleId = Number.parseInt(id, 10)
	const valid = Number.isInteger(scheduleId)
	const { data: integrations } = useApi<ExternalIntegration[]>("/api/external-integrations")
	const { data: schedule, loading: sLoading, error: sError, reload } = useApi<ImportSchedule>(
		valid ? `/api/import-schedules/${scheduleId}` : null,
	)
	const { data: clients } = useApi<ScheduleClient[]>("/api/clients?archived_at=null&sort=name&order=asc")
	const { data: options } = useApi<ClockifyOptions>(
		schedule ? `/api/external-integrations/${schedule.integration_id}/clockify-options` : null,
	)

	const [status, setStatus] = useState<string | null>(null)
	const [statusError, setStatusError] = useState(false)
	const [form, setForm] = useState({
		status: "",
		integration_id: "",
		name: "",
		cadence: "",
		timezone: "",
		lookback_days: "",
		next_run_at: "",
		target_client_id: "",
		dry_run: false,
		user_ids: [] as string[],
		client_ids: [] as string[],
		project_ids: [] as string[],
		initialized: 0,
	})

	if (schedule && form.initialized !== schedule.id) {
		const params = parseJson<ScheduleParams>(schedule.params_json, {})
		setForm({
			status: String(schedule.status),
			integration_id: String(schedule.integration_id),
			name: schedule.name,
			cadence: String(schedule.cadence),
			timezone: schedule.timezone,
			lookback_days: params.lookback_days === null ? "" : String(params.lookback_days ?? 14),
			next_run_at: schedule.next_run_at ? toDateTimeLocalValue(new Date(schedule.next_run_at)) : "",
			target_client_id: params.target_client_id ? String(params.target_client_id) : "",
			dry_run: params.dry_run ?? false,
			user_ids: params.user_ids ?? [],
			client_ids: params.client_ids ?? [],
			project_ids: params.project_ids ?? [],
			initialized: schedule.id,
		})
	}

	if (!valid) return <div className="card panel page-panel"><p className="page-copy">Invalid schedule id.</p></div>

	const clockifyIntegrations = (integrations ?? []).filter((i) => i.provider === PROVIDER_CLOCKIFY)
	const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

	const save = async (event: React.FormEvent) => {
		event.preventDefault()
		try {
			const next = form.next_run_at.trim() ? new Date(form.next_run_at) : null
			if (next && Number.isNaN(next.getTime())) throw new Error("Next run time is invalid.")
			await apiFetch(`/api/import-schedules/${scheduleId}`, {
				method: "PATCH",
				body: JSON.stringify({
					integration_id: Number(form.integration_id),
					name: form.name,
					cadence: Number(form.cadence),
					timezone: form.timezone,
					lookback_days: form.lookback_days.trim() ? Number(form.lookback_days) : null,
					dry_run: form.dry_run,
					target_client_id: form.target_client_id ? Number(form.target_client_id) : null,
					user_ids: form.user_ids,
					client_ids: form.client_ids,
					project_ids: form.project_ids,
					next_run_at: next ? next.toISOString() : null,
					status: Number(form.status),
				}),
			})
			setStatus("Schedule saved.")
			setStatusError(false)
			reload()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to save schedule.")
			setStatusError(true)
		}
	}

	const run = async () => {
		try {
			await apiFetch(`/api/import-schedules/${scheduleId}/run`, { method: "POST", body: "{}" })
			setStatus("Import job queued.")
			setStatusError(false)
			reload()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to queue import job.")
			setStatusError(true)
		}
	}

	const selectedClients = new Set(form.client_ids)
	const projectOptions = (options?.projects ?? []).filter(
		(p) => selectedClients.size === 0 || (p.client_id !== null && selectedClients.has(p.client_id)),
	)

	const multiSelect = (
		label: string,
		values: string[],
		choices: Array<{ value: string; label: string }>,
		onChange: (next: string[]) => void,
	) => (
		<label>
			{label}
			<select multiple size={Math.min(8, Math.max(3, choices.length))} value={values} onChange={(e) => onChange(Array.from(e.target.selectedOptions).map((o) => o.value))}>
				{choices.map((c) => (
					<option key={c.value} value={c.value}>
						{c.label}
					</option>
				))}
			</select>
		</label>
	)

	return (
		<>
			<section className="page-heading page-heading--compact">
				<div>
					<h1 className="page-title">Edit Import Schedule</h1>
				</div>
				<div className="actions">
					<a className="secondary" href={link("/import-schedules")} data-link="">
						Back
					</a>
					<button id="import-schedule-run-button" className="secondary" type="button" onClick={() => void run()}>
						Run
					</button>
				</div>
			</section>
			<section className="workspace workspace--single">
				<div className="card panel">
					<div className="section-header">
						<h2>Schedule</h2>
						<Status message={sLoading ? "Loading schedule..." : (sError ?? status) || "Schedule loaded."} error={!!sError || statusError} />
					</div>
					{!sLoading && !sError && schedule ? (
						<form id="import-schedule-edit-form" className="integration-schedule-form" onSubmit={save}>
							<div className="row">
								<label>
									Status
									<select name="status" value={form.status} onChange={(e) => set({ status: e.target.value })}>
										<option value={STATUS_ACTIVE}>Active</option>
										<option value={STATUS_PAUSED}>Paused</option>
									</select>
								</label>
								<label>
									Integration
									<select name="integration_id" required value={form.integration_id} onChange={(e) => set({ integration_id: e.target.value })}>
										{clockifyIntegrations.map((i) => (
											<option key={i.id} value={String(i.id)}>
												{i.name}
											</option>
										))}
									</select>
								</label>
							</div>
							<div className="row">
								<label>
									Name
									<input name="name" type="text" required value={form.name} onChange={(e) => set({ name: e.target.value })} />
								</label>
								<label>
									Cadence
									<select name="cadence" value={form.cadence} onChange={(e) => set({ cadence: e.target.value })}>
										{cadenceOptions.map((o) => (
											<option key={o.value} value={String(o.value)}>
												{o.label}
											</option>
										))}
									</select>
								</label>
							</div>
							<div className="row">
								<label>
									Timezone
									<input name="timezone" type="text" required value={form.timezone} onChange={(e) => set({ timezone: e.target.value })} />
								</label>
								<label>
									Lookback Days
									<input name="lookback_days" type="number" min="1" placeholder="Blank imports all history" value={form.lookback_days} onChange={(e) => set({ lookback_days: e.target.value })} />
								</label>
							</div>
							<div className="row">
								<label>
									Next Run At
									<input name="next_run_at" type="datetime-local" value={form.next_run_at} onChange={(e) => set({ next_run_at: e.target.value })} />
								</label>
								<label>
									Pupler Client
									<select name="target_client_id" value={form.target_client_id} onChange={(e) => set({ target_client_id: e.target.value })}>
										<option value="">Use Clockify clients</option>
										{(clients ?? []).map((c) => (
											<option key={c.id} value={String(c.id)}>
												{c.name}
											</option>
										))}
									</select>
								</label>
							</div>
							<div className="row">
								<label className="checkbox-line">
									<input name="dry_run" type="checkbox" checked={form.dry_run} onChange={(e) => set({ dry_run: e.target.checked })} />
									Dry run
								</label>
							</div>
							<div className="row">
								{multiSelect(
									"Users (all when empty)",
									form.user_ids,
									(options?.users ?? []).map((u) => ({ value: u.id, label: u.email ? `${u.name} - ${u.email}` : u.name })),
									(next) => set({ user_ids: next }),
								)}
								{multiSelect(
									"Clients",
									form.client_ids,
									(options?.clients ?? []).map((c) => ({ value: c.id, label: c.name })),
									(next) => set({ client_ids: next }),
								)}
							</div>
							<div className="row">
								{multiSelect(
									"Projects",
									form.project_ids,
									projectOptions.map((p) => ({ value: p.id, label: p.client_name ? `${p.name} - ${p.client_name}` : p.name })),
									(next) => set({ project_ids: next }),
								)}
							</div>
							<div className="actions">
								<button className="primary" type="submit">
									Save
								</button>
							</div>
						</form>
					) : null}
				</div>
			</section>
		</>
	)
}
