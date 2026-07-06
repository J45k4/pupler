import { Button, Label, UiComponent } from "../ui/component";
import { SearchSelect, type SearchSelectOption } from "../ui/search-select";

type Client = {
	id: number;
	name: string;
	color: string;
	archived_at: string | null;
	created_at: string;
	updated_at: string;
};

type Project = {
	id: number;
	client_id: number | null;
	name: string;
	color: string;
	archived_at: string | null;
	created_at: string;
	updated_at: string;
	client?: Client | null;
};

type UserSummary = {
	id: number;
	name: string;
	email: string | null;
};

type TimeEntry = {
	id: number;
	user_id: number | null;
	project_id: number | null;
	description: string | null;
	started_at: string;
	ended_at: string | null;
	created_at: string;
	updated_at: string;
	user?: UserSummary | null;
	project?: Project;
};

type ProjectChoice = {
	project: Project;
	entry_count: number;
	total_seconds: number;
	latest_started_at: string | null;
};

type TimeQuickAction = {
	project_id: number;
	description: string;
	entry_count: number;
	latest_started_at: string;
	total_seconds: number;
	project?: Project;
};

type TimeReportProjectTotal = {
	project_id: number | null;
	project_name: string;
	project_color: string;
	client_id: number | null;
	client_name: string | null;
	client_color: string | null;
	total_seconds: number;
	entry_count: number;
};

type TimeReportClientTotal = {
	client_id: number | null;
	client_name: string;
	client_color: string;
	total_seconds: number;
	entry_count: number;
	project_count: number;
};

type TimeReport = {
	period: {
		from: string | null;
		to: string;
		range: "custom" | "all";
	};
	total_seconds: number;
	project_totals: TimeReportProjectTotal[];
	client_totals: TimeReportClientTotal[];
};

type TimePageState = {
	clients: Client[];
	projects: Project[];
	entries: TimeEntry[];
	choices: ProjectChoice[];
	runningEntry: TimeEntry | null;
};

const TIME_OVERVIEW_SPANS = [
	{ value: "today", label: "Today" },
	{ value: "this-week", label: "This Week" },
	{ value: "last-week", label: "Last Week" },
	{ value: "custom-day", label: "Selected Day" },
	{ value: "last-2-weeks", label: "Last 2 Weeks" },
	{ value: "last-30-days", label: "Last 30 Days" },
	{ value: "ytd", label: "YTD" },
] as const;

type TimeOverviewSpan = (typeof TIME_OVERVIEW_SPANS)[number];

type TimeOverviewSelection = {
	span: TimeOverviewSpan;
	day: string;
	group: TimeOverviewGroup;
};

type TimeOverviewPeriod = {
	from: string;
	to: string;
};

type TimeOverviewAverage = {
	totalSeconds: number;
	baselineSeconds: number;
	dayCount: number;
	projectSecondsByKey: Map<string, number>;
	clientSecondsByKey: Map<string, number>;
};

type TimeWeeklyDayReport = {
	date: string;
	label: string;
	shortLabel: string;
	from: string;
	to: string;
	baselineSeconds: number;
	report: TimeReport | null;
};

const DAY_SECONDS = 24 * 60 * 60;
const UNKNOWN_TIME_KEY = "__unknown_time__";
const UNKNOWN_TIME_COLOR = "#cbd5e1";
const DEFAULT_TIME_OVERVIEW_SPAN = "today";
const TIME_OVERVIEW_GROUPS = [
	{ value: "project", label: "Project" },
	{ value: "client", label: "Client" },
] as const;
type TimeOverviewGroup = (typeof TIME_OVERVIEW_GROUPS)[number]["value"];
const DEFAULT_TIME_OVERVIEW_GROUP: TimeOverviewGroup = "project";

const field = (label: string, control: HTMLElement) => {
	const labelComponent = new Label({ text: label });
	labelComponent.root.append(control);
	return labelComponent.root;
};

const div = (className?: string) => {
	const element = document.createElement("div");
	if (className) element.className = className;
	return element;
};

const text = (tag: "div" | "p" | "span" | "strong" | "h2", value: string) => {
	const element = document.createElement(tag);
	element.textContent = value;
	return element;
};

const timeColor = (color: string) => {
	const element = document.createElement("span");
	element.className = "time-color";
	element.style.setProperty("--time-color", color);
	return element;
};

const tag = (value: string, neutral = false) => {
	const element = document.createElement("span");
	element.className = neutral ? "tag tag--neutral" : "tag";
	element.textContent = value;
	return element;
};

const setStatus = (element: HTMLElement, message: string, isError = false) => {
	element.textContent = message;
	element.className = isError ? "status error" : "status";
};

const timeApiJson = async <T>(path: string, options: RequestInit = {}) => {
	const response = await fetch(path, {
		...options,
		headers: {
			...(options.body ? { "Content-Type": "application/json" } : {}),
			...(options.headers ?? {}),
		},
	});
	const body = (await response.json()) as T | { error?: string };

	if (!response.ok) {
		throw new Error(
			typeof body === "object" && body !== null && "error" in body
				? (body.error ?? "Time tracking request failed")
				: "Time tracking request failed",
		);
	}

	return body as T;
};

const timeApi = {
	fetchClients: () =>
		timeApiJson<Client[]>("/api/clients?sort=name&order=asc"),

	fetchProjects: () =>
		timeApiJson<Project[]>("/api/projects?sort=name&order=asc"),

	fetchEntries: () =>
		timeApiJson<TimeEntry[]>("/api/time-entries?sort=started_at&order=desc"),

	fetchReport: (from: string, to: string) => {
		const query = new URLSearchParams({ from, to });
		return timeApiJson<TimeReport>(`/api/time-report?${query.toString()}`);
	},

	createProject: (name: string, clientId: number | null = null) =>
		timeApiJson<Project>("/api/projects", {
			method: "POST",
			body: JSON.stringify({ name, client_id: clientId, archived_at: null }),
		}),

	createClient: (name: string) =>
		timeApiJson<Client>("/api/clients", {
			method: "POST",
			body: JSON.stringify({ name, archived_at: null }),
		}),

	createEntry: (values: {
		project_id: number;
		description: string | null;
		started_at: string;
		ended_at: string | null;
	}) =>
		timeApiJson<TimeEntry>("/api/time-entries", {
			method: "POST",
			body: JSON.stringify(values),
		}),

	startEntry: (values: {
		project_id?: number;
		description: string | null;
	}) =>
		timeApiJson<TimeEntry>("/api/time-entries/start", {
			method: "POST",
			body: JSON.stringify(values),
		}),

	updateEntry: (
		id: number,
		values: {
			project_id?: number | null;
			description?: string | null;
			started_at?: string;
			ended_at?: string | null;
		},
	) =>
		timeApiJson<TimeEntry>(`/api/time-entries/${id}`, {
			method: "PATCH",
			body: JSON.stringify(values),
		}),

	stopEntry: (id: number) =>
		timeApiJson<TimeEntry>(`/api/time-entries/${id}/stop`, {
			method: "POST",
			body: JSON.stringify({}),
		}),

	deleteEntry: async (id: number) => {
		const response = await fetch(`/api/time-entries/${id}`, { method: "DELETE" });
		if (!response.ok) {
			throw new Error("Failed to delete entry.");
		}
	},
};

const formatDateTime = (value: string) =>
	new Intl.DateTimeFormat(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(value));

const formatDuration = (totalSeconds: number) => {
	const seconds = Math.max(0, Math.floor(totalSeconds));
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainingSeconds = seconds % 60;
	if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
	if (minutes > 0) return `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`;
	return `${remainingSeconds}s`;
};

const timeEntryDurationSeconds = (entry: TimeEntry) => {
	const end = entry.ended_at ? Date.parse(entry.ended_at) : Date.now();
	return Math.max(0, Math.floor((end - Date.parse(entry.started_at)) / 1000));
};

const formatDateTimeLocalInput = (date = new Date()) =>
	new Date(date.getTime() - date.getTimezoneOffset() * 60000)
		.toISOString()
		.slice(0, 16);

const formatDateInput = (date = new Date()) =>
	new Date(date.getTime() - date.getTimezoneOffset() * 60000)
		.toISOString()
		.slice(0, 10);

const formatMonthInput = (date = new Date()) =>
	new Date(date.getTime() - date.getTimezoneOffset() * 60000)
		.toISOString()
		.slice(0, 7);

const formatShortDate = (date: Date) =>
	new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
	}).format(date);

const formatMonth = (date: Date) =>
	new Intl.DateTimeFormat(undefined, {
		month: "long",
		year: "numeric",
	}).format(date);

const formatWeekday = (date: Date) =>
	new Intl.DateTimeFormat(undefined, {
		weekday: "short",
	}).format(date);

const formatTimestampForDateTimeLocalInput = (value: string) =>
	formatDateTimeLocalInput(new Date(value));

