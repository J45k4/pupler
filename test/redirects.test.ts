import { expect, test } from "bun:test"
import { canonicalPath, legacyRedirect, loginDestination } from "../src/react/redirects"
import { navigate, returnAfterLogin } from "../src/react/router"

test("legacy redirects preserve report dates, login destinations and fragments", () => {
	for (const pathname of ["/react/time/weekly", "/react/settings", "/react/login", "/react", "/react/"]) {
		const search = "?date=2026-09-25&redirect=%2Foauth%2Fauthorize%3Frequest%3Dpending"
		expect(legacyRedirect({ pathname, search, hash: "#details" })).toBe(`${canonicalPath(pathname)}${search}#details`)
	}
	expect(legacyRedirect({ pathname: "/time/weekly", search: "?date=2026-09-25", hash: "" })).toBeNull()
	expect(legacyRedirect({ pathname: "/reactive", search: "", hash: "" })).toBeNull()
})

test("login destinations resume OAuth through a server request", () => {
	expect(loginDestination("?redirect=%2Foauth%2Fauthorize%3Frequest%3Dpending")).toEqual({ path: "/oauth/authorize?request=pending", fullPage: true })
	expect(loginDestination("?redirect=%2Ftime%2Fweekly%3Fdate%3D2026-09-25%23details")).toEqual({ path: "/time/weekly?date=2026-09-25#details", fullPage: false })
	for (const redirect of ["https://example.com", "//example.com", "/\\example.com", "/\n/example.com"]) {
		expect(loginDestination(`?redirect=${encodeURIComponent(redirect)}`)).toEqual({ path: "/", fullPage: false })
	}
	expect(loginDestination("")).toEqual({ path: "/", fullPage: false })
})

test("OAuth returns load the server and legacy redirects replace history", () => {
	const previous = globalThis.window
	const assigned: string[] = []
	const replaced: string[] = []
	const pushed: string[] = []
	globalThis.window = {
		location: { href: "http://localhost:5995/react/time/weekly?date=2026-09-25#details", pathname: "/react/time/weekly", search: "?date=2026-09-25", hash: "#details", assign: (path: string) => assigned.push(path) },
		history: { replaceState: (_state: unknown, _title: string, path: string) => replaced.push(path), pushState: (_state: unknown, _title: string, path: string) => pushed.push(path) },
	} as unknown as Window & typeof globalThis
	try {
		returnAfterLogin("?redirect=%2Foauth%2Fauthorize%3Frequest%3Dpending")
		expect(assigned).toEqual(["/oauth/authorize?request=pending"])
		expect(pushed).toEqual([])
		const redirect = legacyRedirect(window.location)!
		navigate(redirect, { replace: true })
		expect(replaced).toEqual(["/time/weekly?date=2026-09-25#details"])
		expect(pushed).toEqual([])
	} finally {
		globalThis.window = previous
	}
})
