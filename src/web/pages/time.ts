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
	project_id: number;
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
	dayCount: number;
	projectSecondsById: Map<number, number>;
	clientSecondsByKey: Map<string, number>;
};

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

	updateProject: (
		id: number,
		values: {
			client_id?: number | null;
			name?: string;
			color?: string;
			archived_at?: string | null;
		},
	) =>
		timeApiJson<Project>(`/api/projects/${id}`, {
			method: "PATCH",
			body: JSON.stringify(values),
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

const formatTimestampForDateTimeLocalInput = (value: string) =>
	formatDateTimeLocalInput(new Date(value));

const parseDateTimeLocalInput = (value: string) => {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
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

const startOfLocalWeek = (date: Date) => {
	const start = startOfLocalDay(date);
	const mondayOffset = (start.getDay() + 6) % 7;
	start.setDate(start.getDate() - mondayOffset);
	return start;
};

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

const getTimeOverviewPeriod = (selection: TimeOverviewSelection) => {
	const to = new Date();
	const from = (() => {
		switch (selection.span.value) {
			case "today":
				return startOfLocalDay(to);
			case "custom-day":
				return localDateFromInput(selection.day) ?? startOfLocalDay(to);
			case "this-week":
				return startOfLocalWeek(to);
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

	public async assignProjectClient(project: Project, clientName: string) {
		const normalizedName = clientName.trim();
		const client = normalizedName ? await this.ensureClient(normalizedName) : null;
		const updatedProject = await timeApi.updateProject(project.id, {
			client_id: client?.id ?? null,
		});
		const nextState = this.store.get();
		const projects = nextState.projects.map((candidate) =>
			candidate.id === updatedProject.id ? updatedProject : candidate,
		);
		const entries = nextState.entries.map((entry) =>
			entry.project_id === updatedProject.id
				? { ...entry, project: updatedProject }
				: entry,
		);
		this.store.setAllData(nextState.clients, projects, entries);
		return updatedProject;
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
		const header = div("section-header");
		header.append(
			text("h2", "Start Timer"),
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
	row.append(field("Start", startedAt), field("End", endedAt));

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

const createProjectsList = (context: TimePageContext) => {
	const root = div("time-project-list");

	const render = () => {
		root.replaceChildren();
		const state = context.store.get();
		const projects = state.projects.filter((project) => project.archived_at === null);
		if (!projects.length) {
			const empty = div("empty");
			empty.textContent = "No time projects yet.";
			root.append(empty);
			return;
		}

		for (const project of projects) {
			const row = div("time-project-row");
			const main = div("time-entry-row__main");
			const title = div("time-entry-row__title");
			title.append(timeColor(project.color), text("strong", project.name));
			const meta = div("section-copy");
			meta.textContent = project.client?.name
				? `Client: ${project.client.name}`
				: "No client";
			main.append(title, meta);

			const form = document.createElement("form");
			form.className = "time-project-client-form";
			const clientSelect = new SearchSelect({
				placeholder: "No client",
				allowCreate: true,
				createLabelPrefix: "Create client",
			});
			clientSelect
				.setOptions(clientOptions(state.clients, project.client_id))
				.setValue(project.client_id === null ? null : String(project.client_id));
			const save = new Button({
				text: "Save",
				className: "secondary",
				type: "submit",
			});
			const clear = new Button({
				text: "Clear",
				className: "secondary",
				type: "button",
			});
			form.append(clientSelect.root, save.root, clear.root);
			form.addEventListener("submit", async (event) => {
				event.preventDefault();
				try {
					await context.actions.assignProjectClient(project, clientSelect.text);
					setStatus(context.status, "Project client saved.");
				} catch (error) {
					setStatus(
						context.status,
						error instanceof Error ? error.message : "Failed to save project client.",
						true,
					);
				}
			});
			clear.onClick = async () => {
				try {
					clientSelect.clear();
					await context.actions.assignProjectClient(project, "");
					setStatus(context.status, "Project client cleared.");
				} catch (error) {
					setStatus(
						context.status,
						error instanceof Error ? error.message : "Failed to clear project client.",
						true,
					);
				}
			};
			row.append(main, form);
			root.append(row);
		}
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
};

const clientTotalKey = (clientId: number | null) =>
	clientId === null ? "none" : String(clientId);

const getTimeOverviewItems = (
	report: TimeReport,
	group: TimeOverviewGroup,
): TimeOverviewItem[] => {
	if (group === "client") {
		return report.client_totals.map((client) => ({
			key: clientTotalKey(client.client_id),
			name: client.client_name,
			color: client.client_color,
			totalSeconds: client.total_seconds,
			entryCount: client.entry_count,
			projectCount: client.project_count,
		}));
	}
	return report.project_totals.map((project) => ({
		key: String(project.project_id),
		name: project.project_name,
		color: project.project_color,
		totalSeconds: project.total_seconds,
		entryCount: project.entry_count,
	}));
};

const createTimeOverviewPie = (
	report: TimeReport,
	group: TimeOverviewGroup,
) => {
	const pie = div("time-overview-pie");
	const items = getTimeOverviewItems(report, group);
	const total = items.reduce(
		(sum, item) => sum + item.totalSeconds,
		0,
	);
	if (total <= 0) {
		pie.classList.add("time-overview-pie--empty");
		pie.setAttribute("aria-label", `No ${group} time in this span`);
		return pie;
	}

	let cursor = 0;
	const segments = items.map((item) => {
		const start = cursor;
		const end = cursor + (item.totalSeconds / total) * 100;
		cursor = end;
		return `${item.color} ${start.toFixed(3)}% ${end.toFixed(3)}%`;
	});
	pie.style.background = `conic-gradient(${segments.join(", ")})`;
	pie.setAttribute("aria-label", `${group} time usage pie chart`);
	return pie;
};

const createTimeOverviewSummary = (
	report: TimeReport,
	average: TimeOverviewAverage | null,
	group: TimeOverviewGroup,
) => {
	const summary = div("time-report-summary time-overview-summary");
	const items = getTimeOverviewItems(report, group);
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
) => {
	const list = div("time-report-list time-overview-list");
	const items = getTimeOverviewItems(report, group);
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
			group === "client"
				? `${item.projectCount ?? 0} project${item.projectCount === 1 ? "" : "s"} - ${item.entryCount} entr${item.entryCount === 1 ? "y" : "ies"}`
				: `${item.entryCount} entr${item.entryCount === 1 ? "y" : "ies"}`,
		);
		meta.className = "section-copy";
		const percent =
			itemTotal > 0 ? Math.round((item.totalSeconds / itemTotal) * 100) : 0;
		main.append(title, meta);
		const total = div("time-overview-row__total");
		const averageSeconds = group === "client"
			? (average?.clientSecondsByKey.get(item.key) ?? 0)
			: (average?.projectSecondsById.get(Number(item.key)) ?? 0);
		total.append(
			text("strong", formatDuration(item.totalSeconds)),
			text("span", `${percent}%`),
			text(
				"span",
				average && average.dayCount > 0
					? `Avg/day ${formatDuration(averageSeconds / average.dayCount)}`
					: "Avg/day No full days",
			),
		);
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
		createTimeOverviewPie(report, group),
		createTimeOverviewProjectList(report, average, group),
	);
	resultsRoot.append(createTimeOverviewSummary(report, average, group), chartPanel);
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
	const projectsList = createProjectsList(context);
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
	const projectsBlock = document.createElement("section");
	projectsBlock.className = "time-block";
	const projectsHeader = div("section-header");
	projectsHeader.append(text("h2", "Projects"));
	projectsBlock.append(projectsHeader, projectsList.root);
	main.append(entriesBlock, projectsBlock);

	workspace.append(sidebar, main);
	page.append(workspace, entryCreateModal.root);

	void actions.loadInitial();
};

export const renderTimeOverviewPage = (page: HTMLElement) => {
	const selected = getCurrentTimeOverviewSelection();
	const header = div("section-header");
	header.append(text("h2", "Time Overview"));

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
	pageBlock.append(header, controls, status, results);
	page.append(pageBlock);

	const load = async (selection: TimeOverviewSelection) => {
		setStatus(status, "Loading time overview...");
		renderTimeOverviewReport(null, results, null, selection.group);
		try {
			const period = getTimeOverviewPeriod(selection);
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
							projectSecondsById: new Map(
								averageReport.project_totals.map((project) => [
									project.project_id,
									project.total_seconds,
								]),
							),
							clientSecondsByKey: new Map(
								averageReport.client_totals.map((client) => [
									clientTotalKey(client.client_id),
									client.total_seconds,
								]),
							),
						}
					: null,
				selection.group,
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
