import { useState } from "react"
import { apiFetch } from "../api"
import { Status, useApi } from "../lib"
import { useAuth } from "../auth"
import type { UpdateInfo } from "../../web/update-widget"

const UpdatesPanel = () => {
	const [pending, setPending] = useState(false)
	const [message, setMessage] = useState("")
	const [error, setError] = useState(false)
	const check = async () => {
		setPending(true)
		setError(false)
		setMessage("Checking for updates…")
		try {
			const info = await apiFetch<UpdateInfo>("/api/update?check=1", { cache: "no-store" })
			if (info.check_error) throw new Error(info.check_error)
			setMessage(!info.supported
				? "In-app updates require a release-based user service."
				: info.available
					? `${info.latest} is available. Use the Update button at the top to install it.`
					: `Pupler ${info.version} is up to date.`)
			window.dispatchEvent(new Event("pupler:update-checked"))
		} catch (err) {
			setError(true)
			setMessage(err instanceof Error ? err.message : "Could not check for updates")
		} finally {
			setPending(false)
		}
	}
	return (
		<div className="card panel settings-panel">
			<h2>Updates</h2>
			<button type="button" disabled={pending} onClick={() => void check()}>
				{pending ? "Checking…" : "Check for updates"}
			</button>
			<div role="status" aria-live="polite"><Status message={message} error={error} /></div>
		</div>
	)
}

type ApiKey = {
	id: number
	name: string
	prefix: string
	created_at: string
	last_used_at: string | null
}

const ApiKeysPanel = () => {
	const { data, loading, error, reload } = useApi<ApiKey[]>("/api/auth/api-keys")
	const [name, setName] = useState("")
	const [secret, setSecret] = useState<string | null>(null)
	const [status, setStatus] = useState("")
	const [pending, setPending] = useState(false)

	const create = async (event: React.FormEvent) => {
		event.preventDefault()
		setPending(true)
		setSecret(null)
		try {
			const result = await apiFetch<{ key: string }>("/api/auth/api-keys", {
				method: "POST",
				body: JSON.stringify({ name }),
			})
			setSecret(result.key)
			setName("")
			setStatus("API key created.")
			reload()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "API key request failed")
		} finally {
			setPending(false)
		}
	}

	const revoke = async (key: ApiKey) => {
		if (!window.confirm(`Revoke API key "${key.name}"? Apps using it will lose access.`)) return
		try {
			await apiFetch(`/api/auth/api-keys/${key.id}`, { method: "DELETE" })
			setSecret(null)
			setStatus("API key revoked.")
			reload()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "API key request failed")
		}
	}

	const copy = async () => {
		if (!secret) return
		try {
			await navigator.clipboard.writeText(secret)
			setStatus("API key copied.")
		} catch {
			setStatus("Select and copy the key manually.")
		}
	}

	return (
		<div className="card panel settings-panel">
			<h2>API keys</h2>
			<p>Keys give apps your account&apos;s API access. Revoke a key here to disable it. Key management requires a browser sign-in.</p>
			<form onSubmit={create}>
				<label>
					Key name
					<input required maxLength={100} placeholder="Omarchy toolbar" value={name} onChange={(e) => setName(e.target.value)} />
				</label>
				<button type="submit" disabled={pending}>
					Create API key
				</button>
			</form>
			{secret ? (
				<div>
					<p>Save this key now. It will not be shown again.</p>
					<input aria-label="New API key" readOnly value={secret} />
					<button type="button" onClick={() => void copy()}>
						Copy key
					</button>
				</div>
			) : null}
			<Status message={status} />
			{loading ? <p>Loading…</p> : null}
			{error ? <Status message={error} error /> : null}
			{!loading && !error ? (
				(data ?? []).length === 0 ? (
					<p>No API keys yet.</p>
				) : (
					<div>
						{(data ?? []).map((key) => (
							<div key={key.id} className="card">
								<strong>{key.name}</strong>
								<p>
									{key.prefix}… · Created {new Date(key.created_at).toLocaleString()} · Last used{" "}
									{key.last_used_at ? new Date(key.last_used_at).toLocaleString() : "never"}
								</p>
								<button type="button" onClick={() => void revoke(key)}>
									Revoke
								</button>
							</div>
						))}
					</div>
				)
			) : null}
		</div>
	)
}

export const SettingsPage = () => {
	const { user } = useAuth()
	const [currentPassword, setCurrentPassword] = useState("")
	const [newPassword, setNewPassword] = useState("")
	const [confirmPassword, setConfirmPassword] = useState("")
	const [status, setStatus] = useState("")
	const [statusError, setStatusError] = useState(false)
	const [pending, setPending] = useState(false)

	const onSubmit = async (event: React.FormEvent) => {
		event.preventDefault()
		if (newPassword !== confirmPassword) {
			setStatus("New passwords do not match.")
			setStatusError(true)
			return
		}
		setPending(true)
		setStatus("Changing password...")
		setStatusError(false)
		try {
			await apiFetch("/api/auth/password", {
				method: "POST",
				body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
			})
			setCurrentPassword("")
			setNewPassword("")
			setConfirmPassword("")
			setStatus("Password changed.")
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to change password.")
			setStatusError(true)
		} finally {
			setPending(false)
		}
	}

	return (
		<section className="workspace workspace--single">
			{user?.is_admin ? <UpdatesPanel /> : null}
			<div className="card panel settings-panel">
				<div className="section-header">
					<h2>Password</h2>
				</div>
				<form id="password-settings-form" autoComplete="on" onSubmit={onSubmit}>
					<label>
						Current Password
						<input
							type="password"
							name="current-password"
							autoComplete="current-password"
							required
							value={currentPassword}
							onChange={(e) => setCurrentPassword(e.target.value)}
						/>
					</label>
					<label>
						New Password
						<input
							type="password"
							name="new-password"
							autoComplete="new-password"
							minLength={8}
							required
							value={newPassword}
							onChange={(e) => setNewPassword(e.target.value)}
						/>
					</label>
					<label>
						Confirm New Password
						<input
							type="password"
							name="confirm-password"
							autoComplete="new-password"
							minLength={8}
							required
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
						/>
					</label>
					<div className="actions">
						<button className="primary" type="submit" disabled={pending}>
							Change Password
						</button>
					</div>
					<Status message={status} error={statusError} />
				</form>
			</div>
			<ApiKeysPanel />
		</section>
	)
}
