import { renderNavbar } from "./navbar";
import { installLinkInterceptor, routes } from "./router";

type Product = {
	id: number;
	name: string;
	category: string;
	barcode: string | null;
	default_unit: string | null;
	is_perishable: boolean;
};

type ShoppingListItem = {
	id: number;
	product_id: number;
	quantity: number;
	unit: string;
	done: boolean;
	source_recipe_id: number | null;
	notes: string | null;
	created_at: string;
	updated_at: string;
};

const render = (html: string) => {
	document.body.innerHTML = html;
};

const renderPage = (content: string) => {
	render(`
		${renderNavbar(window.location.pathname)}
		<main class="page-shell">
			${content}
		</main>
	`);
};

const setStatus = (elementId: string, message: string, isError = false) => {
	const status = document.getElementById(elementId);
	if (!status) {
		return;
	}
	status.textContent = message;
	status.className = isError ? "status error" : "status";
};

const formatShoppingDate = (value: string) =>
	new Intl.DateTimeFormat(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	}).format(new Date(value));

const getShoppingListMode = () => {
	const toggle = document.getElementById("shoppinglist-show-done");
	if (!(toggle instanceof HTMLInputElement)) {
		return "active";
	}

	return toggle.checked ? "all" : "active";
};

const renderOverviewPage = () => {
	renderPage("");
};

const renderRecipesPage = () => {
	renderPage(
		`
			<section class="card panel page-panel">
				<div class="page-heading">
					<div>
						<span class="eyebrow">Recipes</span>
						<h1 class="page-title">Recipe planning will sit here.</h1>
					</div>
				</div>
				<p class="page-copy">
					This page is routed through the frontend navbar already. When recipe forms and meal
					planning endpoints are added, this is where they should render.
				</p>
			</section>
		`,
	);
};

const renderProducts = (products: Product[]) => {
	const results = document.getElementById("results");
	if (!results) {
		return;
	}

	if (!products.length) {
		results.innerHTML = '<div class="empty">No products found.</div>';
		return;
	}

	results.innerHTML = products
		.map((product) => {
			const badge = product.is_perishable
				? '<span class="tag">Perishable</span>'
				: "";
			return `
				<article class="product">
					<div class="product__media">
						<img class="product__image" src="/api/products/${product.id}/picture" alt="${product.name}" loading="lazy" onerror="this.parentElement.remove()" />
					</div>
					<header>
						<h3>${product.name}</h3>
						${badge}
					</header>
					<dl>
						<div>
							<dt>Category</dt>
							<dd>${product.category ?? "-"}</dd>
						</div>
						<div>
							<dt>Barcode</dt>
							<dd>${product.barcode ?? "-"}</dd>
						</div>
						<div>
							<dt>Unit</dt>
							<dd>${product.default_unit ?? "-"}</dd>
						</div>
					</dl>
				</article>
			`;
		})
		.join("");
};

const renderShoppingListItems = (
	items: ShoppingListItem[],
	products: Product[],
) => {
	const results = document.getElementById("shopping-list-item-results");
	if (!results) {
		return;
	}

	const productsById = new Map(
		products.map((product) => [product.id, product]),
	);

	if (!items.length) {
		results.innerHTML =
			'<div class="empty">No items in the shoppinglist yet.</div>';
		return;
	}

	results.innerHTML = `
		<table class="shoppinglist-table">
			<thead>
				<tr>
					<th>Name</th>
					<th>Date</th>
					<th>Done</th>
				</tr>
			</thead>
			<tbody>
				${items
					.map((item) => {
						const product = productsById.get(item.product_id);
						const checked = item.done ? " checked" : "";
						const rowClass = item.done
							? "shoppinglist-table__row shoppinglist-table__row--done"
							: "shoppinglist-table__row";
						const dateLabel = item.done ? "Done" : "Added";
						const dateValue = item.done
							? formatShoppingDate(item.updated_at)
							: formatShoppingDate(item.created_at);

						return `
							<tr class="${rowClass}">
								<td>${product?.name ?? `Product #${item.product_id}`}</td>
								<td class="shoppinglist-table__date">
									<span class="shoppinglist-table__date-label">${dateLabel}</span>
									${dateValue}
								</td>
								<td class="shoppinglist-table__check">
									<input
										type="checkbox"
										data-shopping-item-id="${item.id}"
										aria-label="Mark ${product?.name ?? `product ${item.product_id}`} done"
										${checked}
									/>
								</td>
							</tr>
						`;
					})
					.join("")}
			</tbody>
		</table>
	`;
};

