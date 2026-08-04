import {
	formatMoney,
	formatReceiptDateTime,
	loadDashboardSpendingSummary,
	renderPage,
	setStatus,
} from "../app"
import {
	createElement,
	createEmptyState,
	getElementById,
	withQueryRoot,
} from "../lib/dom"

type SpendingCategoryTotal = {
	category: string
	currency: string
	total: number
	item_count: number
	missing_total_count: number
	items: SpendingLineItem[]
}

type SpendingLineItem = {
	id: number
	receipt_id: number
	product_id: number | null
	store_name: string
	purchased_at: string
	product_name: string
	quantity: number
	unit: string
	unit_price: number | null
	line_total: number | null
	amount: number | null
}

type SpendingSearchLineItem = SpendingLineItem & {
	category: string
	currency: string
}

type SpendingProductGroup = {
	product_id: number | null
	product_name: string
	total: number | null
	item_count: number
	missing_total_count: number
	items: SpendingLineItem[]
}

type SpendingCurrencyTotal = {
	currency: string
	total: number
}

type SpendingAverageTotal = SpendingCurrencyTotal & {
	day_count: number
}

type SpendingBreakdown = {
	period: {
		from: string | null
		to: string
		days: number | null
		range: "days" | "all"
	}
	item_count: number
	missing_total_count: number
	currency_totals: SpendingCurrencyTotal[]
	monthly_average_totals: SpendingAverageTotal[]
	weekly_average_totals: SpendingAverageTotal[]
	daily_average_totals: SpendingAverageTotal[]
	current_month_totals: SpendingCurrencyTotal[]
	categories: SpendingCategoryTotal[]
}

const SPENDING_RANGE_OPTIONS = [
	{ value: "7", label: "Last 7 Days" },
	{ value: "30", label: "Last 30 Days" },
	{ value: "90", label: "Last 90 Days" },
	{ value: "365", label: "Last 365 Days" },
	{ value: "all", label: "All Time" },
] as const

type SpendingRangeOption = (typeof SPENDING_RANGE_OPTIONS)[number]

const DEFAULT_SPENDING_RANGE_VALUE = "30"

const getSpendingRangeOption = (
	value: string | null | undefined,
): SpendingRangeOption =>
	SPENDING_RANGE_OPTIONS.find((option) => option.value === value) ??
	SPENDING_RANGE_OPTIONS.find(
		(option) => option.value === DEFAULT_SPENDING_RANGE_VALUE,
	)!

const getCurrentSpendingRangeOption = () =>
	getSpendingRangeOption(
		new URLSearchParams(window.location.search).get("span"),
	)

const spendingRangeStatusSuffix = (option: SpendingRangeOption) =>
	option.value === "all"
		? "across all time"
		: `in the last ${option.value} days`

const spendingRangeEmptyMessage = (option: SpendingRangeOption) =>
	option.value === "all"
		? "No receipt items recorded yet."
		: `No receipt items in the last ${option.value} days.`

const allTimeSpendingRangeOption = () => getSpendingRangeOption("all")

let spendingItemsBreakdown: SpendingBreakdown | null = null

const attachSpendingBreakdownPageEvents = () => {
	const rangeSelect = getElementById("spending-range-select")
	if (!(rangeSelect instanceof HTMLSelectElement)) {
		return
	}

	rangeSelect.addEventListener("change", () => {
		const selectedRange = getSpendingRangeOption(rangeSelect.value)
		rangeSelect.value = selectedRange.value

		const url = new URL(window.location.href)
		if (selectedRange.value === DEFAULT_SPENDING_RANGE_VALUE) {
			url.searchParams.delete("span")
		} else {
			url.searchParams.set("span", selectedRange.value)
		}
		window.history.replaceState({}, "", `${url.pathname}${url.search}`)

		void loadSpendingBreakdownPage(selectedRange)
	})
}

