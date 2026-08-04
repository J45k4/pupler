import { createElement } from "./lib/dom";

type NavItem = {
	href: string;
	label: string;
	mobileLabel: string;
	children?: Array<{
		href: string;
		label: string;
	}>;
};

type NavbarUser = {
	name: string;
	username: string | null;
	is_admin: boolean;
};

type NavigationEntry = {
	href: string;
	label: string;
	group: string;
	keywords?: string;
};

export const primaryNavItems: NavItem[] = [
	{ href: "/", label: "Overview", mobileLabel: "Home" },
	{
		href: "/products",
		label: "Products",
		mobileLabel: "Products",
		children: [
			{ href: "/products", label: "Lookup" },
			{ href: "/products/stats", label: "Stats" },
		],
	},
	{ href: "/clients", label: "Clients", mobileLabel: "Clients" },
	{ href: "/projects", label: "Projects", mobileLabel: "Projects" },
	{
		href: "/inventory",
		label: "Inventory",
		mobileLabel: "Inventory",
		children: [
			{ href: "/inventory", label: "Inventory" },
			{ href: "/inventory/expirations", label: "Expirations" },
		],
	},
	{
		href: "/spending",
		label: "Spending",
		mobileLabel: "Spending",
		children: [
			{ href: "/spending/overview", label: "Overview" },
			{ href: "/spending", label: "Breakdown" },
			{ href: "/spending/monthly", label: "Monthly" },
			{ href: "/spending/items", label: "Receipt Items" },
		],
	},
	{ href: "/receipts", label: "Receipts", mobileLabel: "Receipts" },
	{ href: "/shoppinglist", label: "Shoppinglist", mobileLabel: "Shopping" },
	{ href: "/todos", label: "Todos", mobileLabel: "Todos" },
	{
		href: "/time",
		label: "Time",
		mobileLabel: "Time",
		children: [
			{ href: "/time", label: "Timer" },
			{ href: "/time/overview", label: "Overview" },
			{ href: "/time/weekly", label: "Weekly" },
			{ href: "/time/monthly", label: "Monthly" },
		],
	},
	{ href: "/recipes", label: "Recipes", mobileLabel: "Recipes" },
];

const navigationEntries: NavigationEntry[] = [
	{ href: "/clients", label: "Clients", group: "Time", keywords: "customers" },
	{ href: "/inventory/expirations", label: "Expirations", group: "Inventory", keywords: "expires food" },
	{ href: "/inventory", label: "Inventory", group: "Inventory", keywords: "stock storage containers" },
	{ href: "/spending/items", label: "Receipt Items", group: "Spending", keywords: "recent purchases search product store category" },
	{ href: "/spending/monthly", label: "Monthly Spending", group: "Spending", keywords: "month chart" },
	{ href: "/time/monthly", label: "Monthly Time", group: "Time", keywords: "month time report" },
	{ href: "/recipes/new", label: "New Recipe", group: "Cooking", keywords: "create recipe" },
	{ href: "/", label: "Overview", group: "Activity", keywords: "home dashboard" },
	{ href: "/products", label: "Products", group: "Catalog", keywords: "barcode product lookup" },
	{ href: "/products/stats", label: "Product Stats", group: "Catalog", keywords: "bought used usage table" },
	{ href: "/projects", label: "Projects", group: "Time", keywords: "work project clockify" },
	{ href: "/receipts", label: "Receipts", group: "Spending", keywords: "purchases receipt" },
	{ href: "/recipes", label: "Recipes", group: "Cooking", keywords: "meals" },
	{ href: "/settings", label: "Settings", group: "Settings", keywords: "password account" },
	{ href: "/users", label: "Users", group: "Settings", keywords: "accounts administrators permissions" },
	{ href: "/shoppinglist", label: "Shopping List", group: "Planning", keywords: "shopping groceries" },
	{ href: "/spending", label: "Spending Breakdown", group: "Spending", keywords: "categories costs" },
	{ href: "/spending/overview", label: "Spending Overview", group: "Spending", keywords: "money report" },
	{ href: "/time/overview", label: "Time Overview", group: "Time", keywords: "time report" },
	{ href: "/time", label: "Timer", group: "Time", keywords: "time tracking start timer" },
	{ href: "/todos", label: "Todos", group: "Planning", keywords: "tasks" },
	{ href: "/time/weekly", label: "Weekly Time", group: "Time", keywords: "week time report" },
];