const parseDateTimeLocalInput = (value: string) => {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const moveDateTimeLocalInputIntoPast = (
	input: HTMLInputElement,
	minutes: number,
) => {
	const current = input.value.trim() ? new Date(input.value) : new Date();
	if (Number.isNaN(current.getTime())) return;
	current.setMinutes(current.getMinutes() - minutes);
	input.value = formatDateTimeLocalInput(current);
	input.dispatchEvent(new Event("input", { bubbles: true }));
};

const timeAdjustmentButtons = (label: string, input: HTMLInputElement) => {
	const root = div("time-adjustments");
	for (const minutes of [30, 60]) {
		const button = new Button({
			text: `-${minutes} min`,
			className: "secondary time-adjustments__button",
			type: "button",
		});
		button.root.setAttribute(
			"aria-label",
			`Move ${label.toLowerCase()} ${minutes} minutes into the past`,
		);
		button.onClick = () => moveDateTimeLocalInputIntoPast(input, minutes);
		root.append(button.root);
	}
	return root;
};

const startOfLocalDay = (date: Date) =>
	new Date(date.getFullYear(), date.getMonth(), date.getDate());

const localDateFromInput = (value: string) => {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return null;
	const [, year, month, day] = match;
	const yearValue = Number(year);
	const monthValue = Number(month);
	const dayValue = Number(day);
	const date = new Date(yearValue, monthValue - 1, dayValue);
	return Number.isNaN(date.getTime()) ||
		date.getFullYear() !== yearValue ||
		date.getMonth() !== monthValue - 1 ||
		date.getDate() !== dayValue
		? null
		: date;
};

const localMonthFromInput = (value: string) => {
	const match = /^(\d{4})-(\d{2})$/.exec(value);
	if (!match) return null;
	const [, year, month] = match;
	const yearValue = Number(year);
	const monthValue = Number(month);
	const date = new Date(yearValue, monthValue - 1, 1);
	return Number.isNaN(date.getTime()) ||
		date.getFullYear() !== yearValue ||
		date.getMonth() !== monthValue - 1
		? null
		: date;
};

const startOfLocalWeek = (date: Date) => {
	const start = startOfLocalDay(date);
	const mondayOffset = (start.getDay() + 6) % 7;
	start.setDate(start.getDate() - mondayOffset);
	return start;
};

const startOfLocalMonth = (date: Date) =>
	new Date(date.getFullYear(), date.getMonth(), 1);

const getTimeOverviewSpan = (
	value: string | null | undefined,
): TimeOverviewSpan =>
	TIME_OVERVIEW_SPANS.find((span) => span.value === value) ??
	TIME_OVERVIEW_SPANS.find(
		(span) => span.value === DEFAULT_TIME_OVERVIEW_SPAN,
	)!;

const getTimeOverviewGroup = (
	value: string | null | undefined,
): TimeOverviewGroup =>
	TIME_OVERVIEW_GROUPS.find((group) => group.value === value)?.value ??
	DEFAULT_TIME_OVERVIEW_GROUP;

const getCurrentTimeOverviewSelection = (): TimeOverviewSelection => {
	const params = new URLSearchParams(window.location.search);
	const span = getTimeOverviewSpan(params.get("span"));
	const group = getTimeOverviewGroup(params.get("group"));
	const requestedDay = params.get("day") ?? "";
	const day = localDateFromInput(requestedDay)
		? requestedDay
		: formatDateInput();
	return { span, day, group };
};

const getCurrentTimeWeeklyDate = () => {
	const params = new URLSearchParams(window.location.search);
	const requestedWeek = params.get("week") ?? "";
	return localDateFromInput(requestedWeek) ? requestedWeek : formatDateInput();
};

const getCurrentTimeMonthlyDate = () => {
	const params = new URLSearchParams(window.location.search);
	const requestedMonth = params.get("month") ?? "";
	return localMonthFromInput(requestedMonth) ? requestedMonth : formatMonthInput();
};

const getTimeOverviewPeriod = (selection: TimeOverviewSelection) => {
	const to = new Date();
	const thisWeekStart = startOfLocalWeek(to);
	const from = (() => {
		switch (selection.span.value) {
			case "today":
				return startOfLocalDay(to);
			case "custom-day":
				return localDateFromInput(selection.day) ?? startOfLocalDay(to);
			case "this-week":
				return thisWeekStart;
			case "last-week": {
				const date = new Date(thisWeekStart);
				date.setDate(date.getDate() - 7);
				return date;
			}
			case "last-2-weeks": {
				const date = startOfLocalDay(to);
				date.setDate(date.getDate() - 13);
				return date;
			}
			case "last-30-days": {
				const date = startOfLocalDay(to);
				date.setDate(date.getDate() - 29);
				return date;
			}
			case "ytd":
				return new Date(to.getFullYear(), 0, 1);
		}
	})();
	if (selection.span.value === "custom-day") {
		const end = new Date(from);
		end.setDate(end.getDate() + 1);
		const clippedEndMs = Math.min(end.getTime(), to.getTime());
		return {
			from: from.toISOString(),
			to: new Date(Math.max(from.getTime(), clippedEndMs)).toISOString(),
		};
	}
	if (selection.span.value === "last-week") {
		return { from: from.toISOString(), to: thisWeekStart.toISOString() };
	}
	return { from: from.toISOString(), to: to.toISOString() };
};

const getFullLocalDayBounds = (period: TimeOverviewPeriod) => {
	const from = new Date(period.from);
	const to = new Date(period.to);
	if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
		return null;
	}

	const start = startOfLocalDay(from);
	if (from.getTime() > start.getTime()) {
		start.setDate(start.getDate() + 1);
	}
	const end = startOfLocalDay(to);
	if (start.getTime() >= end.getTime()) {
		return null;
	}

	return { from: start.toISOString(), to: end.toISOString() };
};

const countFullLocalDays = (period: TimeOverviewPeriod) => {
	const bounds = getFullLocalDayBounds(period);
	if (!bounds) {
		return 0;
	}

	const end = new Date(bounds.to);
	let days = 0;
	for (const cursor = new Date(bounds.from); cursor < end; days += 1) {
		cursor.setDate(cursor.getDate() + 1);
	}
	return days;
};

const countLocalDaysInclusive = (from: Date, to: Date) => {
	const start = startOfLocalDay(from);
	const end = startOfLocalDay(to);
	let days = 0;
	for (const cursor = new Date(start); cursor <= end; days += 1) {
		cursor.setDate(cursor.getDate() + 1);
	}
	return days;
};

const getTimeOverviewBaselineSeconds = (selection: TimeOverviewSelection) => {
	const today = startOfLocalDay(new Date());
	switch (selection.span.value) {
		case "today":
		case "custom-day":
			return DAY_SECONDS;
		case "this-week":
			return countLocalDaysInclusive(startOfLocalWeek(today), today) * DAY_SECONDS;
		case "last-week":
			return 7 * DAY_SECONDS;
		case "last-2-weeks":
			return 14 * DAY_SECONDS;
		case "last-30-days":
			return 30 * DAY_SECONDS;
		case "ytd":
			return countLocalDaysInclusive(new Date(today.getFullYear(), 0, 1), today) * DAY_SECONDS;
	}
};

const updateTimeOverviewUrl = (selection: TimeOverviewSelection) => {
	const url = new URL(window.location.href);
	if (selection.span.value === DEFAULT_TIME_OVERVIEW_SPAN) {
		url.searchParams.delete("span");
	} else {
		url.searchParams.set("span", selection.span.value);
	}
	if (selection.span.value === "custom-day") {
		url.searchParams.set("day", selection.day);
	} else {
		url.searchParams.delete("day");
	}
	if (selection.group === DEFAULT_TIME_OVERVIEW_GROUP) {
		url.searchParams.delete("group");
	} else {
		url.searchParams.set("group", selection.group);
	}
	window.history.replaceState({}, "", `${url.pathname}${url.search}`);
};

const updateTimeWeeklyUrl = (weekDate: string) => {
	const url = new URL(window.location.href);
	const today = formatDateInput();
	if (weekDate === today) {
		url.searchParams.delete("week");
	} else {
		url.searchParams.set("week", weekDate);
	}
	window.history.replaceState({}, "", `${url.pathname}${url.search}`);
};

const updateTimeMonthlyUrl = (monthDate: string) => {
	const url = new URL(window.location.href);
	const currentMonth = formatMonthInput();
	if (monthDate === currentMonth) {
		url.searchParams.delete("month");
	} else {
		url.searchParams.set("month", monthDate);
	}
	window.history.replaceState({}, "", `${url.pathname}${url.search}`);
};

const getTimeWeeklyDays = (weekDate: string): TimeWeeklyDayReport[] => {
	const start = startOfLocalWeek(
		localDateFromInput(weekDate) ?? startOfLocalDay(new Date()),
	);
	const now = new Date();
	const today = startOfLocalDay(now);
	return Array.from({ length: 7 }, (_, index) => {
		const day = new Date(start);
		day.setDate(start.getDate() + index);
		const nextDay = new Date(day);
		nextDay.setDate(day.getDate() + 1);
		const to = new Date(Math.min(nextDay.getTime(), now.getTime()));
		return {
			date: formatDateInput(day),
			label: `${formatWeekday(day)} ${formatShortDate(day)}`,
			shortLabel: formatWeekday(day),
			from: day.toISOString(),
			to: to.toISOString(),
			baselineSeconds: day > today ? 0 : DAY_SECONDS,
			report: null,
		};
	});
};

const getTimeMonthlyDays = (monthDate: string): TimeWeeklyDayReport[] => {
	const start = startOfLocalMonth(
		localMonthFromInput(monthDate) ?? startOfLocalDay(new Date()),
	);
	const nextMonth = new Date(start);
	nextMonth.setMonth(start.getMonth() + 1);
	const now = new Date();
	const today = startOfLocalDay(now);
	const days: TimeWeeklyDayReport[] = [];
	for (const day = new Date(start); day < nextMonth; day.setDate(day.getDate() + 1)) {
		const nextDay = new Date(day);
		nextDay.setDate(day.getDate() + 1);
		const to = new Date(Math.min(nextDay.getTime(), now.getTime()));
		days.push({
			date: formatDateInput(day),
			label: `${formatWeekday(day)} ${formatShortDate(day)}`,
			shortLabel: String(day.getDate()),
			from: day.toISOString(),
			to: to.toISOString(),
			baselineSeconds: day > today ? 0 : DAY_SECONDS,
			report: null,
		});
	}
	return days;
};

const defaultTimeEntryRange = () => {
	const endedAt = new Date();
	const startedAt = new Date(endedAt.getTime() - 60 * 60 * 1000);
	return {
		startedAt: formatDateTimeLocalInput(startedAt),
		endedAt: formatDateTimeLocalInput(endedAt),
	};
};

const normalizeDescription = (description: string | null | undefined) =>
	description?.trim() ?? "";

const normalizeProjectName = (name: string) => name.trim().toLowerCase();
const normalizeClientName = (name: string) => name.trim().toLowerCase();

const buildProjectChoices = (
	entries: TimeEntry[],
	projects: Project[],
): ProjectChoice[] => {
	const choiceByProjectId = new Map<number, ProjectChoice>();
	for (const project of projects) {
		if (project.archived_at !== null) continue;
		choiceByProjectId.set(project.id, {
			project,
			entry_count: 0,
			total_seconds: 0,
			latest_started_at: null,
		});
	}

	for (const entry of entries) {
		if (entry.project_id === null) continue;
		const choice = choiceByProjectId.get(entry.project_id);
		if (!choice) continue;
		choice.entry_count += 1;
		choice.total_seconds += timeEntryDurationSeconds(entry);
		if (
			choice.latest_started_at === null ||
			Date.parse(entry.started_at) > Date.parse(choice.latest_started_at)
		) {
			choice.latest_started_at = entry.started_at;
		}
	}

	return [...choiceByProjectId.values()].sort((first, second) => {
		if (second.entry_count !== first.entry_count) {
			return second.entry_count - first.entry_count;
		}
		if (second.total_seconds !== first.total_seconds) {
			return second.total_seconds - first.total_seconds;
		}
		const latestDifference =
			Date.parse(second.latest_started_at ?? "1970-01-01T00:00:00.000Z") -
			Date.parse(first.latest_started_at ?? "1970-01-01T00:00:00.000Z");
		if (latestDifference !== 0) return latestDifference;
		return first.project.name.localeCompare(second.project.name);
	});
};

const buildQuickActions = (
	entries: TimeEntry[],
	projects: Project[],
): TimeQuickAction[] => {
	const projectById = new Map(projects.map((project) => [project.id, project]));
	const activeProjectIds = new Set(
		projects
			.filter((project) => project.archived_at === null)
			.map((project) => project.id),
	);
	const actionByKey = new Map<string, TimeQuickAction>();

	for (const entry of entries) {
		if (entry.project_id === null) continue;
		if (!activeProjectIds.has(entry.project_id)) continue;
		const description = normalizeDescription(entry.description);
		const key = `${entry.project_id}\u0000${description}`;
		const existing = actionByKey.get(key);
		if (existing) {
			existing.entry_count += 1;
			existing.total_seconds += timeEntryDurationSeconds(entry);
			if (Date.parse(entry.started_at) > Date.parse(existing.latest_started_at)) {
				existing.latest_started_at = entry.started_at;
			}
			continue;
		}
		actionByKey.set(key, {
			project_id: entry.project_id,
			description,
			entry_count: 1,
			latest_started_at: entry.started_at,
			total_seconds: timeEntryDurationSeconds(entry),
			project: entry.project ?? projectById.get(entry.project_id),
		});
	}

	return [...actionByKey.values()]
		.sort((first, second) => {
			if (second.entry_count !== first.entry_count) {
				return second.entry_count - first.entry_count;
			}
			return (
				Date.parse(second.latest_started_at) -
				Date.parse(first.latest_started_at)
			);
		})
		.slice(0, 8);
};

