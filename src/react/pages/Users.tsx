import { useState } from "react"
import { apiFetch } from "../api"
import { Empty, Modal, Status, useApi, type AppUser } from "../lib"
import { useAuth } from "../auth"

export const UsersPage = () => {
	const { user: currentUser } = useAuth()
	const { data, loading, error, reload } = useApi<AppUser[]>("/api/users?sort=name&order=asc")
	const [status, setStatus] = useState("Loading users...")
	const [statusError, setStatusError] = useState(false)
	const [createOpen, setCreateOpen] = useState(false)
	const [createStatus, setCreateStatus] = useState("")
	const [editUser, setEditUser] = useState<AppUser | null>(null)
	const [editStatus, setEditStatus] = useState("")

	const [cName, setCName] = useState("")
	const [cUsername, setCUsername] = useState("")
	const [cEmail, setCEmail] = useState("")
	const [cPassword, setCPassword] = useState("")
	const [cAdmin, setCAdmin] = useState(false)

	const [eName, setEName] = useState("")
	const [eUsername, setEUsername] = useState("")
	const [eEmail, setEEmail] = useState("")
	const [ePassword, setEPassword] = useState("")
	const [eAdmin, setEAdmin] = useState(false)

	if (!currentUser?.is_admin) {
		return (
			<section className="workspace workspace--single">
				<div className="card panel">
					<p className="page-copy">Only administrators can manage users.</p>
				</div>
			</section>
		)
	}

	const users = data ?? []
	const nullable = (v: string) => (v.trim() ? v.trim() : null)

	const create = async (event: React.FormEvent) => {
		event.preventDefault()
		if (!cName.trim()) {
			setCreateStatus("User name is required.")
			return
		}
		if (cPassword.length < 8) {
			setCreateStatus("Password must be at least 8 characters.")
			return
		}
		try {
			await apiFetch("/api/users", {
				method: "POST",
				body: JSON.stringify({
					name: cName.trim(),
					username: nullable(cUsername),
					email: nullable(cEmail),
					password: cPassword,
					is_admin: cAdmin,
				}),
			})
			setCName("")
			setCUsername("")
			setCEmail("")
			setCPassword("")
			setCAdmin(false)
			setCreateOpen(false)
			setStatus("User created.")
			setStatusError(false)
			reload()
		} catch (err) {
			setCreateStatus(err instanceof Error ? err.message : "Failed to create user.")
		}
	}

	const openEdit = (user: AppUser) => {
		setEditUser(user)
		setEName(user.name)
		setEUsername(user.username ?? "")
		setEEmail(user.email ?? "")
		setEPassword("")
		setEAdmin(user.is_admin)
		setEditStatus("")
	}

	const saveEdit = async (event: React.FormEvent) => {
		event.preventDefault()
		if (!editUser) return
		if (!eName.trim()) {
			setEditStatus("User name is required.")
			return
		}
		if (ePassword && ePassword.length < 8) {
			setEditStatus("New password must be at least 8 characters.")
			return
		}
		try {
			await apiFetch(`/api/users/${editUser.id}`, {
				method: "PATCH",
				body: JSON.stringify({
					name: eName.trim(),
					username: nullable(eUsername),
					email: nullable(eEmail),
					...(ePassword ? { password: ePassword } : {}),
					is_admin: eAdmin,
				}),
			})
			setEditUser(null)
			setStatus("User saved.")
			setStatusError(false)
			reload()
		} catch (err) {
			setEditStatus(err instanceof Error ? err.message : "Failed to save user.")
		}
	}

	const remove = async (user: AppUser) => {
		if (!window.confirm("Delete this user? Their sessions and linked time entries will be removed or unlinked.")) return
		try {
			await apiFetch(`/api/users/${user.id}`, { method: "DELETE" })
			setStatus("User deleted.")
			setStatusError(false)
			reload()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to delete user.")
			setStatusError(true)
		}
	}

	return (
		<>
			<section className="workspace workspace--single">
				<div className="card panel">
					<div className="section-header">
						<h2>Users</h2>
						<button id="open-user-create-modal" className="primary" type="button" onClick={() => { setCreateStatus(""); setCreateOpen(true) }}>
							Add User
						</button>
					</div>
					<Status message={loading ? "Loading users..." : (error ?? status) || `Loaded ${users.length} user${users.length === 1 ? "" : "s"}.`} error={!!error || statusError} />
					<div id="user-results">
						{!loading && !error && users.length === 0 ? <Empty message="No users yet." /> : null}
						{users.length > 0 ? (
							<div className="user-table-wrap">
								<table className="user-table">
									<thead>
										<tr>
											<th scope="col">Name</th>
											<th scope="col">Username</th>
											<th scope="col">Email</th>
											<th scope="col">Admin</th>
											<th scope="col">Actions</th>
										</tr>
									</thead>
									<tbody>
										{users.map((user) => (
											<tr key={user.id}>
												<td>{user.name}</td>
												<td>{user.username ?? "—"}</td>
												<td>{user.email ?? "—"}</td>
												<td className="user-table__admin">
													{user.is_admin ? <span className="tag">Admin</span> : "—"}
												</td>
												<td className="user-table__actions">
													<button className="secondary" type="button" onClick={() => openEdit(user)}>
														Edit
													</button>
													<button className="secondary" type="button" onClick={() => void remove(user)}>
														Delete
													</button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : null}
					</div>
				</div>
			</section>
			<Modal id="user-create-modal" title="Create User" open={createOpen} onClose={() => setCreateOpen(false)}>
				<form id="user-create-form" onSubmit={create}>
					<label>
						Name
						<input name="name" required value={cName} onChange={(e) => setCName(e.target.value)} />
					</label>
					<label>
						Username
						<input name="username" value={cUsername} onChange={(e) => setCUsername(e.target.value)} />
					</label>
					<label>
						Email
						<input name="email" type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} />
					</label>
					<label>
						Password
						<input name="password" type="password" minLength={8} required value={cPassword} onChange={(e) => setCPassword(e.target.value)} />
					</label>
					<label className="checkbox-line">
						<input name="is_admin" type="checkbox" checked={cAdmin} onChange={(e) => setCAdmin(e.target.checked)} />
						Administrator
					</label>
					<div className="actions">
						<button className="primary" type="submit">
							Create User
						</button>
					</div>
				</form>
				<Status message={createStatus} error={!!createStatus} />
			</Modal>
			<Modal id="user-edit-modal" title="Edit User" open={editUser !== null} onClose={() => setEditUser(null)}>
				<form id="user-edit-form" onSubmit={saveEdit}>
					<label>
						Name
						<input name="name" required value={eName} onChange={(e) => setEName(e.target.value)} />
					</label>
					<label>
						Username
						<input name="username" value={eUsername} onChange={(e) => setEUsername(e.target.value)} />
					</label>
					<label>
						Email
						<input name="email" type="email" value={eEmail} onChange={(e) => setEEmail(e.target.value)} />
					</label>
					<label>
						New Password (blank keeps current)
						<input name="password" type="password" minLength={8} value={ePassword} onChange={(e) => setEPassword(e.target.value)} />
					</label>
					<label className="checkbox-line">
						<input name="is_admin" type="checkbox" checked={eAdmin} onChange={(e) => setEAdmin(e.target.checked)} />
						Administrator
					</label>
					<div className="actions">
						<button className="primary" type="submit">
							Save User
						</button>
					</div>
				</form>
				<Status message={editStatus} error={!!editStatus} />
			</Modal>
		</>
	)
}
