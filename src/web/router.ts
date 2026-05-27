type HandlerResult = void | Promise<void>;
type Handler = (params: Record<string, string>) => HandlerResult;

type MatchResult = {
	pattern: string;
	handler: Handler;
	params: Record<string, string>;
} | null;

let matcher: ReturnType<typeof patternMatcher> | null = null;

export function patternMatcher(handlers: Record<string, Handler>) {
	const routes = Object.keys(handlers).sort((a, b) => {
		if (!a.includes("*") && !a.includes(":")) return -1;
		if (!b.includes("*") && !b.includes(":")) return 1;

		if (a.includes(":") && !b.includes(":")) return -1;
		if (!a.includes(":") && b.includes(":")) return 1;

		if (a.includes("*") && !b.includes("*")) return 1;
		if (!a.includes("*") && b.includes("*")) return -1;

		return b.length - a.length;
	});

	return {
		match(path: string): MatchResult {
			for (const route of routes) {
				const params = matchRoute(route, path);
				if (params !== null) {
					const handler = handlers[route];
					if (!handler) {
						continue;
					}
					return {
						pattern: route,
						handler,
						params,
					};
				}
			}
			return null;
		},
	};
}

function matchRoute(
	pattern: string,
	path: string,
): Record<string, string> | null {
	const patternParts = pattern
		.split("/")
		.filter((segment) => segment.length > 0);
	const pathParts = path.split("/").filter((segment) => segment.length > 0);

	if (pattern === "/*") {
		return {};
	}

	if (patternParts.length !== pathParts.length) {
		const lastPattern = patternParts[patternParts.length - 1] ?? "";
		if (
			lastPattern === "*" &&
			pathParts.length >= patternParts.length - 1
		) {
			return {};
		}
		return null;
	}

	const params: Record<string, string> = {};

	for (let index = 0; index < patternParts.length; index += 1) {
		const patternPart = patternParts[index]!;
		const pathPart = pathParts[index]!;

		if (patternPart === "*") {
			return params;
		}
		if (patternPart.startsWith(":")) {
			params[patternPart.slice(1)] = pathPart;
			continue;
		}
		if (patternPart !== pathPart) {
			return null;
		}
	}

	return params;
}

const handleRoute = async (path: string) => {
	if (!matcher) {
		return;
	}
	const match = matcher.match(path);
	if (!match) {
		console.error("No route found for", path);
		return;
	}
	await Promise.resolve(match.handler(match.params) as HandlerResult);
};

window.addEventListener("popstate", () => {
	void handleRoute(window.location.pathname);
});

export const routes = (handlers: Record<string, Handler>) => {
	matcher = patternMatcher(handlers);
	void handleRoute(window.location.pathname);
};

export const installLinkInterceptor = (root: ParentNode = document) => {
	root.addEventListener("click", (event) => {
		const target = event.target;
		if (!(target instanceof Element)) {
			return;
		}
		const link = target.closest("a[data-link]");
		if (!(link instanceof HTMLAnchorElement)) {
			return;
		}
		const href = link.getAttribute("href");
		if (!href || href.startsWith("http")) {
			return;
		}
		event.preventDefault();
		navigate(href);
	});
};

export const navigate = (path: string) => {
	if (window.location.pathname !== path) {
		window.history.pushState({}, "", path);
	}
	void handleRoute(path);
};