const findPreviousTimeEntryEnd = (
	entries: TimeEntry[],
	runningEntry: TimeEntry | null,
) => {
	if (!runningEntry) return null;
	const previousEntry = entries
		.filter((entry) => entry.id !== runningEntry.id && entry.ended_at !== null)
		.sort(
			(first, second) =>
				Date.parse(second.ended_at ?? "") - Date.parse(first.ended_at ?? ""),
		)[0];
	return previousEntry?.ended_at ?? null;
};

const projectOptions = (
	projects: Project[],
	selectedId?: number | null,
) =>
	projects
		.filter((project) => project.archived_at === null || project.id === selectedId)
		.map((project) => ({
			value: String(project.id),
			text: project.name,
		}));

const selectProject = (
	projects: Project[],
	selectedId?: number | null,
) => {
	const select = document.createElement("select");
	select.required = true;
	const emptyOption = document.createElement("option");
	emptyOption.value = "";
	emptyOption.textContent = "Choose a project";
	select.append(emptyOption);
	for (const option of projectOptions(projects, selectedId)) {
		const optionElement = document.createElement("option");
		optionElement.value = option.value;
		optionElement.textContent = option.text;
		select.append(optionElement);
	}
	select.value = selectedId ? String(selectedId) : "";
	return select;
};

const choiceOptions = (choices: ProjectChoice[]): SearchSelectOption[] =>
	choices.map((choice) => ({
		value: String(choice.project.id),
		label: choice.project.name,
	}));

const choiceOptionsForClient = (
	choices: ProjectChoice[],
	client: Client | null,
): SearchSelectOption[] =>
	choiceOptions(
		client
			? choices.filter((choice) => choice.project.client_id === client.id)
			: choices,
	);

const clientOptions = (
	clients: Client[],
	selectedId?: number | null,
): SearchSelectOption[] =>
	clients
		.filter((client) => client.archived_at === null || client.id === selectedId)
		.map((client) => ({
			value: String(client.id),
			label: client.name,
		}));

const findChoiceByName = (choices: ProjectChoice[], name: string) => {
	const normalizedName = normalizeProjectName(name);
	return choices.find(
		(choice) => normalizeProjectName(choice.project.name) === normalizedName,
	);
};

const findChoiceById = (choices: ProjectChoice[], id: number) =>
	choices.find((choice) => choice.project.id === id);

const findClientByName = (clients: Client[], name: string) => {
	const normalizedName = normalizeClientName(name);
	return clients.find((client) => normalizeClientName(client.name) === normalizedName);
};

const selectedClientFromSelect = (
	clients: Client[],
	clientSelect: SearchSelect,
) => {
	const selectedId = Number(clientSelect.value);
	if (Number.isInteger(selectedId) && selectedId > 0) {
		return clients.find((client) => client.id === selectedId) ?? null;
	}
	return clientSelect.text ? (findClientByName(clients, clientSelect.text) ?? null) : null;
};

const bindClientScopedProjectSelect = (
	getState: () => TimePageState,
	clientSelect: SearchSelect,
	projectSelect: SearchSelect,
) => {
	const refresh = () => {
		const state = getState();
		const client = selectedClientFromSelect(state.clients, clientSelect);
		projectSelect.setOptions(
			client || !clientSelect.text
				? choiceOptionsForClient(state.choices, client)
				: [],
		);
	};

	for (const eventName of ["input", "keydown", "mousedown", "focusout"]) {
		clientSelect.root.addEventListener(eventName, () => {
			window.setTimeout(refresh, 0);
		});
	}
	refresh();
	return refresh;
};

const projectForEntry = (entry: TimeEntry, projects: Project[]) =>
	entry.project ??
	(entry.project_id === null
		? undefined
		: projects.find((project) => project.id === entry.project_id));

const sortTimeEntries = (entries: TimeEntry[]) =>
	[...entries].sort(
		(first, second) =>
			Date.parse(second.started_at) - Date.parse(first.started_at) ||
			second.id - first.id,
	);

const createTimePageState = (
	clients: Client[],
	projects: Project[],
	entries: TimeEntry[],
): TimePageState => {
	const sortedEntries = sortTimeEntries(entries);
	return {
		clients,
		projects,
		entries: sortedEntries,
		choices: buildProjectChoices(sortedEntries, projects),
		runningEntry:
			sortedEntries.find((entry) => entry.ended_at === null) ?? null,
	};
};

type TimeStoreSelector<T> = (state: TimePageState) => T;
type TimeStoreListener<T> = (value: T, state: TimePageState) => void;

class TimeStore {
	private state: TimePageState;
	private readonly listeners = new Set<() => void>();

	constructor(state: TimePageState) {
		this.state = state;
	}

	public get() {
		return this.state;
	}

	public set(state: TimePageState) {
		this.state = state;
		for (const listener of this.listeners) listener();
	}

	public setData(projects: Project[], entries: TimeEntry[]) {
		this.set(createTimePageState(this.state.clients, projects, entries));
	}

	public setAllData(clients: Client[], projects: Project[], entries: TimeEntry[]) {
		this.set(createTimePageState(clients, projects, entries));
	}

	public subscribe(listener: () => void, options?: { immediate?: boolean }) {
		this.listeners.add(listener);
		if (options?.immediate ?? true) listener();
		return () => {
			this.listeners.delete(listener);
		};
	}

	public select<T>(
		selector: TimeStoreSelector<T>,
		listener: TimeStoreListener<T>,
		options?: { immediate?: boolean; equals?: (left: T, right: T) => boolean },
	) {
		const equals = options?.equals ?? Object.is;
		let selected = selector(this.state);
		if (options?.immediate ?? true) {
			listener(selected, this.state);
		}
		return this.subscribe(
			() => {
				const next = selector(this.state);
				if (equals(selected, next)) return;
				selected = next;
				listener(next, this.state);
			},
			{ immediate: false },
		);
	}
}

const replaceTimeEntry = (entries: TimeEntry[], nextEntry: TimeEntry) =>
	sortTimeEntries(
		entries.map((entry) => (entry.id === nextEntry.id ? nextEntry : entry)),
	);

const addTimeEntry = (entries: TimeEntry[], nextEntry: TimeEntry) =>
	sortTimeEntries([
		nextEntry,
		...entries
			.filter((entry) => entry.id !== nextEntry.id)
			.map((entry) =>
				nextEntry.ended_at === null && entry.ended_at === null
					? {
							...entry,
							ended_at: nextEntry.started_at,
							updated_at: nextEntry.updated_at,
						}
					: entry,
			),
	]);

class TimeActions {
	constructor(
		private readonly store: TimeStore,
		private readonly status: HTMLElement,
	) {}

	public async loadInitial() {
		try {
			setStatus(this.status, "Loading time tracking...");
			const [clients, projects, entries] = await Promise.all([
				timeApi.fetchClients(),
				timeApi.fetchProjects(),
				timeApi.fetchEntries(),
			]);
			this.store.setAllData(clients, projects, entries);
			setStatus(
				this.status,
				`Loaded ${entries.length} time entr${entries.length === 1 ? "y" : "ies"}.`,
			);
		} catch (error) {
			setStatus(
				this.status,
				error instanceof Error ? error.message : "Failed to load time tracking.",
				true,
			);
		}
	}

	public async ensureProject(projectName: string, clientName = "") {
		const normalizedName = projectName.trim();
		if (!normalizedName) throw new Error("Project is required.");
		const client = clientName.trim() ? await this.ensureClient(clientName) : null;
		const state = this.store.get();
		const existing = findChoiceByName(
			client
				? state.choices.filter((choice) => choice.project.client_id === client.id)
				: state.choices,
			normalizedName,
		)?.project;
		if (existing) return existing;
		const project = await timeApi.createProject(normalizedName, client?.id ?? null);
		const nextState = this.store.get();
		this.store.setData([...nextState.projects, project], nextState.entries);
		return project;
	}

	public async ensureClient(clientName: string) {
		const normalizedName = clientName.trim();
		if (!normalizedName) throw new Error("Client is required.");
		const state = this.store.get();
		const existing = findClientByName(state.clients, normalizedName);
		if (existing) return existing;
		const client = await timeApi.createClient(normalizedName);
		this.store.setAllData([...state.clients, client], state.projects, state.entries);
		return client;
	}

	public async addEntry(values: {
		clientName: string;
		projectName: string;
		description: string | null;
		startedAt: string;
		endedAt: string | null;
	}) {
		const project = await this.ensureProject(values.projectName, values.clientName);
		const entry = await timeApi.createEntry({
			project_id: project.id,
			description: values.description,
			started_at: values.startedAt,
			ended_at: values.endedAt,
		});
		const state = this.store.get();
		this.store.setData(state.projects, addTimeEntry(state.entries, entry));
		return entry;
	}

	public async startTimer(
		clientName: string,
		projectName: string,
		description: string | null,
	) {
		if (clientName.trim() && !projectName.trim()) {
			throw new Error("Project is required when client is selected.");
		}
		const project = projectName.trim()
			? await this.ensureProject(projectName, clientName)
			: null;
		const entry = await timeApi.startEntry({
			...(project ? { project_id: project.id } : {}),
			description,
		});
		const state = this.store.get();
		this.store.setData(state.projects, addTimeEntry(state.entries, entry));
		return entry;
	}

	public async startTimerForProject(
		projectId: number,
		description: string | null,
	) {
		const entry = await timeApi.startEntry({
			project_id: projectId,
			description,
		});
		const state = this.store.get();
		this.store.setData(state.projects, addTimeEntry(state.entries, entry));
		return entry;
	}

	public async stopTimer(entry: TimeEntry) {
		const stopped = await timeApi.stopEntry(entry.id);
		const state = this.store.get();
		this.store.setData(state.projects, replaceTimeEntry(state.entries, stopped));
		return stopped;
	}

	public async assignProjectAndStopTimer(
		entry: TimeEntry,
		projectName: string,
		clientName = "",
	) {
		const project = await this.ensureProject(projectName, clientName);
		const assigned = await timeApi.updateEntry(entry.id, {
			project_id: project.id,
		});
		const stateAfterAssign = this.store.get();
		this.store.setData(
			stateAfterAssign.projects,
			replaceTimeEntry(stateAfterAssign.entries, assigned),
		);
		return this.stopTimer(assigned);
	}

	public async updateRunningTimer(
		entry: TimeEntry,
		values: {
			clientName: string;
			projectName: string;
			description: string | null;
			startedAt: string;
		},
	) {
		if (values.clientName.trim() && !values.projectName.trim()) {
			throw new Error("Project is required when client is selected.");
		}
		const project = values.projectName.trim()
			? await this.ensureProject(values.projectName, values.clientName)
			: null;
		const updated = await timeApi.updateEntry(entry.id, {
			project_id: project?.id ?? null,
			description: values.description,
			started_at: values.startedAt,
		});
		const state = this.store.get();
		this.store.setData(state.projects, replaceTimeEntry(state.entries, updated));
		return updated;
	}

	public async updateRunningStart(entry: TimeEntry, startedAt: string) {
		const updated = await timeApi.updateEntry(entry.id, {
			started_at: startedAt,
		});
		const state = this.store.get();
		this.store.setData(state.projects, replaceTimeEntry(state.entries, updated));
		return updated;
	}

	public async updateEntry(
		entry: TimeEntry,
		values: {
			projectId: number;
			description: string | null;
			startedAt: string;
			endedAt: string | null;
		},
	) {
		const updated = await timeApi.updateEntry(entry.id, {
			project_id: values.projectId,
			description: values.description,
			started_at: values.startedAt,
			ended_at: values.endedAt,
		});
		const state = this.store.get();
		this.store.setData(state.projects, replaceTimeEntry(state.entries, updated));
		return updated;
	}

