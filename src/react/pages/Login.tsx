import { useState } from "react"
import { useAuth } from "../auth"
import { returnAfterLogin, usePath } from "../router"

export const LoginPage = () => {
	const { login, loginWithPasskey } = useAuth()
	const path = usePath()
	const [username, setUsername] = useState("")
	const [password, setPassword] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [pending, setPending] = useState(false)

	const onSubmit = async (event: React.FormEvent) => {
		event.preventDefault()
		setPending(true)
		setError(null)
		try {
			const search = window.location.search
			await login(username, password)
			returnAfterLogin(search)
		} catch (err) {
			setError(err instanceof Error ? err.message : "Login failed")
		} finally {
			setPending(false)
		}
	}

	const onPasskey = async () => {
		setPending(true)
		setError(null)
		try {
			const search = window.location.search
			await loginWithPasskey()
			returnAfterLogin(search)
		} catch (err) {
			setError(err instanceof Error && err.name === "NotAllowedError" ? "Passkey login was cancelled or no passkey was found." : err instanceof Error ? err.message : "Passkey login failed")
		} finally {
			setPending(false)
		}
	}

	return (
		<section className="card panel" data-path={path}>
			<h2>Login</h2>
			<form onSubmit={onSubmit}>
				<label>
					Username
					<input
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						required
						autoComplete="username"
					/>
				</label>
				<label>
					Password
					<input
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
						autoComplete="current-password"
					/>
				</label>
				<div className="actions">
					<button className="primary" type="submit" disabled={pending}>
						{pending ? "Logging in…" : "Login"}
					</button>
					<button className="secondary" type="button" disabled={pending} onClick={() => void onPasskey()}>
						Login with Passkey
					</button>
				</div>
			</form>
			{error ? <p className="status error">{error}</p> : null}
		</section>
	)
}
