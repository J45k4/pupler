import {
	escapeHtml,
	formatShoppingDate,
	renderPage,
	setStatus,
} from "../app";
import type { ShoppingListItem } from "../app";

const getShoppingListMode = (): "active" | "done" | "all" => {
	const toggle = document.getElementById("shoppinglist-show-done");
	if (!(toggle instanceof HTMLInputElement)) {
		return "active";
	}

	return toggle.checked ? "all" : "active";
};

const renderShoppingListItems = (items: ShoppingListItem[]) => {
	const results = document.getElementById("shopping-list-item-results");
	if (!results) {
		return;
	}

	if (!items.length) {
		results.innerHTML =
			'<div class="empty">No items in the shoppinglist yet.</div>';
		return;
	}

	results.innerHTML = `
		<table class="shoppinglist-table shoppinglist-table--shopping">
			<thead>
				<tr>
					<th>Done</th>
					<th>Name</th>
					<th>Date</th>
				</tr>
			</thead>
			<tbody>
				${items
					.map((item) => {
						const productPictureUpdated = item.product?.picture_file?.created_at ?? null;
						const productPictureUrl = item.product_id
							? productPictureUpdated
								? `/api/products/${item.product_id}/picture?updated=${encodeURIComponent(productPictureUpdated)}`
								: `/api/products/${item.product_id}/picture`
							: null;
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
								<td class="shoppinglist-table__check">
									<input
										type="checkbox"
										data-shopping-item-id="${item.id}"
										aria-label="Mark ${escapeHtml(item.name)} done"
										${checked}
									/>
								</td>
								<td>
									<div class="shoppinglist-product">
										${productPictureUrl
											? `<img class="shoppinglist-product__image" src="${productPictureUrl}" alt="${escapeHtml(item.product?.name ?? item.name)}" loading="lazy" onerror="this.remove()" />`
											: ""}
										<div>
											<div class="shoppinglist-product__name">${escapeHtml(item.name)}</div>
											${item.product
												? `<a class="shoppinglist-product__linked" href="/products/${item.product.id}" data-link>Product: ${escapeHtml(item.product.name)}</a>`
												: ""}
										</div>
									</div>
								</td>
								<td class="shoppinglist-table__date">
									<span class="shoppinglist-table__date-label">${dateLabel}</span>
									<span class="shoppinglist-table__date-value">${dateValue}</span>
								</td>
							</tr>
						`;
					})
					.join("")}
			</tbody>
		</table>
	`;
};

const loadShoppingListItems = async () => {
	try {
		const mode = getShoppingListMode();
		const query =
			mode === "active"
				? "?done=false"
				: mode === "done"
					? "?done=true"
					: "";
		const itemsResponse = await fetch(`/api/shopping-list-items${query}`);
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
		renderShoppingListItems(items);
		setStatus(
			"shopping-list-item-status",
			mode === "active"
				? `Loaded ${items.length} active shoppinglist item(s).`
				: `Loaded ${items.length} shoppinglist item(s).`,
		);
	} catch (error) {
		renderShoppingListItems([]);
		setStatus(
			"shopping-list-item-status",
			error instanceof Error
				? error.message
				: "Failed to load shoppinglist items",
			true,
		);
	}
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
				const response = await fetch("/api/shopping-list-items", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						name,
						ingredient_id: null,
						product_id: null,
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
					`Added ${name} to shoppinglist.`,
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

export const renderShoppingListsPage = () => {
	renderPage(
		`
			<section class="workspace workspace--single">
				<div class="card panel shoppinglist-create-panel">
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

				<div class="card panel shoppinglist-results-panel">
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
			renderShoppingListItems([]);
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