const activeNavigationEntry = (currentPath: string, entries: NavigationEntry[]) =>
	entries.find((entry) => currentPath === entry.href) ??
	entries.find((entry) => entry.href !== "/" && currentPath.startsWith(`${entry.href}/`)) ??
	entries[0]!;

const isActiveNavHref = (currentPath: string, href: string) =>
	href === "/"
		? currentPath === href
		: currentPath === href || currentPath.startsWith(`${href}/`);

const renderAccountMenu = (user: NavbarUser | null) => {
	if (!user) {
		const login = createElement("a", {
			className: "account-login",
			text: "Login",
		});
		login.href = "/login";
		login.dataset.link = "";
		return login;
	}

	const label = user.username ?? user.name;
	const trigger = createElement("button", {
		className: "account-menu__trigger",
		text: label,
	});
	trigger.type = "button";
	trigger.setAttribute("aria-haspopup", "true");
	const settings = createElement("a", {
		className: "account-menu__link",
		text: "Settings",
	});
	settings.href = "/settings";
	settings.dataset.link = "";
	const logout = createElement("button", {
		className: "account-menu__logout",
		text: "Logout",
	});
	logout.type = "button";
	return createElement(
		"div",
		{ className: "account-menu" },
		trigger,
		createElement(
			"div",
			{ className: "account-menu__dropdown" },
			createElement("div", { className: "account-menu__username", text: label }),
			settings,
			logout,
		),
	);
};

export const renderNavbar = (currentPath: string, user: NavbarUser | null = null) => {
	const visibleNavigationEntries = user?.is_admin
		? navigationEntries
		: navigationEntries.filter((entry) => entry.href !== "/users");
	const activeEntry = activeNavigationEntry(currentPath, visibleNavigationEntries);
	const brand = createElement("a", { className: "brand" });
	brand.href = "/";
	brand.dataset.link = "";
	brand.append(createElement("span", { className: "brand__badge", text: "Pupler" }));
	const inner = createElement("div", { className: "site-header__inner" }, brand);

	if (user) {
		const trigger = createElement("button", {
			id: "navigation-hub-trigger",
			className: "navigation-hub__trigger",
		});
		trigger.type = "button";
		trigger.setAttribute("aria-haspopup", "dialog");
		trigger.setAttribute("aria-expanded", "false");
		trigger.setAttribute("aria-controls", "navigation-hub-menu");
		const logo = createElement("img", { className: "navigation-hub__logo" });
		logo.src = "/favicon.png";
		logo.alt = "";
		logo.setAttribute("aria-hidden", "true");
		trigger.append(
			logo,
			createElement("span", {
				className: "navigation-hub__label",
				text: activeEntry.label,
			}),
		);

		const search = createElement("input", {
			id: "navigation-menu-search",
			className: "navigation-menu__search",
		});
		search.type = "search";
		search.placeholder = "Search or jump to a page";
		search.autocomplete = "off";
		const results = createElement("div", {
			id: "navigation-menu-results",
			className: "navigation-menu__results",
		});
		for (const entry of visibleNavigationEntries) {
			const link = createElement("a", {
				className: `navigation-menu__result${isActiveNavHref(currentPath, entry.href) ? " navigation-menu__result--active" : ""}`,
			});
			link.href = entry.href;
			link.dataset.link = "";
			link.dataset.navigationEntry = "";
			link.dataset.label = `${entry.label} ${entry.group} ${entry.keywords ?? ""}`.toLowerCase();
			const mark = createElement("span", {
				className: "navigation-menu__result-mark",
				text: entry.label.slice(0, 1),
			});
			mark.setAttribute("aria-hidden", "true");
			link.append(
				mark,
				createElement(
					"span",
					{},
					createElement("strong", { text: entry.label }),
					createElement("small", { text: entry.group }),
				),
			);
			results.append(link);
		}
		const menu = createElement(
			"div",
			{ id: "navigation-hub-menu", className: "navigation-menu card" },
			search,
			createElement("div", {
				className: "navigation-menu__section-title",
				text: "Pages",
			}),
			results,
		);
		menu.hidden = true;
		inner.append(createElement("div", { className: "navigation-hub" }, trigger, menu));
	}
	if (currentPath !== "/login") inner.append(renderAccountMenu(user));
	return createElement("header", { className: "site-header" }, inner);
};