	public async deleteEntry(entry: TimeEntry) {
		await timeApi.deleteEntry(entry.id);
		const state = this.store.get();
		this.store.setData(
			state.projects,
			state.entries.filter((candidate) => candidate.id !== entry.id),
		);
	}
}

type TimePageContext = {
	store: TimeStore;
	actions: TimeActions;
	status: HTMLElement;
};

const createTimeEntryCreateModal = (context: TimePageContext) => {
	const root = document.createElement("div");
	root.className = "time-entry-create-modal";
	root.hidden = true;
	root.tabIndex = -1;

	const backdrop = div("time-entry-create-modal__backdrop");
	const dialog = div("time-entry-create-modal__dialog card panel");
	dialog.role = "dialog";
	dialog.setAttribute("aria-modal", "true");
	dialog.setAttribute("aria-label", "Add Time Entry");

	const header = div("section-header");
	const closeButton = new Button({
		text: "Close",
		className: "secondary",
		type: "button",
	});
	closeButton.root.setAttribute("aria-label", "Close add time entry modal");
	header.append(text("h2", "Add Time Entry"), closeButton.root);

	const form = document.createElement("form");
	const clientSelect = new SearchSelect({
		placeholder: "Type or choose a client",
		allowCreate: true,
		createLabelPrefix: "Create client",
	});
	const projectSelect = new SearchSelect({
		placeholder: "Type or choose a project",
		allowCreate: true,
		createLabelPrefix: "Create project",
		required: true,
	});

	const description = document.createElement("input");
	description.placeholder = "What did you work on?";
	description.setAttribute("autocomplete", "off");

	const startedAt = document.createElement("input");
	startedAt.type = "datetime-local";
	startedAt.required = true;

	const endedAt = document.createElement("input");
	endedAt.type = "datetime-local";

	const row = div("row");
	row.append(field("Start", startedAt), field("End", endedAt));

	const actions = div("actions");
	const submitButton = new Button({
		text: "Add Entry",
		className: "primary",
		type: "submit",
	});
	const cancelButton = new Button({
		text: "Cancel",
		className: "secondary",
		type: "button",
	});
	actions.append(submitButton.root, cancelButton.root);

	form.append(
		field("Client (optional)", clientSelect.root),
		field("Project", projectSelect.root),
		field("Description", description),
		row,
		actions,
	);

	const status = div("status");
	const setLocalStatus = (message: string, isError = false) => {
		setStatus(status, message, isError);
	};

	const close = () => {
		root.hidden = true;
		document.body.classList.remove("modal-open");
		form.reset();
		clientSelect.clear();
		projectSelect.clear();
		setLocalStatus("");
	};

	const open = () => {
		const range = defaultTimeEntryRange();
		const state = context.store.get();
		clientSelect.setOptions(clientOptions(state.clients));
		projectSelect.setOptions(choiceOptions(state.choices));
		startedAt.value = range.startedAt;
		endedAt.value = range.endedAt;
		root.hidden = false;
		document.body.classList.add("modal-open");
		setLocalStatus("");
		projectSelect.focus();
	};
	bindClientScopedProjectSelect(
		() => context.store.get(),
		clientSelect,
		projectSelect,
	);

	closeButton.onClick = close;
	cancelButton.onClick = close;
	backdrop.onclick = close;
	root.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && !root.hidden) close();
	});
	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		setLocalStatus("Adding entry...");

		const startedAtValue = parseDateTimeLocalInput(startedAt.value);
		const endedAtValue = endedAt.value.trim()
			? parseDateTimeLocalInput(endedAt.value)
			: null;
		if (!startedAtValue || (endedAt.value.trim() && !endedAtValue)) {
			setLocalStatus("Entry times are invalid.", true);
			return;
		}

		try {
			await context.actions.addEntry({
				clientName: clientSelect.text,
				projectName: projectSelect.text,
				description: description.value.trim() || null,
				startedAt: startedAtValue,
				endedAt: endedAtValue,
			});
			close();
			setStatus(context.status, "Entry added.");
		} catch (error) {
			setLocalStatus(
				error instanceof Error ? error.message : "Failed to add entry.",
				true,
			);
		}
	});

	dialog.append(header, form, status);
	root.append(backdrop, dialog);
	return Object.assign(new UiComponent(root), { open, close });
};

const createRunningEditModal = (
	context: TimePageContext,
	runningEntry: TimeEntry,
	previousEndedAt: string | null,
) => {
	const root = document.createElement("div");
	root.className = "time-entry-edit-modal";
	root.hidden = true;
	root.tabIndex = -1;

	const backdrop = div("time-entry-edit-modal__backdrop");
	const dialog = div("time-entry-edit-modal__dialog card panel");
	dialog.role = "dialog";
	dialog.setAttribute("aria-modal", "true");
	dialog.setAttribute("aria-label", "Edit Timer");

	const header = div("section-header");
	const closeButton = new Button({
		text: "Close",
		className: "secondary",
		type: "button",
	});
	closeButton.root.setAttribute("aria-label", "Close edit timer modal");
	header.append(text("h2", "Edit Timer"), closeButton.root);

	const form = document.createElement("form");
	form.className = "time-running__start-form";
	const state = context.store.get();
	const project = projectForEntry(runningEntry, state.projects);

	const clientSelect = new SearchSelect({
		placeholder: "Type or choose a client",
		allowCreate: true,
		createLabelPrefix: "Create client",
	});
	clientSelect
		.setOptions(clientOptions(state.clients, project?.client_id ?? null))
		.setValue(project?.client_id === null || project?.client_id === undefined ? null : String(project.client_id));
	const projectSelect = new SearchSelect({
		placeholder: "Type or choose a project",
		allowCreate: true,
		createLabelPrefix: "Create project",
	});
	projectSelect
		.setOptions(choiceOptionsForClient(state.choices, selectedClientFromSelect(state.clients, clientSelect)))
		.setValue(
			runningEntry.project_id === null ? null : String(runningEntry.project_id),
		);
	projectSelect.root.setAttribute("aria-label", "Running timer project");
	bindClientScopedProjectSelect(
		() => context.store.get(),
		clientSelect,
		projectSelect,
	);

	const description = document.createElement("input");
	description.value = runningEntry.description ?? "";
	description.placeholder = "What are you working on?";
	description.setAttribute("autocomplete", "off");

	const startedAt = document.createElement("input");
	startedAt.type = "datetime-local";
	startedAt.value = formatTimestampForDateTimeLocalInput(runningEntry.started_at);
	startedAt.required = true;

	form.append(
		field("Client (optional)", clientSelect.root),
		field("Project (optional)", projectSelect.root),
		field("Description", description),
		field("Started At", startedAt),
		timeAdjustmentButtons("Started At", startedAt),
	);

	if (previousEndedAt) {
		const previous = div();
		const previousButton = new Button({
			text: "Set start to previous end",
			className: "secondary",
			type: "button",
		});
		previousButton.onClick = async () => {
			try {
				startedAt.value = formatTimestampForDateTimeLocalInput(previousEndedAt);
				await context.actions.updateRunningStart(runningEntry, previousEndedAt);
				setStatus(context.status, "Timer start set to previous end.");
				close();
			} catch (error) {
				setStatus(
					context.status,
					error instanceof Error
						? error.message
						: "Failed to update running timer.",
					true,
				);
			}
		};
		const previousCopy = text(
			"div",
			`Previous end: ${formatDateTime(previousEndedAt)}`,
		);
		previousCopy.className = "section-copy";
		previous.append(previousButton.root, previousCopy);
		form.append(previous);
	}

	const actions = div("actions");
	actions.append(
		new Button({
			text: "Update Timer",
			className: "primary",
			type: "submit",
		}).root,
	);
	form.append(actions);

	const close = () => {
		root.hidden = true;
		document.body.classList.remove("modal-open");
	};

	const open = () => {
		root.hidden = false;
		document.body.classList.add("modal-open");
		projectSelect.focus();
	};

	closeButton.onClick = close;
	backdrop.onclick = close;
	root.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && !root.hidden) close();
	});
	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		const startedAtValue = parseDateTimeLocalInput(startedAt.value);
		if (!startedAtValue) {
			setStatus(context.status, "Start time is invalid.", true);
			return;
		}
		try {
			await context.actions.updateRunningTimer(runningEntry, {
				clientName: clientSelect.text,
				projectName: projectSelect.text,
				description: description.value.trim() || null,
				startedAt: startedAtValue,
			});
			close();
			setStatus(context.status, "Running timer updated.");
		} catch (error) {
			setStatus(
				context.status,
				error instanceof Error ? error.message : "Failed to update running timer.",
				true,
			);
		}
	});

	dialog.append(header, form);
	root.append(backdrop, dialog);
	return Object.assign(new UiComponent(root), { open, close });
};

const createStopTimerProjectModal = (
	context: TimePageContext,
	runningEntry: TimeEntry,
) => {
	const root = document.createElement("div");
	root.className = "time-entry-edit-modal";
	root.hidden = true;
	root.tabIndex = -1;

	const backdrop = div("time-entry-edit-modal__backdrop");
	const dialog = div("time-entry-edit-modal__dialog card panel");
	dialog.role = "dialog";
	dialog.setAttribute("aria-modal", "true");
	dialog.setAttribute("aria-label", "Choose Project");

	const header = div("section-header");
	const closeButton = new Button({
		text: "Close",
		className: "secondary",
		type: "button",
	});
	closeButton.root.setAttribute("aria-label", "Close choose project modal");
	header.append(text("h2", "Choose Project"), closeButton.root);

	const copy = text("p", "Choose a project before stopping this timer.");
	copy.className = "section-copy";

	const form = document.createElement("form");
	const clientSelect = new SearchSelect({
		placeholder: "Type or choose a client",
		allowCreate: true,
		createLabelPrefix: "Create client",
	});
	const projectSelect = new SearchSelect({
		placeholder: "Type or choose a project",
		allowCreate: true,
		createLabelPrefix: "Create project",
		required: true,
	});
	const actions = div("actions");
	const submitButton = new Button({
		text: "Stop Timer",
		className: "primary",
		type: "submit",
	});
	const cancelButton = new Button({
		text: "Cancel",
		className: "secondary",
		type: "button",
	});
	actions.append(submitButton.root, cancelButton.root);
	form.append(
		field("Client (optional)", clientSelect.root),
		field("Project", projectSelect.root),
		actions,
	);

	const status = div("status");
	const setLocalStatus = (message: string, isError = false) => {
		setStatus(status, message, isError);
	};

	const close = () => {
		root.hidden = true;
		document.body.classList.remove("modal-open");
		clientSelect.clear();
		projectSelect.clear();
		setLocalStatus("");
	};

	const open = () => {
		const state = context.store.get();
		clientSelect.setOptions(clientOptions(state.clients));
		projectSelect.setOptions(choiceOptions(state.choices));
		root.hidden = false;
		document.body.classList.add("modal-open");
		setLocalStatus("");
		projectSelect.focus();
	};
	bindClientScopedProjectSelect(
		() => context.store.get(),
		clientSelect,
		projectSelect,
	);

	closeButton.onClick = close;
	cancelButton.onClick = close;
	backdrop.onclick = close;
	root.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && !root.hidden) close();
	});
	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		setLocalStatus("Stopping timer...");
		try {
			await context.actions.assignProjectAndStopTimer(
				runningEntry,
				projectSelect.text,
				clientSelect.text,
			);
			close();
			setStatus(context.status, "Timer stopped.");
		} catch (error) {
			setLocalStatus(
				error instanceof Error ? error.message : "Failed to stop timer.",
				true,
			);
		}
	});

	dialog.append(header, copy, form, status);
	root.append(backdrop, dialog);
	return Object.assign(new UiComponent(root), { open, close });
};

