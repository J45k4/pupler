import type { TimeEntry } from "../lib"

export type TimeReportProjectTotal = {
	project_id: number | null
	project_name: string
	project_color: string
	client_id: number | null
	client_name: string | null
	client_color: string | null
	total_seconds: number
	entry_count: number
}

export type TimeReportClientTotal = {
	client_id: number | null
	client_name: string
	client_color: string
	total_seconds: number
	entry_count: number
	project_count: number
}

export type TimeReport = {
	period: {
		from: string | null
		to: string
		range: "custom" | "all"
	}
	total_seconds: number
	project_totals: TimeReportProjectTotal[]
	client_totals: TimeReportClientTotal[]
}

export const TIME_OVERVIEW_SPANS = [
	{ value: "today", label: "Today" },
	{ value: "this-week", label: "This Week" },
	{ value: "last-week", label: "Last Week" },
	{ value: "custom-day", label: "Selected Day" },
	{ value: "custom-range", label: "Custom" },
	{ value: "last-2-weeks", label: "Last 2 Weeks" },
	{ value: "last-30-days", label: "Last 30 Days" },
	{ value: "ytd", label: "YTD" },
] as const

export type TimeOverviewSpan = (typeof TIME_OVERVIEW_SPANS)[number]

export type TimeOverviewSelection = {
	span: TimeOverviewSpan
	day: string
	fromDay: string
	toDay: string
	clientKey: string | null
	projectKey: string | null
}

export type TimeOverviewPeriod = {
	from: string
	to: string
}

export type TimeOverviewAverage = {
	totalSeconds: number
	baselineSeconds: number
	dayCount: number
	projectSecondsByKey: Map<string, number>
	clientSecondsByKey: Map<string, number>
}

export type TimeWeeklyDayReport = {
	date: string
	label: string
	shortLabel: string
	from: string
	to: string
	baselineSeconds: number
	report: TimeReport | null
}

export type TimeWeeklyViewMode = "summary" | "detail"

export type TimeEntryRangeInput = {
	startedAt: string
	endedAt: string
}

export const DAY_SECONDS = 24 * 60 * 60
export const DAYS_PER_WEEK = 7
export const UNKNOWN_TIME_KEY = "__unknown_time__"
export const UNKNOWN_TIME_COLOR = "#cbd5e1"
export const DEFAULT_TIME_OVERVIEW_SPAN = "today"
export type TimeOverviewGroup = "project" | "client"
export const DEFAULT_TIME_OVERVIEW_GROUP: TimeOverviewGroup = "client"

export const timeEntryDurationInPeriod = (
	entry: TimeEntry,
	period: TimeOverviewPeriod,
) => {
	const start = Math.max(Date.parse(entry.started_at), Date.parse(period.from))
	const end = Math.min(
		entry.ended_at ? Date.parse(entry.ended_at) : Date.now(),
		Date.parse(period.to),
	)
	return Math.max(0, Math.floor((end - start) / 1000))
}

export const formatDateTimeLocalInput = (date = new Date()) =>
	new Date(date.getTime() - date.getTimezoneOffset() * 60000)
		.toISOString()
		.slice(0, 16)

export const formatDateInput = (date = new Date()) =>
	new Date(date.getTime() - date.getTimezoneOffset() * 60000)
		.toISOString()
		.slice(0, 10)

export const formatMonthInput = (date = new Date()) =>
	new Date(date.getTime() - date.getTimezoneOffset() * 60000)
		.toISOString()
		.slice(0, 7)

export const formatShortDate = (date: Date) =>
	new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
	}).format(date)

export const formatMonth = (date: Date) =>
	new Intl.DateTimeFormat(undefined, {
		month: "long",
		year: "numeric",
	}).format(date)

export const formatWeekday = (date: Date) =>
	new Intl.DateTimeFormat(undefined, {
		weekday: "short",
	}).format(date)

export const startOfLocalDay = (date: Date) =>
	new Date(date.getFullYear(), date.getMonth(), date.getDate())

export const localDateFromInput = (value: string) => {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
	if (!match) return null
	const [, year, month, day] = match
	const yearValue = Number(year)
	const monthValue = Number(month)
	const dayValue = Number(day)
	const date = new Date(yearValue, monthValue - 1, dayValue)
	return Number.isNaN(date.getTime()) ||
		date.getFullYear() !== yearValue ||
		date.getMonth() !== monthValue - 1 ||
		date.getDate() !== dayValue
		? null
		: date
}

