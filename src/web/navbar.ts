export const renderNavbar = (currentPath: string) => {
	const items = [
		{ href: "/", label: "Overview", mobileLabel: "Home" },
		{ href: "/products", label: "Products", mobileLabel: "Products" },
		{ href: "/inventory", label: "Inventory", mobileLabel: "Inventory" },
		{ href: "/receipts", label: "Receipts", mobileLabel: "Receipts" },
		{ href: "/shopping-lists", label: "Shoppinglist", mobileLabel: "Shopping" },
		{ href: "/recipes", label: "Recipes", mobileLabel: "Recipes" },
	];

	return `
		<header class="site-header">
			<div class="site-header__inner">
				<a class="brand" href="/" data-link>
					<span class="brand__badge">Pupler</span>
				</a>
				<nav class="navbar" aria-label="Primary">
					${items
						.map(({ href, label, mobileLabel }) => {
							const isActive =
								href === "/"
									? currentPath === href
									: currentPath === href ||
										currentPath.startsWith(`${href}/`);
							const active = isActive ? " navbar__link--active" : "";
							return `<a class="navbar__link${active}" href="${href}" data-link aria-label="${label}"><span class="navbar__label navbar__label--desktop">${label}</span><span class="navbar__label navbar__label--mobile">${mobileLabel}</span></a>`;
						})
						.join("")}
				</nav>
			</div>
		</header>
	`;
};