const groupSpendingItemsByProduct = (
	items: SpendingLineItem[],
): SpendingProductGroup[] => {
	const groups = new Map<number, SpendingProductGroup>()
	const unlinkedItems: SpendingProductGroup[] = []

	for (const item of items) {
		if (item.product_id === null) {
			unlinkedItems.push({
				product_id: null,
				product_name: item.product_name,
				total: item.amount,
				item_count: 1,
				missing_total_count: item.amount === null ? 1 : 0,
				items: [item],
			})
			continue
		}

		let group = groups.get(item.product_id)
		if (!group) {
			group = {
				product_id: item.product_id,
				product_name: item.product_name,
				total: 0,
				item_count: 0,
				missing_total_count: 0,
				items: [],
			}
			groups.set(item.product_id, group)
		}

		group.item_count += 1
		group.items.push(item)
		if (item.amount === null) {
			group.missing_total_count += 1
		} else {
			group.total =
				Math.round(((group.total ?? 0) + item.amount) * 100) / 100
		}
	}

	return [...groups.values(), ...unlinkedItems].sort((left, right) => {
		const leftTotal = left.total ?? -1
		const rightTotal = right.total ?? -1
		return (
			rightTotal - leftTotal ||
			left.product_name.localeCompare(right.product_name)
		)
	})
}

const flattenSpendingItems = (
	breakdown: SpendingBreakdown,
): SpendingSearchLineItem[] =>
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
				Date.parse(right.purchased_at) -
					Date.parse(left.purchased_at) || left.id - right.id,
		)

const spendingMonthParts = (purchasedAt: string) => {
	const date = new Date(purchasedAt)
	if (Number.isNaN(date.getTime())) {
		return null
	}
	return {
		year: date.getFullYear(),
		month: date.getMonth(),
	}
}

const formatSpendingMonth = (month: number) =>
	new Intl.DateTimeFormat(undefined, {
		month: "short",
	}).format(new Date(2000, month, 1))

const niceChartMax = (value: number) => {
	if (value <= 0) {
		return 1
	}
	const magnitude = 10 ** Math.floor(Math.log10(value))
	const normalized = value / magnitude
	const nice =
		normalized <= 1
			? 1
			: normalized <= 2.5
				? 2.5
				: normalized <= 5
					? 5
					: normalized <= 7.5
						? 7.5
						: 10
	return nice * magnitude
}

const formatChartAxisValue = (value: number, currency: string) => {
	const suffix = currency === "EUR" ? "€" : currency
	if (value === 0) {
		return `0.00 ${suffix}`
	}
	if (value >= 1000) {
		const thousands = value / 1000
		return `${Number.isInteger(thousands) ? thousands.toFixed(0) : thousands.toFixed(1)}k ${suffix}`
	}
	return `${Math.round(value)} ${suffix}`
}

const formatSpendingPeriod = (
	breakdown: SpendingBreakdown,
	option: SpendingRangeOption,
) => {
	if (breakdown.period.range === "all" || option.value === "all") {
		return `All receipts through ${formatReceiptDateTime(breakdown.period.to)}`
	}
	if (breakdown.period.from === null) {
		return `Through ${formatReceiptDateTime(breakdown.period.to)}`
	}
	return `${formatReceiptDateTime(breakdown.period.from)} - ${formatReceiptDateTime(breakdown.period.to)}`
}