export const localMonthFromInput = (value: string) => {
	const match = /^(\d{4})-(\d{2})$/.exec(value)
	if (!match) return null
	const [, year, month] = match
	const yearValue = Number(year)
	const monthValue = Number(month)
	const date = new Date(yearValue, monthValue - 1, 1)
	return Number.isNaN(date.getTime()) ||
		date.getFullYear() !== yearValue ||
		date.getMonth() !== monthValue - 1
		? null
		: date
}

export const startOfLocalWeek = (date: Date) => {
	const start = startOfLocalDay(date)
	const mondayOffset = (start.getDay() + 6) % 7
	start.setDate(start.getDate() - mondayOffset)
	return start
}

export const startOfLocalMonth = (date: Date) =>
	new Date(date.getFullYear(), date.getMonth(), 1)

export const getTimeOverviewSpan = (
	value: string | null | undefined,
): TimeOverviewSpan =>
	TIME_OVERVIEW_SPANS.find((span) => span.value === value) ??
	TIME_OVERVIEW_SPANS.find(
		(span) => span.value === DEFAULT_TIME_OVERVIEW_SPAN,
	)!

export const getCurrentTimeOverviewSelection = (): TimeOverviewSelection => {
	const params = new URLSearchParams(window.location.search)
	const span = getTimeOverviewSpan(params.get("span"))
	const today = formatDateInput()
	const requestedDay = params.get("day") ?? ""
	const day = localDateFromInput(requestedDay)
		? requestedDay
		: today
	const requestedFromDay = params.get("from") ?? ""
	const requestedToDay = params.get("to") ?? ""
	let fromDay = localDateFromInput(requestedFromDay)
		? requestedFromDay
		: today
	let toDay = localDateFromInput(requestedToDay) ? requestedToDay : today
	if (fromDay > today) fromDay = today
	if (toDay > today) toDay = today
	if (fromDay > toDay) [fromDay, toDay] = [toDay, fromDay]
	return {
		span,
		day,
		fromDay,
		toDay,
		clientKey: params.get("client"),
		projectKey: params.get("project"),
	}
}

export const getCurrentTimeWeeklyDate = () => {
	const params = new URLSearchParams(window.location.search)
	const requestedWeek = params.get("week") ?? ""
	return localDateFromInput(requestedWeek) ? requestedWeek : formatDateInput()
}

export const getCurrentTimeMonthlyDate = () => {
	const params = new URLSearchParams(window.location.search)
	const requestedMonth = params.get("month") ?? ""
	return localMonthFromInput(requestedMonth)
		? requestedMonth
		: formatMonthInput()
}

export const getTimeOverviewPeriod = (selection: TimeOverviewSelection) => {
	const to = new Date()
	const thisWeekStart = startOfLocalWeek(to)
	const from = (() => {
		switch (selection.span.value) {
			case "today":
				return startOfLocalDay(to)
		case "custom-day":
			return localDateFromInput(selection.day) ?? startOfLocalDay(to)
		case "custom-range":
			return localDateFromInput(selection.fromDay) ?? startOfLocalDay(to)
			case "this-week":
				return thisWeekStart
			case "last-week": {
				const date = new Date(thisWeekStart)
				date.setDate(date.getDate() - 7)
				return date
			}
			case "last-2-weeks": {
				const date = startOfLocalDay(to)
				date.setDate(date.getDate() - 13)
				return date
			}
			case "last-30-days": {
				const date = startOfLocalDay(to)
				date.setDate(date.getDate() - 29)
				return date
			}
			case "ytd":
				return new Date(to.getFullYear(), 0, 1)
		}
	})()
	if (
		selection.span.value === "custom-day" ||
		selection.span.value === "custom-range"
	) {
		const endDay =
			selection.span.value === "custom-day"
				? selection.day
				: selection.toDay
		const endDayDate = localDateFromInput(endDay) ?? from
		const end = startOfLocalDay(endDayDate)
		end.setDate(end.getDate() + 1)
		const clippedEndMs = Math.min(end.getTime(), to.getTime())
		return {
			from: from.toISOString(),
			to: new Date(Math.max(from.getTime(), clippedEndMs)).toISOString(),
		}
	}
	if (selection.span.value === "last-week") {
		return { from: from.toISOString(), to: thisWeekStart.toISOString() }
	}
	return { from: from.toISOString(), to: to.toISOString() }
}

