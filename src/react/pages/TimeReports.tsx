import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react"
import { apiFetch } from "../api"
import { navigate, useLocation } from "../router"
import { Empty, Status, formatDuration, formatReceiptDateTime, type Client, type Project, type TimeEntry } from "../lib"
import { EntryCreateModal, EntryEditModal } from "./TimeEntryForms"
import * as data from "./time-report-data"

const style = (values: Record<string, string | number>) => values as CSSProperties
const Color = ({ color }: { color: string }) => <span className="time-color" style={style({ "--time-color": color })} />
const reportQuery = (from: string, to: string) => `/api/time-report?${new URLSearchParams({ from, to })}`
const entriesQuery = (from: string, to: string) => `/api/time-entries?${new URLSearchParams({ from, to, sort: "started_at", order: "desc" })}`
const timeOfDay = (date: Date) => new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date)

// Ignore stale responses on date changes and cancel reads when leaving a report.
const useReportData = <T,>(key: string, load: (signal: AbortSignal) => Promise<T>) => {
	const loader = useRef(load)
	loader.current = load
	const [revision, setRevision] = useState(0)
	const [state, setState] = useState<{ key: string; value: T | null; error: string }>({ key: "", value: null, error: "" })
	useEffect(() => {
		const controller = new AbortController()
		setState({ key, value: null, error: "" })
		void loader.current(controller.signal).then(value => {
			if (!controller.signal.aborted) setState({ key, value, error: "" })
		}).catch(error => {
			if (!controller.signal.aborted) setState({ key, value: null, error: error instanceof Error ? error.message : "Could not load time report." })
		})
		return () => controller.abort()
	}, [key, revision])
	return { value: state.key === key ? state.value : null, error: state.key === key ? state.error : "", reload: () => setRevision(value => value + 1) }
}

const loadDays = async (days: data.TimeWeeklyDayReport[], signal: AbortSignal) => Promise.all(days.map(async day => ({
	...day,
	report: Date.parse(day.from) >= Date.now() ? data.createEmptyTimeReport(day.from, day.to) : await apiFetch<data.TimeReport>(reportQuery(day.from, day.to), { signal }),
})))

const defaultDay = (days: data.TimeWeeklyDayReport[]) => days.find(day => day.date === data.formatDateInput())?.date ?? days.find(day => day.baselineSeconds > 0)?.date ?? days[0]?.date ?? ""

const DayDetails = ({ day, clients, seconds, total }: { day?: data.TimeWeeklyDayReport; clients: data.TimeOverviewItem[]; seconds?: Map<string, number>; total: number }) => {
	if (!day) return <div className="time-monthly-detail"><Empty message="Select a day." /></div>
	const date = data.localDateFromInput(day.date) ?? new Date(day.from)
	const visible = clients.filter(client => (seconds?.get(client.key) ?? 0) > 0 && total > 0)
	return <div className="time-monthly-detail">
		<div className="time-monthly-detail__title"><strong>{data.formatWeekday(date)} {data.formatShortDate(date)}</strong><span>{formatDuration(day.report?.total_seconds ?? 0)} tracked</span></div>
		<div className="time-monthly-detail__rows">
			{visible.map(client => <div className="time-monthly-detail__row" key={client.key}>
				<div className="time-entry-row__title"><Color color={client.color} /><strong>{client.name}</strong></div>
				<span>{Math.round((seconds!.get(client.key)! / total) * 100)}%</span><span>{formatDuration(seconds!.get(client.key)!)}</span>
			</div>)}
			{!visible.length ? <Empty message="No time details for this day." /> : null}
		</div>
	</div>
}

