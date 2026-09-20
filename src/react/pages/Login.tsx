import { useState } from "react"
import { useAuth } from "../auth"
import { usePath } from "../router"

export const LoginPage = ({
	link,
	navigate,
}: {
	link: (path: string) => string
	navigate: (path: string) => void
}) => {
	const { login } = useAuth()
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
			await login(username, password)
			const redirect = new URLSearchParams(window.location.search).get("redirect")
			navigate(redirect && redirect.startsWith("/") ? link(redirect) : link("/"))
		} catch (err) {
			setError(err instanceof Error ? err.message : "Login failed")
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
				</div>
			</form>
			{error ? <p className="status error">{error}</p> : null}
		</section>
	)
}
