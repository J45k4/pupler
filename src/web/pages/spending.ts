import {
	escapeHtml,
	formatMoney,
	formatReceiptDateTime,
	renderPage,
	setStatus,
} from "../app";

type SpendingCategoryTotal = {
	category: string;
	currency: string;
	total: number;
	item_count: number;
	missing_total_count: number;
	items: SpendingLineItem[];
};

type SpendingLineItem = {
	id: number;
	receipt_id: number;
	product_id: number | null;
	store_name: string;
	purchased_at: string;
	product_name: string;
	quantity: number;
	unit: string;
	unit_price: number | null;
	line_total: number | null;
	amount: number | null;
};

type SpendingProductGroup = {
	product_id: number | null;
	product_name: string;
	total: number | null;
	item_count: number;
	missing_total_count: number;
	items: SpendingLineItem[];
};

type SpendingCurrencyTotal = {
	currency: string;
	total: number;
};

type SpendingBreakdown = {
	period: {
		from: string | null;
		to: string;
		days: number | null;
		range: "days" | "all";
	};
	item_count: number;
	missing_total_count: number;
	currency_totals: SpendingCurrencyTotal[];
	categories: SpendingCategoryTotal[];
};

const SPENDING_RANGE_OPTIONS = [
	{ value: "7", label: "Last 7 Days" },
	{ value: "30", label: "Last 30 Days" },
	{ value: "90", label: "Last 90 Days" },
	{ value: "365", label: "Last 365 Days" },
	{ value: "all", label: "All Time" },
] as const;

type SpendingRangeOption = (typeof SPENDING_RANGE_OPTIONS)[number];

const DEFAULT_SPENDING_RANGE_VALUE = "30";

const getSpendingRangeOption = (
	value: string | null | undefined,
): SpendingRangeOption =>
	SPENDING_RANGE_OPTIONS.find((option) => option.value === value) ??
	SPENDING_RANGE_OPTIONS.find(
		(option) => option.value === DEFAULT_SPENDING_RANGE_VALUE,
	)!;

const getCurrentSpendingRangeOption = () =>
	getSpendingRangeOption(new URLSearchParams(window.location.search).get("span"));

const renderSpendingRangeOptions = (selectedValue: string) =>
	SPENDING_RANGE_OPTIONS.map(
		(option) => `
			<option value="${escapeHtml(option.value)}" ${
				option.value === selectedValue ? "selected" : ""
			}>
				${escapeHtml(option.label)}
			</option>
		`,
	).join("");

const spendingRangeStatusSuffix = (option: SpendingRangeOption) =>
	option.value === "all" ? "across all time" : `in the last ${option.value} days`;

const spendingRangeEmptyMessage = (option: SpendingRangeOption) =>
	option.value === "all"
		? "No receipt items recorded yet."
		: `No receipt items in the last ${option.value} days.`;

const attachSpendingBreakdownPageEvents = () => {
	const rangeSelect = document.getElementById("spending-range-select");
	if (!(rangeSelect instanceof HTMLSelectElement)) {
		return;
	}

	rangeSelect.addEventListener("change", () => {
		const selectedRange = getSpendingRangeOption(rangeSelect.value);
		rangeSelect.value = selectedRange.value;

		const url = new URL(window.location.href);
		if (selectedRange.value === DEFAULT_SPENDING_RANGE_VALUE) {
			url.searchParams.delete("span");
		} else {
			url.searchParams.set("span", selectedRange.value);
		}
		window.history.replaceState({}, "", `${url.pathname}${url.search}`);

		void loadSpendingBreakdownPage(selectedRange);
	});
};