export const WeeklyChart = ({ days, selectedDate, onSelectDate }: { days: data.TimeWeeklyDayReport[]; selectedDate: string; onSelectDate: (date: string) => void }) => {
	const { clients, dayClientSeconds, dayTotals } = data.getTimePeriodChartData(days)
	const maximum = Math.max(...dayTotals, 0)
	const selected = days.findIndex(day => day.date === selectedDate)
	return <div className="time-weekly-chart">
		<div className="time-weekly-bars" style={style({ "--time-period-days": days.length })}>
			{days.map((day, index) => {
				const total = dayTotals[index] ?? 0
				return <button key={day.date} type="button" className={`time-weekly-day${day.date === selectedDate ? " time-weekly-day--selected" : ""}`} aria-pressed={day.date === selectedDate} onClick={() => onSelectDate(day.date)}>
					<div className={`time-weekly-bar${total <= 0 ? " time-weekly-bar--empty" : ""}`} style={style({ "--time-weekly-fill": maximum > 0 ? `${Math.max(4, total / maximum * 100)}%` : "0%" })}>
						<div className="time-weekly-bar__stack">{clients.map(client => {
							const seconds = dayClientSeconds[index]?.get(client.key) ?? 0
							return seconds > 0 && total > 0 ? <div key={client.key} className="time-weekly-bar__segment" style={style({ "--time-color": client.color, "--time-weekly-segment": `${seconds / total * 100}%` })} title={`${client.name}: ${Math.round(seconds / total * 100)}% (${formatDuration(seconds)})`} /> : null
						})}</div>
					</div>
					<div className="time-weekly-day__label"><strong>{day.shortLabel}</strong><span>{formatDuration(total)}</span></div>
				</button>
			})}
		</div>
		<div className="time-monthly-side">
			<DayDetails day={days[selected]} clients={clients} seconds={dayClientSeconds[selected]} total={dayTotals[selected] ?? 0} />
			<div className="time-monthly-detail__title"><strong>Whole week</strong></div>
			<div className="time-weekly-legend">{clients.map(client => <div key={client.key} className="time-weekly-legend__row">
				<div className="time-entry-row__title"><Color color={client.color} /><strong>{client.name}</strong></div>
				<div className="time-weekly-legend__total"><strong>{formatDuration(client.totalSeconds)}</strong><span>Avg/day {formatDuration(days.length ? client.totalSeconds / days.length : 0)}</span></div>
			</div>)}{!clients.length ? <Empty message="No tracked client time in this week." /> : null}</div>
		</div>
	</div>
}

type Selection = { day: data.TimeWeeklyDayReport; start: number; end: number; dragging: boolean }
const selectionRange = (selection: Selection) => ({ start: Math.min(selection.start, selection.end), end: Math.max(selection.start, selection.end) })
const minuteAtPointer = (event: PointerEvent<HTMLDivElement>) => {
	const rect = event.currentTarget.getBoundingClientRect()
	return Math.max(0, Math.min(1440, Math.round(((event.clientY - rect.top) / rect.height * 1440) / 15) * 15))
}
const dateAtMinute = (day: data.TimeWeeklyDayReport, minute: number) => {
	const date = new Date(day.from)
	date.setHours(0, minute, 0, 0)
	return date
}

