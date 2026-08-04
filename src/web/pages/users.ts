import { renderPage, setStatus } from "../app"
import { getCurrentUser } from "../auth"
import {
	createElement,
	createEmptyState,
	getElementById,
	withQueryRoot,
} from "../lib/dom"
import { attachModalControls, createModal } from "../ui/modal"

type User = {
	id: number
	name: string
	username: string | null
	email: string | null
	is_admin: boolean
	created_at: string
	updated_at: string
}

let usersPageState: User[] = []

const apiJson = async <T>(path: string, options: RequestInit = {}) => {
	const response = await fetch(path, {
		...options,
		headers: {
			...(options.body ? { "Content-Type": "application/json" } : {}),
			...(options.headers ?? {}),
		},
	})
	const body = (await response.json().catch(() => null)) as
		| T
		| { error?: string }
		| null
	if (!response.ok) {
		throw new Error(
			typeof body === "object" && body !== null && "error" in body
				? (body.error ?? "Request failed")
				: "Request failed",
		)
	}
	return body as T
}

const nullableText = (value: FormDataEntryValue | null) => {
	const text = String(value ?? "").trim()
	return text || null
}

const renderUsers = (users: User[]) => {
	const results = getElementById("user-results")
	if (!results) return

	if (!users.length) {
		results.replaceChildren(createEmptyState("No users yet."))
		return
	}

	const table = createElement("table", { className: "user-table" })
	const header = document.createElement("tr")
	for (const label of [
		"Name",
		"Username",
		"Email",
		"Password",
		"Admin",
		"Actions",
	]) {
		const cell = createElement("th", { text: label })
		cell.scope = "col"
		header.append(cell)
	}
	const head = document.createElement("thead")
	head.append(header)
	const body = document.createElement("tbody")
	for (const user of users) {
		const edit = createElement("button", {
			className: "secondary",
			text: "Edit",
		})
		edit.type = "button"
		edit.dataset.userEditId = String(user.id)
		const remove = createElement("button", {
			className: "secondary",
			text: "Delete",
		})
		remove.type = "button"
		remove.dataset.userDeleteId = String(user.id)
		const adminCell = createElement("td", {
			className: "user-table__admin",
		})
		adminCell.append(
			user.is_admin
				? createElement("span", { className: "tag", text: "Admin" })
				: "—",
		)
		const row = document.createElement("tr")
		row.append(
			createElement("td", { text: user.name }),
			createElement("td", { text: user.username ?? "—" }),
			createElement("td", { text: user.email ?? "—" }),
			createElement("td", {
				className: "user-table__password",
				text: "••••••••",
			}),
			adminCell,
			createElement(
				"td",
				{ className: "user-table__actions" },
				edit,
				remove,
			),
		)
		body.append(row)
	}
	table.append(head, body)
	results.replaceChildren(
		createElement("div", { className: "user-table-wrap" }, table),
	)
}

const loadUsers = async () => {
	setStatus("users-status", "Loading users...")
	try {
		const users = await apiJson<User[]>("/api/users?sort=name&order=asc")
		usersPageState = users
		renderUsers(users)
		setStatus(
			"users-status",
			`Loaded ${users.length} user${users.length === 1 ? "" : "s"}.`,
		)
	} catch (error) {
		usersPageState = []
		renderUsers([])
		setStatus(
			"users-status",
			error instanceof Error ? error.message : "Failed to load users.",
			true,
		)
	}
}

