import { Button, Label, UiComponent } from "../ui/component";
import { SearchSelect, type SearchSelectOption } from "../ui/search-select";

type TimeProject = {
	id: number;
	name: string;
	color: string;
	archived_at: string | null;
	created_at: string;
	updated_at: string;
};

type TimeEntry = {
	id: number;
	project_id: number | null;
	description: string | null;
	started_at: string;
	ended_at: string | null;
	created_at: string;
	updated_at: string;
	project?: TimeProject;
};

type TimeProjectChoice = {
	project: TimeProject;
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
	project?: TimeProject;
};

type TimeReportProjectTotal = {
	project_id: number;
	project_name: string;
	project_color: string;
	total_seconds: number;
	entry_count: number;
};

type TimeReport = {
	period: {
		from: string | null;
		to: string;
		range: "custom" | "all";
	};
	total_seconds: number;
	project_totals: TimeReportProjectTotal[];
};

type TimePageState = {
	projects: TimeProject[];
	entries: TimeEntry[];
	choices: TimeProjectChoice[];
	runningEntry: TimeEntry | null;
};

const TIME_OVERVIEW_SPANS = [
	{ value: "this-week", label: "This Week" },
	{ value: "last-2-weeks", label: "Last 2 Weeks" },
	{ value: "last-30-days", label: "Last 30 Days" },
	{ value: "ytd", label: "YTD" },
] as const;

type TimeOverviewSpan = (typeof TIME_OVERVIEW_SPANS)[number];