const fetchAllProducts = async () => {
	const response = await fetch("/api/products");
	const body = (await response.json()) as Product[] | { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to load products")
				: "Failed to load products",
		);
	}

	return body as Product[];
};

const loadProducts = async () => {
	const barcodeFilter = document.getElementById("barcode-filter");
	if (!(barcodeFilter instanceof HTMLInputElement)) {
		return;
	}

	const barcode = barcodeFilter.value.trim();
	const query = barcode ? `?barcode=${encodeURIComponent(barcode)}` : "";

	try {
		const response = await fetch(`/api/products${query}`);
		const body = (await response.json()) as Product[] | { error?: string };

		if (!response.ok) {
			throw new Error(
				"error" in body
					? (body.error ?? "Failed to load products")
					: "Failed to load products",
			);
		}

		const products = body as Product[];
		renderProducts(products);
		setStatus(
			"status",
			barcode
				? `Loaded ${products.length} matching product(s).`
				: `Loaded ${products.length} product(s).`,
		);
	} catch (error) {
		renderProducts([]);
		setStatus(
			"status",
			error instanceof Error ? error.message : "Failed to load products",
			true,
		);
	}
};

const uploadProductPicture = async (productId: number, file: File) => {
	const formData = new FormData();
	formData.set("file", file);

	const response = await fetch(`/api/products/${productId}/picture`, {
		method: "POST",
		body: formData,
	});
	const body = (await response.json()) as { error?: string };
	if (!response.ok) {
		throw new Error(body.error ?? "Failed to upload product picture");
	}
};

const loadShoppingListItems = async (products?: Product[]) => {
	try {
		const mode = getShoppingListMode();
		const query =
			mode === "active"
				? "?done=false"
				: mode === "done"
					? "?done=true"
					: "";
		const [itemsResponse, productList] = await Promise.all([
			fetch(`/api/shopping-list-items${query}`),
			products ? Promise.resolve(products) : fetchAllProducts(),
		]);
		const body = (await itemsResponse.json()) as
			| ShoppingListItem[]
			| { error?: string };

		if (!itemsResponse.ok) {
			throw new Error(
				"error" in body
					? (body.error ?? "Failed to load shoppinglist items")
					: "Failed to load shoppinglist items",
			);
		}

		const items = body as ShoppingListItem[];
		renderShoppingListItems(items, productList);
		setStatus(
			"shopping-list-item-status",
			mode === "active"
				? `Loaded ${items.length} active shoppinglist item(s).`
				: `Loaded ${items.length} shoppinglist item(s).`,
		);
	} catch (error) {
		renderShoppingListItems([], products ?? []);
		setStatus(
			"shopping-list-item-status",
			error instanceof Error
				? error.message
				: "Failed to load shoppinglist items",
			true,
		);
	}
};

const findOrCreateProductByName = async (name: string) => {
	const lookupResponse = await fetch(
		`/api/products?name=${encodeURIComponent(name)}`,
	);
	const lookupBody = (await lookupResponse.json()) as
		| Product[]
		| { error?: string };

	if (!lookupResponse.ok) {
		throw new Error(
			"error" in lookupBody
				? (lookupBody.error ?? "Failed to look up product")
				: "Failed to look up product",
		);
	}

	const matches = lookupBody as Product[];
	if (matches.length > 0) {
		return matches[0]!;
	}

	const createResponse = await fetch("/api/products", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			name,
			category: "shopping",
			barcode: null,
			default_unit: "pcs",
			is_perishable: false,
		}),
	});
	const createBody = (await createResponse.json()) as
		| Product
		| { error?: string };

	if (!createResponse.ok) {
		throw new Error(
			"error" in createBody
				? (createBody.error ?? "Failed to create product")
				: "Failed to create product",
		);
	}

	return createBody as Product;
};