export const WeeklyDetail = ({ days, entries, onAddRange, onEditEntry }: { days: data.TimeWeeklyDayReport[]; entries: TimeEntry[]; onAddRange: (range: data.TimeEntryRangeInput) => void; onEditEntry: (entry: TimeEntry) => void }) => {
	const [selection, setSelection] = useState<Selection | null>(null)
	const active = useRef<Selection | null>(null)
	const update = (next: Selection | null) => { active.current = next; setSelection(next) }
	return <div className="time-weekly-detail">
		<div className="time-weekly-detail__header"><div className="time-weekly-detail__corner" />{days.map(day => <div key={day.date} className="time-weekly-detail__day-heading"><strong>{data.formatWeekday(new Date(day.from))}, {data.formatShortDate(new Date(day.from))}</strong><span>{formatDuration(day.report?.total_seconds ?? 0)}</span></div>)}</div>
		<div className="time-weekly-detail__body">
			<div className="time-weekly-detail__hours">{Array.from({ length: 24 }, (_, hour) => <span key={hour}>{String(hour).padStart(2, "0")}:00</span>)}</div>
			{days.map(day => {
				const range = selection?.day.date === day.date ? selectionRange(selection) : null
				return <div key={day.date} className="time-weekly-detail__day" aria-label={day.label} onPointerDown={event => {
					if (event.button !== 0 || (event.target as Element).closest("button, .time-weekly-detail-selection")) return
					event.preventDefault()
					const minute = minuteAtPointer(event)
					update({ day, start: minute, end: minute, dragging: true })
					event.currentTarget.setPointerCapture(event.pointerId)
				}} onPointerMove={event => {
					if (active.current?.dragging && active.current.day.date === day.date) update({ ...active.current, end: minuteAtPointer(event) })
				}} onPointerUp={event => {
					if (!active.current?.dragging || active.current.day.date !== day.date) return
					const next = { ...active.current, end: minuteAtPointer(event), dragging: false }
					const bounds = selectionRange(next)
					update(bounds.end - bounds.start >= 15 ? next : null)
					event.currentTarget.releasePointerCapture(event.pointerId)
				}} onPointerCancel={() => update(null)}>
					{entries.map(entry => {
						const start = Math.max(Date.parse(day.from), Date.parse(entry.started_at))
						const end = Math.min(Date.parse(day.to), entry.ended_at ? Date.parse(entry.ended_at) : Date.now())
						if (end <= start) return null
						const startDate = new Date(start)
						const endDate = new Date(end)
						const project = entry.project
						const name = entry.description?.trim() || "No description"
						return <button type="button" key={entry.id} className="time-weekly-detail-entry" style={style({ "--entry-top": `${(startDate.getHours() * 60 + startDate.getMinutes()) / 1440 * 100}%`, "--entry-height": `${Math.max(1, (end - start) / 60000) / 1440 * 100}%`, "--time-color": project?.color ?? data.UNKNOWN_TIME_COLOR })} title={`${name} - ${timeOfDay(startDate)} to ${timeOfDay(endDate)}`} onClick={() => onEditEntry(entry)}>
							<strong>{name}</strong><div className="time-weekly-detail-entry__project"><Color color={project?.color ?? data.UNKNOWN_TIME_COLOR} /><span>{project?.name ?? (entry.project_id === null ? "No project" : "Unknown project")}{project?.client ? ` - ${project.client.name}` : ""}</span></div>
							<div className="time-weekly-detail-entry__meta"><span>{timeOfDay(startDate)} - {timeOfDay(endDate)}</span><span>{formatDuration((end - start) / 1000)}</span></div>
						</button>
					})}
					{range && selection ? <div className="time-weekly-detail-selection" style={style({ "--selection-top": `${range.start / 1440 * 100}%`, "--selection-height": `${Math.max(15, range.end - range.start) / 1440 * 100}%` })}>
						<div className="time-weekly-detail-selection__label">{timeOfDay(dateAtMinute(day, range.start))} - {formatDuration((range.end - range.start) * 60)}</div>
						{!selection.dragging ? <button type="button" className="primary time-weekly-detail-selection__add" onClick={() => onAddRange({ startedAt: data.formatDateTimeLocalInput(dateAtMinute(day, range.start)), endedAt: data.formatDateTimeLocalInput(dateAtMinute(day, range.end)) })}>Add</button> : null}
					</div> : null}
				</div>
			})}
		</div>
		{!entries.length ? <div className="empty time-weekly-detail__empty">No time entries in this week.</div> : null}
	</div>
}

export const TimeWeeklyPage = (_props: { link: (path: string) => string }) => {
	const location = useLocation()
	const week = data.getCurrentTimeWeeklyDate()
	const view = data.getCurrentTimeWeeklyViewMode()
	const [selectedDate, setSelectedDate] = useState("")
	const [range, setRange] = useState<data.TimeEntryRangeInput | null>(null)
	const [editing, setEditing] = useState<TimeEntry | null>(null)
	const result = useReportData(`week:${week}`, async signal => {
		const days = data.getTimeWeeklyDays(week)
		const [reports, entries, projects, clients] = await Promise.all([
			loadDays(days, signal),
			apiFetch<TimeEntry[]>(entriesQuery(days[0]!.from, days[6]!.to), { signal }),
			apiFetch<Project[]>("/api/projects?sort=name&order=asc", { signal }),
			apiFetch<Client[]>("/api/clients?sort=name&order=asc", { signal }),
		])
		return { days: reports, entries, projects, clients }
	})
	const choose = (date: string, mode = view) => {
		data.updateTimeWeeklyViewUrl(date, mode)
		navigate(`${window.location.pathname}${window.location.search}`)
		setRange(null)
		setEditing(null)
	}
	const move = (offset: number) => {
		const date = data.localDateFromInput(week) ?? new Date()
		date.setDate(date.getDate() + offset)
		choose(data.formatDateInput(new Date(Math.min(date.getTime(), Date.now()))))
	}
	const value = result.value
	const selected = value?.days.some(day => day.date === selectedDate) ? selectedDate : defaultDay(value?.days ?? [])
	return <section className="time-block" data-location={location.path}>
		<div className="time-weekly-toolbar">
			<Status message={result.error || (!value ? "Loading weekly time..." : "")} error={!!result.error} />
			<div className="spending-breakdown-controls time-overview-controls time-weekly-controls">
				<button type="button" className="secondary" onClick={() => move(-7)}>Previous Week</button>
				<input id="time-weekly-date-input" type="date" aria-label="Week" value={week} max={data.formatDateInput()} onChange={event => choose(event.target.value || data.formatDateInput())} />
				<select id="time-weekly-view-select" aria-label="View" value={view} onChange={event => choose(week, event.target.value === "detail" ? "detail" : "summary")}><option value="summary">Summary</option><option value="detail">Detail</option></select>
				<button type="button" className="secondary" disabled={data.startOfLocalWeek(data.localDateFromInput(week) ?? new Date()) >= data.startOfLocalWeek(new Date())} onClick={() => move(7)}>Next Week</button>
			</div>
		</div>
		<div className="time-overview-results">{value ? view === "detail" ? <WeeklyDetail key={week} days={value.days} entries={value.entries} onAddRange={setRange} onEditEntry={setEditing} /> : <WeeklyChart days={value.days} selectedDate={selected} onSelectDate={setSelectedDate} /> : <Empty message="Choose a week to load time usage." />}</div>
		{value ? <>
			<EntryCreateModal projects={value.projects} clients={value.clients} entries={value.entries} range={range ?? undefined} open={range !== null} onClose={() => setRange(null)} onSaved={result.reload} />
			<EntryEditModal clients={value.clients} entry={editing} entries={value.entries} projects={value.projects} open={editing !== null} onClose={() => setEditing(null)} onSaved={result.reload} onDeleted={result.reload} />
		</> : null}
	</section>
}

