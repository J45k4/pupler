export const renderNavbar = (currentPath: string) => {
	const items = [
		{ href: "/", label: "Overview" },
		{ href: "/products", label: "Products" },
		{ href: "/shopping-lists", label: "Shoppinglist" },
		{ href: "/recipes", label: "Recipes" },
	];

	return `
		<header class="site-header">
			<div class="site-header__inner">
				<a class="brand" href="/" data-link>
					<span class="brand__badge">Pupler</span>
				</a>
				<nav class="navbar" aria-label="Primary">
					${items
						.map(({ href, label }) => {
							const active =
								currentPath === href
									? " navbar__link--active"
									: "";
							return `<a class="navbar__link${active}" href="${href}" data-link>${label}</a>`;
						})
						.join("")}
				</nav>
			</div>
		</header>
	`;
};
