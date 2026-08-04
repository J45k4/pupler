import {
	attachReceiptsPageEvents,
	attachUploadDropzones,
	createUploadDropzone,
	getDefaultReceiptViewMode,
	loadReceipts,
	receiptViewModeOverride,
	renderPage,
} from "../app";
import { createModal } from "../ui/modal";
import { createElement, withQueryRoot } from "../lib/dom";

export const renderReceiptsPage = () => {
	const defaultPurchasedAt = new Date(
		Date.now() - new Date().getTimezoneOffset() * 60000,
	)
		.toISOString()
		.slice(0, 16);
	const initialReceiptViewMode =
		receiptViewModeOverride ?? getDefaultReceiptViewMode();

	const page = document.createDocumentFragment();
	const groupFilter = createElement("select", { id: "receipt-group-filter", className: "toolbar__select", attributes: { "aria-label": "Receipt group filter" } }, createElement("option", { properties: { value: "all" } }, "All groups"), createElement("option", { properties: { value: "ungrouped" } }, "Ungrouped"));
	const chronological = createElement("input", { id: "receipt-chronological-view", properties: { type: "checkbox", checked: initialReceiptViewMode === "chronological" } });
	const receiptForm = createElement("form", { id: "receipt-form" },
		createElement("label", {}, "Store Name", createElement("input", { id: "receipt-store-name", properties: { name: "receipt-store-name", placeholder: "K-Market", required: true } })),
		createElement("label", {}, "Purchased At", createElement("input", { id: "receipt-purchased-at", properties: { type: "datetime-local", value: defaultPurchasedAt, required: true } })),
		createElement("div", { className: "row" },
			createElement("label", {}, "Currency", createElement("input", { id: "receipt-currency", properties: { value: "EUR", maxLength: 3, required: true } })),
			createElement("label", {}, "Total Amount", createElement("input", { id: "receipt-total-amount", properties: { type: "number", step: "0.01", min: "0", placeholder: "23.40" } })),
		),
		createElement("label", {}, "Group", createElement("input", { id: "receipt-group-name", properties: { placeholder: "grocery" }, attributes: { list: "receipt-group-options" } }), createElement("datalist", { id: "receipt-group-options" })),
		createUploadDropzone({ inputId: "receipt-picture", label: "Receipt Picture", emptyText: "Choose a receipt image or drop one here." }),
		createElement("div", { className: "actions" }, createElement("button", { className: "primary", properties: { type: "submit" } }, "Create Receipt"), createElement("button", { className: "secondary", properties: { type: "button" }, attributes: { "data-receipt-create-modal-close": "" } }, "Cancel")),
	);
	const groupForm = createElement("form", { id: "group-create-form" },
		createElement("label", {}, "Group Name", createElement("input", { id: "group-create-name", properties: { name: "group-name", placeholder: "grocery", required: true } })),
		createElement("div", { className: "actions" }, createElement("button", { className: "primary", properties: { type: "submit" } }, "Create Group"), createElement("button", { className: "secondary", properties: { type: "button" }, attributes: { "data-group-create-modal-close": "" } }, "Cancel")),
	);
	page.append(
		createElement("section", { className: "receipts-page" },
			createElement("div", { className: "receipts-page__controls" },
				createElement("div", { className: "toolbar toolbar--wrap receipts-page__filters" }, groupFilter, createElement("label", { className: "checkbox-toggle receipt-view-toggle" }, chronological, "Chronological view")),
				createElement("div", { className: "actions receipts-page__actions" }, createElement("button", { id: "receipt-refresh-button", className: "secondary", properties: { type: "button" } }, "Refresh"), createElement("button", { id: "open-group-modal-button", className: "secondary", properties: { type: "button" } }, "New group"), createElement("button", { id: "open-receipt-modal-button", className: "primary", properties: { type: "button" } }, "Add Receipt")),
			),
			createElement("div", { id: "receipt-status", className: "status" }), createElement("div", { id: "receipt-results", className: "results" }),
		),
		createModal({
				id: "receipt-create-modal",
				title: "Create Receipt",
				titleId: "receipt-create-modal-title",
				closeDataAttribute: "data-receipt-create-modal-close",
				className: "receipt-create-modal",
				children: [receiptForm, createElement("div", { id: "receipt-create-status", className: "status" })],
			}),
		createModal({
				id: "group-create-modal",
				title: "New Group",
				titleId: "group-create-modal-title",
				closeDataAttribute: "data-group-create-modal-close",
				className: "receipt-create-modal",
				children: [groupForm, createElement("div", { id: "group-create-status", className: "status" })],
			}),
	);
	attachUploadDropzones(page);
	withQueryRoot(page, attachReceiptsPageEvents);
	renderPage(page);
	void loadReceipts();
};