const createTimerPanel = (context: TimePageContext) => {
	const root = document.createElement("section");
	root.className = "time-block";
	let timerInterval: number | null = null;

	const clearTimer = () => {
		if (timerInterval !== null) {
			window.clearInterval(timerInterval);
			timerInterval = null;
		}
	};

	const render = () => {
		clearTimer();
		root.replaceChildren();
		const state = context.store.get();
		const runningEntry = state.runningEntry;
		root.classList.toggle("time-block--timer-running", runningEntry !== null);
		const header = div("section-header");
		header.append(
			text("h2", runningEntry ? "Current Timer" : "Start Timer"),
			runningEntry ? tag("Running") : tag("Stopped", true),
		);
		root.append(header);

		let unassignedStopModal:
			| ReturnType<typeof createStopTimerProjectModal>
			| null = null;
		if (runningEntry) {
			const previousEndedAt = findPreviousTimeEntryEnd(
				state.entries,
				runningEntry,
			);
			const project = projectForEntry(runningEntry, state.projects);
			const running = div("time-running");
			const projectRow = div("time-running__project");
			projectRow.append(
				timeColor(project?.color ?? "#2d7c6f"),
				text("strong", project?.name ?? "No project"),
			);
			const duration = div("time-running__duration");
			duration.textContent = formatDuration(timeEntryDurationSeconds(runningEntry));
			running.append(projectRow, duration);
			if (runningEntry.description) {
				const description = text("p", runningEntry.description);
				description.className = "section-copy";
				running.append(description);
			}

			const actions = div("time-running__actions");
			const editModal = createRunningEditModal(
				context,
				runningEntry,
				previousEndedAt,
			);
			const stopProjectModal = createStopTimerProjectModal(context, runningEntry);
			unassignedStopModal = stopProjectModal;
			const editButton = new Button({
				text: "Edit",
				className: "secondary",
			});
			editButton.onClick = () => editModal.open();
			const stopButton = new Button({
				text: "Stop",
				className: "primary",
			});
			stopButton.onClick = async () => {
				if (runningEntry.project_id === null) {
					stopProjectModal.open();
					return;
				}
				try {
					await context.actions.stopTimer(runningEntry);
					setStatus(context.status, "Timer stopped.");
				} catch (error) {
					setStatus(
						context.status,
						error instanceof Error ? error.message : "Failed to stop timer.",
						true,
					);
				}
			};
			actions.append(editButton.root, stopButton.root);
			running.append(actions);
			root.append(running, editModal.root, stopProjectModal.root);

			timerInterval = window.setInterval(() => {
				if (!root.isConnected) {
					clearTimer();
					return;
				}
				duration.textContent = formatDuration(
					timeEntryDurationSeconds(runningEntry),
				);
			}, 1000);
			return;
		}

		const form = document.createElement("form");
		form.className = "time-start-form";
		const clientSelect = new SearchSelect({
			placeholder: "Type or choose a client",
			allowCreate: true,
			createLabelPrefix: "Create client",
		});
		clientSelect.setOptions(clientOptions(state.clients));
		const projectSelect = new SearchSelect({
			placeholder: "Type or choose a project",
			allowCreate: true,
			createLabelPrefix: "Create project",
		});
		projectSelect.setOptions(choiceOptions(state.choices));
		bindClientScopedProjectSelect(
			() => context.store.get(),
			clientSelect,
			projectSelect,
		);

		const description = document.createElement("input");
		description.placeholder = "What are you working on?";
		description.setAttribute("autocomplete", "off");

		const submit = new Button({
			text: "Start Timer",
			className: "primary",
			type: "submit",
		});
		form.append(
			field("Client (optional)", clientSelect.root),
			field("Project (optional)", projectSelect.root),
			field("Description", description),
			submit.root,
		);
		form.addEventListener("submit", async (event) => {
			event.preventDefault();
			if (runningEntry?.project_id === null) {
				unassignedStopModal?.open();
				return;
			}
			try {
				await context.actions.startTimer(
					clientSelect.text,
					projectSelect.text,
					description.value.trim() || null,
				);
				setStatus(context.status, "Timer started.");
			} catch (error) {
				setStatus(
					context.status,
					error instanceof Error ? error.message : "Failed to start timer.",
					true,
				);
			}
		});
		root.append(form);
	};

	const unsubscribe = context.store.subscribe(render);
	return Object.assign(new UiComponent(root), {
		render,
		destroy: () => {
			unsubscribe();
			clearTimer();
		},
	});
};

const createQuickActions = (context: TimePageContext) => {
	const root = div("time-quick-actions");

	const render = () => {
		root.replaceChildren();
		const state = context.store.get();
		const actions = buildQuickActions(state.entries, state.projects);
		if (!actions.length) {
			const empty = div("empty");
			empty.textContent = "No repeated timers yet.";
			root.append(empty);
			return;
		}

		for (const action of actions) {
			const row = div("time-action-row");
			const main = div("time-action-row__main");
			const title = div("time-entry-row__title");
			title.append(
				timeColor(action.project?.color ?? "#2d7c6f"),
				text("strong", action.project?.name ?? "Project"),
			);
			const description = div("time-entry-row__description");
			description.textContent = action.description || "No description";
			const meta = div("section-copy");
			meta.textContent = `${action.entry_count} entr${
				action.entry_count === 1 ? "y" : "ies"
			} - ${formatDuration(action.total_seconds)}`;
			main.append(title, description, meta);

			const start = new Button({
				text: "Start",
				className: "secondary",
			});
			start.onClick = async () => {
				try {
					await context.actions.startTimerForProject(
						action.project_id,
						action.description || null,
					);
					setStatus(context.status, "Timer started.");
				} catch (error) {
					setStatus(
						context.status,
						error instanceof Error ? error.message : "Failed to start timer.",
						true,
					);
				}
			};
			row.append(main, start.root);
			root.append(row);
		}
	};

	const unsubscribe = context.store.subscribe(render);
	return Object.assign(new UiComponent(root), {
		render,
		destroy: unsubscribe,
	});
};

const createTimeEntryRow = (
	context: TimePageContext,
	entry: TimeEntry,
) => {
	const root = div(`time-entry-row ${entry.ended_at ? "" : "time-entry-row--running"}`);
	const project = projectForEntry(entry, context.store.get().projects);
	const description = normalizeDescription(entry.description);

	const summary = div("time-entry-row__summary");
	const main = div("time-entry-row__main");
	const header = div("time-entry-row__header");
	const title = div("time-entry-row__title");
	title.append(
		timeColor(project?.color ?? "#2d7c6f"),
		text("strong", project?.name ?? "No project"),
		tag(
			entry.ended_at ? formatDuration(timeEntryDurationSeconds(entry)) : "Running",
			Boolean(entry.ended_at),
		),
	);
	if (project?.client) {
		title.append(tag(project.client.name, true));
	}

	const editButton = new Button({
		text: "Edit",
		className: "secondary time-entry-row__edit",
	});
	header.append(title, editButton.root);

	const descriptionRow = div("time-entry-row__description");
	descriptionRow.textContent = description || "No description";
	const meta = div("section-copy");
	meta.textContent = `${formatDateTime(entry.started_at)}${
		entry.ended_at ? ` - ${formatDateTime(entry.ended_at)}` : ""
	}`;
	main.append(header, descriptionRow, meta);

	const summaryActions = div("time-entry-row__actions");
	const startAgain = new Button({
		text: "Start Again",
		className: "secondary",
	});
	startAgain.onClick = async () => {
		try {
			if (entry.project_id === null) {
				await context.actions.startTimer("", "", description || null);
			} else {
				await context.actions.startTimerForProject(
					entry.project_id,
					description || null,
				);
			}
			setStatus(context.status, "Timer started.");
		} catch (error) {
			setStatus(
				context.status,
				error instanceof Error ? error.message : "Failed to start timer.",
				true,
			);
		}
	};
	summaryActions.append(startAgain.root);
	summary.append(main, summaryActions);

	const form = document.createElement("form");
	form.className = "time-entry-edit-form";
	form.hidden = true;
	const projectSelect = selectProject(context.store.get().projects, entry.project_id);
	projectSelect.setAttribute("aria-label", "Entry project");
	const descriptionInput = document.createElement("input");
	descriptionInput.value = entry.description ?? "";
	descriptionInput.setAttribute("aria-label", "Entry description");

	const startedAt = document.createElement("input");
	startedAt.type = "datetime-local";
	startedAt.value = formatTimestampForDateTimeLocalInput(entry.started_at);
	startedAt.required = true;

	const endedAt = document.createElement("input");
	endedAt.type = "datetime-local";
	endedAt.value = entry.ended_at
		? formatTimestampForDateTimeLocalInput(entry.ended_at)
		: "";

	const row = div("row");
	const startField = field("Start", startedAt);
	startField.append(timeAdjustmentButtons("Start", startedAt));
	const endField = field("End", endedAt);
	endField.append(timeAdjustmentButtons("End", endedAt));
	row.append(startField, endField);

	const actions = div("actions");
	const save = new Button({ text: "Save", className: "primary", type: "submit" });
	const cancel = new Button({ text: "Cancel", className: "secondary" });
	const remove = new Button({ text: "Delete", className: "secondary" });
	actions.append(save.root, cancel.root, remove.root);

	form.append(
		field("Project", projectSelect),
		field("Description", descriptionInput),
		row,
		actions,
	);

	const showEdit = () => {
		summary.hidden = true;
		form.hidden = false;
		projectSelect.focus();
	};
	const hideEdit = () => {
		form.hidden = true;
		summary.hidden = false;
	};

	editButton.onClick = showEdit;
	cancel.onClick = hideEdit;
	remove.onClick = async () => {
		try {
			await context.actions.deleteEntry(entry);
			setStatus(context.status, "Entry deleted.");
		} catch (error) {
			setStatus(
				context.status,
				error instanceof Error ? error.message : "Failed to delete entry.",
				true,
			);
		}
	};
	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		const startedAtValue = parseDateTimeLocalInput(startedAt.value);
		const endedAtValue = endedAt.value.trim()
			? parseDateTimeLocalInput(endedAt.value)
			: null;
		if (!startedAtValue || (endedAt.value.trim() && !endedAtValue)) {
			setStatus(context.status, "Entry times are invalid.", true);
			return;
		}

		try {
			if (!projectSelect.value) {
				setStatus(context.status, "Project is required.", true);
				return;
			}
			await context.actions.updateEntry(entry, {
				projectId: Number(projectSelect.value),
				description: descriptionInput.value.trim() || null,
				startedAt: startedAtValue,
				endedAt: endedAtValue,
			});
			setStatus(context.status, "Entry saved.");
		} catch (error) {
			setStatus(
				context.status,
				error instanceof Error ? error.message : "Failed to save entry.",
				true,
			);
		}
	});

	root.append(summary, form);
	return new UiComponent(root);
};

