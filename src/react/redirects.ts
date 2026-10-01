export const canonicalPath = (path: string) =>
	path === "/react" || path === "/react/" ? "/" : path.startsWith("/react/") ? path.slice("/react".length) : path

export const legacyRedirect = (location: { pathname: string; search: string; hash: string }) => {
	const path = canonicalPath(location.pathname)
	return path === location.pathname ? null : `${path}${location.search}${location.hash}`
}

export const loginDestination = (search: string) => {
	const redirect = new URLSearchParams(search).get("redirect")
	// Only allow local paths; backslashes and protocol-relative URLs can change the origin.
	const path = redirect?.startsWith("/") && !redirect.startsWith("//") && !/[\\\u0000-\u0020]/.test(redirect) ? redirect : "/"
	return { path, fullPage: path.startsWith("/oauth/authorize?request=") }
}
