import { useState } from "react"
import { startRegistration, type PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser"
import { apiFetch } from "./api"
import { Status, useApi } from "./lib"

type Passkey = {
	id: number
	transports: string[]
	created_at: string
	last_used_at: string | null
}

const kind = (transports: string[]) =>
	transports.includes("internal") ? "This device / platform" : transports.includes("hybrid") ? "Phone" : transports.length ? "Security key" : "Passkey"

export const PasskeyList = ({ baseUrl, emptyMessage, canAdd = false }: { baseUrl: string, emptyMessage: string, canAdd?: boolean }) => {
	const { data, loading, error, reload } = useApi<Passkey[]>(baseUrl)
	const [status, setStatus] = useState("")
	const [statusError, setStatusError] = useState(false)

	const [pending, setPending] = useState(false)

	const add = async () => {
		setPending(true)
		try {
			const options = await apiFetch<PublicKeyCredentialCreationOptionsJSON>(`${baseUrl}/options`, { method: "POST", body: "{}" })
			const response = await startRegistration({ optionsJSON: options })
			await apiFetch(baseUrl, { method: "POST", body: JSON.stringify({ response }) })
			setStatus("Passkey added.")
			setStatusError(false)
			reload()
		} catch (err) {
			const name = err instanceof Error ? err.name : ""
			setStatus(name === "InvalidStateError" ? "This device already has a passkey for your account." : name === "NotAllowedError" ? "Passkey setup was cancelled or not allowed." : err instanceof Error ? err.message : "Failed to add passkey.")
			setStatusError(true)
		} finally {
			setPending(false)
		}
	}

	const remove = async (passkey: Passkey) => {
		if (!window.confirm("Remove this passkey? Sessions signed in with it will be logged out.")) return
		try {
			await apiFetch(`${baseUrl}/${passkey.id}`, { method: "DELETE" })
			setStatus("Passkey removed.")
			setStatusError(false)
			reload()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to remove passkey.")
			setStatusError(true)
		}
	}

	return (
		<>
			{canAdd ? (
				<button type="button" disabled={pending} onClick={() => void add()}>
					{pending ? "Waiting for passkey…" : "Add Passkey"}
				</button>
			) : null}
			<Status message={status} error={statusError} />
			{loading ? <p>Loading…</p> : null}
			{error ? <Status message={error} error /> : null}
			{!loading && !error ? (
				(data ?? []).length === 0 ? (
					<p>{emptyMessage}</p>
				) : (
					<div className="api-key-list">
						{(data ?? []).map((passkey) => (
							<div key={passkey.id} className="api-key-card">
								<div className="api-key-details">
									<strong>{kind(passkey.transports)}</strong>
									<div className="api-key-dates">
										<span>Added {new Date(passkey.created_at).toLocaleString()}</span>
										<span>Last used {passkey.last_used_at ? new Date(passkey.last_used_at).toLocaleString() : "never"}</span>
									</div>
								</div>
								<button type="button" onClick={() => void remove(passkey)}>
									Remove
								</button>
							</div>
						))}
					</div>
				)
			) : null}
		</>
	)
}