const renderSpendingBreakdown = (
	breakdown: SpendingBreakdown | null,
	option: SpendingRangeOption,
) => {
	const summaryRoot = getElementById("spending-breakdown-summary")
	const periodRoot = getElementById("spending-breakdown-period")
	const resultsRoot = getElementById("spending-breakdown-results")
	if (!summaryRoot || !periodRoot || !resultsRoot) return
	if (!breakdown || breakdown.item_count === 0) {
		summaryRoot.replaceChildren()
		periodRoot.replaceChildren()
		resultsRoot.replaceChildren(
			createEmptyState(spendingRangeEmptyMessage(option)),
		)
		return
	}
	summaryRoot.replaceChildren(
		createElement(
			"div",
			{ className: "spending-breakdown-summary" },
			createElement(
				"div",
				{ className: "dashboard-spending-summary__metric" },
				createElement("span", {}, "Items"),
				createElement("strong", {}, breakdown.item_count),
			),
			...breakdown.currency_totals.map((total) =>
				createElement(
					"div",
					{ className: "dashboard-spending-total" },
					createElement("span", {}, total.currency),
					createElement(
						"strong",
						{},
						formatMoney(total.total, total.currency),
					),
				),
			),
		),
	)
	periodRoot.textContent = `${formatSpendingPeriod(breakdown, option)}${breakdown.missing_total_count ? `, ${breakdown.missing_total_count} item(s) without a line total or unit price` : ""}`
	const grouped = new Map<string, SpendingCategoryTotal[]>()
	for (const category of breakdown.categories)
		grouped.set(category.currency, [
			...(grouped.get(category.currency) ?? []),
			category,
		])
	resultsRoot.replaceChildren(
		...[...grouped.entries()].map(([currency, categories]) => {
			const maxTotal = Math.max(
				...categories.map((category) => category.total),
				1,
			)
			const list = createElement(
				"div",
				{ className: "spending-breakdown-list" },
				...categories.map((category, index) => {
					const detailsId =
						`spending-${currency}-${category.category}-${index}`
							.replace(/[^a-z0-9_-]+/gi, "-")
							.toLowerCase()
					const meter = createElement("div")
					meter.style.width = `${Math.max(3, Math.round((category.total / maxTotal) * 100))}%`
					const summary = createElement(
						"summary",
						{
							className: "spending-breakdown-row",
							attributes: { "aria-controls": detailsId },
						},
						createElement(
							"div",
							{ className: "spending-breakdown-row__label" },
							createElement("strong", {}, category.category),
							createElement(
								"span",
								{},
								`${category.item_count} item(s)${category.missing_total_count ? `, ${category.missing_total_count} missing total` : ""}`,
							),
						),
						createElement(
							"div",
							{
								className: "spending-breakdown-row__meter",
								attributes: { "aria-hidden": "true" },
							},
							meter,
						),
						createElement(
							"strong",
							{ className: "spending-breakdown-row__total" },
							formatMoney(category.total, category.currency),
						),
					)
					const products = createElement(
						"div",
						{
							id: detailsId,
							className: "spending-breakdown-items",
						},
						...groupSpendingItemsByProduct(category.items).map(
							(product) =>
								createElement(
									"a",
									{
										className: "spending-breakdown-item",
										properties: {
											href:
												product.product_id === null
													? `/receipts/${product.items[0]?.receipt_id ?? ""}`
													: `/products/${product.product_id}`,
										},
										attributes: { "data-link": "" },
									},
									createElement(
										"div",
										{
											className:
												"spending-breakdown-item__main",
										},
										createElement(
											"strong",
											{},
											product.product_name,
										),
										createElement(
											"span",
											{},
											`${product.item_count} purchase(s)${product.missing_total_count ? `, ${product.missing_total_count} missing total` : ""}`,
										),
									),
									createElement(
										"div",
										{
											className:
												"spending-breakdown-item__meta",
										},
										createElement(
											"span",
											{},
											product.product_id === null
												? "Receipt line"
												: "Product total",
										),
										createElement(
											"strong",
											{},
											formatMoney(
												product.total,
												category.currency,
											),
										),
									),
								),
						),
					)
					return createElement(
						"details",
						{ className: "spending-breakdown-details" },
						summary,
						products,
					)
				}),
			)
			return createElement(
				"section",
				{ className: "spending-breakdown-group" },
				createElement(
					"div",
					{ className: "section-header section-header--inline" },
					createElement("h3", {}, currency),
				),
				list,
			)
		}),
	)
}

