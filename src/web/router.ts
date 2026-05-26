type HandlerResult = void | Promise<void>;
type Handler = (params: Record<string, string>) => HandlerResult;

const SWIPE_NAV_MIN_DISTANCE = 72;
const SWIPE_NAV_MAX_VERTICAL_DISTANCE = 80;
const SWIPE_NAV_DIRECTION_RATIO = 1.35;
const SWIPE_NAV_SNAP_DURATION_MS = 180;

type MatchResult = {
	pattern: string;
	handler: Handler;
	params: Record<string, string>;
} | null;

type SwipeNavigationOptions = {
	paths: string[];
	root?: HTMLElement | Document;
	renderPreview?: (path: string) => string;
};

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

const shouldIgnoreSwipeTarget = (target: EventTarget | null) =>
	target instanceof Element &&
	target.closest(
		'button, input, label, select, textarea, [contenteditable="true"], [data-swipe-nav-ignore]',
	);

const getCurrentSwipePathIndex = (paths: string[]) =>
	paths.findIndex((path) =>
		path === "/"
			? window.location.pathname === path
			: window.location.pathname === path ||
				window.location.pathname.startsWith(`${path}/`),
	);

const getSwipeNavigationPath = (paths: string[], deltaX: number) => {
	const currentIndex = getCurrentSwipePathIndex(paths);
	if (currentIndex === -1) {
		return null;
	}

	const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
	return paths[nextIndex] ?? null;
};

const isTouchNavigationAvailable = () =>
	window.matchMedia("(hover: none) and (pointer: coarse)").matches ||
	navigator.maxTouchPoints > 0;