export const MonthlyCalendar = ({ days, selectedDate, onSelectDate }: { days: data.TimeWeeklyDayReport[]; selectedDate: string; onSelectDate: (date: string) => void }) => {
	const { clients, dayClientSeconds, dayTotals } = data.getTimePeriodChartData(days)
	const first = data.localDateFromInput(days[0]?.date ?? data.formatDateInput())!
	const selected = days.findIndex(day => day.date === selectedDate)
	const total = dayTotals.reduce((sum, seconds) => sum + seconds, 0)
	return <div className="time-monthly-calendar-layout">
		<div className="time-monthly-calendar">
			{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => <div key={day} className="time-monthly-weekday">{day}</div>)}
			{Array.from({ length: (first.getDay() + 6) % 7 }, (_, index) => <div key={index} className="time-monthly-day time-monthly-day--blank" />)}
			{days.map((day, index) => {
				const total = dayTotals[index] ?? 0
				return <button key={day.date} type="button" className={`time-monthly-day${day.date === selectedDate ? " time-monthly-day--selected" : ""}${total <= 0 ? " time-monthly-day--empty" : ""}`} aria-pressed={day.date === selectedDate} aria-label={day.label} onClick={() => onSelectDate(day.date)}>
					<div className="time-monthly-day__header"><strong>{day.shortLabel}</strong><span>{data.formatWeekday(new Date(day.from))}</span></div>
					<span className="time-monthly-day__total">{total > 0 ? formatDuration(day.report?.total_seconds ?? 0) : "Future"}</span>
					<div className="time-monthly-day__bar">{clients.map(client => {
						const seconds = dayClientSeconds[index]?.get(client.key) ?? 0
						return seconds > 0 && total > 0 ? <div key={client.key} className="time-monthly-day__segment" style={style({ "--time-color": client.color, "--time-monthly-segment": `${seconds / total * 100}%` })} title={`${client.name}: ${Math.round(seconds / total * 100)}% (${formatDuration(seconds)})`} /> : null
					})}</div>
				</button>
			})}
		</div>
		<div className="time-monthly-side">
			<DayDetails day={days[selected]} clients={clients} seconds={dayClientSeconds[selected]} total={dayTotals[selected] ?? 0} />
			<div className="time-monthly-detail__title"><strong>Whole month</strong></div>
			<div className="time-monthly-detail__rows">{clients.map(client => <div key={client.key} className="time-monthly-detail__row"><div className="time-entry-row__title"><Color color={client.color} /><strong>{client.name}</strong></div><span>{total ? Math.round(client.totalSeconds / total * 100) : 0}%</span><span>{formatDuration(client.totalSeconds)}</span></div>)}{!clients.length ? <Empty message="No tracked client time in this month." /> : null}</div>
		</div>
	</div>
}

