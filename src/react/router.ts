import { useSyncExternalStore } from "react"

type RouteState = {
	path: string
	search: string
}

export const matchRoute = (
	pattern: string,
	path: string,
): Record<string, string> | null => {
	const patternParts = pattern.split("/").filter((s) => s.length > 0)
	const pathParts = path.split("/").filter((s) => s.length > 0)
	if (pattern === "/*") return {}
	if (patternParts.length !== pathParts.length) {
		const last = patternParts[patternParts.length - 1] ?? ""
		if (last === "*" && pathParts.length >= patternParts.length - 1) return {}
		return null
	}
	const params: Record<string, string> = {}
	for (let i = 0; i < patternParts.length; i++) {
		const pp = patternParts[i]!
		const vp = pathParts[i]!
		if (pp === "*") return params
		if (pp.startsWith(":")) {
			params[pp.slice(1)] = vp
			continue
		}
		if (pp !== vp) return null
	}
	return params
}

let cachedSnapshot: RouteState | null = null
let cachedPath = ""
let cachedSearch = ""

const getSnapshot = (): RouteState => {
	const path = window.location.pathname
	const search = window.location.search
	if (cachedSnapshot && cachedPath === path && cachedSearch === search) {
		return cachedSnapshot
	}
	cachedPath = path
	cachedSearch = search
	cachedSnapshot = { path, search }
	return cachedSnapshot
}

const listeners = new Set<() => void>()

const notify = () => {
	for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

if (typeof window !== "undefined") {
	window.addEventListener("popstate", notify)
}

export const navigate = (path: string) => {
	const url = new URL(path, window.location.href)
	const destination = `${url.pathname}${url.search}${url.hash}`
	const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
	if (current !== destination) {
		window.history.pushState({}, "", destination)
	}
	notify()
}

export const installLinkInterceptor = (root: ParentNode = document) => {
	root.addEventListener("click", (event) => {
		const target = event.target
		if (!(target instanceof Element)) return
		const link = target.closest("a[data-link]")
		if (!(link instanceof HTMLAnchorElement)) return
		const href = link.getAttribute("href")
		if (!href || href.startsWith("http")) return
		event.preventDefault()
		navigate(href)
	})
}

export const useLocation = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

export const usePath = () =>
	useSyncExternalStore(subscribe, getSnapshot, getSnapshot).path

export const useRoute = <T extends Record<string, string>>(
	pattern: string,
): (T & { matches: boolean }) | null => {
	const { path } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
	const params = matchRoute(pattern, path)
	if (params === null) return null
	return { ...(params as T), matches: true }
}

export const matchAnyRoute = (
	patterns: string[],
	path: string,
): { pattern: string; params: Record<string, string> } | null => {
	const sorted = [...patterns].sort((a, b) => {
		if (!a.includes("*") && !a.includes(":")) return -1
		if (!b.includes("*") && !b.includes(":")) return 1
		if (a.includes(":") && !b.includes(":")) return -1
		if (!a.includes(":") && b.includes(":")) return 1
		if (a.includes("*") && !b.includes("*")) return 1
		if (!a.includes("*") && b.includes("*")) return -1
		return b.length - a.length
	})
	for (const pattern of sorted) {
		const params = matchRoute(pattern, path)
		if (params !== null) return { pattern, params }
	}
	return null
}