const setShoppingListItemDone = async (itemId: number, done: boolean) => {
	const response = await fetch(`/api/shopping-list-items/${itemId}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ done }),
	});
	const body = (await response.json()) as
		| ShoppingListItem
		| { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to update shoppinglist item")
				: "Failed to update shoppinglist item",
		);
	}
};

const attachProductPageEvents = () => {
	const form = document.getElementById("product-form");
	const filterButton = document.getElementById("filter-button");
	const refreshButton = document.getElementById("refresh-button");

	form?.addEventListener("submit", async (event) => {
		event.preventDefault();

		const nameInput = document.getElementById("name");
		const categoryInput = document.getElementById("category");
		const barcodeInput = document.getElementById("barcode");
		const defaultUnitInput = document.getElementById("default_unit");
		const isPerishableInput = document.getElementById("is_perishable");
		const pictureInput = document.getElementById("picture");

		if (
			!(nameInput instanceof HTMLInputElement) ||
			!(categoryInput instanceof HTMLInputElement) ||
			!(barcodeInput instanceof HTMLInputElement) ||
			!(defaultUnitInput instanceof HTMLInputElement) ||
			!(isPerishableInput instanceof HTMLSelectElement) ||
			!(pictureInput instanceof HTMLInputElement)
		) {
			return;
		}

		const payload = {
			name: nameInput.value.trim(),
			category: categoryInput.value.trim(),
			barcode: barcodeInput.value.trim() || null,
			default_unit: defaultUnitInput.value.trim() || null,
			is_perishable: isPerishableInput.value === "true",
		};

		try {
			const response = await fetch("/api/products", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const body = (await response.json()) as
				| Product
				| { error?: string };

			if (!response.ok) {
				throw new Error(
					"error" in body
						? (body.error ?? "Failed to create product")
						: "Failed to create product",
				);
			}

			const picture = pictureInput.files?.[0];
			if (picture) {
				await uploadProductPicture((body as Product).id, picture);
			}

			if (form instanceof HTMLFormElement) {
				form.reset();
			}
			isPerishableInput.value = "true";

			const barcodeFilter = document.getElementById("barcode-filter");
			if (barcodeFilter instanceof HTMLInputElement) {
				barcodeFilter.value = (body as Product).barcode ?? "";
			}

			setStatus(
				"status",
				picture
					? `Created product #${(body as Product).id} and uploaded picture`
					: `Created product #${(body as Product).id}: ${(body as Product).name}`,
			);
			await loadProducts();
		} catch (error) {
			setStatus(
				"status",
				error instanceof Error
					? error.message
					: "Failed to create product",
				true,
			);
		}
	});

	filterButton?.addEventListener("click", () => {
		void loadProducts();
	});
	refreshButton?.addEventListener("click", () => {
		void loadProducts();
	});
};

const attachShoppingListPageEvents = () => {
	document
		.getElementById("shopping-list-item-form")
		?.addEventListener("submit", async (event) => {
			event.preventDefault();

			const nameInput = document.getElementById("shopping-thing-name");

			if (!(nameInput instanceof HTMLInputElement)) {
				return;
			}

			const name = nameInput.value.trim();
			if (!name) {
				setStatus(
					"shopping-list-item-status",
					"Thing name is required",
					true,
				);
				return;
			}

			try {
				const product = await findOrCreateProductByName(name);
				const response = await fetch("/api/shopping-list-items", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						product_id: product.id,
						quantity: 1,
						unit: "pcs",
						done: false,
						source_recipe_id: null,
						notes: null,
					}),
				});
				const body = (await response.json()) as
					| ShoppingListItem
					| { error?: string };

				if (!response.ok) {
					throw new Error(
						"error" in body
							? (body.error ??
									"Failed to add thing to shoppinglist")
							: "Failed to add thing to shoppinglist",
					);
				}

				setStatus(
					"shopping-list-item-status",
					`Added ${product.name} to shoppinglist.`,
				);
				nameInput.value = "";
				await loadShoppingListItems();
			} catch (error) {
				setStatus(
					"shopping-list-item-status",
					error instanceof Error
						? error.message
						: "Failed to add thing to shoppinglist",
					true,
				);
			}
		});

	document
		.getElementById("shopping-list-item-results")
		?.addEventListener("change", async (event) => {
			const target = event.target;
			if (!(target instanceof HTMLInputElement)) {
				return;
			}
			if (
				target.type !== "checkbox" ||
				!target.matches("[data-shopping-item-id]")
			) {
				return;
			}

			const itemId = Number(target.dataset.shoppingItemId);
			if (!Number.isInteger(itemId)) {
				return;
			}

			try {
				await setShoppingListItemDone(itemId, target.checked);
				setStatus("shopping-list-item-status", "Shoppinglist updated.");
				await loadShoppingListItems();
			} catch (error) {
				target.checked = !target.checked;
				setStatus(
					"shopping-list-item-status",
					error instanceof Error
						? error.message
						: "Failed to update shoppinglist item",
					true,
				);
			}
		});

	document
		.getElementById("shoppinglist-show-done")
		?.addEventListener("change", () => {
			void loadShoppingListItems();
		});
};