export const getFullLocalDayBounds = (period: TimeOverviewPeriod) => {
	const from = new Date(period.from)
	const to = new Date(period.to)
	if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
		return null
	}

	const start = startOfLocalDay(from)
	if (from.getTime() > start.getTime()) {
		start.setDate(start.getDate() + 1)
	}
	const end = startOfLocalDay(to)
	if (start.getTime() >= end.getTime()) {
		return null
	}

	return { from: start.toISOString(), to: end.toISOString() }
}

export const countFullLocalDays = (period: TimeOverviewPeriod) => {
	const bounds = getFullLocalDayBounds(period)
	if (!bounds) {
		return 0
	}

	const end = new Date(bounds.to)
	let days = 0
	for (const cursor = new Date(bounds.from); cursor < end; days += 1) {
		cursor.setDate(cursor.getDate() + 1)
	}
	return days
}

export const countLocalDaysInclusive = (from: Date, to: Date) => {
	const start = startOfLocalDay(from)
	const end = startOfLocalDay(to)
	let days = 0
	for (const cursor = new Date(start); cursor <= end; days += 1) {
		cursor.setDate(cursor.getDate() + 1)
	}
	return days
}

export const getTimeOverviewBaselineSeconds = (selection: TimeOverviewSelection) => {
	const today = startOfLocalDay(new Date())
	switch (selection.span.value) {
		case "today":
		case "custom-day":
			return DAY_SECONDS
		case "custom-range": {
			const from = localDateFromInput(selection.fromDay)
			const to = localDateFromInput(selection.toDay)
			return from && to ? countLocalDaysInclusive(from, to) * DAY_SECONDS : DAY_SECONDS
		}
		case "this-week":
			return (
				countLocalDaysInclusive(startOfLocalWeek(today), today) *
				DAY_SECONDS
			)
		case "last-week":
			return 7 * DAY_SECONDS
		case "last-2-weeks":
			return 14 * DAY_SECONDS
		case "last-30-days":
			return 30 * DAY_SECONDS
		case "ytd":
			return (
				countLocalDaysInclusive(
					new Date(today.getFullYear(), 0, 1),
					today,
				) * DAY_SECONDS
			)
	}
}

export const getTimeOverviewUrl = (selection: TimeOverviewSelection) => {
	const url = new URL(window.location.href)
	url.searchParams.delete("group")
	if (selection.span.value === DEFAULT_TIME_OVERVIEW_SPAN) {
		url.searchParams.delete("span")
	} else {
		url.searchParams.set("span", selection.span.value)
	}
	if (selection.span.value === "custom-day") {
		url.searchParams.set("day", selection.day)
	} else {
		url.searchParams.delete("day")
	}
	if (selection.span.value === "custom-range") {
		url.searchParams.set("from", selection.fromDay)
		url.searchParams.set("to", selection.toDay)
	} else {
		url.searchParams.delete("from")
		url.searchParams.delete("to")
	}
	if (selection.clientKey) url.searchParams.set("client", selection.clientKey)
	else url.searchParams.delete("client")
	if (selection.projectKey) url.searchParams.set("project", selection.projectKey)
	else url.searchParams.delete("project")
	return `${url.pathname}${url.search}`
}

export const updateTimeOverviewUrl = (selection: TimeOverviewSelection) => {
	window.history.replaceState({}, "", getTimeOverviewUrl(selection))
}

export const getCurrentTimeWeeklyViewMode = (): TimeWeeklyViewMode => {
	const requestedView = new URL(window.location.href).searchParams.get("view")
	return requestedView === "detail" ? "detail" : "summary"
}

export const updateTimeWeeklyViewUrl = (
	weekDate: string,
	viewMode: TimeWeeklyViewMode,
) => {
	const url = new URL(window.location.href)
	const today = formatDateInput()
	if (weekDate === today) {
		url.searchParams.delete("week")
	} else {
		url.searchParams.set("week", weekDate)
	}
	if (viewMode === "summary") {
		url.searchParams.delete("view")
	} else {
		url.searchParams.set("view", viewMode)
	}
	window.history.replaceState({}, "", `${url.pathname}${url.search}`)
}

export const updateTimeMonthlyUrl = (monthDate: string) => {
	const url = new URL(window.location.href)
	const currentMonth = formatMonthInput()
	if (monthDate === currentMonth) {
		url.searchParams.delete("month")
	} else {
		url.searchParams.set("month", monthDate)
	}
	window.history.replaceState({}, "", `${url.pathname}${url.search}`)
}