const attachUserEvents = () => {
	const userEditModal = attachModalControls({
		modalId: "user-edit-modal",
		closeSelector: "[data-user-edit-modal-close]",
		focusSelector: "input[name='name']",
	})
	const userCreateModal = attachModalControls({
		modalId: "user-create-modal",
		openButtonId: "open-user-create-modal",
		closeSelector: "[data-user-create-modal-close]",
		focusSelector: "input[name='name']",
		onOpen: () => {
			const form = getElementById("user-create-form")
			if (form instanceof HTMLFormElement) form.reset()
			setStatus("user-create-status", "")
		},
	})

	document
		.getElementById("user-create-form")
		?.addEventListener("submit", async (event) => {
			event.preventDefault()
			const form = event.currentTarget
			if (!(form instanceof HTMLFormElement)) return
			const formData = new FormData(form)
			const name = String(formData.get("name") ?? "").trim()
			const password = String(formData.get("password") ?? "")
			if (!name) {
				setStatus("user-create-status", "User name is required.", true)
				return
			}
			if (password.length < 8) {
				setStatus(
					"user-create-status",
					"Password must be at least 8 characters.",
					true,
				)
				return
			}

			try {
				await apiJson<User>("/api/users", {
					method: "POST",
					body: JSON.stringify({
						name,
						username: nullableText(formData.get("username")),
						email: nullableText(formData.get("email")),
						password,
						is_admin: formData.get("is_admin") === "on",
					}),
				})
				form.reset()
				userCreateModal.close()
				setStatus("users-status", "User created.")
				await loadUsers()
			} catch (error) {
				setStatus(
					"user-create-status",
					error instanceof Error
						? error.message
						: "Failed to create user.",
					true,
				)
			}
		})

	document
		.getElementById("user-edit-form")
		?.addEventListener("submit", async (event) => {
			event.preventDefault()
			const form = event.currentTarget
			if (!(form instanceof HTMLFormElement)) return
			const userId = Number(form.dataset.userId)
			const formData = new FormData(form)
			const name = String(formData.get("name") ?? "").trim()
			const password = String(formData.get("password") ?? "")
			if (!Number.isInteger(userId) || !name) {
				setStatus("user-edit-status", "User name is required.", true)
				return
			}
			if (password && password.length < 8) {
				setStatus(
					"user-edit-status",
					"New password must be at least 8 characters.",
					true,
				)
				return
			}
			try {
				await apiJson<User>(`/api/users/${userId}`, {
					method: "PATCH",
					body: JSON.stringify({
						name,
						username: nullableText(formData.get("username")),
						email: nullableText(formData.get("email")),
						...(password ? { password } : {}),
						is_admin: formData.get("is_admin") === "on",
					}),
				})
				userEditModal.close()
				setStatus("users-status", "User saved.")
				await loadUsers()
			} catch (error) {
				setStatus(
					"user-edit-status",
					error instanceof Error
						? error.message
						: "Failed to save user.",
					true,
				)
			}
		})

	document
		.getElementById("user-results")
		?.addEventListener("click", async (event) => {
			const target = event.target
			if (!(target instanceof HTMLElement)) return
			const button = target.closest<HTMLButtonElement>(
				"[data-user-edit-id], [data-user-delete-id]",
			)
			if (!button) return
			const userId = Number(
				button.dataset.userEditId ?? button.dataset.userDeleteId,
			)
			if (!Number.isInteger(userId)) return

			if (button.dataset.userDeleteId) {
				if (
					!window.confirm(
						"Delete this user? Their sessions and linked time entries will be removed or unlinked.",
					)
				)
					return
				try {
					await apiJson<void>(`/api/users/${userId}`, {
						method: "DELETE",
					})
					setStatus("users-status", "User deleted.")
					await loadUsers()
				} catch (error) {
					setStatus(
						"users-status",
						error instanceof Error
							? error.message
							: "Failed to delete user.",
						true,
					)
				}
				return
			}

			const user = usersPageState.find((entry) => entry.id === userId)
			if (!user) return
			const form = getElementById("user-edit-form")
			if (!(form instanceof HTMLFormElement)) return
			form.dataset.userId = String(user.id)
			;(form.elements.namedItem("name") as HTMLInputElement).value =
				user.name
			;(form.elements.namedItem("username") as HTMLInputElement).value =
				user.username ?? ""
			;(form.elements.namedItem("email") as HTMLInputElement).value =
				user.email ?? ""
			;(form.elements.namedItem("password") as HTMLInputElement).value =
				""
			;(form.elements.namedItem("is_admin") as HTMLInputElement).checked =
				user.is_admin
			setStatus("user-edit-status", "")
			userEditModal.open()
		})
}

export const renderUsersPage = () => {
	if (!getCurrentUser()?.is_admin) {
		renderPage(
			createElement(
				"section",
				{ className: "workspace workspace--single" },
				createElement(
					"div",
					{ className: "card panel" },
					createElement("h2", {}, "Administrator access required"),
				),
			),
		)
		return
	}
	const userForm = (id: string, editing = false) =>
		createElement(
			"form",
			{ id },
			createElement(
				"label",
				{},
				"Name",
				createElement("input", {
					properties: {
						name: "name",
						autocomplete: "name",
						required: true,
					},
				}),
			),
			createElement(
				"label",
				{},
				"Username",
				createElement("input", {
					properties: { name: "username", autocomplete: "username" },
				}),
			),
			createElement(
				"label",
				{},
				"Email",
				createElement("input", {
					properties: {
						name: "email",
						type: "email",
						autocomplete: "email",
					},
				}),
			),
			createElement(
				"label",
				{},
				editing ? "New password" : "Password",
				createElement("input", {
					properties: {
						name: "password",
						type: "password",
						minLength: 8,
						autocomplete: "new-password",
						required: !editing,
						placeholder: editing ? "Leave unchanged" : "",
					},
				}),
			),
			createElement(
				"label",
				{ className: "inline-toggle" },
				createElement("input", {
					properties: { name: "is_admin", type: "checkbox" },
				}),
				"Administrator",
			),
			createElement(
				"div",
				{ className: "actions" },
				createElement(
					"button",
					{ className: "primary", properties: { type: "submit" } },
					editing ? "Save User" : "Create User",
				),
				createElement(
					"button",
					{
						className: "secondary",
						properties: { type: "button" },
						attributes: {
							[editing
								? "data-user-edit-modal-close"
								: "data-user-create-modal-close"]: "",
						},
					},
					"Cancel",
				),
			),
			createElement("div", {
				id: editing ? "user-edit-status" : "user-create-status",
				className: "status",
				attributes: { role: "status" },
			}),
		)
	const page = document.createDocumentFragment()
	page.append(
		createElement(
			"section",
			{ className: "workspace workspace--single" },
			createElement(
				"div",
				{ className: "card panel" },
				createElement(
					"div",
					{ className: "section-header" },
					createElement("h2", {}, "Users"),
					createElement(
						"button",
						{
							id: "open-user-create-modal",
							className: "primary",
							properties: { type: "button" },
						},
						"New User",
					),
				),
				createElement("div", {
					id: "users-status",
					className: "status",
					attributes: { role: "status" },
				}),
				createElement("div", { id: "user-results" }),
			),
		),
		createModal({
			id: "user-create-modal",
			title: "New User",
			closeDataAttribute: "data-user-create-modal-close",
			className: "user-create-modal",
			children: userForm("user-create-form"),
		}),
		createModal({
			id: "user-edit-modal",
			title: "Edit User",
			closeDataAttribute: "data-user-edit-modal-close",
			className: "user-edit-modal",
			children: userForm("user-edit-form", true),
		}),
	)
	withQueryRoot(page, attachUserEvents)
	renderPage(page)
	void loadUsers()
}