const renderProductsPage = () => {
	renderPage(
		`
			<section class="page-heading page-heading--compact">
				<div>
					<span class="eyebrow">Products</span>
					<h1 class="page-title">Create Product</h1>
				</div>
				<p class="page-copy">
					Add products, scan barcodes into the lookup input, and confirm the API behavior from one page.
				</p>
			</section>

			<section class="workspace">
				<div class="card panel">
					<h2>Create Product</h2>
					<form id="product-form">
						<label>
							Name
							<input id="name" name="name" placeholder="Milk" required />
						</label>

						<div class="row">
							<label>
								Category
								<input id="category" name="category" placeholder="food" required />
							</label>

							<label>
								Unit
								<input id="default_unit" name="default_unit" placeholder="pcs" />
							</label>
						</div>

						<label>
							Barcode
							<input id="barcode" name="barcode" placeholder="6414893400012" />
						</label>

						<label>
							Picture
							<input id="picture" name="picture" type="file" accept="image/*" />
						</label>

						<label>
							Perishable
							<select id="is_perishable" name="is_perishable">
								<option value="true">true</option>
								<option value="false">false</option>
							</select>
						</label>

						<div class="actions">
							<button class="primary" type="submit">Create Product</button>
							<button class="secondary" type="button" id="refresh-button">Refresh List</button>
						</div>
					</form>
					<div id="status" class="status"></div>
				</div>

				<div class="card panel">
					<h2>Product Lookup</h2>
					<div class="toolbar">
						<input id="barcode-filter" placeholder="Scan or type barcode" />
						<button class="secondary" id="filter-button" type="button">Find</button>
					</div>
					<div id="results" class="results"></div>
				</div>
			</section>
		`,
	);

	attachProductPageEvents();
	void loadProducts();
};

const renderShoppingListsPage = () => {
	renderPage(
		`
			<section class="workspace workspace--single">
				<div class="card panel">
					<form id="shopping-list-item-form">
						<div class="shoppinglist-input">
							<input
								id="shopping-thing-name"
								name="shopping-thing-name"
								placeholder="Milk"
								autocomplete="off"
								required
							/>
							<button class="primary" type="submit">Add</button>
						</div>
					</form>
					<div id="shopping-list-item-status" class="status"></div>
				</div>

				<div class="card panel">
					<div class="section-header section-header--end">
						<label class="checkbox-toggle" for="shoppinglist-show-done">
							<input
								id="shoppinglist-show-done"
								type="checkbox"
								aria-label="Show done shoppinglist items"
							/>
							<span>Show done</span>
						</label>
					</div>
					<div id="shopping-list-item-results" class="results"></div>
				</div>
			</section>
		`,
	);

	void (async () => {
		try {
			await loadShoppingListItems();
		} catch (error) {
			renderShoppingListItems([], []);
			setStatus(
				"shopping-list-item-status",
				error instanceof Error
					? error.message
					: "Failed to initialize shoppinglist",
				true,
			);
		}
	})();

	attachShoppingListPageEvents();
};

const renderNotFoundPage = () => {
	renderPage(
		`
			<section class="card panel page-panel">
				<div class="page-heading">
					<div>
						<span class="eyebrow">Not Found</span>
						<h1 class="page-title">That frontend route is not registered.</h1>
					</div>
				</div>
				<p class="page-copy">
					Use the navbar to return to a known page.
				</p>
			</section>
		`,
	);
};

window.onload = () => {
	installLinkInterceptor(document.body);

	routes({
		"/": renderOverviewPage,
		"/products": renderProductsPage,
		"/shopping-lists": renderShoppingListsPage,
		"/recipes": renderRecipesPage,
		"/*": renderNotFoundPage,
	});
};