export const installSwipeNavigation = ({
	paths,
	root = document,
	renderPreview,
}: SwipeNavigationOptions) => {
	let trackingPointerId: number | null = null;
	let startX = 0;
	let startY = 0;
	let startAt = 0;
	let swiped = false;
	let lastSwipeAt = 0;
	let isDraggingPage = false;
	let isTrackingTouch = false;
	let swipePreview: HTMLElement | null = null;
	let swipePreviewPath: string | null = null;
	let swipePreviewDirection = 0;

	const getSwipeSurface = () =>
		document.querySelector<HTMLElement>(".page-shell");

	const removeSwipePreview = () => {
		swipePreview?.remove();
		swipePreview = null;
		swipePreviewPath = null;
		swipePreviewDirection = 0;
	};

	const ensureSwipePreview = (path: string, direction: number) => {
		if (
			swipePreview &&
			swipePreviewPath === path &&
			swipePreviewDirection === direction
		) {
			return swipePreview;
		}

		removeSwipePreview();
		const preview = document.createElement("div");
		preview.className = "swipe-page-preview";
		preview.setAttribute("aria-hidden", "true");
		const header = document.querySelector<HTMLElement>(".site-header");
		const previewTop = header?.getBoundingClientRect().bottom ?? 0;
		preview.style.setProperty("--swipe-preview-top", `${previewTop}px`);
		preview.innerHTML = renderPreview?.(path) ?? "";
		document.body.append(preview);
		swipePreview = preview;
		swipePreviewPath = path;
		swipePreviewDirection = direction;
		return preview;
	};

	const setSwipeTransforms = (deltaX: number) => {
		const surface = getSwipeSurface();
		if (surface) {
			surface.style.transform = `translate3d(${deltaX}px, 0, 0)`;
		}
		if (swipePreview) {
			swipePreview.style.transform = `translate3d(${deltaX + swipePreviewDirection * window.innerWidth}px, 0, 0)`;
		}
	};

	const resetSwipeSurface = () => {
		const surface = getSwipeSurface();
		if (surface) {
			surface.classList.remove("page-shell--swiping");
			surface.classList.remove("page-shell--swipe-commit");
			surface.classList.add("page-shell--swipe-reset");
		}
		swipePreview?.classList.add("swipe-page-preview--reset");
		setSwipeTransforms(0);
		window.setTimeout(() => {
			surface?.classList.remove("page-shell--swipe-reset");
			if (surface) surface.style.transform = "";
			removeSwipePreview();
		}, SWIPE_NAV_SNAP_DURATION_MS);
	};

	const updateSwipeSurface = (deltaX: number, deltaY: number) => {
		const absX = Math.abs(deltaX);
		const absY = Math.abs(deltaY);
		if (
			!isDraggingPage &&
			(absX < 12 || absX < absY * SWIPE_NAV_DIRECTION_RATIO)
		) {
			return false;
		}

		isDraggingPage = true;
		const surface = getSwipeSurface();
		if (!surface) return false;
		const width = Math.max(1, window.innerWidth);
		const nextPath = getSwipeNavigationPath(paths, deltaX);
		const direction = deltaX < 0 ? 1 : -1;
		const targetDelta = nextPath ? deltaX : deltaX * 0.28;
		const clamped = Math.max(
			-width,
			Math.min(width, targetDelta),
		);
		if (nextPath) {
			const preview = ensureSwipePreview(nextPath, direction);
			preview.classList.add("swipe-page-preview--swiping");
			preview.classList.remove("swipe-page-preview--reset");
			preview.classList.remove("swipe-page-preview--commit");
		} else {
			removeSwipePreview();
		}
		surface.classList.add("page-shell--swiping");
		surface.classList.remove("page-shell--swipe-reset");
		surface.classList.remove("page-shell--swipe-commit");
		setSwipeTransforms(clamped);
		return true;
	};

	const startTracking = (x: number, y: number) => {
		startX = x;
		startY = y;
		startAt = performance.now();
		swiped = false;
		isDraggingPage = false;
		isTrackingTouch = true;
	};

	const finishTracking = (x: number, y: number) => {
		if (Date.now() - lastSwipeAt < 500) {
			return false;
		}

		const deltaX = x - startX;
		const deltaY = y - startY;
		const absX = Math.abs(deltaX);
		const absY = Math.abs(deltaY);

		const elapsed = Math.max(1, performance.now() - startAt);
		const velocity = absX / elapsed;
		const snapThreshold = Math.max(
			SWIPE_NAV_MIN_DISTANCE,
			window.innerWidth * 0.25,
		);
		const isIntentionalFastSwipe = absX >= 48 && velocity >= 0.45;

		if (
			(absX < snapThreshold && !isIntentionalFastSwipe) ||
			absY > SWIPE_NAV_MAX_VERTICAL_DISTANCE ||
			absX < absY * SWIPE_NAV_DIRECTION_RATIO
		) {
			return false;
		}

		const nextPath = getSwipeNavigationPath(paths, deltaX);
		if (!nextPath) {
			resetSwipeSurface();
			return false;
		}

		swiped = true;
		lastSwipeAt = Date.now();
		const surface = getSwipeSurface();
		if (!surface) {
			navigate(nextPath);
			return true;
		}
		surface.classList.remove("page-shell--swiping");
		surface.classList.add("page-shell--swipe-commit");
		swipePreview?.classList.remove("swipe-page-preview--swiping");
		swipePreview?.classList.add("swipe-page-preview--commit");
		setSwipeTransforms(deltaX < 0 ? -window.innerWidth : window.innerWidth);
		window.setTimeout(() => {
			removeSwipePreview();
			navigate(nextPath);
		}, SWIPE_NAV_SNAP_DURATION_MS);
		return true;
	};

	root.addEventListener("pointerdown", (event) => {
		if (!(event instanceof PointerEvent)) {
			return;
		}
		if (
			!isTouchNavigationAvailable() ||
			event.pointerType !== "touch" ||
			!event.isPrimary ||
			shouldIgnoreSwipeTarget(event.target)
		) {
			return;
		}
		trackingPointerId = event.pointerId;
		startTracking(event.clientX, event.clientY);
	});

	root.addEventListener("pointermove", (event) => {
		if (
			!(event instanceof PointerEvent) ||
			trackingPointerId !== event.pointerId
		) {
			return;
		}
		if (updateSwipeSurface(event.clientX - startX, event.clientY - startY)) {
			event.preventDefault();
		}
	});

	root.addEventListener("pointerup", (event) => {
		if (
			!(event instanceof PointerEvent) ||
			trackingPointerId !== event.pointerId
		) {
			return;
		}

		trackingPointerId = null;
		isTrackingTouch = false;
		if (finishTracking(event.clientX, event.clientY)) {
			event.preventDefault();
		} else if (isDraggingPage) {
			resetSwipeSurface();
		}
	});

	root.addEventListener("pointercancel", (event) => {
		if (
			event instanceof PointerEvent &&
			trackingPointerId === event.pointerId
		) {
			trackingPointerId = null;
			isTrackingTouch = false;
			resetSwipeSurface();
		}
	});

	root.addEventListener(
		"touchstart",
		(event) => {
			if (
				!isTouchNavigationAvailable() ||
				event.touches.length !== 1 ||
				shouldIgnoreSwipeTarget(event.target)
			) {
				return;
			}
			const touch = event.touches[0];
			if (!touch) return;
			startTracking(touch.clientX, touch.clientY);
		},
		{ passive: true },
	);

	root.addEventListener(
		"touchmove",
		(event) => {
			if (!isTrackingTouch) return;
			const touch = event.touches[0];
			if (!touch) return;
			if (updateSwipeSurface(touch.clientX - startX, touch.clientY - startY)) {
				event.preventDefault();
			}
		},
		{ passive: false },
	);

	root.addEventListener(
		"touchend",
		(event) => {
			if (!isTrackingTouch) return;
			isTrackingTouch = false;
			const touch = event.changedTouches[0];
			if (!touch) return;
			if (finishTracking(touch.clientX, touch.clientY)) {
				event.preventDefault();
			} else if (isDraggingPage) {
				resetSwipeSurface();
			}
		},
		{ passive: false },
	);

	root.addEventListener(
		"click",
		(event) => {
			if (!swiped) return;
			event.preventDefault();
			event.stopPropagation();
			swiped = false;
		},
		true,
	);
};

export const navigate = (path: string) => {
	if (window.location.pathname !== path) {
		window.history.pushState({}, "", path);
	}
	void handleRoute(path);
};
