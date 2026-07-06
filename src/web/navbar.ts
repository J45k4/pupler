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
};

type NavigationEntry = {
	href: string;
	label: string;
	group: string;
	keywords?: string;
};

const escapeHtml = (value: string) =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");

export const primaryNavItems: NavItem[] = [
	{ href: "/", label: "Overview", mobileLabel: "Home" },
	{ href: "/products", label: "Products", mobileLabel: "Products" },
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
			{ href: "/spending/items", label: "Last Items" },
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
	{ href: "/", label: "Overview", group: "Activity", keywords: "home dashboard" },
	{ href: "/products", label: "Products", group: "Catalog", keywords: "barcode product lookup" },
	{ href: "/clients", label: "Clients", group: "Time", keywords: "customers" },
	{ href: "/projects", label: "Projects", group: "Time", keywords: "work project clockify" },
	{ href: "/inventory", label: "Inventory", group: "Inventory", keywords: "stock storage containers" },
	{ href: "/inventory/expirations", label: "Expirations", group: "Inventory", keywords: "expires food" },
	{ href: "/receipts", label: "Receipts", group: "Spending", keywords: "purchases receipt" },
	{ href: "/spending/overview", label: "Spending Overview", group: "Spending", keywords: "money report" },
	{ href: "/spending", label: "Spending Breakdown", group: "Spending", keywords: "categories costs" },
	{ href: "/spending/monthly", label: "Monthly Spending", group: "Spending", keywords: "month chart" },
	{ href: "/spending/items", label: "Last Purchased Items", group: "Spending", keywords: "recent purchases" },
	{ href: "/shoppinglist", label: "Shopping List", group: "Planning", keywords: "shopping groceries" },
	{ href: "/todos", label: "Todos", group: "Planning", keywords: "tasks" },
	{ href: "/time", label: "Timer", group: "Time", keywords: "time tracking start timer" },
	{ href: "/time/overview", label: "Time Overview", group: "Time", keywords: "time report" },
	{ href: "/time/weekly", label: "Weekly Time", group: "Time", keywords: "week time report" },
	{ href: "/time/monthly", label: "Monthly Time", group: "Time", keywords: "month time report" },
	{ href: "/recipes", label: "Recipes", group: "Cooking", keywords: "meals" },
	{ href: "/recipes/new", label: "New Recipe", group: "Cooking", keywords: "create recipe" },
	{ href: "/settings", label: "Settings", group: "Settings", keywords: "password account" },
];

const quickNavigationEntries = [
	{ href: "/", label: "Activity", icon: "⌁" },
	{ href: "/time", label: "Time", icon: "◴" },
	{ href: "/spending/overview", label: "Reports", icon: "◐" },
];

const activeNavigationEntry = (currentPath: string) =>
	navigationEntries.find((entry) => currentPath === entry.href) ??
	navigationEntries.find((entry) => entry.href !== "/" && currentPath.startsWith(`${entry.href}/`)) ??
	navigationEntries[0]!;

const isActiveNavHref = (currentPath: string, href: string) =>
	href === "/"
		? currentPath === href
		: currentPath === href || currentPath.startsWith(`${href}/`);

const renderAccountMenu = (user: NavbarUser | null) => {
	if (!user) {
		return `<a class="account-login" href="/login" data-link>Login</a>`;
	}

	const label = escapeHtml(user.username ?? user.name);
	return `
		<div class="account-menu">
			<button class="account-menu__trigger" type="button" aria-haspopup="true">
				${label}
			</button>
			<div class="account-menu__dropdown">
				<div class="account-menu__username">${label}</div>
				<a class="account-menu__link" href="/settings" data-link>Settings</a>
				<button class="account-menu__logout" type="button">Logout</button>
			</div>
		</div>
	`;
};

export const renderNavbar = (currentPath: string, user: NavbarUser | null = null) => {
	const activeEntry = activeNavigationEntry(currentPath);
	return `
		<header class="site-header">
			<div class="site-header__inner">
				<a class="brand" href="/" data-link>
					<span class="brand__badge">Pupler</span>
				</a>
				<div class="navigation-hub">
					<button
						class="navigation-hub__trigger"
						id="navigation-hub-trigger"
						type="button"
						aria-haspopup="dialog"
						aria-expanded="false"
						aria-controls="navigation-hub-menu"
					>
						<img class="navigation-hub__logo" src="/favicon.png" alt="" aria-hidden="true" />
						<span class="navigation-hub__label">${escapeHtml(activeEntry.label)}</span>
					</button>
					<div class="navigation-menu card" id="navigation-hub-menu" hidden>
						<div class="navigation-menu__quick">
							${quickNavigationEntries
								.map(
									(entry) => `
										<a class="navigation-menu__quick-link" href="${entry.href}" data-link>
											<span class="navigation-menu__quick-icon">${entry.icon}</span>
											<span>${escapeHtml(entry.label)}</span>
										</a>
									`,
								)
								.join("")}
						</div>
						<input
							class="navigation-menu__search"
							id="navigation-menu-search"
							type="search"
							placeholder="Search or jump to a page"
							autocomplete="off"
						/>
						<div class="navigation-menu__section-title">Pages</div>
						<div class="navigation-menu__results" id="navigation-menu-results">
							${navigationEntries
								.map(
									(entry) => `
										<a
											class="navigation-menu__result${isActiveNavHref(currentPath, entry.href) ? " navigation-menu__result--active" : ""}"
											href="${entry.href}"
											data-link
											data-navigation-entry
											data-label="${escapeHtml(`${entry.label} ${entry.group} ${entry.keywords ?? ""}`.toLowerCase())}"
										>
											<span class="navigation-menu__result-mark" aria-hidden="true">${escapeHtml(entry.label.slice(0, 1))}</span>
											<span>
												<strong>${escapeHtml(entry.label)}</strong>
												<small>${escapeHtml(entry.group)}</small>
											</span>
										</a>
									`,
								)
								.join("")}
						</div>
					</div>
				</div>
				${renderAccountMenu(user)}
			</div>
		</header>
	`;
};

export const attachNavigationMenu = (signal?: AbortSignal) => {
	const trigger = document.getElementById("navigation-hub-trigger");
	const menu = document.getElementById("navigation-hub-menu");
	const search = document.getElementById("navigation-menu-search");
	const resultLinks = Array.from(
		document.querySelectorAll<HTMLAnchorElement>("[data-navigation-entry]"),
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
