import {
	createInventoryItemNodeLink,
	deleteInventoryContainer,
	fetchInventoryContainer,
	fetchInventoryContainers,
	fetchInventoryItemsByContainer,
	navigate,
	renderPage,
	setStatus,
	updateInventoryContainer,
} from "../app"
import {
	createElement,
	createEmptyState,
	createPageMessage,
	getElementById,
	withQueryRoot,
} from "../lib/dom"

export const renderInventoryContainerDetailPage = async (
	params: Record<string, string>,
) => {
	const containerId = Number.parseInt(params.id ?? "", 10)
	const page = createElement("div", { id: "inventory-container-detail-page" })
	if (!Number.isInteger(containerId)) {
		page.append(createPageMessage("Container id is invalid."))
		renderPage(page)
		return
	}

	try {
		const [container, containers, items] = await Promise.all([
			fetchInventoryContainer(containerId),
			fetchInventoryContainers(),
			fetchInventoryItemsByContainer(containerId),
		])
		const children = containers
			.filter(
				(candidate) => candidate.parent_container_id === containerId,
			)
			.sort((left, right) => left.name.localeCompare(right.name))
		const descendants = new Set<number>([containerId])
		let foundDescendant = true
		while (foundDescendant) {
			foundDescendant = false
			for (const candidate of containers) {
				if (
					candidate.parent_container_id !== null &&
					descendants.has(candidate.parent_container_id) &&
					!descendants.has(candidate.id)
				) {
					descendants.add(candidate.id)
					foundDescendant = true
				}
			}
		}

		const parentOptions = containers
			.filter((candidate) => !descendants.has(candidate.id))
			.sort((left, right) => left.name.localeCompare(right.name))

		withQueryRoot(page, () => {
			const parentSelect = createElement(
				"select",
				{
					id: "inventory-container-detail-parent",
					properties: { name: "parent_container_id" },
				},
				createElement(
					"option",
					{ properties: { value: "" } },
					"Top level",
				),
			)
			const detailForm = createElement(
				"form",
				{ id: "inventory-container-detail-form" },
				createElement(
					"label",
					{},
					"Name",
					createElement("input", {
						id: "inventory-container-detail-name",
						properties: { name: "name", required: true },
					}),
				),
				createElement("label", {}, "Inside", parentSelect),
				createElement(
					"label",
					{},
					"Notes",
					createElement("input", {
						id: "inventory-container-detail-notes",
						properties: {
							name: "notes",
							placeholder: "Pantry shelf or freezer drawer",
						},
					}),
				),
				createElement(
					"div",
					{ className: "actions" },
					createElement(
						"button",
						{
							className: "primary",
							properties: { type: "submit" },
						},
						"Save",
					),
					createElement(
						"button",
						{
							id: "inventory-container-detail-delete",
							className: "secondary",
							properties: { type: "button" },
						},
						"Delete",
					),
				),
			)
			const back = createElement(
				"a",
				{
					className: "secondary action-link",
					properties: { href: "/inventory" },
					attributes: { "data-link": "" },
				},
				"Back To Inventory",
			)
			page.replaceChildren(
				createElement(
					"section",
					{ className: "page-heading page-heading--compact" },
					back,
				),
				createElement(
					"section",
					{ className: "workspace" },
					createElement(
						"div",
						{ className: "card panel" },
						createElement("h2", {}, "Container Details"),
						detailForm,
						createElement("div", {
							id: "inventory-container-detail-status",
							className: "status",
						}),
					),
					createElement(
						"div",
						{ className: "card panel" },
						createElement("h2", {}, "Contents"),
						createElement(
							"div",
							{ className: "results" },
							createElement(
								"div",
								{ className: "inventory-detail-block" },
								createElement("h3", {}, "Child Containers"),
								createElement("div", {
									id: "inventory-container-detail-children",
								}),
							),
							createElement(
								"div",
								{ className: "inventory-detail-block" },
								createElement("h3", {}, "Active Items"),
								createElement("div", {
									id: "inventory-container-detail-items",
								}),
							),
						),
					),
				),
			)
			const nameInput = getElementById("inventory-container-detail-name")
			const parentInput = getElementById(
				"inventory-container-detail-parent",
			)
			const notesInput = getElementById(
				"inventory-container-detail-notes",
			)
			if (nameInput instanceof HTMLInputElement)
				nameInput.value = container.name
			if (notesInput instanceof HTMLInputElement)
				notesInput.value = container.notes ?? ""
			if (parentInput instanceof HTMLSelectElement) {
				for (const candidate of parentOptions) {
					const option = document.createElement("option")
					option.value = String(candidate.id)
					option.textContent = candidate.name
					parentInput.append(option)
				}
				parentInput.value = String(container.parent_container_id ?? "")
			}
			const childResults = getElementById(
				"inventory-container-detail-children",
			)
			if (childResults) {
				if (!children.length) {
					childResults.replaceChildren(
						createEmptyState("No child containers."),
					)
				} else {
					const list = createElement("div", {
						className: "inventory-detail-list",
					})
					for (const child of children) {
						const link = createElement(
							"a",
							{ className: "receipt-card" },
							createElement(
								"div",
								{ className: "receipt-card__header" },
								createElement("h3", { text: child.name }),
							),
							createElement("div", {
								className: "section-copy",
								text: child.notes ?? "No notes",
							}),
						)
						link.href = `/inventory/containers/${child.id}`
						link.dataset.link = ""
						list.append(link)
					}
					childResults.replaceChildren(list)
				}
			}
			const itemResults = getElementById(
				"inventory-container-detail-items",
			)
			if (itemResults) {
				itemResults.replaceChildren(
					items.length
						? createElement(
								"div",
								{ className: "inventory-detail-list" },
								items.map((item) =>
									createInventoryItemNodeLink(item),
								),
							)
						: createEmptyState(
								"No active items in this container.",
							),
				)
			}

			const form = getElementById("inventory-container-detail-form")
			const deleteButton = getElementById(
				"inventory-container-detail-delete",
			)

			form?.addEventListener("submit", async (event) => {
				event.preventDefault()
				const nameInput = getElementById(
					"inventory-container-detail-name",
				)
				const parentInput = getElementById(
					"inventory-container-detail-parent",
				)
				const notesInput = getElementById(
					"inventory-container-detail-notes",
				)

				if (
					!(nameInput instanceof HTMLInputElement) ||
					!(parentInput instanceof HTMLSelectElement) ||
					!(notesInput instanceof HTMLInputElement)
				) {
					return
				}

				try {
					const updated = await updateInventoryContainer(
						containerId,
						{
							name: nameInput.value.trim(),
							parent_container_id: parentInput.value
								? Number(parentInput.value)
								: null,
							notes: notesInput.value.trim() || null,
						},
					)
					setStatus(
						"inventory-container-detail-status",
						`Saved ${updated.name}.`,
					)
				} catch (error) {
					setStatus(
						"inventory-container-detail-status",
						error instanceof Error
							? error.message
							: "Failed to save container.",
						true,
					)
				}
			})

			deleteButton?.addEventListener("click", async () => {
				const confirmed = window.confirm(
					`Delete ${container.name}? Child containers and inventory items will be unassigned.`,
				)
				if (!confirmed) {
					return
				}

				try {
					await deleteInventoryContainer(containerId)
					navigate("/inventory")
				} catch (error) {
					setStatus(
						"inventory-container-detail-status",
						error instanceof Error
							? error.message
							: "Failed to delete container.",
						true,
					)
				}
			})
		})
	} catch (error) {
		page.append(
			createPageMessage(
				error instanceof Error
					? error.message
					: "Failed to load inventory container.",
			),
		)
	}
	renderPage(page)
}
