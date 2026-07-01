import {
	escapeHtml,
	formatMoney,
	formatReceiptDateTime,
	loadDashboardSpendingSummary,
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

type SpendingAverageTotal = SpendingCurrencyTotal & {
	day_count: number;
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
	monthly_average_totals: SpendingAverageTotal[];
	weekly_average_totals: SpendingAverageTotal[];
	daily_average_totals: SpendingAverageTotal[];
	current_month_totals: SpendingCurrencyTotal[];
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

const allTimeSpendingRangeOption = () => getSpendingRangeOption("all");

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

const flattenSpendingItems = (breakdown: SpendingBreakdown) =>
	breakdown.categories
		.flatMap((category) =>
			category.items.map((item) => ({
				...item,
				currency: category.currency,
				category: category.category,
			})),
		)
		.sort(
			(left, right) =>
				Date.parse(right.purchased_at) - Date.parse(left.purchased_at) ||
				left.id - right.id,
		);

const spendingMonthParts = (purchasedAt: string) => {
	const date = new Date(purchasedAt);
	if (Number.isNaN(date.getTime())) {
		return null;
	}
	return {
		year: date.getFullYear(),
		month: date.getMonth(),
	};
};

const formatSpendingMonth = (month: number) =>
	new Intl.DateTimeFormat(undefined, {
		month: "short",
	}).format(new Date(2000, month, 1));

const niceChartMax = (value: number) => {
	if (value <= 0) {
		return 1;
	}
	const magnitude = 10 ** Math.floor(Math.log10(value));
	const normalized = value / magnitude;
	const nice =
		normalized <= 1
			? 1
			: normalized <= 2.5
				? 2.5
				: normalized <= 5
					? 5
					: normalized <= 7.5
						? 7.5
						: 10;
	return nice * magnitude;
};

const formatChartAxisValue = (value: number, currency: string) => {
	const suffix = currency === "EUR" ? "€" : currency;
	if (value === 0) {
		return `0.00 ${suffix}`;
	}
	if (value >= 1000) {
		const thousands = value / 1000;
		return `${Number.isInteger(thousands) ? thousands.toFixed(0) : thousands.toFixed(1)}k ${suffix}`;
	}
	return `${Math.round(value)} ${suffix}`;
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
	const periodRoot = document.getElementById("spending-breakdown-period");
	const resultsRoot = document.getElementById("spending-breakdown-results");
	if (!summaryRoot || !periodRoot || !resultsRoot) {
		return;
	}

	if (!breakdown || breakdown.item_count === 0) {
		summaryRoot.innerHTML = "";
		periodRoot.innerHTML = "";
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
	`;
	periodRoot.innerHTML = `
		${formatSpendingPeriod(breakdown, option)}
		${
			breakdown.missing_total_count
				? `, ${breakdown.missing_total_count} item(s) without a line total or unit price`
				: ""
		}
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

const renderMonthlySpendingChart = (breakdown: SpendingBreakdown | null) => {
	const root = document.getElementById("spending-monthly-chart");
	if (!root) {
		return;
	}
	if (!breakdown || breakdown.item_count === 0) {
		root.innerHTML = '<div class="empty">No receipt items recorded yet.</div>';
		return;
	}

	const now = new Date();
	const currentYear = now.getFullYear();
	const previousYear = currentYear - 1;
	const months = Array.from({ length: 12 }, (_, index) => index);
	const monthTotalsByCurrency = new Map<string, Map<string, number>>();

	for (const item of flattenSpendingItems(breakdown)) {
		const parts = spendingMonthParts(item.purchased_at);
		if (!parts || item.amount === null) {
			continue;
		}
		if (parts.year !== currentYear && parts.year !== previousYear) {
			continue;
		}
		let monthTotals = monthTotalsByCurrency.get(item.currency);
		if (!monthTotals) {
			monthTotals = new Map();
			monthTotalsByCurrency.set(item.currency, monthTotals);
		}
		const key = `${parts.year}-${parts.month}`;
		monthTotals.set(
			key,
			Math.round(((monthTotals.get(key) ?? 0) + item.amount) * 100) / 100,
		);
	}

	const currencyGroups = [...monthTotalsByCurrency.entries()]
		.map(([currency, monthTotals]) => ({
			currency,
			months: months.map((month) => ({
				month,
				current_total: monthTotals.get(`${currentYear}-${month}`) ?? 0,
				previous_total: monthTotals.get(`${previousYear}-${month}`) ?? 0,
			})),
		}))
		.filter((group) =>
			group.months.some(
				(month) => month.current_total > 0 || month.previous_total > 0,
			),
		)
		.sort((left, right) => left.currency.localeCompare(right.currency));

	root.innerHTML = currencyGroups.length
		? currencyGroups
				.map((group) => {
					const monthlyAverage =
						breakdown.monthly_average_totals.find(
							(total) => total.currency === group.currency,
						)?.total ?? 0;
					const chartMax = niceChartMax(
						Math.max(
							...group.months.flatMap((month) => [
								month.current_total,
								month.previous_total,
							]),
							monthlyAverage,
							1,
						),
					);
					const averageLinePosition =
						monthlyAverage > 0
							? Math.min(
									100,
									Math.round((monthlyAverage / chartMax) * 10000) / 100,
								)
							: 0;
					const ticks = [chartMax, chartMax * 0.75, chartMax * 0.5, chartMax * 0.25, 0];
					return `
						<section class="spending-monthly-group">
							<div class="spending-monthly-legend">
								<span><i class="spending-monthly-legend__swatch spending-monthly-legend__swatch--previous"></i>${previousYear}</span>
								<span><i class="spending-monthly-legend__swatch spending-monthly-legend__swatch--current"></i>${currentYear}</span>
								${
									monthlyAverage > 0
										? `<span><i class="spending-monthly-legend__swatch spending-monthly-legend__swatch--average"></i>Avg ${escapeHtml(formatMoney(monthlyAverage, group.currency))}</span>`
										: ""
								}
							</div>
							<div class="spending-monthly-plot">
								<div class="spending-monthly-axis" aria-hidden="true">
									${ticks
										.map(
											(tick) =>
												`<span>${escapeHtml(formatChartAxisValue(tick, group.currency))}</span>`,
										)
										.join("")}
								</div>
								<div class="spending-monthly-chart">
									<div class="spending-monthly-gridlines" aria-hidden="true">
										${ticks.map(() => "<span></span>").join("")}
									</div>
									${
										monthlyAverage > 0
											? `
												<div class="spending-monthly-average" aria-hidden="true">
													<span class="spending-monthly-average__line" style="bottom: ${averageLinePosition}%"></span>
													<span class="spending-monthly-average__label" style="bottom: ${averageLinePosition}%">${escapeHtml(formatMoney(monthlyAverage, group.currency))}</span>
												</div>
											`
											: ""
									}
									<div class="spending-monthly-columns">
										${group.months
											.map((month) => {
												const previousHeight =
													month.previous_total > 0
														? Math.max(
																2,
																Math.round((month.previous_total / chartMax) * 100),
															)
														: 0;
												const currentHeight =
													month.current_total > 0
														? Math.max(
																2,
																Math.round((month.current_total / chartMax) * 100),
															)
														: 0;
												return `
													<div class="spending-monthly-column">
														<div class="spending-monthly-column__bars">
															<div class="spending-monthly-bar spending-monthly-bar--previous" title="${previousYear}: ${escapeHtml(formatMoney(month.previous_total, group.currency))}" style="height: ${previousHeight}%"></div>
															<div class="spending-monthly-bar spending-monthly-bar--current" title="${currentYear}: ${escapeHtml(formatMoney(month.current_total, group.currency))}" style="height: ${currentHeight}%"></div>
														</div>
														<span>${escapeHtml(formatSpendingMonth(month.month))}</span>
													</div>
												`;
											})
											.join("")}
									</div>
								</div>
							</div>
						</section>
					`;
				})
				.join("")
		: '<div class="empty">No monthly totals recorded yet.</div>';
};

const renderLastSpendingItems = (breakdown: SpendingBreakdown | null) => {
	const root = document.getElementById("spending-items-results");
	if (!root) {
		return;
	}
	if (!breakdown || breakdown.item_count === 0) {
		root.innerHTML = '<div class="empty">No receipt items recorded yet.</div>';
		return;
	}

	const items = flattenSpendingItems(breakdown).slice(0, 50);
	root.innerHTML = `
		<div class="spending-items-list">
			${items
				.map(
					(item) => `
						<a class="spending-breakdown-item" href="${item.product_id === null ? `/receipts/${item.receipt_id}` : `/products/${item.product_id}`}" data-link>
							<div class="spending-breakdown-item__main">
								<strong>${escapeHtml(item.product_name)}</strong>
								<span>${escapeHtml(item.store_name)} · ${formatReceiptDateTime(item.purchased_at)}</span>
							</div>
							<div class="spending-breakdown-item__meta">
								<span>${item.quantity} ${escapeHtml(item.unit)} · ${escapeHtml(item.category)}</span>
								<strong>${formatMoney(item.amount, item.currency)}</strong>
							</div>
						</a>
					`,
				)
				.join("")}
		</div>
	`;
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
			<section class="workspace workspace--single">
				<div class="spending-breakdown-panel">
					<div class="section-header spending-breakdown-header">
						<h2 id="spending-breakdown-title">${escapeHtml(selectedRange.label)}</h2>
						<div id="spending-breakdown-summary"></div>
						<div class="spending-breakdown-controls">
							<label for="spending-range-select">
								<span>Time span</span>
								<select id="spending-range-select">
									${renderSpendingRangeOptions(selectedRange.value)}
								</select>
							</label>
							<a class="secondary action-link" href="/" data-link>Back To Overview</a>
							<a class="secondary action-link" href="/receipts" data-link>Receipts</a>
						</div>
					</div>
					<div id="spending-breakdown-period" class="section-copy"></div>
					<div id="spending-breakdown-results"></div>
					<div id="spending-breakdown-status" class="status"></div>
				</div>
			</section>
		`,
	);

	attachSpendingBreakdownPageEvents();
	void loadSpendingBreakdownPage(selectedRange);
};

export const renderSpendingOverviewPage = () => {
	renderPage(
		`
			<section class="page-heading page-heading--compact">
				<div>
					<h1 class="page-title">Overview</h1>
				</div>
				<div class="actions">
					<a class="secondary action-link" href="/spending" data-link>Breakdown</a>
					<a class="secondary action-link" href="/receipts" data-link>Receipts</a>
				</div>
			</section>

			<section class="workspace workspace--single">
				<div class="card panel dashboard-spending-panel">
					<div id="dashboard-spending-summary"></div>
					<div id="dashboard-spending-status" class="status"></div>
				</div>
			</section>
		`,
	);

	void loadDashboardSpendingSummary();
};

export const renderSpendingMonthlyPage = () => {
	renderPage(
		`
			<section class="workspace workspace--single">
				<div class="spending-breakdown-panel">
					<div id="spending-monthly-chart"></div>
					<div id="spending-monthly-status" class="status"></div>
				</div>
			</section>
		`,
	);

	setStatus("spending-monthly-status", "Loading monthly spending...");
	void fetchSpendingBreakdown(allTimeSpendingRangeOption())
		.then((breakdown) => {
			renderMonthlySpendingChart(breakdown);
			setStatus(
				"spending-monthly-status",
				breakdown.item_count
					? `${breakdown.item_count} receipt item(s) across all time.`
					: "No receipt items recorded yet.",
			);
		})
		.catch((error) => {
			renderMonthlySpendingChart(null);
			setStatus(
				"spending-monthly-status",
				error instanceof Error ? error.message : "Failed to load monthly spending.",
				true,
			);
		});
};

export const renderSpendingItemsPage = () => {
	renderPage(
		`
			<section class="workspace workspace--single">
				<div class="spending-breakdown-panel">
					<div class="section-header">
						<h2>Last Items</h2>
					</div>
					<div id="spending-items-results"></div>
					<div id="spending-items-status" class="status"></div>
				</div>
			</section>
		`,
	);

	setStatus("spending-items-status", "Loading receipt items...");
	void fetchSpendingBreakdown(allTimeSpendingRangeOption())
		.then((breakdown) => {
			renderLastSpendingItems(breakdown);
			setStatus(
				"spending-items-status",
				breakdown.item_count
					? `${Math.min(50, breakdown.item_count)} of ${breakdown.item_count} receipt item(s).`
					: "No receipt items recorded yet.",
			);
		})
		.catch((error) => {
			renderLastSpendingItems(null);
			setStatus(
				"spending-items-status",
				error instanceof Error ? error.message : "Failed to load receipt items.",
				true,
			);
		});
};
