import { escapeHtml, renderPage, setStatus } from "../app";
import { getCurrentUser } from "../auth";
import { attachModalControls, renderModal } from "../ui/modal";

type User = {
	id: number;
	name: string;
	username: string | null;
	email: string | null;
	is_admin: boolean;
	created_at: string;
	updated_at: string;
};

let usersPageState: User[] = [];

const apiJson = async <T>(path: string, options: RequestInit = {}) => {
	const response = await fetch(path, {
		...options,
		headers: {
			...(options.body ? { "Content-Type": "application/json" } : {}),
			...(options.headers ?? {}),
		},
	});
	const body = (await response.json().catch(() => null)) as T | { error?: string } | null;
	if (!response.ok) {
		throw new Error(
			typeof body === "object" && body !== null && "error" in body
				? (body.error ?? "Request failed")
				: "Request failed",
		);
	}
	return body as T;
};

const nullableText = (value: FormDataEntryValue | null) => {
	const text = String(value ?? "").trim();
	return text || null;
};

const renderUsers = (users: User[]) => {
	const results = document.getElementById("user-results");
	if (!results) return;

	if (!users.length) {
		results.innerHTML = '<div class="empty">No users yet.</div>';
		return;
	}

	results.innerHTML = `
		<div class="user-table-wrap">
			<table class="user-table">
				<thead>
					<tr>
						<th scope="col">Name</th>
						<th scope="col">Username</th>
						<th scope="col">Email</th>
						<th scope="col">Password</th>
						<th scope="col">Admin</th>
						<th scope="col">Actions</th>
					</tr>
				</thead>
				<tbody>
					${users
						.map(
							(user) => `
								<tr>
									<td>${escapeHtml(user.name)}</td>
									<td>${escapeHtml(user.username ?? "—")}</td>
									<td>${escapeHtml(user.email ?? "—")}</td>
									<td class="user-table__password">••••••••</td>
									<td class="user-table__admin">${user.is_admin ? '<span class="tag">Admin</span>' : "—"}</td>
									<td class="user-table__actions">
										<button class="secondary" type="button" data-user-edit-id="${user.id}">Edit</button>
										<button class="secondary" type="button" data-user-delete-id="${user.id}">Delete</button>
									</td>
								</tr>
							`,
						)
						.join("")}
				</tbody>
			</table>
		</div>
	`;
};

const loadUsers = async () => {
	setStatus("users-status", "Loading users...");
	try {
		const users = await apiJson<User[]>("/api/users?sort=name&order=asc");
		usersPageState = users;
		renderUsers(users);
		setStatus("users-status", `Loaded ${users.length} user${users.length === 1 ? "" : "s"}.`);
	} catch (error) {
		usersPageState = [];
		renderUsers([]);
		setStatus(
			"users-status",
			error instanceof Error ? error.message : "Failed to load users.",
			true,
		);
	}
};