const groupSpendingItemsByProduct = (
	items: SpendingLineItem[],
): SpendingProductGroup[] => {
	const groups = new Map<number, SpendingProductGroup>();
	const unlinkedItems: SpendingProductGroup[] = [];

	for (const item of items) {
		if (item.product_id === null) {
			unlinkedItems.push({
				product_id: null,
				product_name: item.product_name,
				total: item.amount,
				item_count: 1,
				missing_total_count: item.amount === null ? 1 : 0,
				items: [item],
			});
			continue;
		}

		let group = groups.get(item.product_id);
		if (!group) {
			group = {
				product_id: item.product_id,
				product_name: item.product_name,
				total: 0,
				item_count: 0,
				missing_total_count: 0,
				items: [],
			};
			groups.set(item.product_id, group);
		}

		group.item_count += 1;
		group.items.push(item);
		if (item.amount === null) {
			group.missing_total_count += 1;
		} else {
			group.total = Math.round(((group.total ?? 0) + item.amount) * 100) / 100;
		}
	}

	return [...groups.values(), ...unlinkedItems].sort((left, right) => {
		const leftTotal = left.total ?? -1;
		const rightTotal = right.total ?? -1;
		return rightTotal - leftTotal || left.product_name.localeCompare(right.product_name);
	});
};

const formatSpendingPeriod = (
	breakdown: SpendingBreakdown,
	option: SpendingRangeOption,
) => {
	if (breakdown.period.range === "all" || option.value === "all") {
		return `All receipts through ${formatReceiptDateTime(breakdown.period.to)}`;
	}
	if (breakdown.period.from === null) {
		return `Through ${formatReceiptDateTime(breakdown.period.to)}`;
	}
	return `${formatReceiptDateTime(breakdown.period.from)} - ${formatReceiptDateTime(breakdown.period.to)}`;
};

const renderSpendingBreakdown = (
	breakdown: SpendingBreakdown | null,
	option: SpendingRangeOption,
) => {
	const summaryRoot = document.getElementById("spending-breakdown-summary");
	const resultsRoot = document.getElementById("spending-breakdown-results");
	if (!summaryRoot || !resultsRoot) {
		return;
	}

	if (!breakdown || breakdown.item_count === 0) {
		summaryRoot.innerHTML = "";
		resultsRoot.innerHTML = `<div class="empty">${escapeHtml(
			spendingRangeEmptyMessage(option),
		)}</div>`;
		return;
	}

	summaryRoot.innerHTML = `
		<div class="spending-breakdown-summary">
			<div class="dashboard-spending-summary__metric">
				<span>Items</span>
				<strong>${breakdown.item_count}</strong>
			</div>
			${breakdown.currency_totals
				.map(
					(total) => `
						<div class="dashboard-spending-total">
							<span>${escapeHtml(total.currency)}</span>
							<strong>${formatMoney(total.total, total.currency)}</strong>
						</div>
					`,
				)
				.join("")}
		</div>
		<div class="section-copy">
			${formatSpendingPeriod(breakdown, option)}
			${
				breakdown.missing_total_count
					? `, ${breakdown.missing_total_count} item(s) without a line total or unit price`
					: ""
			}
		</div>
	`;

	const categoriesByCurrency = new Map<string, SpendingCategoryTotal[]>();
	for (const category of breakdown.categories) {
		categoriesByCurrency.set(category.currency, [
			...(categoriesByCurrency.get(category.currency) ?? []),
			category,
		]);
	}

	resultsRoot.innerHTML = [...categoriesByCurrency.entries()]
		.map(([currency, categories]) => {
			const maxTotal = Math.max(
				...categories.map((category) => category.total),
				1,
			);
			return `
				<section class="spending-breakdown-group">
					<div class="section-header section-header--inline">
						<h3>${escapeHtml(currency)}</h3>
					</div>
					<div class="spending-breakdown-list">
						${categories
							.map((category, index) => {
								const width = Math.max(
									3,
									Math.round((category.total / maxTotal) * 100),
								);
								const detailsId = `spending-${currency}-${category.category}-${index}`
									.replace(/[^a-z0-9_-]+/gi, "-")
									.toLowerCase();
								const productGroups = groupSpendingItemsByProduct(category.items);
								return `
									<details class="spending-breakdown-details">
										<summary class="spending-breakdown-row" aria-controls="${detailsId}">
											<div class="spending-breakdown-row__label">
												<strong>${escapeHtml(category.category)}</strong>
												<span>${category.item_count} item(s)${
													category.missing_total_count
														? `, ${category.missing_total_count} missing total`
														: ""
												}</span>
											</div>
											<div class="spending-breakdown-row__meter" aria-hidden="true">
												<div style="width: ${width}%"></div>
											</div>
											<strong class="spending-breakdown-row__total">
												${formatMoney(category.total, category.currency)}
											</strong>
										</summary>
										<div id="${detailsId}" class="spending-breakdown-items">
											${productGroups
												.map(
													(product) => `
														<a class="spending-breakdown-item" href="${product.product_id === null ? `/receipts/${product.items[0]?.receipt_id ?? ""}` : `/products/${product.product_id}`}" data-link>
															<div class="spending-breakdown-item__main">
																<strong>${escapeHtml(product.product_name)}</strong>
																<span>${product.item_count} purchase(s)${
																	product.missing_total_count
																		? `, ${product.missing_total_count} missing total`
																		: ""
																}</span>
															</div>
															<div class="spending-breakdown-item__meta">
																<span>${product.product_id === null ? "Receipt line" : "Product total"}</span>
																<strong>${formatMoney(product.total, category.currency)}</strong>
															</div>
														</a>
													`,
												)
												.join("")}
										</div>
									</details>
								`;
							})
							.join("")}
					</div>
				</section>
			`;
		})
		.join("");
};

