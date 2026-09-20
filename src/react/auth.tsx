import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react"
import { apiFetch } from "./api"
import { navigate } from "./router"

export type AuthUser = {
	id: number
	name: string
	username: string | null
	email: string | null
	is_admin: boolean
	created_at: string
	updated_at: string
}

type AuthState = {
	user: AuthUser | null
	loading: boolean
	login: (username: string, password: string) => Promise<void>
	logout: () => Promise<void>
	refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
	const [user, setUser] = useState<AuthUser | null>(null)
	const [loading, setLoading] = useState(true)

	const refresh = useCallback(async () => {
		try {
			const body = await apiFetch<{ user: AuthUser }>("/api/auth/session")
			setUser(body.user)
		} catch {
			setUser(null)
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		void refresh()
	}, [refresh])

	useEffect(() => {
		const originalFetch = window.fetch.bind(window)
		let active = true
		window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const response = await originalFetch(input, init)
			const url =
				typeof input === "string"
					? input
					: input instanceof Request
						? input.url
						: String(input)
			if (response.status === 401 && !url.includes("/api/auth/")) {
				if (active) setUser(null)
				if (!window.location.pathname.startsWith("/react/login")) {
					navigate(`/react/login?redirect=${encodeURIComponent(window.location.pathname.replace(/^\/react/, "") || "/")}`)
				}
			}
			return response
		}) as typeof window.fetch
		return () => {
			active = false
			window.fetch = originalFetch
		}
	}, [])

	const login = useCallback(async (username: string, password: string) => {
		const body = await apiFetch<{ user: AuthUser }>("/api/auth/login", {
			method: "POST",
			body: JSON.stringify({ username, password }),
		})
		setUser(body.user)
	}, [])

	const logout = useCallback(async () => {
		await apiFetch("/api/auth/logout", { method: "POST", body: "{}" })
		setUser(null)
		navigate("/react/login")
	}, [])

	return (
		<AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
			{children}
		</AuthContext.Provider>
	)
}

export const useAuth = () => {
	const ctx = useContext(AuthContext)
	if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
	return ctx
}
