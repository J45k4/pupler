import { formatShoppingDate, renderPage, setStatus } from "../app"
import type { ShoppingListItem } from "../app"
import {
	createElement,
	createEmptyState,
	getElementById,
	withQueryRoot,
} from "../lib/dom"

const getShoppingListMode = (): "active" | "done" | "all" => {
	const toggle = getElementById("shoppinglist-show-done")
	if (!(toggle instanceof HTMLInputElement)) {
		return "active"
	}

	return toggle.checked ? "all" : "active"
}

const renderShoppingListItems = (items: ShoppingListItem[]) => {
	const results = getElementById("shopping-list-item-results")
	if (!results) {
		return
	}

	if (!items.length) {
		results.replaceChildren(
			createEmptyState("No items in the shoppinglist yet."),
		)
		return
	}

	const table = createElement("table", {
		className: "shoppinglist-table shoppinglist-table--shopping",
	})
	const headerRow = document.createElement("tr")
	for (const label of ["Done", "Name", "Date"]) {
		headerRow.append(createElement("th", { text: label }))
	}
	const head = document.createElement("thead")
	head.append(headerRow)
	const body = document.createElement("tbody")
	for (const item of items) {
		const row = createElement("tr", {
			className: item.done
				? "shoppinglist-table__row shoppinglist-table__row--done"
				: "shoppinglist-table__row",
		})
		const checkbox = document.createElement("input")
		checkbox.type = "checkbox"
		checkbox.checked = item.done
		checkbox.setAttribute("aria-label", `Mark ${item.name} done`)
		checkbox.addEventListener("change", async () => {
			try {
				await setShoppingListItemDone(item.id, checkbox.checked)
				setStatus("shopping-list-item-status", "Shoppinglist updated.")
				await loadShoppingListItems()
			} catch (error) {
				checkbox.checked = !checkbox.checked
				setStatus(
					"shopping-list-item-status",
					error instanceof Error
						? error.message
						: "Failed to update shoppinglist item",
					true,
				)
			}
		})
		const product = createElement("div", {
			className: "shoppinglist-product",
		})
		const pictureUpdated = item.product?.picture_file?.created_at ?? null
		if (item.product_id) {
			const image = createElement("img", {
				className: "shoppinglist-product__image",
			})
			image.src = pictureUpdated
				? `/api/products/${item.product_id}/picture?updated=${encodeURIComponent(pictureUpdated)}`
				: `/api/products/${item.product_id}/picture`
			image.alt = item.product?.name ?? item.name
			image.loading = "lazy"
			image.addEventListener("error", () => image.remove())
			product.append(image)
		}
		const productCopy = document.createElement("div")
		productCopy.append(
			createElement("div", {
				className: "shoppinglist-product__name",
				text: item.name,
			}),
		)
		if (item.product) {
			const link = createElement("a", {
				className: "shoppinglist-product__linked",
				text: `Product: ${item.product.name}`,
			})
			link.href = `/products/${item.product.id}`
			link.dataset.link = ""
			productCopy.append(link)
		}
		product.append(productCopy)
		const date = createElement(
			"td",
			{ className: "shoppinglist-table__date" },
			createElement("span", {
				className: "shoppinglist-table__date-label",
				text: item.done ? "Done" : "Added",
			}),
			createElement("span", {
				className: "shoppinglist-table__date-value",
				text: formatShoppingDate(
					item.done ? item.updated_at : item.created_at,
				),
			}),
		)
		row.append(
			createElement(
				"td",
				{ className: "shoppinglist-table__check" },
				checkbox,
			),
			createElement("td", {}, product),
			date,
		)
		body.append(row)
	}
	table.append(head, body)
	results.replaceChildren(table)
}

