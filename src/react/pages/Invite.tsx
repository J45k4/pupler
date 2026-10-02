import { useEffect, useState } from "react"
import { startRegistration, type PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser"
import { apiFetch } from "../api"
import { useAuth, type AuthUser } from "../auth"
import { navigate } from "../router"

type InviteInfo = { user: { name: string, username: string | null }, expires_at: string }

export const InvitePage = ({ token }: { token: string }) => {
	const { setUser } = useAuth()
	const [invite, setInvite] = useState<InviteInfo | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [pending, setPending] = useState(false)
	const base = `/api/auth/invites/${encodeURIComponent(token)}`

	useEffect(() => {
		apiFetch<InviteInfo>(base).then(setInvite, (err) => setError(err instanceof Error ? err.message : "Invite link is invalid"))
	}, [base])

	const register = async () => {
		setPending(true)
		setError(null)
		try {
			const options = await apiFetch<PublicKeyCredentialCreationOptionsJSON>(`${base}/options`, { method: "POST", body: "{}" })
			const response = await startRegistration({ optionsJSON: options })
			const body = await apiFetch<{ user: AuthUser }>(`${base}/verify`, { method: "POST", body: JSON.stringify({ response }) })
			setUser(body.user)
			navigate("/", { replace: true })
		} catch (err) {
			setError(err instanceof Error && err.name === "InvalidStateError" ? "This device already has a passkey for this account. Open this link on a different device." : err instanceof Error && err.name === "NotAllowedError" ? "Passkey setup was cancelled or not allowed." : err instanceof Error ? err.message : "Passkey setup failed")
		} finally {
			setPending(false)
		}
	}

	return (
		<section className="card panel">
			<h2>Set Up Passkey</h2>
			{invite ? (
				<>
					<p className="page-copy">
						Welcome {invite.user.name}. Create a passkey to sign in to Pupler{invite.user.username ? ` as ${invite.user.username}` : ""}. This link works once.
					</p>
					<div className="actions">
						<button className="primary" type="button" disabled={pending} onClick={() => void register()}>
							{pending ? "Waiting for passkey…" : "Create Passkey"}
						</button>
					</div>
				</>
			) : null}
			{error ? <p className="status error">{error}</p> : null}
		</section>
	)
}
