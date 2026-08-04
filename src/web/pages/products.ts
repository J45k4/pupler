import {
	attachProductPageEvents,
	attachUploadDropzones,
	createProductCategoryInput,
	createUnitSelect,
	createUploadDropzone,
	loadProducts,
	renderPage,
} from "../app";
import { createModal } from "../ui/modal";
import { createElement, withQueryRoot } from "../lib/dom";

export const renderProductsPage = () => {
	const page = document.createDocumentFragment();
	const searchType = createElement("select", { id: "product-search-type", className: "toolbar__select", attributes: { "aria-label": "Product search type" } },
		...[ ["auto", "Auto"], ["barcode", "Barcode"], ["name", "Name"], ["includes", "Includes"] ].map(([value, label]) => createElement("option", { properties: { value } }, label)),
	);
	const stats = createElement("a", { className: "secondary action-link", properties: { href: "/products/stats" }, attributes: { "data-link": "" } }, "Stats");
	const perishable = createElement("select", { id: "is_perishable", properties: { name: "is_perishable" } }, createElement("option", { properties: { value: "true" } }, "true"), createElement("option", { properties: { value: "false" } }, "false"));
	const productForm = createElement("form", { id: "product-form" },
		createElement("label", {}, "Name", createElement("input", { id: "name", properties: { name: "name", placeholder: "Milk", required: true } })),
		createElement("div", { className: "row" },
			createProductCategoryInput({ id: "category", name: "category", label: "Category", required: true }),
			createUnitSelect({ id: "default_unit", name: "default_unit", label: "Unit", selectedValue: null, placeholderLabel: "No default unit" }),
		),
		createElement("label", {}, "Barcode", createElement("input", { id: "barcode", properties: { name: "barcode", placeholder: "6414893400012" } })),
		createElement("label", {}, "Ingredient", createElement("input", { id: "ingredient_name", properties: { name: "ingredient_name", placeholder: "Sausage" } })),
		createUploadDropzone({ inputId: "picture", label: "Picture", name: "picture", emptyText: "Choose a product image or drop one here." }),
		createElement("label", {}, "Perishable", perishable),
		createElement("div", { className: "actions" }, createElement("button", { className: "primary", properties: { type: "submit" } }, "Create Product")),
	);
	page.append(
		createElement("section", { className: "workspace workspace--single" }, createElement("div", { className: "card panel" },
			createElement("h2", {}, "Product Lookup"),
			createElement("div", { className: "toolbar" }, searchType, createElement("input", { id: "barcode-filter", properties: { placeholder: "Scan barcode or type product name" } }), createElement("button", { id: "filter-button", className: "secondary", properties: { type: "button" } }, "Find"), stats, createElement("button", { id: "open-product-modal-button", className: "primary", properties: { type: "button" } }, "Add")),
			createElement("div", { id: "status", className: "status" }), createElement("div", { id: "results", className: "results" }),
		)),
		createModal({
				id: "product-create-modal",
				title: "Create Product",
				ariaLabel: "Create product",
				closeDataAttribute: "data-product-modal-close",
				headerClassName: "section-header--end",
				className: "product-create-modal",
				children: [productForm, createElement("div", { id: "product-modal-status", className: "status" })],
			}),
	);
	attachUploadDropzones(page);
	withQueryRoot(page, attachProductPageEvents);
	renderPage(page);
	void loadProducts();
};
