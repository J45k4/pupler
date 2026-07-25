import {
	escapeHtml,
	formatMoney,
	renderPage,
	setStatus,
} from "../app";

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
		.map((item) => `${formatQuantity(item.quantity)} ${escapeHtml(item.unit)}`)
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
	return `
		<button
			class="product-stats-sort${isActive ? " product-stats-sort--active" : ""}"
			type="button"
			data-product-stats-sort="${key}"
			aria-label="Sort by ${escapeHtml(label)}"
		>
			<span>${escapeHtml(label)}</span>
			<span class="product-stats-sort__marker" aria-hidden="true">${marker}</span>
		</button>
	`;
};

const renderProductStatsRows = () => {
	const results = document.getElementById("product-stats-results");
	if (!results) {
		return;
	}

	if (!productStatsRows.length) {
		results.innerHTML = '<div class="empty">No products yet.</div>';
		return;
	}

	const rows = [...productStatsRows].sort(compareProductStatsRows);
	results.innerHTML = `
		<table class="shoppinglist-table product-stats-table">
			<thead>
				<tr>
					${productStatsColumns
						.map(
							(column) => `
								<th scope="col">
									${renderProductStatsSortButton(column.key, column.label)}
								</th>
							`,
						)
						.join("")}
				</tr>
			</thead>
			<tbody>
				${rows
					.map(
						(row) => `
							<tr>
								<td>
									<a href="/products/${row.product_id}" data-link>${escapeHtml(row.product_name)}</a>
									</td>
									<td>${escapeHtml(row.category)}</td>
									<td>${row.bought_count}</td>
									<td>${escapeHtml(formatMoneyTotals(row.total_costs))}</td>
									<td>${row.used_count}</td>
									<td>${formatUnitQuantities(row.used_quantities)}</td>
							</tr>
						`,
					)
					.join("")}
			</tbody>
		</table>
	`;
};

const attachProductStatsEvents = () => {
	document
		.getElementById("product-stats-results")
		?.addEventListener("click", (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) {
				return;
			}
			const button = target.closest<HTMLButtonElement>("[data-product-stats-sort]");
			if (!button) {
				return;
			}

			const nextKey = button.dataset.productStatsSort as ProductStatsSortKey;
			if (productStatsSortKey === nextKey) {
				productStatsSortDirection =
					productStatsSortDirection === "asc" ? "desc" : "asc";
			} else {
				productStatsSortKey = nextKey;
				productStatsSortDirection =
					nextKey === "product_name" || nextKey === "category"
						? "asc"
						: "desc";
			}

			renderProductStatsRows();
		});
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
	renderPage(`
		<section class="workspace workspace--single">
			<div class="card panel">
				<div class="section-header">
					<div>
						<h2>Product Stats</h2>
					</div>
					<a class="secondary action-link" href="/products" data-link>Products</a>
				</div>
				<div id="product-stats-status" class="status"></div>
				<div id="product-stats-results" class="results"></div>
			</div>
		</section>
	`);

	attachProductStatsEvents();
	void loadProductStats();
};