const attachUserEvents = () => {
	const userEditModal = attachModalControls({
		modalId: "user-edit-modal",
		closeSelector: "[data-user-edit-modal-close]",
		focusSelector: "input[name='name']",
	});
	const userCreateModal = attachModalControls({
		modalId: "user-create-modal",
		openButtonId: "open-user-create-modal",
		closeSelector: "[data-user-create-modal-close]",
		focusSelector: "input[name='name']",
		onOpen: () => {
			const form = document.getElementById("user-create-form");
			if (form instanceof HTMLFormElement) form.reset();
			setStatus("user-create-status", "");
		},
	});

	document
		.getElementById("user-create-form")
		?.addEventListener("submit", async (event) => {
			event.preventDefault();
			const form = event.currentTarget;
			if (!(form instanceof HTMLFormElement)) return;
			const formData = new FormData(form);
			const name = String(formData.get("name") ?? "").trim();
			const password = String(formData.get("password") ?? "");
			if (!name) {
				setStatus("user-create-status", "User name is required.", true);
				return;
			}
			if (password.length < 8) {
				setStatus("user-create-status", "Password must be at least 8 characters.", true);
				return;
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
				});
				form.reset();
				userCreateModal.close();
				setStatus("users-status", "User created.");
				await loadUsers();
			} catch (error) {
				setStatus(
					"user-create-status",
					error instanceof Error ? error.message : "Failed to create user.",
					true,
				);
			}
		});

	document
		.getElementById("user-edit-form")
		?.addEventListener("submit", async (event) => {
			event.preventDefault();
			const form = event.currentTarget;
			if (!(form instanceof HTMLFormElement)) return;
			const userId = Number(form.dataset.userId);
			const formData = new FormData(form);
			const name = String(formData.get("name") ?? "").trim();
			const password = String(formData.get("password") ?? "");
			if (!Number.isInteger(userId) || !name) {
				setStatus("user-edit-status", "User name is required.", true);
				return;
			}
			if (password && password.length < 8) {
				setStatus("user-edit-status", "New password must be at least 8 characters.", true);
				return;
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
				});
				userEditModal.close();
				setStatus("users-status", "User saved.");
				await loadUsers();
			} catch (error) {
				setStatus("user-edit-status", error instanceof Error ? error.message : "Failed to save user.", true);
			}
		});

	document
		.getElementById("user-results")
		?.addEventListener("click", async (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) return;
			const button = target.closest<HTMLButtonElement>("[data-user-edit-id], [data-user-delete-id]");
			if (!button) return;
			const userId = Number(button.dataset.userEditId ?? button.dataset.userDeleteId);
			if (!Number.isInteger(userId)) return;

			if (button.dataset.userDeleteId) {
				if (!window.confirm("Delete this user? Their sessions and linked time entries will be removed or unlinked.")) return;
				try {
					await apiJson<void>(`/api/users/${userId}`, { method: "DELETE" });
					setStatus("users-status", "User deleted.");
					await loadUsers();
				} catch (error) {
					setStatus("users-status", error instanceof Error ? error.message : "Failed to delete user.", true);
				}
				return;
			}

			const user = usersPageState.find((entry) => entry.id === userId);
			if (!user) return;
			const form = document.getElementById("user-edit-form");
			if (!(form instanceof HTMLFormElement)) return;
			form.dataset.userId = String(user.id);
			(form.elements.namedItem("name") as HTMLInputElement).value = user.name;
			(form.elements.namedItem("username") as HTMLInputElement).value = user.username ?? "";
			(form.elements.namedItem("email") as HTMLInputElement).value = user.email ?? "";
			(form.elements.namedItem("password") as HTMLInputElement).value = "";
			(form.elements.namedItem("is_admin") as HTMLInputElement).checked = user.is_admin;
			setStatus("user-edit-status", "");
			userEditModal.open();
		});
};

export const renderUsersPage = () => {
	if (!getCurrentUser()?.is_admin) {
		renderPage(`
			<section class="workspace workspace--single">
				<div class="card panel"><h2>Administrator access required</h2></div>
			</section>
		`);
		return;
	}
	renderPage(`
		<section class="workspace workspace--single">
			<div class="card panel">
				<div class="section-header">
					<h2>Users</h2>
					<button class="primary" id="open-user-create-modal" type="button">New User</button>
				</div>
				<div id="users-status" class="status" role="status"></div>
				<div id="user-results"></div>
			</div>
		</section>

		${renderModal({
			id: "user-create-modal",
			title: "New User",
			closeDataAttribute: "data-user-create-modal-close",
			className: "user-create-modal",
			children: `
				<form id="user-create-form">
					<label>Name<input name="name" autocomplete="name" required /></label>
					<label>Username<input name="username" autocomplete="username" /></label>
					<label>Email<input name="email" type="email" autocomplete="email" /></label>
					<label>Password<input name="password" type="password" minlength="8" autocomplete="new-password" required /></label>
					<label class="inline-toggle"><input name="is_admin" type="checkbox" /> Administrator</label>
					<div class="actions">
						<button class="primary" type="submit">Create User</button>
						<button class="secondary" type="button" data-user-create-modal-close>Cancel</button>
					</div>
					<div id="user-create-status" class="status" role="status"></div>
				</form>
			`,
		})}

		${renderModal({
			id: "user-edit-modal",
			title: "Edit User",
			closeDataAttribute: "data-user-edit-modal-close",
			className: "user-edit-modal",
			children: `
				<form id="user-edit-form">
					<label>Name<input name="name" autocomplete="name" required /></label>
					<label>Username<input name="username" autocomplete="username" /></label>
					<label>Email<input name="email" type="email" autocomplete="email" /></label>
					<label>New password<input name="password" type="password" minlength="8" autocomplete="new-password" placeholder="Leave unchanged" /></label>
					<label class="inline-toggle"><input name="is_admin" type="checkbox" /> Administrator</label>
					<div class="actions">
						<button class="primary" type="submit">Save User</button>
						<button class="secondary" type="button" data-user-edit-modal-close>Cancel</button>
					</div>
					<div id="user-edit-status" class="status" role="status"></div>
				</form>
			`,
		})}
	`);

	attachUserEvents();
	void loadUsers();
};