const DEFAULT_TIME_OVERVIEW_SPAN = "this-week";

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
	fetchProjects: () =>
		timeApiJson<TimeProject[]>("/api/time-projects?sort=name&order=asc"),

	fetchEntries: () =>
		timeApiJson<TimeEntry[]>("/api/time-entries?sort=started_at&order=desc"),

	fetchReport: (from: string, to: string) => {
		const query = new URLSearchParams({ from, to });
		return timeApiJson<TimeReport>(`/api/time-report?${query.toString()}`);
	},

	createProject: (name: string) =>
		timeApiJson<TimeProject>("/api/time-projects", {
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

const formatTimestampForDateTimeLocalInput = (value: string) =>
	formatDateTimeLocalInput(new Date(value));

const parseDateTimeLocalInput = (value: string) => {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const startOfLocalDay = (date: Date) =>
	new Date(date.getFullYear(), date.getMonth(), date.getDate());

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

const getCurrentTimeOverviewSpan = () =>
	getTimeOverviewSpan(new URLSearchParams(window.location.search).get("span"));

const getTimeOverviewPeriod = (span: TimeOverviewSpan) => {
	const to = new Date();
	const from = (() => {
		switch (span.value) {
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
	return { from: from.toISOString(), to: to.toISOString() };
};

const updateTimeOverviewSpanUrl = (span: TimeOverviewSpan) => {
	const url = new URL(window.location.href);
	if (span.value === DEFAULT_TIME_OVERVIEW_SPAN) {
		url.searchParams.delete("span");
	} else {
		url.searchParams.set("span", span.value);
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

const buildProjectChoices = (
	entries: TimeEntry[],
	projects: TimeProject[],
): TimeProjectChoice[] => {
	const choiceByProjectId = new Map<number, TimeProjectChoice>();
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
	projects: TimeProject[],
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
	projects: TimeProject[],
	selectedId?: number | null,
) =>
	projects
		.filter((project) => project.archived_at === null || project.id === selectedId)
		.map((project) => ({
			value: String(project.id),
			text: project.name,
		}));

const selectProject = (
	projects: TimeProject[],
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

const choiceOptions = (choices: TimeProjectChoice[]): SearchSelectOption[] =>
	choices.map((choice) => ({
		value: String(choice.project.id),
		label: choice.project.name,
	}));

const findChoiceByName = (choices: TimeProjectChoice[], name: string) => {
	const normalizedName = normalizeProjectName(name);
	return choices.find(
		(choice) => normalizeProjectName(choice.project.name) === normalizedName,
	);
};

const findChoiceById = (choices: TimeProjectChoice[], id: number) =>
	choices.find((choice) => choice.project.id === id);

const projectForEntry = (entry: TimeEntry, projects: TimeProject[]) =>
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
	projects: TimeProject[],
	entries: TimeEntry[],
): TimePageState => {
	const sortedEntries = sortTimeEntries(entries);
	return {
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

	public setData(projects: TimeProject[], entries: TimeEntry[]) {
		this.set(createTimePageState(projects, entries));
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
			const [projects, entries] = await Promise.all([
				timeApi.fetchProjects(),
				timeApi.fetchEntries(),
			]);
			this.store.setData(projects, entries);
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

	public async ensureProject(projectName: string) {
		const normalizedName = projectName.trim();
		if (!normalizedName) throw new Error("Project is required.");
		const state = this.store.get();
		const existing = findChoiceByName(state.choices, normalizedName)?.project;
		if (existing) return existing;
		const project = await timeApi.createProject(normalizedName);
		this.store.setData([...state.projects, project], state.entries);
		return project;
	}

	public async addEntry(values: {
		projectName: string;
		description: string | null;
		startedAt: string;
		endedAt: string | null;
	}) {
		const project = await this.ensureProject(values.projectName);
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

	public async startTimer(projectName: string, description: string | null) {
		const project = projectName.trim()
			? await this.ensureProject(projectName)
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

	public async assignProjectAndStopTimer(entry: TimeEntry, projectName: string) {
		const project = await this.ensureProject(projectName);
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
			projectName: string;
			description: string | null;
			startedAt: string;
		},
	) {
		const project = values.projectName.trim()
			? await this.ensureProject(values.projectName)
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
		projectSelect.clear();
		setLocalStatus("");
	};

	const open = () => {
		const range = defaultTimeEntryRange();
		projectSelect.setOptions(choiceOptions(context.store.get().choices));
		startedAt.value = range.startedAt;
		endedAt.value = range.endedAt;
		root.hidden = false;
		document.body.classList.add("modal-open");
		setLocalStatus("");
		projectSelect.focus();
	};

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

	const projectSelect = new SearchSelect({
		placeholder: "Type or choose a project",
		allowCreate: true,
		createLabelPrefix: "Create project",
	});
	projectSelect
		.setOptions(choiceOptions(context.store.get().choices))
		.setValue(
			runningEntry.project_id === null ? null : String(runningEntry.project_id),
		);
	projectSelect.root.setAttribute("aria-label", "Running timer project");

	const description = document.createElement("input");
	description.value = runningEntry.description ?? "";
	description.placeholder = "What are you working on?";
	description.setAttribute("autocomplete", "off");

	const startedAt = document.createElement("input");
	startedAt.type = "datetime-local";
	startedAt.value = formatTimestampForDateTimeLocalInput(runningEntry.started_at);
	startedAt.required = true;

	form.append(
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
	form.append(field("Project", projectSelect.root), actions);

	const status = div("status");
	const setLocalStatus = (message: string, isError = false) => {
		setStatus(status, message, isError);
	};

	const close = () => {
		root.hidden = true;
		document.body.classList.remove("modal-open");
		projectSelect.clear();
		setLocalStatus("");
	};

	const open = () => {
		projectSelect.setOptions(choiceOptions(context.store.get().choices));
		root.hidden = false;
		document.body.classList.add("modal-open");
		setLocalStatus("");
		projectSelect.focus();
	};

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
		const projectSelect = new SearchSelect({
			placeholder: "Type or choose a project",
			allowCreate: true,
			createLabelPrefix: "Create project",
		});
		projectSelect.setOptions(choiceOptions(state.choices));

		const description = document.createElement("input");
		description.placeholder = "What are you working on?";
		description.setAttribute("autocomplete", "off");

		const submit = new Button({
			text: "Start Timer",
			className: "primary",
			type: "submit",
		});
		form.append(
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
				await context.actions.startTimer("", description || null);
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

const renderTimeOverviewSpanOptions = (selectedValue: string) =>
	TIME_OVERVIEW_SPANS.map((span) => {
		const option = document.createElement("option");
		option.value = span.value;
		option.textContent = span.label;
		option.selected = span.value === selectedValue;
		return option;
	});

const formatTimeOverviewPeriod = (report: TimeReport) => {
	if (report.period.from === null) {
		return `Through ${formatDateTime(report.period.to)}`;
	}
	return `${formatDateTime(report.period.from)} - ${formatDateTime(report.period.to)}`;
};

const createTimeOverviewPie = (report: TimeReport) => {
	const pie = div("time-overview-pie");
	const total = report.project_totals.reduce(
		(sum, project) => sum + project.total_seconds,
		0,
	);
	if (total <= 0) {
		pie.classList.add("time-overview-pie--empty");
		pie.setAttribute("aria-label", "No project time in this span");
		return pie;
	}

	let cursor = 0;
	const segments = report.project_totals.map((project) => {
		const start = cursor;
		const end = cursor + (project.total_seconds / total) * 100;
		cursor = end;
		return `${project.project_color} ${start.toFixed(3)}% ${end.toFixed(3)}%`;
	});
	pie.style.background = `conic-gradient(${segments.join(", ")})`;
	pie.setAttribute("aria-label", "Project time usage pie chart");
	return pie;
};

const createTimeOverviewSummary = (report: TimeReport) => {
	const summary = div("time-report-summary time-overview-summary");
	const total = div();
	total.append(text("span", "Total Time"), text("strong", formatDuration(report.total_seconds)));
	const projects = div();
	projects.append(
		text("span", "Projects"),
		text("strong", String(report.project_totals.length)),
	);
	const period = div();
	period.append(text("span", "Span"), text("strong", formatTimeOverviewPeriod(report)));
	summary.append(total, projects, period);
	return summary;
};

const createTimeOverviewProjectList = (report: TimeReport) => {
	const list = div("time-report-list time-overview-list");
	const projectTotal = report.project_totals.reduce(
		(sum, project) => sum + project.total_seconds,
		0,
	);
	if (!report.project_totals.length) {
		const empty = div("empty");
		empty.textContent = "No tracked project time in this span.";
		list.append(empty);
		return list;
	}

	for (const project of report.project_totals) {
		const row = div("time-report-row time-overview-row");
		const main = div("time-overview-row__main");
		const title = div("time-entry-row__title");
		title.append(
			timeColor(project.project_color),
			text("strong", project.project_name),
		);
		const meta = text(
			"span",
			`${project.entry_count} entr${project.entry_count === 1 ? "y" : "ies"}`,
		);
		meta.className = "section-copy";
		const percent =
			projectTotal > 0 ? Math.round((project.total_seconds / projectTotal) * 100) : 0;
		main.append(title, meta);
		const total = div("time-overview-row__total");
		total.append(
			text("strong", formatDuration(project.total_seconds)),
			text("span", `${percent}%`),
		);
		row.append(main, total);
		list.append(row);
	}

	return list;
};

const renderTimeOverviewReport = (
	report: TimeReport | null,
	resultsRoot: HTMLElement,
) => {
	resultsRoot.replaceChildren();
	if (!report) {
		const empty = div("empty");
		empty.textContent = "Choose a span to load time usage.";
		resultsRoot.append(empty);
		return;
	}

	const chartPanel = div("time-overview-chart");
	chartPanel.append(createTimeOverviewPie(report), createTimeOverviewProjectList(report));
	resultsRoot.append(createTimeOverviewSummary(report), chartPanel);
};

export const renderTimePage = (page: HTMLElement) => {
	const status = div("status");
	const store = new TimeStore(
		createTimePageState([], []),
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
	const selectedSpan = getCurrentTimeOverviewSpan();
	const header = div("section-header");
	header.append(text("h2", "Time Overview"));

	const controls = div("spending-breakdown-controls time-overview-controls");
	const spanSelect = document.createElement("select");
	spanSelect.id = "time-overview-span-select";
	spanSelect.append(...renderTimeOverviewSpanOptions(selectedSpan.value));
	const spanLabel = field("Span", spanSelect);
	controls.append(spanLabel);

	const status = div("status");
	const results = div("time-overview-results");
	const pageBlock = document.createElement("section");
	pageBlock.className = "time-block";
	pageBlock.append(header, controls, status, results);
	page.append(pageBlock);

	const load = async (span: TimeOverviewSpan) => {
		setStatus(status, "Loading time overview...");
		renderTimeOverviewReport(null, results);
		try {
			const period = getTimeOverviewPeriod(span);
			const report = await timeApi.fetchReport(period.from, period.to);
			renderTimeOverviewReport(report, results);
			setStatus(status, `Loaded ${span.label.toLowerCase()} time usage.`);
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
		updateTimeOverviewSpanUrl(span);
		void load(span);
	});

	void load(selectedSpan);
};