export const TimeMonthlyPage = (_props: { link: (path: string) => string }) => {
	useLocation()
	const month = data.getCurrentTimeMonthlyDate()
	const result = useReportData(`month:${month}`, signal => loadDays(data.getTimeMonthlyDays(month), signal))
	const days = result.value
	const choose = (value: string) => { data.updateTimeMonthlyUrl(value); navigate(`${window.location.pathname}${window.location.search}`) }
	const move = (offset: number) => {
		const date = data.localMonthFromInput(month) ?? new Date()
		date.setMonth(date.getMonth() + offset)
		choose(data.formatMonthInput(new Date(Math.min(date.getTime(), Date.now()))))
	}
	const reports = days?.flatMap(day => day.report ? [day.report] : []) ?? []
	const total = reports.reduce((sum, report) => sum + report.total_seconds, 0)
	const activeDays = reports.filter(report => report.total_seconds > 0).length
	const clients = new Set(reports.flatMap(report => report.client_totals.map(data.clientTotalKey)))
	return <section className="time-block"><div className="time-overview-results">
		<div className="time-report-summary time-overview-summary time-monthly-summary">
			<Status message={result.error || (!days ? "Loading monthly time..." : "")} error={!!result.error} />
			{days ? <><div><span>Total Time</span><strong>{formatDuration(total)}</strong></div><div><span>Daily Average</span><strong>{activeDays ? formatDuration(total / activeDays) : "No active days"}</strong></div><div><span>Clients</span><strong>{clients.size}</strong></div><div><span>Month</span><strong>{data.formatMonth(data.localMonthFromInput(month) ?? new Date())}</strong></div></> : null}
			<div className="spending-breakdown-controls time-overview-controls time-weekly-controls">
				<button type="button" className="secondary" onClick={() => move(-1)}>Previous Month</button>
				<label>Month<input id="time-monthly-date-input" type="month" value={month} max={data.formatMonthInput()} onChange={event => choose(event.target.value || data.formatMonthInput())} /></label>
				<button type="button" className="secondary" disabled={month >= data.formatMonthInput()} onClick={() => move(1)}>Next Month</button>
			</div>
		</div>
		{days ? <MonthlyCalendar days={days} selectedDate={defaultDay(days)} onSelectDate={date => navigate(`/time/weekly?week=${encodeURIComponent(date)}`)} /> : <Empty message="Choose a month to load time usage." />}
	</div></section>
}

export const OverviewPie = ({ items, group }: { items: data.TimeOverviewItem[]; group: data.TimeOverviewGroup }) => {
	const total = items.reduce((sum, item) => sum + item.totalSeconds, 0)
	let cursor = 0
	return <div className={`time-overview-pie${total <= 0 ? " time-overview-pie--empty" : ""}`} aria-label={total > 0 ? `${group} time usage pie chart` : `No ${group} time in this span`}>
		{total > 0 ? <svg viewBox="0 0 100 100" role="img" aria-label={`${group} time usage pie chart`}>{items.map(item => {
			const start = cursor
			cursor += item.totalSeconds / total * 100
			const title = <title>{`${item.name}: ${Math.round(item.totalSeconds / total * 100)}% (${formatDuration(item.totalSeconds)})`}</title>
			return cursor - start >= 99.999 ? <circle key={item.key} cx="50" cy="50" r="50" fill={item.color}>{title}</circle> : <path key={item.key} d={data.describePieSegment(start, cursor)} fill={item.color}>{title}</path>
		})}</svg> : null}
	</div>
}