const createTimeEntriesList = (context: TimePageContext) => {
	const root = div("time-entry-list");

	const render = () => {
		root.replaceChildren();
		const recentEntries = context.store.get().entries.slice(0, 30);
		if (!recentEntries.length) {
			const empty = div("empty");
			empty.textContent = "No time entries yet.";
			root.append(empty);
			return;
		}
		root.append(
			...recentEntries.map((entry) => createTimeEntryRow(context, entry).root),
		);
	};

	const unsubscribe = context.store.subscribe(render);
	return Object.assign(new UiComponent(root), {
		render,
		destroy: unsubscribe,
	});
};

const renderTimeOverviewSpanOptions = (selectedValue: string) =>
	TIME_OVERVIEW_SPANS.map((span) => {
		const option = document.createElement("option");
		option.value = span.value;
		option.textContent = span.label;
		option.selected = span.value === selectedValue;
		return option;
	});

const renderTimeOverviewGroupOptions = (selectedValue: TimeOverviewGroup) =>
	TIME_OVERVIEW_GROUPS.map((group) => {
		const option = document.createElement("option");
		option.value = group.value;
		option.textContent = group.label;
		option.selected = group.value === selectedValue;
		return option;
	});

const formatTimeOverviewPeriod = (report: TimeReport) => {
	if (report.period.from === null) {
		return `Through ${formatDateTime(report.period.to)}`;
	}
	return `${formatDateTime(report.period.from)} - ${formatDateTime(report.period.to)}`;
};

type TimeOverviewItem = {
	key: string;
	name: string;
	color: string;
	totalSeconds: number;
	entryCount: number;
	projectCount?: number;
	synthetic?: boolean;
};

const projectTotalKey = (projectId: number | null) =>
	projectId === null ? "no-project" : String(projectId);

const clientTotalKey = (client: Pick<TimeReportClientTotal, "client_id" | "client_name">) =>
	client.client_id === null ? client.client_name : String(client.client_id);

const getTimeOverviewItems = (
	report: TimeReport,
	group: TimeOverviewGroup,
	baselineSeconds?: number,
): TimeOverviewItem[] => {
	const items = group === "client"
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
	}));
	if (baselineSeconds === undefined) return items;
	const trackedSeconds = items.reduce((sum, item) => sum + item.totalSeconds, 0);
	const unknownSeconds = Math.max(0, baselineSeconds - trackedSeconds);
	if (unknownSeconds <= 0) return items;
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
	];
};

const polarToPiePoint = (percent: number) => {
	const radians = ((percent / 100) * 360 - 90) * (Math.PI / 180);
	return {
		x: 50 + 50 * Math.cos(radians),
		y: 50 + 50 * Math.sin(radians),
	};
};

const describePieSegment = (startPercent: number, endPercent: number) => {
	const start = polarToPiePoint(startPercent);
	const end = polarToPiePoint(endPercent);
	const largeArc = endPercent - startPercent > 50 ? 1 : 0;
	return [
		"M 50 50",
		`L ${start.x.toFixed(4)} ${start.y.toFixed(4)}`,
		`A 50 50 0 ${largeArc} 1 ${end.x.toFixed(4)} ${end.y.toFixed(4)}`,
		"Z",
	].join(" ");
};

const createTimeOverviewPie = (
	report: TimeReport,
	group: TimeOverviewGroup,
	baselineSeconds?: number,
) => {
	const pie = div("time-overview-pie");
	const items = getTimeOverviewItems(report, group, baselineSeconds);
	const total = items.reduce(
		(sum, item) => sum + item.totalSeconds,
		0,
	);
	if (total <= 0) {
		pie.classList.add("time-overview-pie--empty");
		pie.setAttribute("aria-label", `No ${group} time in this span`);
		return pie;
	}

	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("viewBox", "0 0 100 100");
	svg.setAttribute("role", "img");
	svg.setAttribute("aria-label", `${group} time usage pie chart`);
	let cursor = 0;
	for (const item of items) {
		const start = cursor;
		const end = cursor + (item.totalSeconds / total) * 100;
		cursor = end;
		const percent = Math.round((item.totalSeconds / total) * 100);
		const segment =
			end - start >= 99.999
				? document.createElementNS("http://www.w3.org/2000/svg", "circle")
				: document.createElementNS("http://www.w3.org/2000/svg", "path");
		if (segment instanceof SVGCircleElement) {
			segment.setAttribute("cx", "50");
			segment.setAttribute("cy", "50");
			segment.setAttribute("r", "50");
		} else {
			segment.setAttribute("d", describePieSegment(start, end));
		}
		segment.setAttribute("fill", item.color);
		const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
		title.textContent = `${item.name}: ${percent}% (${formatDuration(item.totalSeconds)})`;
		segment.append(title);
		svg.append(segment);
	}
	pie.append(svg);
	pie.setAttribute("aria-label", `${group} time usage pie chart`);
	return pie;
};

const createTimeOverviewSummary = (
	report: TimeReport,
	average: TimeOverviewAverage | null,
	group: TimeOverviewGroup,
	baselineSeconds?: number,
) => {
	const summary = div("time-report-summary time-overview-summary");
	const items = getTimeOverviewItems(report, group, baselineSeconds);
	const total = div();
	total.append(text("span", "Total Time"), text("strong", formatDuration(report.total_seconds)));
	const dailyAverage = div();
	dailyAverage.append(
		text("span", "Average per full day"),
		text(
			"strong",
			average && average.dayCount > 0
				? formatDuration(average.totalSeconds / average.dayCount)
				: "No full days",
		),
	);
	const projects = div();
	projects.append(
		text("span", group === "client" ? "Clients" : "Projects"),
		text("strong", String(items.length)),
	);
	const period = div();
	period.append(text("span", "Span"), text("strong", formatTimeOverviewPeriod(report)));
	summary.append(total, dailyAverage, projects, period);
	return summary;
};

const createTimeOverviewProjectList = (
	report: TimeReport,
	average: TimeOverviewAverage | null,
	group: TimeOverviewGroup,
	baselineSeconds?: number,
) => {
	const list = div("time-report-list time-overview-list");
	const items = getTimeOverviewItems(report, group, baselineSeconds);
	const itemTotal = items.reduce(
		(sum, item) => sum + item.totalSeconds,
		0,
	);
	if (!items.length) {
		const empty = div("empty");
		empty.textContent = `No tracked ${group} time in this span.`;
		list.append(empty);
		return list;
	}

	for (const item of items) {
		const row = div("time-report-row time-overview-row");
		const main = div("time-overview-row__main");
		const title = div("time-entry-row__title");
		title.append(
			timeColor(item.color),
			text("strong", item.name),
		);
		const meta = text(
			"span",
			item.synthetic
				? "24h minus tracked time"
				: group === "client"
				? `${item.projectCount ?? 0} project${item.projectCount === 1 ? "" : "s"} - ${item.entryCount} entr${item.entryCount === 1 ? "y" : "ies"}`
				: `${item.entryCount} entr${item.entryCount === 1 ? "y" : "ies"}`,
		);
		meta.className = "section-copy";
		const percent =
			itemTotal > 0 ? Math.round((item.totalSeconds / itemTotal) * 100) : 0;
		main.append(title, meta);
		const total = div("time-overview-row__total");
			const averageSeconds = item.synthetic
				? Math.max(0, (average?.baselineSeconds ?? 0) - (average?.totalSeconds ?? 0))
				: group === "client"
					? (average?.clientSecondsByKey.get(item.key) ?? 0)
					: (average?.projectSecondsByKey.get(item.key) ?? 0);
		total.append(
			text("strong", formatDuration(item.totalSeconds)),
			text("span", `${percent}%`),
		);
			total.append(text(
				"span",
				average && average.dayCount > 0
					? `Avg/day ${formatDuration(averageSeconds / average.dayCount)}`
					: "Avg/day No full days",
			));
		row.append(main, total);
		list.append(row);
	}

	return list;
};

const renderTimeOverviewReport = (
	report: TimeReport | null,
	resultsRoot: HTMLElement,
	average: TimeOverviewAverage | null = null,
	group: TimeOverviewGroup = DEFAULT_TIME_OVERVIEW_GROUP,
	baselineSeconds?: number,
) => {
	resultsRoot.replaceChildren();
	if (!report) {
		const empty = div("empty");
		empty.textContent = "Choose a span to load time usage.";
		resultsRoot.append(empty);
		return;
	}

	const chartPanel = div("time-overview-chart");
	chartPanel.append(
		createTimeOverviewPie(report, group, baselineSeconds),
		createTimeOverviewProjectList(report, average, group, baselineSeconds),
	);
	resultsRoot.append(createTimeOverviewSummary(report, average, group, baselineSeconds), chartPanel);
};

const createEmptyTimeReport = (from: string, to: string): TimeReport => ({
	period: {
		from,
		to,
		range: "custom",
	},
	total_seconds: 0,
	project_totals: [],
	client_totals: [],
});

const createTimeWeeklySummary = (days: TimeWeeklyDayReport[]) => {
	const summary = div("time-report-summary time-overview-summary");
	const reports = days.map((day) => day.report).filter((report): report is TimeReport => report !== null);
	const totalSeconds = reports.reduce(
		(sum, report) => sum + report.total_seconds,
		0,
	);
	const activeDays = reports.filter((report) => report.total_seconds > 0).length;
	const clients = new Set<string>();
	for (const report of reports) {
		for (const client of report.client_totals) {
			clients.add(clientTotalKey(client));
		}
	}
	const weekStart = localDateFromInput(days[0]?.date ?? formatDateInput());
	const weekEnd = localDateFromInput(days[6]?.date ?? formatDateInput());
	const total = div();
	total.append(text("span", "Total Time"), text("strong", formatDuration(totalSeconds)));
	const average = div();
	average.append(
		text("span", "Daily Average"),
		text("strong", activeDays > 0 ? formatDuration(totalSeconds / activeDays) : "No active days"),
	);
	const clientCount = div();
	clientCount.append(text("span", "Clients"), text("strong", String(clients.size)));
	const span = div();
	span.append(
		text("span", "Week"),
		text(
			"strong",
			weekStart && weekEnd
				? `${formatShortDate(weekStart)} - ${formatShortDate(weekEnd)}`
				: "Selected week",
		),
	);
	summary.append(total, average, clientCount, span);
	return summary;
};

const createTimeMonthlySummary = (days: TimeWeeklyDayReport[]) => {
	const summary = div("time-report-summary time-overview-summary");
	const reports = days.map((day) => day.report).filter((report): report is TimeReport => report !== null);
	const totalSeconds = reports.reduce(
		(sum, report) => sum + report.total_seconds,
		0,
	);
	const activeDays = reports.filter((report) => report.total_seconds > 0).length;
	const clients = new Set<string>();
	for (const report of reports) {
		for (const client of report.client_totals) {
			clients.add(clientTotalKey(client));
		}
	}
	const monthStart = localDateFromInput(days[0]?.date ?? formatDateInput());
	const total = div();
	total.append(text("span", "Total Time"), text("strong", formatDuration(totalSeconds)));
	const average = div();
	average.append(
		text("span", "Daily Average"),
		text("strong", activeDays > 0 ? formatDuration(totalSeconds / activeDays) : "No active days"),
	);
	const clientCount = div();
	clientCount.append(text("span", "Clients"), text("strong", String(clients.size)));
	const span = div();
	span.append(
		text("span", "Month"),
		text("strong", monthStart ? formatMonth(monthStart) : "Selected month"),
	);
	summary.append(total, average, clientCount, span);
	return summary;
};