export const attachNavigationMenu = (
	root: ParentNode = document,
	signal?: AbortSignal,
) => {
	const trigger = root.querySelector("#navigation-hub-trigger");
	const menu = root.querySelector("#navigation-hub-menu");
	const search = root.querySelector("#navigation-menu-search");
	const resultLinks = Array.from(
		root.querySelectorAll<HTMLAnchorElement>("[data-navigation-entry]"),
	);
	if (
		!(trigger instanceof HTMLButtonElement) ||
		!(menu instanceof HTMLElement) ||
		!(search instanceof HTMLInputElement)
	) {
		return;
	}

	let activeLinkIndex = -1;

	const visibleResultLinks = () => resultLinks.filter((link) => !link.hidden);

	const isEditableTarget = (target: EventTarget | null) =>
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		(target instanceof HTMLElement && target.isContentEditable);

	const isPrintableKey = (event: KeyboardEvent) =>
		event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

	const updateSearchValue = (nextValue: string, selectionStart = nextValue.length) => {
		search.value = nextValue;
		search.focus();
		search.setSelectionRange(selectionStart, selectionStart);
		filterResults(search.value);
	};

	const typeIntoSearch = (text: string) => {
		const start = search.selectionStart ?? search.value.length;
		const end = search.selectionEnd ?? search.value.length;
		updateSearchValue(
			`${search.value.slice(0, start)}${text}${search.value.slice(end)}`,
			start + text.length,
		);
	};

	const focusLink = (index: number) => {
		const links = visibleResultLinks();
		if (!links.length) return;
		activeLinkIndex = (index + links.length) % links.length;
		links[activeLinkIndex]?.focus();
	};

	const setOpen = (open: boolean) => {
		menu.hidden = !open;
		trigger.setAttribute("aria-expanded", String(open));
		document.body.classList.toggle("navigation-menu-open", open);
		if (open) {
			activeLinkIndex = -1;
			search.focus();
			search.select();
		} else {
			activeLinkIndex = -1;
			search.value = "";
			filterResults("");
		}
	};

	const filterResults = (query: string) => {
		const normalized = query.trim().toLowerCase();
		let visibleCount = 0;
		for (const link of resultLinks) {
			const matches = !normalized || (link.dataset.label ?? "").includes(normalized);
			link.hidden = !matches;
			if (matches) visibleCount += 1;
		}
		menu.classList.toggle("navigation-menu--empty", visibleCount === 0);
		activeLinkIndex = -1;
	};

	trigger.addEventListener("click", () => setOpen(menu.hidden), { signal });
	search.addEventListener("input", () => filterResults(search.value), { signal });
	search.addEventListener(
		"keydown",
		(event) => {
			if (event.key === "ArrowDown") {
				event.preventDefault();
				focusLink(0);
				return;
			}
			if (event.key === "ArrowUp") {
				event.preventDefault();
				focusLink(visibleResultLinks().length - 1);
				return;
			}
			if (event.key !== "Enter") return;
			const firstVisible = resultLinks.find((link) => !link.hidden);
			if (firstVisible) {
				firstVisible.click();
				setOpen(false);
			}
		},
		{ signal },
	);

	menu.addEventListener(
		"click",
		(event) => {
			if (event.target instanceof Element && event.target.closest("a")) {
				setOpen(false);
			}
		},
		{ signal },
	);
	menu.addEventListener(
		"keydown",
		(event) => {
			if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
			if (!(event.target instanceof HTMLAnchorElement)) return;
			event.preventDefault();
			const links = visibleResultLinks();
			const currentIndex = links.indexOf(event.target);
			if (currentIndex === -1) {
				focusLink(event.key === "ArrowDown" ? 0 : links.length - 1);
				return;
			}
			focusLink(
				currentIndex + (event.key === "ArrowDown" ? 1 : -1),
			);
		},
		{ signal },
	);

	document.addEventListener(
		"click",
		(event) => {
			if (!(event.target instanceof Node)) return;
			if (menu.contains(event.target) || trigger.contains(event.target)) return;
			setOpen(false);
		},
		{ signal },
	);

	document.addEventListener(
		"keydown",
		(event) => {
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "j") {
				event.preventDefault();
				setOpen(menu.hidden);
				return;
			}
			if (event.key === "Escape") {
				setOpen(false);
				return;
			}
			if (menu.hidden || isEditableTarget(event.target)) {
				return;
			}
			if (isPrintableKey(event)) {
				event.preventDefault();
				typeIntoSearch(event.key);
				return;
			}
			if (event.key === "Backspace") {
				event.preventDefault();
				updateSearchValue(search.value.slice(0, -1));
				return;
			}
			if (event.key === "Delete") {
				event.preventDefault();
				updateSearchValue("");
			}
		},
		{ signal },
	);
};