const fetchSpendingBreakdown = async (option: SpendingRangeOption) => {
	const params =
		option.value === "all"
			? new URLSearchParams({ range: "all" })
			: new URLSearchParams({ days: option.value })
	const response = await fetch(`/api/spending?${params.toString()}`)
	const body = (await response.json()) as
		| SpendingBreakdown
		| { error?: string }

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to load spending breakdown")
				: "Failed to load spending breakdown",
		)
	}

	return body as SpendingBreakdown
}

const renderMonthlySpendingChart = (breakdown: SpendingBreakdown | null) => {
	const root = getElementById("spending-monthly-chart")
	if (!root) return
	if (!breakdown || breakdown.item_count === 0) {
		root.replaceChildren(createEmptyState("No receipt items recorded yet."))
		return
	}
	const currentYear = new Date().getFullYear()
	const previousYear = currentYear - 1
	const monthTotalsByCurrency = new Map<string, Map<string, number>>()
	for (const item of flattenSpendingItems(breakdown)) {
		const parts = spendingMonthParts(item.purchased_at)
		if (
			!parts ||
			item.amount === null ||
			(parts.year !== currentYear && parts.year !== previousYear)
		)
			continue
		const totals =
			monthTotalsByCurrency.get(item.currency) ??
			new Map<string, number>()
		totals.set(
			`${parts.year}-${parts.month}`,
			Math.round(
				((totals.get(`${parts.year}-${parts.month}`) ?? 0) +
					item.amount) *
					100,
			) / 100,
		)
		monthTotalsByCurrency.set(item.currency, totals)
	}
	const groups = [...monthTotalsByCurrency.entries()]
		.map(([currency, totals]) => ({
			currency,
			months: Array.from({ length: 12 }, (_, month) => ({
				month,
				current_total: totals.get(`${currentYear}-${month}`) ?? 0,
				previous_total: totals.get(`${previousYear}-${month}`) ?? 0,
			})),
		}))
		.filter((group) =>
			group.months.some(
				(month) => month.current_total > 0 || month.previous_total > 0,
			),
		)
		.sort((a, b) => a.currency.localeCompare(b.currency))
	if (!groups.length) {
		root.replaceChildren(
			createEmptyState("No monthly totals recorded yet."),
		)
		return
	}
	root.replaceChildren(
		...groups.map((group) => {
			const monthlyAverage =
				breakdown.monthly_average_totals.find(
					(total) => total.currency === group.currency,
				)?.total ?? 0
			const chartMax = niceChartMax(
				Math.max(
					...group.months.flatMap((month) => [
						month.current_total,
						month.previous_total,
					]),
					monthlyAverage,
					1,
				),
			)
			const ticks = [
				chartMax,
				chartMax * 0.75,
				chartMax * 0.5,
				chartMax * 0.25,
				0,
			]
			const legend = createElement(
				"div",
				{ className: "spending-monthly-legend" },
				createElement(
					"span",
					{},
					createElement("i", {
						className:
							"spending-monthly-legend__swatch spending-monthly-legend__swatch--previous",
					}),
					String(previousYear),
				),
				createElement(
					"span",
					{},
					createElement("i", {
						className:
							"spending-monthly-legend__swatch spending-monthly-legend__swatch--current",
					}),
					String(currentYear),
				),
				monthlyAverage > 0
					? createElement(
							"span",
							{},
							createElement("i", {
								className:
									"spending-monthly-legend__swatch spending-monthly-legend__swatch--average",
							}),
							`Avg ${formatMoney(monthlyAverage, group.currency)}`,
						)
					: null,
			)
			const chart = createElement(
				"div",
				{ className: "spending-monthly-chart" },
				createElement(
					"div",
					{
						className: "spending-monthly-gridlines",
						attributes: { "aria-hidden": "true" },
					},
					...ticks.map(() => createElement("span")),
				),
			)
			if (monthlyAverage > 0) {
				const position = `${Math.min(100, Math.round((monthlyAverage / chartMax) * 10000) / 100)}%`
				const line = createElement("span", {
					className: "spending-monthly-average__line",
				})
				line.style.bottom = position
				const label = createElement(
					"span",
					{ className: "spending-monthly-average__label" },
					formatMoney(monthlyAverage, group.currency),
				)
				label.style.bottom = position
				chart.append(
					createElement(
						"div",
						{
							className: "spending-monthly-average",
							attributes: { "aria-hidden": "true" },
						},
						line,
						label,
					),
				)
			}
			chart.append(
				createElement(
					"div",
					{ className: "spending-monthly-columns" },
					...group.months.map((month) => {
						const previous = createElement("div", {
							className:
								"spending-monthly-bar spending-monthly-bar--previous",
							properties: {
								title: `${previousYear}: ${formatMoney(month.previous_total, group.currency)}`,
							},
						})
						previous.style.height = `${month.previous_total > 0 ? Math.max(2, Math.round((month.previous_total / chartMax) * 100)) : 0}%`
						const current = createElement("div", {
							className:
								"spending-monthly-bar spending-monthly-bar--current",
							properties: {
								title: `${currentYear}: ${formatMoney(month.current_total, group.currency)}`,
							},
						})
						current.style.height = `${month.current_total > 0 ? Math.max(2, Math.round((month.current_total / chartMax) * 100)) : 0}%`
						return createElement(
							"div",
							{ className: "spending-monthly-column" },
							createElement(
								"div",
								{ className: "spending-monthly-column__bars" },
								previous,
								current,
							),
							createElement(
								"span",
								{},
								formatSpendingMonth(month.month),
							),
						)
					}),
				),
			)
			return createElement(
				"section",
				{ className: "spending-monthly-group" },
				legend,
				createElement(
					"div",
					{ className: "spending-monthly-plot" },
					createElement(
						"div",
						{
							className: "spending-monthly-axis",
							attributes: { "aria-hidden": "true" },
						},
						...ticks.map((tick) =>
							createElement(
								"span",
								{},
								formatChartAxisValue(tick, group.currency),
							),
						),
					),
					chart,
				),
			)
		}),
	)
}