const OverviewList = ({ report, average, group, entries, period, selection, items }: { report: data.TimeReport; average: data.TimeOverviewAverage | null; group: data.TimeOverviewGroup; entries: TimeEntry[]; period: data.TimeOverviewPeriod; selection: data.TimeOverviewSelection; items: data.TimeOverviewItem[] }) => {
	const itemTotal = items.reduce((sum, item) => sum + item.totalSeconds, 0)
	const row = (item: data.TimeOverviewItem, rowGroup: data.TimeOverviewGroup, total: number, className = "") => {
		const averageSeconds = item.synthetic ? Math.max(0, (average?.baselineSeconds ?? 0) - (average?.totalSeconds ?? 0)) : rowGroup === "client" ? average?.clientSecondsByKey.get(item.key) ?? 0 : average?.projectSecondsByKey.get(item.key) ?? 0
		const next = rowGroup === "client" ? { ...selection, clientKey: item.key, projectKey: null } : { ...selection, clientKey: null, projectKey: item.key }
		return <div key={item.key} className={`time-report-row time-overview-row${className ? ` ${className}` : ""}`}>
			<div className="time-overview-row__main"><div className="time-entry-row__title"><Color color={item.color} />{item.synthetic ? <strong>{item.name}</strong> : <a className="time-overview-row__link" href={data.getTimeOverviewUrl(next)} onClick={event => {
				if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
				event.preventDefault()
				event.stopPropagation()
				navigate(data.getTimeOverviewUrl(next))
			}}>{item.name}</a>}</div><span className="section-copy">{item.synthetic ? "24h minus tracked time" : `${rowGroup === "client" ? `${item.projectCount ?? 0} project${item.projectCount === 1 ? "" : "s"} - ` : ""}${item.entryCount} entr${item.entryCount === 1 ? "y" : "ies"}`}</span></div>
			<div className="time-overview-row__total"><strong>{formatDuration(item.totalSeconds)}</strong><span>{total ? Math.round(item.totalSeconds / total * 100) : 0}%</span><span>Avg/day {average?.dayCount ? formatDuration(averageSeconds / average.dayCount) : "No full days"}</span><span>Avg/week {average?.dayCount ? formatDuration(averageSeconds / average.dayCount * 7) : "No full days"}</span></div>
		</div>
	}
	const projectGroup = (project: data.TimeOverviewItem, total: number, className = ""): ReactNode => {
		const groups = new Map<string, data.TimeOverviewEntryGroup>()
		for (const entry of entries) {
			const seconds = data.timeEntryDurationInPeriod(entry, period)
			if (project.key !== data.projectTotalKey(entry.project_id) || seconds <= 0) continue
			const description = entry.description?.trim() || "No description"
			const key = description.toLocaleLowerCase()
			const existing = groups.get(key)
			if (existing) {
				existing.entryCount++
				existing.totalSeconds += seconds
				if (Date.parse(entry.started_at) > Date.parse(existing.latestStartedAt)) existing.latestStartedAt = entry.started_at
			} else groups.set(key, { description, entryCount: 1, totalSeconds: seconds, latestStartedAt: entry.started_at })
		}
		const sorted = [...groups.values()].sort((a, b) => b.totalSeconds - a.totalSeconds || Date.parse(b.latestStartedAt) - Date.parse(a.latestStartedAt))
		const entryRows = sorted.length ? <div className="time-overview-project-entries">{sorted.map(entry => <div key={entry.description.toLocaleLowerCase()} className="time-overview-entry-row"><div className="time-overview-entry-row__main"><strong>{entry.description}</strong><span className="section-copy">{entry.entryCount} entr{entry.entryCount === 1 ? "y" : "ies"} - Latest {formatReceiptDateTime(entry.latestStartedAt)}</span></div><strong>{formatDuration(entry.totalSeconds)}</strong></div>)}</div> : null
		if (selection.projectKey === project.key) return <div key={project.key} className={`time-overview-project-detail ${className}`}>{row(project, "project", total)}{entryRows}</div>
		if (!sorted.length) return row(project, "project", total, className)
		return <details key={project.key} className={`time-overview-project-group ${className}`}><summary aria-label={`Show time entries for ${project.name}`}>{row(project, "project", total)}</summary>{entryRows}</details>
	}
	return <div className="time-report-list time-overview-list">
		{!items.length ? <Empty message={`No tracked ${group} time in this span.`} /> : null}
		{items.map(item => {
			if (group === "project") return projectGroup(item, itemTotal)
			if (item.synthetic) return row(item, group, itemTotal)
			const projects = report.project_totals.filter(project => project.project_id !== null && (item.key === "No client" ? project.client_id === null : project.client_id !== null && String(project.client_id) === item.key)).map(project => ({ key: data.projectTotalKey(project.project_id), name: project.project_name, color: project.project_color, totalSeconds: project.total_seconds, entryCount: project.entry_count })).sort((a, b) => b.totalSeconds - a.totalSeconds || a.name.localeCompare(b.name))
			if (!projects.length) return row(item, "client", itemTotal)
			return <details key={item.key} className="time-overview-client-group"><summary aria-label={`Show projects for ${item.name}`}>{row(item, "client", itemTotal)}</summary><div className="time-overview-client-projects">{projects.map(project => projectGroup(project, item.totalSeconds, "time-overview-project-row"))}</div></details>
		})}
	</div>
}

