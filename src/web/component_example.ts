// Example only: this file is not imported by the app.
// It shows the intended root-based component convention for a time page slice.

import { Button, Container, Label, UiComponent, VList } from "./ui/component"
import { SearchSelect, type SearchSelectOption } from "./ui/search-select"

type TimeProject = {
	id: number
	name: string
	color: string
}

type UserSummary = {
	id: number
	name: string
	email: string | null
}

type TimeEntry = {
	id: number
	user_id: number | null
	project_id: number | null
	description: string | null
	started_at: string
	ended_at: string | null
	user?: UserSummary | null
	project?: TimeProject
}

const createEl = <K extends keyof HTMLElementTagNameMap>(
	tag: K,
	args: {
		id?: string
		className?: string
		text?: string
		type?: string
		required?: boolean
		placeholder?: string
		children?: Array<HTMLElement | UiComponent<HTMLElement> | string>
	} = {},
) => {
	const root = document.createElement(tag)
	if (args.id) root.id = args.id
	if (args.className) root.className = args.className
	if (args.text !== undefined) root.textContent = args.text
	if (args.type && root instanceof HTMLInputElement) root.type = args.type
	if (args.required && root instanceof HTMLInputElement) root.required = true
	if (args.placeholder && root instanceof HTMLInputElement) {
		root.placeholder = args.placeholder
	}
	for (const child of args.children ?? []) {
		root.append(
			typeof child === "string"
				? document.createTextNode(child)
				: child instanceof HTMLElement
					? child
					: child.root,
		)
	}
	return root
}

const createField = (
	label: string,
	control: HTMLElement | UiComponent<HTMLElement>,
) =>
	new Label({
		text: label,
		control: control instanceof HTMLElement ? control : control.root,
	})

const defaultTimeEntryRange = () => {
	const endedAt = new Date()
	const startedAt = new Date(endedAt.getTime() - 60 * 60 * 1000)
	const format = (date: Date) =>
		new Date(date.getTime() - date.getTimezoneOffset() * 60000)
			.toISOString()
			.slice(0, 16)
	return { startedAt: format(startedAt), endedAt: format(endedAt) }
}

const createTimeEntryModal = (args: {
	projectOptions: SearchSelectOption[]
	onSubmit: (values: {
		projectName: string
		description: string | null
		startedAt: string
		endedAt: string | null
	}) => Promise<void>
}) => {
	const root = createEl("div", {
		className: "time-entry-create-modal",
	})
	root.hidden = true

	const projectSelect = new SearchSelect({
		placeholder: "Type or choose a project",
		allowCreate: true,
		createLabelPrefix: "Create project",
		required: true,
	}).setOptions(args.projectOptions)

	const description = createEl("input", {
		placeholder: "What did you work on?",
	})
	const startedAt = createEl("input", {
		type: "datetime-local",
		required: true,
	})
	const endedAt = createEl("input", {
		type: "datetime-local",
	})

	const close = () => {
		root.hidden = true
		document.body.classList.remove("modal-open")
	}
	const open = () => {
		const range = defaultTimeEntryRange()
		startedAt.value = range.startedAt
		endedAt.value = range.endedAt
		root.hidden = false
		document.body.classList.add("modal-open")
		projectSelect.focus()
	}

	const submit = new Button({
		text: "Add Entry",
		className: "primary",
		type: "submit",
	})
	const cancel = new Button({
		text: "Cancel",
		className: "secondary",
	})
	cancel.onClick = close

	const form = createEl("form", {
		children: [
			createField("Project", projectSelect),
			createField("Description", description),
			createEl("div", {
				className: "row",
				children: [
					createField("Start", startedAt),
					createField("End", endedAt),
				],
			}),
			createEl("div", {
				className: "actions",
				children: [submit, cancel],
			}),
		],
	})
	form.addEventListener("submit", async (event) => {
		event.preventDefault()
		await args.onSubmit({
			projectName: projectSelect.text,
			description: description.value.trim() || null,
			startedAt: startedAt.value,
			endedAt: endedAt.value.trim() || null,
		})
		close()
	})

	const backdrop = createEl("div", {
		className: "time-entry-create-modal__backdrop",
	})
	backdrop.onclick = close

	const closeHeader = new Button({ text: "Close", className: "secondary" })
	closeHeader.onClick = close

	root.append(
		backdrop,
		createEl("div", {
			className: "time-entry-create-modal__dialog card panel",
			children: [
				createEl("div", {
					className: "section-header",
					children: [
						createEl("h2", { text: "Add Time Entry" }),
						closeHeader,
					],
				}),
				form,
			],
		}),
	)

	return Object.assign(new UiComponent(root), {
		open,
		close,
		projectSelect,
	})
}

export const createTimerPageExample = (args: {
	projects: TimeProject[]
	entries: TimeEntry[]
	onCreateEntry: Parameters<typeof createTimeEntryModal>[0]["onSubmit"]
}) => {
	const root = createEl("section", { id: "time-page" })
	const page = new Container(root)
	const modal = createTimeEntryModal({
		projectOptions: args.projects.map((project) => ({
			value: String(project.id),
			label: project.name,
		})),
		onSubmit: args.onCreateEntry,
	})

	const addEntry = new Button({
		text: "Add Entry",
		className: "primary",
	})
	addEntry.onClick = modal.open

	const entries = new VList({ className: "time-entry-list" })
	for (const entry of args.entries) {
		entries.add(
			new UiComponent(
				createEl("div", {
					className: "time-entry-row",
					children: [
						createEl("strong", {
							text: entry.project?.name ?? "Project",
						}),
						createEl("span", {
							className: "section-copy",
							text: entry.description ?? "No description",
						}),
					],
				}),
			),
		)
	}

	page.add(
		new UiComponent(
			createEl("section", {
				className: "time-block",
				children: [
					createEl("div", {
						className: "section-header",
						children: [
							createEl("h2", { text: "Past Entries" }),
							addEntry,
						],
					}),
					entries,
				],
			}),
		),
		modal,
	)

	return page
}