const receiptItemMatchesSearch = (
	item: SpendingSearchLineItem,
	query: string,
) => {
	const normalizedQuery = query.trim().toLowerCase()
	if (!normalizedQuery) {
		return true
	}

	const haystack = [
		item.product_name,
		item.store_name,
		item.category,
		item.unit,
		String(item.quantity),
		String(item.receipt_id),
		formatReceiptDateTime(item.purchased_at),
		formatMoney(item.amount, item.currency),
	]
		.join(" ")
		.toLowerCase()

	return normalizedQuery.split(/\s+/).every((term) => haystack.includes(term))
}

const renderLastSpendingItems = (
	breakdown: SpendingBreakdown | null,
	query = "",
) => {
	const root = getElementById("spending-items-results")
	if (!root) {
		return { filtered: 0, shown: 0, total: 0 }
	}
	if (!breakdown || breakdown.item_count === 0) {
		root.replaceChildren(createEmptyState("No receipt items recorded yet."))
		return { filtered: 0, shown: 0, total: 0 }
	}

	const filteredItems = flattenSpendingItems(breakdown).filter((item) =>
		receiptItemMatchesSearch(item, query),
	)
	if (!filteredItems.length) {
		root.replaceChildren(
			createEmptyState("No receipt items match that search."),
		)
		return { filtered: 0, shown: 0, total: breakdown.item_count }
	}

	const limit = query.trim() ? 100 : 50
	const items = filteredItems.slice(0, limit)
	root.replaceChildren(
		createElement(
			"div",
			{ className: "spending-items-list" },
			...items.map((item) =>
				createElement(
					"a",
					{
						className: "spending-breakdown-item",
						properties: {
							href:
								item.product_id === null
									? `/receipts/${item.receipt_id}`
									: `/products/${item.product_id}`,
						},
						attributes: { "data-link": "" },
					},
					createElement(
						"div",
						{ className: "spending-breakdown-item__main" },
						createElement("strong", {}, item.product_name),
						createElement(
							"span",
							{},
							`${item.store_name} · ${formatReceiptDateTime(item.purchased_at)}`,
						),
					),
					createElement(
						"div",
						{ className: "spending-breakdown-item__meta" },
						createElement(
							"span",
							{},
							`${item.quantity} ${item.unit} · ${item.category}`,
						),
						createElement(
							"strong",
							{},
							formatMoney(item.amount, item.currency),
						),
					),
				),
			),
		),
	)

	return {
		filtered: filteredItems.length,
		shown: items.length,
		total: breakdown.item_count,
	}
}