export const TimeOverviewPage = (_props: { link: (path: string) => string }) => {
	const location = useLocation()
	const selection = data.getCurrentTimeOverviewSelection()
	const result = useReportData(`overview:${location.search}`, async signal => {
		const period = data.getTimeOverviewPeriod(selection)
		const averagePeriod = data.getFullLocalDayBounds(period)
		const reportPromise = apiFetch<data.TimeReport>(reportQuery(period.from, period.to), { signal })
		const [report, entries, averageReport] = await Promise.all([
			reportPromise,
			apiFetch<TimeEntry[]>(entriesQuery(period.from, period.to), { signal }),
			averagePeriod ? averagePeriod.from === period.from && averagePeriod.to === period.to ? reportPromise : apiFetch<data.TimeReport>(reportQuery(averagePeriod.from, averagePeriod.to), { signal }) : Promise.resolve(null),
		])
		const average: data.TimeOverviewAverage | null = averageReport && averagePeriod ? {
			totalSeconds: averageReport.total_seconds,
			dayCount: data.countFullLocalDays(averagePeriod),
			baselineSeconds: data.countFullLocalDays(averagePeriod) * data.DAY_SECONDS,
			projectSecondsByKey: new Map(averageReport.project_totals.map(project => [data.projectTotalKey(project.project_id), project.total_seconds])),
			clientSecondsByKey: new Map(averageReport.client_totals.map(client => [data.clientTotalKey(client), client.total_seconds])),
		} : null
		return { report, entries, period, average }
	})
	const choose = (next: data.TimeOverviewSelection) => { data.updateTimeOverviewUrl(next); navigate(`${window.location.pathname}${window.location.search}`) }
	const range = (field: "fromDay" | "toDay", value: string) => {
		const next = { ...selection, [field]: value || data.formatDateInput(), span: data.getTimeOverviewSpan("custom-range") }
		if (next.fromDay > next.toDay) {
			if (field === "fromDay") next.toDay = next.fromDay
			else next.fromDay = next.toDay
		}
		choose(next)
	}
	const value = result.value
	const group = selection.clientKey || selection.projectKey ? "project" : "client"
	const report = value ? data.filterTimeOverviewReport(value.report, selection) : null
	const items = report ? data.getTimeOverviewItems(report, group, selection.clientKey || selection.projectKey ? undefined : data.getTimeOverviewBaselineSeconds(selection)) : []
	return <section className="time-block">
		<div className="spending-breakdown-controls time-overview-controls">
			<label>Span<select id="time-overview-span-select" value={selection.span.value} onChange={event => choose({ ...selection, span: data.getTimeOverviewSpan(event.target.value) })}>{data.TIME_OVERVIEW_SPANS.map(span => <option key={span.value} value={span.value}>{span.label}</option>)}</select></label>
			<label hidden={selection.span.value !== "custom-day"}>Day<input id="time-overview-day-input" type="date" max={data.formatDateInput()} value={selection.day} onChange={event => choose({ ...selection, day: event.target.value || data.formatDateInput() })} /></label>
			<label hidden={selection.span.value !== "custom-range"}>From<input id="time-overview-from-input" type="date" max={data.formatDateInput()} value={selection.fromDay} onChange={event => range("fromDay", event.target.value)} /></label>
			<label hidden={selection.span.value !== "custom-range"}>To<input id="time-overview-to-input" type="date" max={data.formatDateInput()} value={selection.toDay} onChange={event => range("toDay", event.target.value)} /></label>
			<button type="button" className="secondary" hidden={!selection.clientKey && !selection.projectKey} onClick={() => choose({ ...selection, clientKey: null, projectKey: null })}>Show All</button>
		</div>
		<Status message={result.error || (!value ? "Loading time overview..." : `Loaded ${selection.span.label.toLowerCase()} time usage.`)} error={!!result.error} />
		<div className="time-overview-results">{value && report ? <div className="time-overview-chart"><OverviewPie items={items} group={group} /><OverviewList report={report} average={value.average} group={group} entries={value.entries} period={value.period} selection={selection} items={items} /></div> : <Empty message="Choose a span to load time usage." />}</div>
	</section>
}
