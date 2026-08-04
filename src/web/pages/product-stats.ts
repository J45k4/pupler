import {
	formatMoney,
	renderPage,
	setStatus,
} from "../app";
import { createElement, createEmptyState } from "../lib/dom";

type UnitQuantity = {
	unit: string;
	quantity: number;
};

type MoneyTotal = {
	currency: string;
	total: number;
};

type ProductStatsRow = {
	product_id: number;
	product_name: string;
	category: string;
	default_unit: string | null;
	bought_count: number;
	bought_quantities: UnitQuantity[];
	total_costs: MoneyTotal[];
	total_cost_sort: number;
	used_count: number;
	used_quantities: UnitQuantity[];
	used_sort_quantity: number;
};

type ProductStatsSortKey =
	| "product_name"
	| "category"
	| "bought_count"
	| "total_cost_sort"
	| "used_count"
	| "used_sort_quantity";
type ProductStatsSortDirection = "asc" | "desc";

let productStatsRows: ProductStatsRow[] = [];
let productStatsSortKey: ProductStatsSortKey = "bought_count";
let productStatsSortDirection: ProductStatsSortDirection = "desc";

const productStatsColumns: Array<{
	key: ProductStatsSortKey;
	label: string;
}> = [
	{ key: "product_name", label: "Product" },
	{ key: "category", label: "Category" },
	{ key: "bought_count", label: "Times Bought" },
	{ key: "total_cost_sort", label: "Total Cost" },
	{ key: "used_count", label: "Used Entries" },
	{ key: "used_sort_quantity", label: "Used Amount" },
];

const formatQuantity = (value: number) =>
	Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");

const formatUnitQuantities = (quantities: UnitQuantity[]) => {
	if (!quantities.length) {
		return "-";
	}
	return quantities
		.map((item) => `${formatQuantity(item.quantity)} ${item.unit}`)
		.join(", ");
};

const formatMoneyTotals = (totals: MoneyTotal[]) => {
	if (!totals.length) {
		return "-";
	}
	return totals
		.map((item) => formatMoney(item.total, item.currency))
		.join(", ");
};

const compareProductStatsRows = (
	left: ProductStatsRow,
	right: ProductStatsRow,
) => {
	const multiplier = productStatsSortDirection === "asc" ? 1 : -1;
	const leftValue = left[productStatsSortKey];
	const rightValue = right[productStatsSortKey];

	if (typeof leftValue === "number" && typeof rightValue === "number") {
		return (
			(leftValue - rightValue) * multiplier ||
			left.product_name.localeCompare(right.product_name)
		);
	}

	return (
		String(leftValue).localeCompare(String(rightValue)) * multiplier ||
		left.product_name.localeCompare(right.product_name)
	);
};

const renderProductStatsSortButton = (
	key: ProductStatsSortKey,
	label: string,
) => {
	const isActive = productStatsSortKey === key;
	const marker = isActive
		? productStatsSortDirection === "asc"
			? "^"
			: "v"
		: "";
	const button = createElement(
		"button",
		{
			className: `product-stats-sort${isActive ? " product-stats-sort--active" : ""}`,
		},
		createElement("span", { text: label }),
		createElement("span", {
			className: "product-stats-sort__marker",
			text: marker,
		}),
	);
	button.type = "button";
	button.setAttribute("aria-label", `Sort by ${label}`);
	button.addEventListener("click", () => {
		if (productStatsSortKey === key) {
			productStatsSortDirection = productStatsSortDirection === "asc" ? "desc" : "asc";
		} else {
			productStatsSortKey = key;
			productStatsSortDirection =
				key === "product_name" || key === "category" ? "asc" : "desc";
		}
		renderProductStatsRows();
	});
	return button;
};

const renderProductStatsRows = () => {
	const results = document.getElementById("product-stats-results");
	if (!results) {
		return;
	}

	if (!productStatsRows.length) {
		results.replaceChildren(createEmptyState("No products yet."));
		return;
	}

	const rows = [...productStatsRows].sort(compareProductStatsRows);
	const table = createElement("table", {
		className: "shoppinglist-table product-stats-table",
	});
	const headerRow = document.createElement("tr");
	for (const column of productStatsColumns) {
		const cell = createElement(
			"th",
			{},
			renderProductStatsSortButton(column.key, column.label),
		);
		cell.scope = "col";
		headerRow.append(cell);
	}
	const head = document.createElement("thead");
	head.append(headerRow);
	const body = document.createElement("tbody");
	for (const row of rows) {
		const link = createElement("a", { text: row.product_name });
		link.href = `/products/${row.product_id}`;
		link.dataset.link = "";
		const tableRow = document.createElement("tr");
		tableRow.append(
			createElement("td", {}, link),
			createElement("td", { text: row.category }),
			createElement("td", { text: String(row.bought_count) }),
			createElement("td", { text: formatMoneyTotals(row.total_costs) }),
			createElement("td", { text: String(row.used_count) }),
			createElement("td", { text: formatUnitQuantities(row.used_quantities) }),
		);
		body.append(tableRow);
	}
	table.append(head, body);
	results.replaceChildren(table);
};

const loadProductStats = async () => {
	setStatus("product-stats-status", "Loading product stats...");
	try {
		const response = await fetch("/api/product-stats");
		if (!response.ok) {
			throw new Error("Failed to load product stats.");
		}
		productStatsRows = (await response.json()) as ProductStatsRow[];
		renderProductStatsRows();
		setStatus(
			"product-stats-status",
			`${productStatsRows.length} products loaded.`,
		);
	} catch (error) {
		productStatsRows = [];
		renderProductStatsRows();
		setStatus(
			"product-stats-status",
			error instanceof Error ? error.message : "Failed to load product stats.",
			true,
		);
	}
};

export const renderProductStatsPage = () => {
	const productsLink = createElement("a", { className: "secondary action-link", properties: { href: "/products" }, attributes: { "data-link": "" } }, "Products");
	renderPage(createElement("section", { className: "workspace workspace--single" },
		createElement("div", { className: "card panel" },
			createElement("div", { className: "section-header" }, createElement("div", {}, createElement("h2", {}, "Product Stats")), productsLink),
			createElement("div", { id: "product-stats-status", className: "status" }),
			createElement("div", { id: "product-stats-results", className: "results" }),
		),
	));

	void loadProductStats();
};