const fetchSpendingBreakdown = async (option: SpendingRangeOption) => {
	const params =
		option.value === "all"
			? new URLSearchParams({ range: "all" })
			: new URLSearchParams({ days: option.value });
	const response = await fetch(`/api/spending?${params.toString()}`);
	const body = (await response.json()) as
		| SpendingBreakdown
		| { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to load spending breakdown")
				: "Failed to load spending breakdown",
		);
	}

	return body as SpendingBreakdown;
};

const loadSpendingBreakdownPage = async (
	option = getCurrentSpendingRangeOption(),
) => {
	const title = document.getElementById("spending-breakdown-title");
	if (title) {
		title.textContent = option.label;
	}
	setStatus("spending-breakdown-status", "Loading spending breakdown...");
	try {
		const breakdown = await fetchSpendingBreakdown(option);
		renderSpendingBreakdown(breakdown, option);
		setStatus(
			"spending-breakdown-status",
			breakdown.item_count
				? `${breakdown.item_count} receipt item(s) ${spendingRangeStatusSuffix(option)}.`
				: spendingRangeEmptyMessage(option),
		);
	} catch (error) {
		renderSpendingBreakdown(null, option);
		setStatus(
			"spending-breakdown-status",
			error instanceof Error
				? error.message
				: "Failed to load spending breakdown.",
			true,
		);
	}
};

export const renderSpendingPage = () => {
	const selectedRange = getCurrentSpendingRangeOption();

	renderPage(
		`
			<section class="page-heading page-heading--compact">
				<div>
					<span class="eyebrow">Spending</span>
					<h1 class="page-title">Cost Breakdown</h1>
				</div>
				<a class="secondary action-link" href="/" data-link>Back To Overview</a>
			</section>

			<section class="workspace workspace--single">
				<div class="card panel spending-breakdown-panel">
					<div class="section-header">
						<h2 id="spending-breakdown-title">${escapeHtml(selectedRange.label)}</h2>
						<div class="spending-breakdown-controls">
							<label for="spending-range-select">
								<span>Time span</span>
								<select id="spending-range-select">
									${renderSpendingRangeOptions(selectedRange.value)}
								</select>
							</label>
							<a class="secondary action-link" href="/receipts" data-link>Receipts</a>
						</div>
					</div>
					<div id="spending-breakdown-summary"></div>
					<div id="spending-breakdown-results"></div>
					<div id="spending-breakdown-status" class="status"></div>
				</div>
			</section>
		`,
	);

	attachSpendingBreakdownPageEvents();
	void loadSpendingBreakdownPage(selectedRange);
};