export const getTimeWeeklyDays = (weekDate: string): TimeWeeklyDayReport[] => {
	const start = startOfLocalWeek(
		localDateFromInput(weekDate) ?? startOfLocalDay(new Date()),
	)
	const now = new Date()
	const today = startOfLocalDay(now)
	return Array.from({ length: 7 }, (_, index) => {
		const day = new Date(start)
		day.setDate(start.getDate() + index)
		const nextDay = new Date(day)
		nextDay.setDate(day.getDate() + 1)
		const to = new Date(Math.min(nextDay.getTime(), now.getTime()))
		return {
			date: formatDateInput(day),
			label: `${formatWeekday(day)} ${formatShortDate(day)}`,
			shortLabel: formatWeekday(day),
			from: day.toISOString(),
			to: to.toISOString(),
			baselineSeconds: day > today ? 0 : DAY_SECONDS,
			report: null,
		}
	})
}

export const getTimeMonthlyDays = (monthDate: string): TimeWeeklyDayReport[] => {
	const start = startOfLocalMonth(
		localMonthFromInput(monthDate) ?? startOfLocalDay(new Date()),
	)
	const nextMonth = new Date(start)
	nextMonth.setMonth(start.getMonth() + 1)
	const now = new Date()
	const today = startOfLocalDay(now)
	const days: TimeWeeklyDayReport[] = []
	for (
		const day = new Date(start);
		day < nextMonth;
		day.setDate(day.getDate() + 1)
	) {
		const nextDay = new Date(day)
		nextDay.setDate(day.getDate() + 1)
		const to = new Date(Math.min(nextDay.getTime(), now.getTime()))
		days.push({
			date: formatDateInput(day),
			label: `${formatWeekday(day)} ${formatShortDate(day)}`,
			shortLabel: String(day.getDate()),
			from: day.toISOString(),
			to: to.toISOString(),
			baselineSeconds: day > today ? 0 : DAY_SECONDS,
			report: null,
		})
	}
	return days
}

export type TimeOverviewItem = {
	key: string
	name: string
	color: string
	totalSeconds: number
	entryCount: number
	projectCount?: number
	synthetic?: boolean
}

export type TimeOverviewEntryGroup = {
	description: string
	entryCount: number
	totalSeconds: number
	latestStartedAt: string
}

export const projectTotalKey = (projectId: number | null) =>
	projectId === null ? "no-project" : String(projectId)

export const clientTotalKey = (
	client: Pick<TimeReportClientTotal, "client_id" | "client_name">,
) => (client.client_id === null ? client.client_name : String(client.client_id))

export const getTimeOverviewItems = (
	report: TimeReport,
	group: TimeOverviewGroup,
	baselineSeconds?: number,
): TimeOverviewItem[] => {
	const items = (
		group === "client"
			? report.client_totals.map((client) => ({
					key: clientTotalKey(client),
					name: client.client_name,
					color: client.client_color,
					totalSeconds: client.total_seconds,
					entryCount: client.entry_count,
					projectCount: client.project_count,
				}))
			: report.project_totals.map((project) => ({
					key: projectTotalKey(project.project_id),
					name: project.project_name,
					color: project.project_color,
					totalSeconds: project.total_seconds,
					entryCount: project.entry_count,
				}))
	).sort(
		(left, right) =>
			right.totalSeconds - left.totalSeconds || left.name.localeCompare(right.name),
	)
	if (baselineSeconds === undefined) return items
	const trackedSeconds = items.reduce(
		(sum, item) => sum + item.totalSeconds,
		0,
	)
	const unknownSeconds = Math.max(0, baselineSeconds - trackedSeconds)
	if (unknownSeconds <= 0) return items
	return [
		...items,
		{
			key: UNKNOWN_TIME_KEY,
			name: "Unknown",
			color: UNKNOWN_TIME_COLOR,
			totalSeconds: unknownSeconds,
			entryCount: 0,
			projectCount: 0,
			synthetic: true,
		},
	].sort(
		(left, right) =>
			right.totalSeconds - left.totalSeconds || left.name.localeCompare(right.name),
	)
}

export const clientKeyForProject = (project: TimeReportProjectTotal) =>
	project.project_id === null
		? "No project"
		: project.client_id === null
			? "No client"
			: String(project.client_id)