const getTimePeriodChartData = (days: TimeWeeklyDayReport[]) => {
	const clientTotals = new Map<string, TimeOverviewItem>();
	const dayClientSeconds = days.map((day) => {
		const totals = new Map<string, number>();
		let trackedSeconds = 0;
		for (const client of day.report?.client_totals ?? []) {
			const key = clientTotalKey(client);
			totals.set(key, client.total_seconds);
			trackedSeconds += client.total_seconds;
			const existing = clientTotals.get(key);
			if (existing) {
				existing.totalSeconds += client.total_seconds;
				existing.entryCount += client.entry_count;
				existing.projectCount = Math.max(
					existing.projectCount ?? 0,
					client.project_count,
				);
			} else {
				clientTotals.set(key, {
					key,
					name: client.client_name,
					color: client.client_color,
					totalSeconds: client.total_seconds,
					entryCount: client.entry_count,
					projectCount: client.project_count,
				});
			}
		}
		const unknownSeconds = Math.max(0, day.baselineSeconds - trackedSeconds);
		if (unknownSeconds > 0) {
			totals.set(UNKNOWN_TIME_KEY, unknownSeconds);
			const existing = clientTotals.get(UNKNOWN_TIME_KEY);
			if (existing) {
				existing.totalSeconds += unknownSeconds;
			} else {
				clientTotals.set(UNKNOWN_TIME_KEY, {
					key: UNKNOWN_TIME_KEY,
					name: "Unknown",
					color: UNKNOWN_TIME_COLOR,
					totalSeconds: unknownSeconds,
					entryCount: 0,
					projectCount: 0,
					synthetic: true,
				});
			}
		}
		return totals;
	});
	const clients = [...clientTotals.values()].sort(
		(left, right) =>
			Number(Boolean(left.synthetic)) - Number(Boolean(right.synthetic)) ||
			right.totalSeconds - left.totalSeconds ||
			left.name.localeCompare(right.name),
	);
	const dayTotals = days.map((day) =>
		Math.max(day.baselineSeconds, day.report?.total_seconds ?? 0),
	);
	return { clients, dayClientSeconds, dayTotals };
};

const createTimeWeeklyLegend = (
	clients: TimeOverviewItem[],
	dayCount: number,
	emptyText: string,
) => {
	const legend = div("time-weekly-legend");
	if (clients.length === 0) {
		const empty = div("empty");
		empty.textContent = emptyText;
		legend.append(empty);
	} else {
		for (const client of clients) {
			const row = div("time-weekly-legend__row");
			const label = div("time-entry-row__title");
			label.append(timeColor(client.color), text("strong", client.name));
			const total = div("time-weekly-legend__total");
			total.append(
				text("strong", formatDuration(client.totalSeconds)),
				text(
					"span",
					`Avg/day ${formatDuration(
						dayCount > 0 ? client.totalSeconds / dayCount : 0,
					)}`,
				),
			);
			row.append(label, total);
			legend.append(row);
		}
	}
	return legend;
};

const createTimeWeeklyChart = (
	days: TimeWeeklyDayReport[],
	emptyText = "No tracked client time in this week.",
) => {
	const { clients, dayClientSeconds, dayTotals } = getTimePeriodChartData(days);
	const maxDaySeconds = Math.max(...dayTotals, 0);
	const root = div("time-weekly-chart");
	const bars = div("time-weekly-bars");
	bars.style.setProperty("--time-period-days", String(days.length));

	for (const [index, day] of days.entries()) {
		const dayTotal = dayTotals[index] ?? 0;
		const column = div("time-weekly-day");
		const bar = div("time-weekly-bar");
		bar.style.setProperty(
			"--time-weekly-fill",
			maxDaySeconds > 0 ? `${Math.max(4, (dayTotal / maxDaySeconds) * 100)}%` : "0%",
		);
		if (dayTotal <= 0) {
			bar.classList.add("time-weekly-bar--empty");
		}
		const stack = div("time-weekly-bar__stack");
		for (const client of clients) {
			const seconds = dayClientSeconds[index]?.get(client.key) ?? 0;
			if (seconds <= 0 || dayTotal <= 0) continue;
			const segment = div("time-weekly-bar__segment");
			segment.style.setProperty("--time-color", client.color);
			segment.style.setProperty(
				"--time-weekly-segment",
				`${(seconds / dayTotal) * 100}%`,
			);
			const percentage = Math.round((seconds / dayTotal) * 100);
			segment.title = `${client.name}: ${percentage}% (${formatDuration(seconds)})`;
			stack.append(segment);
		}
		bar.append(stack);
		const label = div("time-weekly-day__label");
		label.append(text("strong", day.shortLabel), text("span", formatDuration(dayTotal)));
		column.append(bar, label);
		bars.append(column);
	}

	root.append(bars, createTimeWeeklyLegend(clients, days.length, emptyText));
	return root;
};

const createTimeMonthlyDayDetails = (
	day: TimeWeeklyDayReport | undefined,
	clients: TimeOverviewItem[],
	dayClientSeconds: Map<string, number> | undefined,
	dayTotal: number,
) => {
	const details = div("time-monthly-detail");
	if (!day) {
		const empty = div("empty");
		empty.textContent = "Select a day.";
		details.append(empty);
		return details;
	}

	const date = localDateFromInput(day.date) ?? new Date(day.from);
	const title = div("time-monthly-detail__title");
	title.append(text("strong", `${formatWeekday(date)} ${formatShortDate(date)}`));
	title.append(text("span", `${formatDuration(day.report?.total_seconds ?? 0)} tracked`));
	details.append(title);

	const rows = div("time-monthly-detail__rows");
	for (const client of clients) {
		const seconds = dayClientSeconds?.get(client.key) ?? 0;
		if (seconds <= 0 || dayTotal <= 0) continue;
		const percentage = Math.round((seconds / dayTotal) * 100);
		const row = div("time-monthly-detail__row");
		const label = div("time-entry-row__title");
		label.append(timeColor(client.color), text("strong", client.name));
		row.append(
			label,
			text("span", `${percentage}%`),
			text("span", formatDuration(seconds)),
		);
		rows.append(row);
	}
	if (!rows.childElementCount) {
		const empty = div("empty");
		empty.textContent = "No time details for this day.";
		rows.append(empty);
	}
	details.append(rows);
	return details;
};

const createTimeMonthlyTotals = (
	clients: TimeOverviewItem[],
	totalSeconds: number,
	emptyText: string,
) => {
	const rows = div("time-monthly-detail__rows");
	for (const client of clients) {
		const percentage =
			totalSeconds > 0 ? Math.round((client.totalSeconds / totalSeconds) * 100) : 0;
		const row = div("time-monthly-detail__row");
		const label = div("time-entry-row__title");
		label.append(timeColor(client.color), text("strong", client.name));
		row.append(
			label,
			text("span", `${percentage}%`),
			text("span", formatDuration(client.totalSeconds)),
		);
		rows.append(row);
	}
	if (!rows.childElementCount) {
		const empty = div("empty");
		empty.textContent = emptyText;
		rows.append(empty);
	}
	return rows;
};

const createTimeMonthlyCalendar = (
	days: TimeWeeklyDayReport[],
	selectedDate: string,
	onSelectDate: (date: string) => void,
) => {
	const { clients, dayClientSeconds, dayTotals } = getTimePeriodChartData(days);
	const root = div("time-monthly-calendar-layout");
	const calendar = div("time-monthly-calendar");
	for (const weekday of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
		calendar.append(text("div", weekday));
		calendar.lastElementChild?.classList.add("time-monthly-weekday");
	}
	const firstDay = localDateFromInput(days[0]?.date ?? formatDateInput());
	const leadingBlankCount = firstDay ? (firstDay.getDay() + 6) % 7 : 0;
	for (let index = 0; index < leadingBlankCount; index += 1) {
		calendar.append(div("time-monthly-day time-monthly-day--blank"));
	}

	for (const [index, day] of days.entries()) {
		const dayTotal = dayTotals[index] ?? 0;
		const trackedSeconds = day.report?.total_seconds ?? 0;
		const cell = document.createElement("button");
		cell.type = "button";
		cell.className = "time-monthly-day";
		cell.setAttribute("aria-pressed", day.date === selectedDate ? "true" : "false");
		cell.addEventListener("click", () => onSelectDate(day.date));
		if (day.date === selectedDate) {
			cell.classList.add("time-monthly-day--selected");
		}
		if (dayTotal <= 0) {
			cell.classList.add("time-monthly-day--empty");
		}
		const header = div("time-monthly-day__header");
		header.append(text("strong", day.shortLabel), text("span", formatWeekday(localDateFromInput(day.date) ?? new Date(day.from))));
		const total = text("span", dayTotal > 0 ? formatDuration(trackedSeconds) : "Future");
		total.className = "time-monthly-day__total";
		const bar = div("time-monthly-day__bar");
		for (const client of clients) {
			const seconds = dayClientSeconds[index]?.get(client.key) ?? 0;
			if (seconds <= 0 || dayTotal <= 0) continue;
			const segment = div("time-monthly-day__segment");
			segment.style.setProperty("--time-color", client.color);
			segment.style.setProperty(
				"--time-monthly-segment",
				`${(seconds / dayTotal) * 100}%`,
			);
			const percentage = Math.round((seconds / dayTotal) * 100);
			segment.title = `${client.name}: ${percentage}% (${formatDuration(seconds)})`;
			bar.append(segment);
		}
		cell.append(header, total, bar);
		calendar.append(cell);
	}

	const selectedIndex = days.findIndex((day) => day.date === selectedDate);
	const side = div("time-monthly-side");
	const monthTitle = div("time-monthly-detail__title");
	monthTitle.append(text("strong", "Whole month"));
	const monthTotalSeconds = dayTotals.reduce((sum, seconds) => sum + seconds, 0);
	side.append(
		createTimeMonthlyDayDetails(
			days[selectedIndex],
			clients,
			selectedIndex >= 0 ? dayClientSeconds[selectedIndex] : undefined,
			selectedIndex >= 0 ? (dayTotals[selectedIndex] ?? 0) : 0,
		),
		monthTitle,
		createTimeMonthlyTotals(
			clients,
			monthTotalSeconds,
			"No tracked client time in this month.",
		),
	);
	root.append(
		calendar,
		side,
	);
	return root;
};

const renderTimeWeeklyReport = (
	days: TimeWeeklyDayReport[] | null,
	resultsRoot: HTMLElement,
) => {
	resultsRoot.replaceChildren();
	if (!days) {
		const empty = div("empty");
		empty.textContent = "Choose a week to load time usage.";
		resultsRoot.append(empty);
		return;
	}
	resultsRoot.append(createTimeWeeklySummary(days), createTimeWeeklyChart(days));
};

const renderTimeMonthlyReport = (
	days: TimeWeeklyDayReport[] | null,
	resultsRoot: HTMLElement,
	selectedDate = "",
	onSelectDate: (date: string) => void = () => {},
) => {
	resultsRoot.replaceChildren();
	if (!days) {
		const empty = div("empty");
		empty.textContent = "Choose a month to load time usage.";
		resultsRoot.append(empty);
		return;
	}
	resultsRoot.append(
		createTimeMonthlySummary(days),
		createTimeMonthlyCalendar(days, selectedDate, onSelectDate),
	);
};

