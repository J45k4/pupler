import {
	attachInventoryPageEvents,
	loadInventoryPageData,
	renderPage,
} from "../app";
import { createModal } from "../ui/modal";
import { createElement, withQueryRoot } from "../lib/dom";

export const renderInventoryPage = () => {
	const page = document.createDocumentFragment();
	const containerForm = createElement("form", { id: "inventory-container-modal-form" },
		createElement("label", {}, "Name", createElement("input", { id: "inventory-container-name", properties: { name: "name", placeholder: "Room X", required: true } })),
		createElement("label", {}, "Notes", createElement("input", { id: "inventory-container-notes", properties: { name: "notes", placeholder: "Pantry shelf or freezer drawer" } })),
		createElement("div", { className: "actions" }, createElement("button", { className: "primary", properties: { type: "submit" } }, "Add Container")),
	);
	const consumeForm = createElement("form", { id: "inventory-consume-form" },
		createElement("div", { id: "inventory-consume-item-name", className: "inventory-consume-target" }),
		createElement("label", {}, "Consumed At", createElement("input", { id: "inventory-consume-date", properties: { name: "consumed_at", type: "datetime-local" } })),
		createElement("div", { className: "actions" },
			createElement("button", { className: "primary", properties: { type: "submit" } }, "Consume"),
			createElement("button", { className: "secondary", properties: { type: "button" }, attributes: { "data-close-inventory-consume-modal": "" } }, "Cancel"),
		),
	);
	page.append(
		createElement("section", { className: "inventory-page" }, createElement("div", { id: "inventory-tree-root" })),
		createModal({
				id: "inventory-container-modal",
				title: "Add Container",
				ariaLabel: "Create inventory container",
				closeDataAttribute: "data-close-inventory-container-modal",
				headerClassName: "section-header--end",
				className: "inventory-container-modal",
				children: containerForm,
			}),
			createModal({
				id: "inventory-consume-modal",
				title: "Consume Item",
				ariaLabel: "Consume inventory item",
				closeDataAttribute: "data-close-inventory-consume-modal",
				headerClassName: "section-header--end",
				className: "inventory-container-modal",
				children: [consumeForm, createElement("div", { id: "inventory-consume-status", className: "status" })],
			}),
	);
	withQueryRoot(page, attachInventoryPageEvents);
	renderPage(page);
	void loadInventoryPageData();
};