const loadShoppingListItems = async () => {
	try {
		const mode = getShoppingListMode()
		const query =
			mode === "active"
				? "?done=false"
				: mode === "done"
					? "?done=true"
					: ""
		const itemsResponse = await fetch(`/api/shopping-list-items${query}`)
		const body = (await itemsResponse.json()) as
			| ShoppingListItem[]
			| { error?: string }

		if (!itemsResponse.ok) {
			throw new Error(
				"error" in body
					? (body.error ?? "Failed to load shoppinglist items")
					: "Failed to load shoppinglist items",
			)
		}

		const items = body as ShoppingListItem[]
		renderShoppingListItems(items)
		setStatus(
			"shopping-list-item-status",
			mode === "active"
				? `Loaded ${items.length} active shoppinglist item(s).`
				: `Loaded ${items.length} shoppinglist item(s).`,
		)
	} catch (error) {
		renderShoppingListItems([])
		setStatus(
			"shopping-list-item-status",
			error instanceof Error
				? error.message
				: "Failed to load shoppinglist items",
			true,
		)
	}
}

const setShoppingListItemDone = async (itemId: number, done: boolean) => {
	const response = await fetch(`/api/shopping-list-items/${itemId}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ done }),
	})
	const body = (await response.json()) as
		| ShoppingListItem
		| { error?: string }

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to update shoppinglist item")
				: "Failed to update shoppinglist item",
		)
	}
}

const attachShoppingListPageEvents = () => {
	document
		.getElementById("shopping-list-item-form")
		?.addEventListener("submit", async (event) => {
			event.preventDefault()

			const nameInput = getElementById("shopping-thing-name")

			if (!(nameInput instanceof HTMLInputElement)) {
				return
			}

			const name = nameInput.value.trim()
			if (!name) {
				setStatus(
					"shopping-list-item-status",
					"Thing name is required",
					true,
				)
				return
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
				})
				const body = (await response.json()) as
					| ShoppingListItem
					| { error?: string }

				if (!response.ok) {
					throw new Error(
						"error" in body
							? (body.error ??
								"Failed to add thing to shoppinglist")
							: "Failed to add thing to shoppinglist",
					)
				}

				setStatus(
					"shopping-list-item-status",
					`Added ${name} to shoppinglist.`,
				)
				nameInput.value = ""
				await loadShoppingListItems()
			} catch (error) {
				setStatus(
					"shopping-list-item-status",
					error instanceof Error
						? error.message
						: "Failed to add thing to shoppinglist",
					true,
				)
			}
		})

	document
		.getElementById("shoppinglist-show-done")
		?.addEventListener("change", () => {
			void loadShoppingListItems()
		})
}

export const renderShoppingListsPage = () => {
	const name = createElement("input", {
		id: "shopping-thing-name",
		properties: {
			name: "shopping-thing-name",
			placeholder: "Milk",
			autocomplete: "off",
			required: true,
		},
	})
	const form = createElement(
		"form",
		{ id: "shopping-list-item-form" },
		createElement(
			"div",
			{ className: "shoppinglist-input" },
			name,
			createElement(
				"button",
				{ className: "primary", properties: { type: "submit" } },
				"Add",
			),
		),
	)
	const showDone = createElement("input", {
		id: "shoppinglist-show-done",
		properties: { type: "checkbox" },
		attributes: { "aria-label": "Show done shoppinglist items" },
	})
	const page = createElement(
		"section",
		{ className: "workspace workspace--single" },
		createElement(
			"div",
			{ className: "card panel shoppinglist-create-panel" },
			form,
			createElement("div", {
				id: "shopping-list-item-status",
				className: "status",
			}),
		),
		createElement(
			"div",
			{ className: "card panel shoppinglist-results-panel" },
			createElement(
				"div",
				{ className: "section-header section-header--end" },
				createElement(
					"label",
					{
						className: "checkbox-toggle",
						properties: { htmlFor: "shoppinglist-show-done" },
					},
					showDone,
					createElement("span", {}, "Show done"),
				),
			),
			createElement("div", {
				id: "shopping-list-item-results",
				className: "results",
			}),
		),
	)
	withQueryRoot(page, attachShoppingListPageEvents)
	renderPage(page)

	void (async () => {
		try {
			await loadShoppingListItems()
		} catch (error) {
			renderShoppingListItems([])
			setStatus(
				"shopping-list-item-status",
				error instanceof Error
					? error.message
					: "Failed to initialize shoppinglist",
				true,
			)
		}
	})()
}
