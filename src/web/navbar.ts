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
	{ href: "/inventory", label: "Inventory", mobileLabel: "Inventory" },
	{
		href: "/spending",
		label: "Spending",
		mobileLabel: "Spending",
		children: [
			{ href: "/spending", label: "Breakdown" },
			{ href: "/spending/monthly", label: "Monthly" },
			{ href: "/spending/items", label: "Last Items" },
		],
	},
	{ href: "/receipts", label: "Receipts", mobileLabel: "Receipts" },
	{ href: "/shoppinglist", label: "Shoppinglist", mobileLabel: "Shopping" },
	{ href: "/todos", label: "Todos", mobileLabel: "Todos" },
	{ href: "/time", label: "Time", mobileLabel: "Time" },
	{ href: "/recipes", label: "Recipes", mobileLabel: "Recipes" },
];

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
				<button class="account-menu__logout" type="button">Logout</button>
			</div>
		</div>
	`;
};

export const renderNavbar = (currentPath: string, user: NavbarUser | null = null) => {
	return `
		<header class="site-header">
			<div class="site-header__inner">
				<a class="brand" href="/" data-link>
					<span class="brand__badge">Pupler</span>
				</a>
					<nav class="navbar" aria-label="Primary">
						${primaryNavItems
							.map(({ href, label, mobileLabel, children }) => {
								const isActive =
									isActiveNavHref(currentPath, href) ||
									(children?.some((child) =>
										isActiveNavHref(currentPath, child.href),
									) ??
										false);
								const active = isActive ? " navbar__link--active" : "";
								if (children?.length) {
									return `
										<div class="navbar__dropdown">
											<a class="navbar__link navbar__dropdown-trigger${active}" href="${href}" data-link aria-label="${label}" aria-haspopup="true">
												<span class="navbar__label navbar__label--desktop">${label}</span>
												<span class="navbar__label navbar__label--mobile">${mobileLabel}</span>
											</a>
											<div class="navbar__dropdown-menu">
												${children
													.map((child) => {
														const childActive = currentPath === child.href
															? " navbar__dropdown-link--active"
															: "";
														return `<a class="navbar__dropdown-link${childActive}" href="${child.href}" data-link>${child.label}</a>`;
													})
													.join("")}
											</div>
										</div>
									`;
								}
								return `<a class="navbar__link${active}" href="${href}" data-link aria-label="${label}"><span class="navbar__label navbar__label--desktop">${label}</span><span class="navbar__label navbar__label--mobile">${mobileLabel}</span></a>`;
							})
							.join("")}
					</nav>
					${renderAccountMenu(user)}
			</div>
		</header>
	`;
};