const updateSpendingItemsStatus = (
	breakdown: SpendingBreakdown | null,
	query = "",
) => {
	const stats = renderLastSpendingItems(breakdown, query)
	const trimmedQuery = query.trim()
	if (!breakdown || breakdown.item_count === 0) {
		setStatus("spending-items-status", "No receipt items recorded yet.")
		return
	}
	if (!stats.filtered) {
		setStatus(
			"spending-items-status",
			"No receipt items match that search.",
		)
		return
	}
	setStatus(
		"spending-items-status",
		trimmedQuery
			? `${stats.shown} of ${stats.filtered} matching receipt item(s), ${stats.total} total.`
			: `${stats.shown} of ${stats.total} receipt item(s).`,
	)
}

const attachSpendingItemsPageEvents = () => {
	const search = getElementById("spending-items-search")
	const clear = getElementById("spending-items-clear")
	if (!(search instanceof HTMLInputElement)) {
		return
	}

	const renderFromSearch = () => {
		updateSpendingItemsStatus(spendingItemsBreakdown, search.value)
	}

	search.addEventListener("input", renderFromSearch)
	if (clear instanceof HTMLButtonElement) {
		clear.addEventListener("click", () => {
			search.value = ""
			search.focus()
			renderFromSearch()
		})
	}
}

const loadSpendingBreakdownPage = async (
	option = getCurrentSpendingRangeOption(),
) => {
	const title = getElementById("spending-breakdown-title")
	if (title) {
		title.textContent = option.label
	}
	setStatus("spending-breakdown-status", "Loading spending breakdown...")
	try {
		const breakdown = await fetchSpendingBreakdown(option)
		renderSpendingBreakdown(breakdown, option)
		setStatus(
			"spending-breakdown-status",
			breakdown.item_count
				? `${breakdown.item_count} receipt item(s) ${spendingRangeStatusSuffix(option)}.`
				: spendingRangeEmptyMessage(option),
		)
	} catch (error) {
		renderSpendingBreakdown(null, option)
		setStatus(
			"spending-breakdown-status",
			error instanceof Error
				? error.message
				: "Failed to load spending breakdown.",
			true,
		)
	}
}

export const renderSpendingPage = () => {
	const selectedRange = getCurrentSpendingRangeOption()
	const link = (href: string, text: string) =>
		createElement(
			"a",
			{
				className: "secondary action-link",
				properties: { href },
				attributes: { "data-link": "" },
			},
			text,
		)
	const range = createElement(
		"select",
		{ id: "spending-range-select" },
		...SPENDING_RANGE_OPTIONS.map((option) =>
			createElement(
				"option",
				{
					properties: {
						value: option.value,
						selected: option.value === selectedRange.value,
					},
				},
				option.label,
			),
		),
	)
	const page = createElement(
		"section",
		{ className: "workspace workspace--single" },
		createElement(
			"div",
			{ className: "spending-breakdown-panel" },
			createElement(
				"div",
				{ className: "section-header spending-breakdown-header" },
				createElement(
					"h2",
					{ id: "spending-breakdown-title" },
					selectedRange.label,
				),
				createElement("div", { id: "spending-breakdown-summary" }),
				createElement(
					"div",
					{ className: "spending-breakdown-controls" },
					createElement(
						"label",
						{ properties: { htmlFor: "spending-range-select" } },
						createElement("span", {}, "Time span"),
						range,
					),
					link("/", "Back To Overview"),
					link("/receipts", "Receipts"),
				),
			),
			createElement("div", {
				id: "spending-breakdown-period",
				className: "section-copy",
			}),
			createElement("div", { id: "spending-breakdown-results" }),
			createElement("div", {
				id: "spending-breakdown-status",
				className: "status",
			}),
		),
	)
	withQueryRoot(page, attachSpendingBreakdownPageEvents)
	renderPage(page)
	void loadSpendingBreakdownPage(selectedRange)
}