export const renderTimePage = (page: HTMLElement) => {
	const status = div("status");
	const store = new TimeStore(
		createTimePageState([], [], []),
	);
	const actions = new TimeActions(store, status);
	const context: TimePageContext = {
		store,
		actions,
		status,
	};

	const timerPanel = createTimerPanel(context);
	const quickActions = createQuickActions(context);
	const entriesList = createTimeEntriesList(context);
	const entryCreateModal = createTimeEntryCreateModal(context);

	const workspace = div("workspace time-workspace");
	const sidebar = div("time-sidebar");
	const quickActionsBlock = document.createElement("section");
	quickActionsBlock.className = "time-block";
	const quickActionsHeader = div("section-header");
	quickActionsHeader.append(text("h2", "Quick Actions"));
	quickActionsBlock.append(quickActionsHeader, quickActions.root);
	sidebar.append(timerPanel.root, quickActionsBlock);

	const main = div("time-main");
	const entriesBlock = document.createElement("section");
	entriesBlock.className = "time-block";
	const entriesHeader = div("section-header");
	const addEntry = new Button({
		text: "Add Entry",
		className: "primary",
	});
	addEntry.onClick = () => entryCreateModal.open();
	const headerActions = div("actions");
	headerActions.append(addEntry.root);
	entriesHeader.append(text("h2", "Past Entries"), headerActions);
	entriesBlock.append(entriesHeader, status, entriesList.root);
	main.append(entriesBlock);

	workspace.append(sidebar, main);
	page.append(workspace, entryCreateModal.root);

	void actions.loadInitial();
};

export const renderTimeOverviewPage = (page: HTMLElement) => {
	const selected = getCurrentTimeOverviewSelection();
	const controls = div("spending-breakdown-controls time-overview-controls");
	const spanSelect = document.createElement("select");
	spanSelect.id = "time-overview-span-select";
	spanSelect.append(...renderTimeOverviewSpanOptions(selected.span.value));
	const spanLabel = field("Span", spanSelect);
	const groupSelect = document.createElement("select");
	groupSelect.id = "time-overview-group-select";
	groupSelect.append(...renderTimeOverviewGroupOptions(selected.group));
	const groupLabel = field("Group By", groupSelect);
	const dayInput = document.createElement("input");
	dayInput.id = "time-overview-day-input";
	dayInput.type = "date";
	dayInput.value = selected.day;
	dayInput.max = formatDateInput();
	const dayLabel = field("Day", dayInput);
	controls.append(spanLabel, groupLabel, dayLabel);

	const status = div("status");
	const results = div("time-overview-results");
	const pageBlock = document.createElement("section");
	pageBlock.className = "time-block";
	pageBlock.append(controls, status, results);
	page.append(pageBlock);

	const load = async (selection: TimeOverviewSelection) => {
		setStatus(status, "Loading time overview...");
		renderTimeOverviewReport(null, results, null, selection.group);
		try {
			const period = getTimeOverviewPeriod(selection);
			const baselineSeconds = getTimeOverviewBaselineSeconds(selection);
			const averagePeriod = getFullLocalDayBounds(period);
			const reportPromise = timeApi.fetchReport(period.from, period.to);
			const averageReportPromise = averagePeriod
				? averagePeriod.from === period.from && averagePeriod.to === period.to
					? reportPromise
					: timeApi.fetchReport(averagePeriod.from, averagePeriod.to)
				: Promise.resolve(null);
			const [report, averageReport] = await Promise.all([
				reportPromise,
				averageReportPromise,
			]);
			renderTimeOverviewReport(
				report,
				results,
				averageReport && averagePeriod
						? {
								totalSeconds: averageReport.total_seconds,
								dayCount: countFullLocalDays(averagePeriod),
								baselineSeconds: countFullLocalDays(averagePeriod) * DAY_SECONDS,
								projectSecondsByKey: new Map(
								averageReport.project_totals.map((project) => [
									projectTotalKey(project.project_id),
									project.total_seconds,
								]),
							),
							clientSecondsByKey: new Map(
								averageReport.client_totals.map((client) => [
									clientTotalKey(client),
									client.total_seconds,
								]),
							),
						}
					: null,
				selection.group,
				baselineSeconds,
			);
			setStatus(status, `Loaded ${selection.span.label.toLowerCase()} time usage.`);
		} catch (error) {
			setStatus(
				status,
				error instanceof Error ? error.message : "Failed to load time overview.",
				true,
			);
		}
	};

	spanSelect.addEventListener("change", () => {
		const span = getTimeOverviewSpan(spanSelect.value);
		spanSelect.value = span.value;
		const selection = {
			span,
			day: dayInput.value || formatDateInput(),
			group: getTimeOverviewGroup(groupSelect.value),
		};
		updateTimeOverviewUrl(selection);
		void load(selection);
	});

	groupSelect.addEventListener("change", () => {
		const group = getTimeOverviewGroup(groupSelect.value);
		groupSelect.value = group;
		const selection = {
			span: getTimeOverviewSpan(spanSelect.value),
			day: dayInput.value || formatDateInput(),
			group,
		};
		updateTimeOverviewUrl(selection);
		void load(selection);
	});

	dayInput.addEventListener("change", () => {
		const day = dayInput.value || formatDateInput();
		const span = getTimeOverviewSpan("custom-day");
		spanSelect.value = span.value;
		const selection = {
			span,
			day,
			group: getTimeOverviewGroup(groupSelect.value),
		};
		updateTimeOverviewUrl(selection);
		void load(selection);
	});

	void load(selected);
};

export const renderTimeWeeklyPage = (page: HTMLElement) => {
	let selectedDate = getCurrentTimeWeeklyDate();
	const controls = div("spending-breakdown-controls time-overview-controls time-weekly-controls");
	const previousWeek = new Button({ text: "Previous Week", className: "secondary" });
	const nextWeek = new Button({ text: "Next Week", className: "secondary" });
	const weekInput = document.createElement("input");
	weekInput.id = "time-weekly-date-input";
	weekInput.type = "date";
	weekInput.value = selectedDate;
	weekInput.max = formatDateInput();
	const weekLabel = field("Week", weekInput);
	controls.append(previousWeek.root, weekLabel, nextWeek.root);

	const status = div("status");
	const results = div("time-overview-results");
	const pageBlock = document.createElement("section");
	pageBlock.className = "time-block";
	pageBlock.append(controls, status, results);
	page.append(pageBlock);

	const setSelectedDate = (date: string) => {
		selectedDate = date;
		weekInput.value = selectedDate;
		const selectedWeekStart = startOfLocalWeek(
			localDateFromInput(selectedDate) ?? new Date(),
		);
		const currentWeekStart = startOfLocalWeek(new Date());
		nextWeek.root.disabled = selectedWeekStart >= currentWeekStart;
		updateTimeWeeklyUrl(selectedDate);
	};

	const load = async (weekDate: string) => {
		setSelectedDate(weekDate);
		setStatus(status, "Loading weekly time...");
		renderTimeWeeklyReport(null, results);
		try {
			const days = getTimeWeeklyDays(weekDate);
			const reports = await Promise.all(
				days.map((day) => {
					if (Date.parse(day.from) >= Date.now()) {
						return Promise.resolve(createEmptyTimeReport(day.from, day.to));
					}
					return timeApi.fetchReport(day.from, day.to);
				}),
			);
			const loadedDays = days.map((day, index) => ({
				...day,
				report: reports[index] ?? createEmptyTimeReport(day.from, day.to),
			}));
			renderTimeWeeklyReport(loadedDays, results);
			setStatus(status, "Loaded weekly client time.");
		} catch (error) {
			setStatus(
				status,
				error instanceof Error ? error.message : "Failed to load weekly time.",
				true,
			);
		}
	};

	previousWeek.onClick = () => {
		const date = localDateFromInput(selectedDate) ?? new Date();
		date.setDate(date.getDate() - 7);
		void load(formatDateInput(date));
	};

	nextWeek.onClick = () => {
		const date = localDateFromInput(selectedDate) ?? new Date();
		date.setDate(date.getDate() + 7);
		const clippedDate = new Date(Math.min(date.getTime(), Date.now()));
		void load(formatDateInput(clippedDate));
	};

	weekInput.addEventListener("change", () => {
		const date = weekInput.value || formatDateInput();
		void load(date);
	});

	void load(selectedDate);
};

export const renderTimeMonthlyPage = (page: HTMLElement) => {
	let selectedMonth = getCurrentTimeMonthlyDate();
	let selectedDate = formatDateInput();
	let loadedDays: TimeWeeklyDayReport[] = [];
	const controls = div("spending-breakdown-controls time-overview-controls time-weekly-controls");
	const previousMonth = new Button({ text: "Previous Month", className: "secondary" });
	const nextMonth = new Button({ text: "Next Month", className: "secondary" });
	const monthInput = document.createElement("input");
	monthInput.id = "time-monthly-date-input";
	monthInput.type = "month";
	monthInput.value = selectedMonth;
	monthInput.max = formatMonthInput();
	const monthLabel = field("Month", monthInput);
	controls.append(previousMonth.root, monthLabel, nextMonth.root);

	const status = div("status");
	const results = div("time-overview-results");
	const pageBlock = document.createElement("section");
	pageBlock.className = "time-block";
	pageBlock.append(controls, status, results);
	page.append(pageBlock);

	const setSelectedMonth = (month: string) => {
		selectedMonth = month;
		monthInput.value = selectedMonth;
		const selectedMonthStart = startOfLocalMonth(
			localMonthFromInput(selectedMonth) ?? new Date(),
		);
		const currentMonthStart = startOfLocalMonth(new Date());
		nextMonth.root.disabled = selectedMonthStart >= currentMonthStart;
		updateTimeMonthlyUrl(selectedMonth);
	};

	const defaultSelectedDate = (days: TimeWeeklyDayReport[]) => {
		const today = formatDateInput();
		return days.some((day) => day.date === today)
			? today
			: (days.find((day) => day.baselineSeconds > 0) ?? days[0])?.date ?? today;
	};

	const renderLoadedDays = () => {
		renderTimeMonthlyReport(loadedDays, results, selectedDate, (date) => {
			selectedDate = date;
			renderLoadedDays();
		});
	};

	const load = async (monthDate: string) => {
		setSelectedMonth(monthDate);
		setStatus(status, "Loading monthly time...");
		renderTimeMonthlyReport(null, results);
		try {
			const days = getTimeMonthlyDays(monthDate);
			const reports = await Promise.all(
				days.map((day) => {
					if (Date.parse(day.from) >= Date.now()) {
						return Promise.resolve(createEmptyTimeReport(day.from, day.to));
					}
					return timeApi.fetchReport(day.from, day.to);
				}),
			);
			loadedDays = days.map((day, index) => ({
				...day,
				report: reports[index] ?? createEmptyTimeReport(day.from, day.to),
			}));
			if (!loadedDays.some((day) => day.date === selectedDate)) {
				selectedDate = defaultSelectedDate(loadedDays);
			}
			renderLoadedDays();
			setStatus(status, "Loaded monthly client time.");
		} catch (error) {
			setStatus(
				status,
				error instanceof Error ? error.message : "Failed to load monthly time.",
				true,
			);
		}
	};

	previousMonth.onClick = () => {
		const date = localMonthFromInput(selectedMonth) ?? new Date();
		date.setMonth(date.getMonth() - 1);
		void load(formatMonthInput(date));
	};

	nextMonth.onClick = () => {
		const date = localMonthFromInput(selectedMonth) ?? new Date();
		date.setMonth(date.getMonth() + 1);
		const clippedDate = new Date(Math.min(date.getTime(), Date.now()));
		void load(formatMonthInput(clippedDate));
	};

	monthInput.addEventListener("change", () => {
		const date = monthInput.value || formatMonthInput();
		void load(date);
	});

	void load(selectedMonth);
};
