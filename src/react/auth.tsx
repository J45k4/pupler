import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react"
import { startAuthentication, type PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser"
import { apiFetch, ApiError } from "./api"
import { activateOfflineUser, offlineSignedOut, prepareOfflinePages, savedOfflineUser } from "./offline"
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
	loginWithPasskey: () => Promise<void>
	setUser: (user: AuthUser) => void
	logout: () => Promise<void>
	refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
	const [user, setUserState] = useState<AuthUser | null>(null)
	const [loading, setLoading] = useState(true)
	const setUser = useCallback((next: AuthUser | null) => {
		setUserState(next)
		void activateOfflineUser(next).then(() => next ? prepareOfflinePages() : undefined).catch(() => {})
	}, [])

	const refresh = useCallback(async () => {
		try {
			if (await offlineSignedOut().catch(() => false)) {
				setUserState(null)
				return
			}
			const body = await apiFetch<{ user: AuthUser }>("/api/auth/session")
			setUser(body.user)
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) setUser(null)
			else {
				const saved = await savedOfflineUser().catch(() => null)
				if (saved) setUser(saved)
				else setUserState(null)
			}
		} finally {
			setLoading(false)
		}
	}, [setUser])

	useEffect(() => {
		void refresh()
		window.addEventListener("online", refresh)
		return () => window.removeEventListener("online", refresh)
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
				if (!window.location.pathname.startsWith("/login")) {
					navigate(`/login?redirect=${encodeURIComponent(`${window.location.pathname || "/"}${window.location.search}${window.location.hash}`)}`)
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
		if (await offlineSignedOut().catch(() => false)) await apiFetch("/api/auth/logout", { method: "POST", body: "{}" })
		const body = await apiFetch<{ user: AuthUser }>("/api/auth/login", {
			method: "POST",
			body: JSON.stringify({ username, password }),
		})
		setUser(body.user)
	}, [])

	const loginWithPasskey = useCallback(async () => {
		if (await offlineSignedOut().catch(() => false)) await apiFetch("/api/auth/logout", { method: "POST", body: "{}" })
		const { challenge_id, options } = await apiFetch<{ challenge_id: string, options: PublicKeyCredentialRequestOptionsJSON }>("/api/auth/passkey/options", { method: "POST", body: "{}" })
		const response = await startAuthentication({ optionsJSON: options })
		const body = await apiFetch<{ user: AuthUser }>("/api/auth/passkey/verify", {
			method: "POST",
			body: JSON.stringify({ challenge_id, response }),
		})
		setUser(body.user)
	}, [])

	const logout = useCallback(async () => {
		await apiFetch("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => {})
		setUser(null)
		navigate("/login")
	}, [])

	return (
		<AuthContext.Provider value={{ user, loading, login, loginWithPasskey, setUser, logout, refresh }}>
			{children}
		</AuthContext.Provider>
	)
}

export const useAuth = () => {
	const ctx = useContext(AuthContext)
	if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
	return ctx
}