export const renderSpendingOverviewPage = () => {
	const link = (href: string, text: string) =>
		createElement(
			"a",
			{
				className: "secondary action-link",
				properties: { href },
				attributes: { "data-link": "" },
			},
			text,
		)
	const page = document.createDocumentFragment()
	page.append(
		createElement(
			"section",
			{ className: "page-heading page-heading--compact" },
			createElement(
				"div",
				{ className: "actions" },
				link("/spending", "Breakdown"),
				link("/receipts", "Receipts"),
			),
		),
		createElement(
			"section",
			{ className: "workspace workspace--single" },
			createElement(
				"div",
				{ className: "card panel dashboard-spending-panel" },
				createElement("div", { id: "dashboard-spending-summary" }),
				createElement("div", {
					id: "dashboard-spending-status",
					className: "status",
				}),
			),
		),
	)
	renderPage(page)

	void loadDashboardSpendingSummary()
}

export const renderSpendingMonthlyPage = () => {
	renderPage(
		createElement(
			"section",
			{ className: "workspace workspace--single" },
			createElement(
				"div",
				{ className: "spending-breakdown-panel" },
				createElement("div", { id: "spending-monthly-chart" }),
				createElement("div", {
					id: "spending-monthly-status",
					className: "status",
				}),
			),
		),
	)

	setStatus("spending-monthly-status", "Loading monthly spending...")
	void fetchSpendingBreakdown(allTimeSpendingRangeOption())
		.then((breakdown) => {
			renderMonthlySpendingChart(breakdown)
			setStatus(
				"spending-monthly-status",
				breakdown.item_count
					? `${breakdown.item_count} receipt item(s) across all time.`
					: "No receipt items recorded yet.",
			)
		})
		.catch((error) => {
			renderMonthlySpendingChart(null)
			setStatus(
				"spending-monthly-status",
				error instanceof Error
					? error.message
					: "Failed to load monthly spending.",
				true,
			)
		})
}

export const renderSpendingItemsPage = () => {
	const page = createElement(
		"section",
		{ className: "workspace workspace--single" },
		createElement(
			"div",
			{ className: "spending-breakdown-panel" },
			createElement(
				"div",
				{ className: "section-header" },
				createElement("h2", {}, "Receipt Items"),
			),
			createElement(
				"div",
				{ className: "toolbar" },
				createElement("input", {
					id: "spending-items-search",
					properties: {
						type: "search",
						placeholder:
							"Search product, store, category, receipt id",
						autocomplete: "off",
					},
				}),
				createElement(
					"button",
					{
						id: "spending-items-clear",
						className: "secondary",
						properties: { type: "button" },
					},
					"Clear",
				),
			),
			createElement("div", { id: "spending-items-results" }),
			createElement("div", {
				id: "spending-items-status",
				className: "status",
			}),
		),
	)

	spendingItemsBreakdown = null
	withQueryRoot(page, attachSpendingItemsPageEvents)
	renderPage(page)
	setStatus("spending-items-status", "Loading receipt items...")
	void fetchSpendingBreakdown(allTimeSpendingRangeOption())
		.then((breakdown) => {
			spendingItemsBreakdown = breakdown
			const search = getElementById("spending-items-search")
			updateSpendingItemsStatus(
				breakdown,
				search instanceof HTMLInputElement ? search.value : "",
			)
		})
		.catch((error) => {
			spendingItemsBreakdown = null
			renderLastSpendingItems(null)
			setStatus(
				"spending-items-status",
				error instanceof Error
					? error.message
					: "Failed to load receipt items.",
				true,
			)
		})
}