export const filterTimeOverviewReport = (
	report: TimeReport,
	selection: TimeOverviewSelection,
) => {
	if (!selection.clientKey && !selection.projectKey) return report
	const projectTotals = report.project_totals.filter((project) =>
		selection.projectKey
			? projectTotalKey(project.project_id) === selection.projectKey
			: clientKeyForProject(project) === selection.clientKey,
	)
	const clientTotals = new Map<string, TimeReportClientTotal>()
	const projectIdsByClient = new Map<string, Set<number>>()
	for (const project of projectTotals) {
		const key = clientKeyForProject(project)
		const existing = clientTotals.get(key)
		if (existing) {
			existing.total_seconds += project.total_seconds
			existing.entry_count += project.entry_count
		} else {
			clientTotals.set(key, {
				client_id: project.project_id === null ? null : project.client_id,
				client_name:
					project.project_id === null
						? "No project"
						: (project.client_name ?? "No client"),
				client_color:
					project.project_id === null
						? project.project_color
						: (project.client_color ?? "#6b7280"),
				total_seconds: project.total_seconds,
				entry_count: project.entry_count,
				project_count: 0,
			})
		}
		if (project.project_id !== null) {
			const projectIds = projectIdsByClient.get(key) ?? new Set<number>()
			projectIds.add(project.project_id)
			projectIdsByClient.set(key, projectIds)
		}
	}
	for (const [key, client] of clientTotals) {
		client.project_count = projectIdsByClient.get(key)?.size ?? 0
	}
	return {
		...report,
		total_seconds: projectTotals.reduce(
			(sum, project) => sum + project.total_seconds,
			0,
		),
		project_totals: projectTotals,
		client_totals: [...clientTotals.values()],
	}
}

export const polarToPiePoint = (percent: number) => {
	const radians = ((percent / 100) * 360 - 90) * (Math.PI / 180)
	return {
		x: 50 + 50 * Math.cos(radians),
		y: 50 + 50 * Math.sin(radians),
	}
}

export const describePieSegment = (startPercent: number, endPercent: number) => {
	const start = polarToPiePoint(startPercent)
	const end = polarToPiePoint(endPercent)
	const largeArc = endPercent - startPercent > 50 ? 1 : 0
	return [
		"M 50 50",
		`L ${start.x.toFixed(4)} ${start.y.toFixed(4)}`,
		`A 50 50 0 ${largeArc} 1 ${end.x.toFixed(4)} ${end.y.toFixed(4)}`,
		"Z",
	].join(" ")
}

export const createEmptyTimeReport = (from: string, to: string): TimeReport => ({
	period: {
		from,
		to,
		range: "custom",
	},
	total_seconds: 0,
	project_totals: [],
	client_totals: [],
})

export const getTimePeriodChartData = (days: TimeWeeklyDayReport[]) => {
	const clientTotals = new Map<string, TimeOverviewItem>()
	const dayClientSeconds = days.map((day) => {
		const totals = new Map<string, number>()
		let trackedSeconds = 0
		for (const client of day.report?.client_totals ?? []) {
			const key = clientTotalKey(client)
			totals.set(key, client.total_seconds)
			trackedSeconds += client.total_seconds
			const existing = clientTotals.get(key)
			if (existing) {
				existing.totalSeconds += client.total_seconds
				existing.entryCount += client.entry_count
				existing.projectCount = Math.max(
					existing.projectCount ?? 0,
					client.project_count,
				)
			} else {
				clientTotals.set(key, {
					key,
					name: client.client_name,
					color: client.client_color,
					totalSeconds: client.total_seconds,
					entryCount: client.entry_count,
					projectCount: client.project_count,
				})
			}
		}
		const unknownSeconds = Math.max(0, day.baselineSeconds - trackedSeconds)
		if (unknownSeconds > 0) {
			totals.set(UNKNOWN_TIME_KEY, unknownSeconds)
			const existing = clientTotals.get(UNKNOWN_TIME_KEY)
			if (existing) {
				existing.totalSeconds += unknownSeconds
			} else {
				clientTotals.set(UNKNOWN_TIME_KEY, {
					key: UNKNOWN_TIME_KEY,
					name: "Unknown",
					color: UNKNOWN_TIME_COLOR,
					totalSeconds: unknownSeconds,
					entryCount: 0,
					projectCount: 0,
					synthetic: true,
				})
			}
		}
		return totals
	})
	const clients = [...clientTotals.values()].sort(
		(left, right) =>
			Number(Boolean(left.synthetic)) -
				Number(Boolean(right.synthetic)) ||
			right.totalSeconds - left.totalSeconds ||
			left.name.localeCompare(right.name),
	)
	const dayTotals = days.map((day) =>
		Math.max(day.baselineSeconds, day.report?.total_seconds ?? 0),
	)
	return { clients, dayClientSeconds, dayTotals }
}
