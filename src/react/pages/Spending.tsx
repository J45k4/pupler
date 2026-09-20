import { useMemo, useState } from "react"
import { Empty, Status, formatMoney, formatReceiptDateTime, useApi } from "../lib"

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

type SpendingCategoryTotal = {
	category: string
	currency: string
	total: number
	item_count: number
	missing_total_count: number
	items: SpendingLineItem[]
}

type SpendingSearchLineItem = SpendingLineItem & { category: string; currency: string }

type SpendingCurrencyTotal = { currency: string; total: number }
type SpendingAverageTotal = SpendingCurrencyTotal & { day_count: number }

export type SpendingBreakdown = {
	period: { from: string | null; to: string; days: number | null; range: "days" | "all" }
	item_count: number
	missing_total_count: number
	currency_totals: SpendingCurrencyTotal[]
	monthly_average_totals: SpendingAverageTotal[]
	weekly_average_totals: SpendingAverageTotal[]
	daily_average_totals: SpendingAverageTotal[]
	current_month_totals: SpendingCurrencyTotal[]
	categories: SpendingCategoryTotal[]
}

const RANGE_OPTIONS = [
	{ value: "7", label: "Last 7 Days" },
	{ value: "30", label: "Last 30 Days" },
	{ value: "90", label: "Last 90 Days" },
	{ value: "365", label: "Last 365 Days" },
	{ value: "all", label: "All Time" },
] as const

type RangeOption = (typeof RANGE_OPTIONS)[number]

const rangeFromSearch = (): RangeOption => {
	const value = new URLSearchParams(window.location.search).get("span")
	return RANGE_OPTIONS.find((o) => o.value === value) ?? RANGE_OPTIONS.find((o) => o.value === "30")!
}

const rangeQuery = (option: RangeOption) =>
	option.value === "all" ? "/api/spending?range=all" : `/api/spending?days=${option.value}`

const rangeSuffix = (option: RangeOption) =>
	option.value === "all" ? "across all time" : `in the last ${option.value} days`

const emptyMessage = (option: RangeOption) =>
	option.value === "all" ? "No receipt items recorded yet." : `No receipt items in the last ${option.value} days.`

const formatPeriod = (breakdown: SpendingBreakdown, option: RangeOption) => {
	if (breakdown.period.range === "all" || option.value === "all") {
		return `All receipts through ${formatReceiptDateTime(breakdown.period.to)}`
	}
	if (breakdown.period.from === null) return `Through ${formatReceiptDateTime(breakdown.period.to)}`
	return `${formatReceiptDateTime(breakdown.period.from)} - ${formatReceiptDateTime(breakdown.period.to)}`
}

const flattenItems = (breakdown: SpendingBreakdown): SpendingSearchLineItem[] =>
	breakdown.categories
		.flatMap((category) => category.items.map((item) => ({ ...item, currency: category.currency, category: category.category })))
		.sort((l, r) => Date.parse(r.purchased_at) - Date.parse(l.purchased_at) || l.id - r.id)

const groupByProduct = (items: SpendingLineItem[]) => {
	const groups = new Map<number, { product_id: number | null; product_name: string; total: number | null; item_count: number; missing_total_count: number; items: SpendingLineItem[] }>()
	const unlinked: Array<{ product_id: number | null; product_name: string; total: number | null; item_count: number; missing_total_count: number; items: SpendingLineItem[] }> = []
	for (const item of items) {
		if (item.product_id === null) {
			unlinked.push({
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
			group = { product_id: item.product_id, product_name: item.product_name, total: 0, item_count: 0, missing_total_count: 0, items: [] }
			groups.set(item.product_id, group)
		}
		group.item_count += 1
		group.items.push(item)
		if (item.amount === null) group.missing_total_count += 1
		else group.total = Math.round(((group.total ?? 0) + item.amount) * 100) / 100
	}
	return [...groups.values(), ...unlinked].sort((l, r) => {
		const lt = l.total ?? -1
		const rt = r.total ?? -1
		return rt - lt || l.product_name.localeCompare(r.product_name)
	})
}

const monthParts = (purchasedAt: string) => {
	const date = new Date(purchasedAt)
	if (Number.isNaN(date.getTime())) return null
	return { year: date.getFullYear(), month: date.getMonth() }
}

const formatMonth = (month: number) =>
	new Intl.DateTimeFormat(undefined, { month: "short" }).format(new Date(2000, month, 1))

const niceChartMax = (value: number) => {
	if (value <= 0) return 1
	const magnitude = 10 ** Math.floor(Math.log10(value))
	const normalized = value / magnitude
	const nice = normalized <= 1 ? 1 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : normalized <= 7.5 ? 7.5 : 10
	return nice * magnitude
}

const formatAxis = (value: number, currency: string) => {
	const suffix = currency === "EUR" ? "€" : currency
	if (value === 0) return `0.00 ${suffix}`
	if (value >= 1000) {
		const t = value / 1000
		return `${Number.isInteger(t) ? t.toFixed(0) : t.toFixed(1)}k ${suffix}`
	}
	return `${Math.round(value)} ${suffix}`
}

export const SpendingPage = ({ link }: { link: (p: string) => string }) => {
	const [option, setOption] = useState<RangeOption>(() => rangeFromSearch())
	const { data: breakdown, loading, error } = useApi<SpendingBreakdown>(rangeQuery(option))

	const changeRange = (value: string) => {
		const next = RANGE_OPTIONS.find((o) => o.value === value) ?? RANGE_OPTIONS[1]
		setOption(next)
		const url = new URL(window.location.href)
		if (next.value === "30") url.searchParams.delete("span")
		else url.searchParams.set("span", next.value)
		window.history.replaceState({}, "", `${url.pathname}${url.search}`)
	}

	const grouped = useMemo(() => {
		const map = new Map<string, SpendingCategoryTotal[]>()
		for (const category of breakdown?.categories ?? []) {
			map.set(category.currency, [...(map.get(category.currency) ?? []), category])
		}
		return [...map.entries()]
	}, [breakdown])

	return (
		<section className="workspace workspace--single">
			<div className="spending-breakdown-panel">
				<div className="section-header spending-breakdown-header">
					<h2 id="spending-breakdown-title">{option.label}</h2>
					<div id="spending-breakdown-summary">
						{breakdown && breakdown.item_count > 0 ? (
							<div className="spending-breakdown-summary">
								<div className="dashboard-spending-summary__metric">
									<span>Items</span>
									<strong>{breakdown.item_count}</strong>
								</div>
								{breakdown.currency_totals.map((total) => (
									<div key={total.currency} className="dashboard-spending-total">
										<span>{total.currency}</span>
										<strong>{formatMoney(total.total, total.currency)}</strong>
									</div>
								))}
							</div>
						) : null}
					</div>
					<div className="spending-breakdown-controls">
						<label htmlFor="spending-range-select">
							<span>Time span</span>
							<select id="spending-range-select" value={option.value} onChange={(e) => changeRange(e.target.value)}>
								{RANGE_OPTIONS.map((o) => (
									<option key={o.value} value={o.value}>
										{o.label}
									</option>
								))}
							</select>
						</label>
						<a className="secondary action-link" href={link("/")} data-link="">
							Back To Overview
						</a>
						<a className="secondary action-link" href={link("/receipts")} data-link="">
							Receipts
						</a>
					</div>
				</div>
				<div id="spending-breakdown-period" className="section-copy">
					{breakdown && breakdown.item_count > 0
						? `${formatPeriod(breakdown, option)}${breakdown.missing_total_count ? `, ${breakdown.missing_total_count} item(s) without a line total or unit price` : ""}`
						: ""}
				</div>
				<div id="spending-breakdown-results">
					{loading ? <p className="page-copy">Loading spending breakdown...</p> : null}
					{!loading && (!breakdown || breakdown.item_count === 0) ? <Empty message={emptyMessage(option)} /> : null}
					{!loading && breakdown && breakdown.item_count > 0
						? grouped.map(([currency, categories]) => {
								const maxTotal = Math.max(...categories.map((c) => c.total), 1)
								return (
									<section key={currency} className="spending-breakdown-group">
										<div className="section-header section-header--inline">
											<h3>{currency}</h3>
										</div>
										<div className="spending-breakdown-list">
											{categories.map((category, index) => {
												const detailsId = `spending-${currency}-${category.category}-${index}`
													.replace(/[^a-z0-9_-]+/gi, "-")
													.toLowerCase()
												return (
													<details key={detailsId} className="spending-breakdown-details">
														<summary className="spending-breakdown-row" aria-controls={detailsId}>
															<div className="spending-breakdown-row__label">
																<strong>{category.category}</strong>
																<span>
																	{`${category.item_count} item(s)${category.missing_total_count ? `, ${category.missing_total_count} missing total` : ""}`}
																</span>
															</div>
															<div className="spending-breakdown-row__meter" aria-hidden="true">
																<div style={{ width: `${Math.max(3, Math.round((category.total / maxTotal) * 100))}%` }} />
															</div>
															<strong className="spending-breakdown-row__total">
																{formatMoney(category.total, category.currency)}
															</strong>
														</summary>
														<div id={detailsId} className="spending-breakdown-items">
															{groupByProduct(category.items).map((product) => (
																<a
																	key={product.product_id ?? `${product.product_name}-${product.items[0]?.id}`}
																	className="spending-breakdown-item"
																	href={link(
																		product.product_id === null
																			? `/receipts/${product.items[0]?.receipt_id ?? ""}`
																			: `/products/${product.product_id}`,
																	)}
																	data-link=""
																>
																	<div className="spending-breakdown-item__main">
																		<strong>{product.product_name}</strong>
																		<span>
																			{`${product.item_count} purchase(s)${product.missing_total_count ? `, ${product.missing_total_count} missing total` : ""}`}
																		</span>
																	</div>
																	<div className="spending-breakdown-item__meta">
																		<span>{product.product_id === null ? "Receipt line" : "Product total"}</span>
																		<strong>{formatMoney(product.total, category.currency)}</strong>
																	</div>
																</a>
															))}
														</div>
													</details>
												)
											})}
										</div>
									</section>
								)
							})
						: null}
				</div>
				<Status
					message={
						loading
							? "Loading spending breakdown..."
							: error ??
								(breakdown?.item_count
									? `${breakdown.item_count} receipt item(s) ${rangeSuffix(option)}.`
									: emptyMessage(option))
					}
					error={!!error}
				/>
			</div>
		</section>
	)
}

export const SpendingOverviewPage = ({ link }: { link: (p: string) => string }) => {
	const { data: receipts } = useApi<Array<{ total_amount: number | null; currency: string; purchased_at: string }>>(
		"/api/receipts?sort=purchased_at&order=desc",
	)
	const { data: breakdown } = useApi<SpendingBreakdown>("/api/spending?range=all")

	const totals = useMemo(() => {
		const map = new Map<string, number>()
		const cutoff = new Date()
		cutoff.setDate(cutoff.getDate() - 30)
		for (const r of receipts ?? []) {
			if (r.total_amount === null) continue
			if (new Date(r.purchased_at).getTime() < cutoff.getTime()) continue
			map.set(r.currency, (map.get(r.currency) ?? 0) + r.total_amount)
		}
		return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
	}, [receipts])

	return (
		<>
			<section className="page-heading page-heading--compact">
				<div className="actions">
					<a className="secondary action-link" href={link("/spending")} data-link="">
						Breakdown
					</a>
					<a className="secondary action-link" href={link("/receipts")} data-link="">
						Receipts
					</a>
				</div>
			</section>
			<section className="workspace workspace--single">
				<div className="card panel dashboard-spending-panel">
					<div id="dashboard-spending-summary">
						{!receipts?.length ? (
							<Empty message="No receipts recorded yet." />
						) : (
							<div className="dashboard-spending-summary">
								{totals.map(([currency, total]) => (
									<div key={currency} className="dashboard-spending-total">
										<span>Last 30 Days</span>
										<strong>{formatMoney(total, currency)}</strong>
									</div>
								))}
								{(breakdown?.monthly_average_totals ?? []).map((t) => (
									<div key={t.currency} className="dashboard-spending-total">
										<span>Average Month Spending</span>
										<strong>{formatMoney(t.total, t.currency)}</strong>
									</div>
								))}
								{(breakdown?.current_month_totals ?? []).map((t) => (
									<div key={t.currency} className="dashboard-spending-total">
										<span>This Month Spending</span>
										<strong>{formatMoney(t.total, t.currency)}</strong>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</section>
		</>
	)
}

export const SpendingMonthlyPage = () => {
	const { data: breakdown, loading, error } = useApi<SpendingBreakdown>("/api/spending?range=all")

	const groups = useMemo(() => {
		if (!breakdown || breakdown.item_count === 0) return []
		const currentYear = new Date().getFullYear()
		const previousYear = currentYear - 1
		const byCurrency = new Map<string, Map<string, number>>()
		for (const item of flattenItems(breakdown)) {
			const parts = monthParts(item.purchased_at)
			if (!parts || item.amount === null || (parts.year !== currentYear && parts.year !== previousYear)) continue
			const totals = byCurrency.get(item.currency) ?? new Map<string, number>()
			const key = `${parts.year}-${parts.month}`
			totals.set(key, Math.round(((totals.get(key) ?? 0) + item.amount) * 100) / 100)
			byCurrency.set(item.currency, totals)
		}
		return [...byCurrency.entries()]
			.map(([currency, totals]) => ({
				currency,
				months: Array.from({ length: 12 }, (_, month) => ({
					month,
					current_total: totals.get(`${currentYear}-${month}`) ?? 0,
					previous_total: totals.get(`${previousYear}-${month}`) ?? 0,
				})),
			}))
			.filter((g) => g.months.some((m) => m.current_total > 0 || m.previous_total > 0))
			.sort((a, b) => a.currency.localeCompare(b.currency))
	}, [breakdown])

	const currentYear = new Date().getFullYear()
	const previousYear = currentYear - 1

	return (
		<section className="workspace workspace--single">
			<div className="spending-breakdown-panel">
				<div id="spending-monthly-chart">
					{loading ? <p className="page-copy">Loading monthly spending...</p> : null}
					{!loading && groups.length === 0 ? <Empty message="No monthly totals recorded yet." /> : null}
					{groups.map((group) => {
						const monthlyAverage = breakdown?.monthly_average_totals.find((t) => t.currency === group.currency)?.total ?? 0
						const chartMax = niceChartMax(
							Math.max(...group.months.flatMap((m) => [m.current_total, m.previous_total]), monthlyAverage, 1),
						)
						const ticks = [chartMax, chartMax * 0.75, chartMax * 0.5, chartMax * 0.25, 0]
						return (
							<section key={group.currency} className="spending-monthly-group">
								<div className="spending-monthly-legend">
									<span>
										<i className="spending-monthly-legend__swatch spending-monthly-legend__swatch--previous" />
										{String(previousYear)}
									</span>
									<span>
										<i className="spending-monthly-legend__swatch spending-monthly-legend__swatch--current" />
										{String(currentYear)}
									</span>
									{monthlyAverage > 0 ? (
										<span>
											<i className="spending-monthly-legend__swatch spending-monthly-legend__swatch--average" />
											{`Avg ${formatMoney(monthlyAverage, group.currency)}`}
										</span>
									) : null}
								</div>
								<div className="spending-monthly-plot">
									<div className="spending-monthly-axis" aria-hidden="true">
										{ticks.map((tick) => (
											<span key={tick}>{formatAxis(tick, group.currency)}</span>
										))}
									</div>
									<div className="spending-monthly-chart">
										<div className="spending-monthly-gridlines" aria-hidden="true">
											{ticks.map((tick) => (
												<span key={tick} />
											))}
										</div>
										{monthlyAverage > 0 ? (
											<div className="spending-monthly-average" aria-hidden="true">
												<span
													className="spending-monthly-average__line"
													style={{ bottom: `${Math.min(100, Math.round((monthlyAverage / chartMax) * 10000) / 100)}%` }}
												/>
												<span
													className="spending-monthly-average__label"
													style={{ bottom: `${Math.min(100, Math.round((monthlyAverage / chartMax) * 10000) / 100)}%` }}
												>
													{formatMoney(monthlyAverage, group.currency)}
												</span>
											</div>
										) : null}
										<div className="spending-monthly-columns">
											{group.months.map((month) => (
												<div key={month.month} className="spending-monthly-column">
													<div className="spending-monthly-column__bars">
														<div
															className="spending-monthly-bar spending-monthly-bar--previous"
															title={`${previousYear}: ${formatMoney(month.previous_total, group.currency)}`}
															style={{
																height: `${month.previous_total > 0 ? Math.max(2, Math.round((month.previous_total / chartMax) * 100)) : 0}%`,
															}}
														/>
														<div
															className="spending-monthly-bar spending-monthly-bar--current"
															title={`${currentYear}: ${formatMoney(month.current_total, group.currency)}`}
															style={{
																height: `${month.current_total > 0 ? Math.max(2, Math.round((month.current_total / chartMax) * 100)) : 0}%`,
															}}
														/>
													</div>
													<span>{formatMonth(month.month)}</span>
												</div>
											))}
										</div>
									</div>
								</div>
							</section>
						)
					})}
				</div>
				<Status
					message={
						loading
							? "Loading monthly spending..."
							: error ??
								(breakdown?.item_count ? `${breakdown.item_count} receipt item(s) across all time.` : "No receipt items recorded yet.")
					}
					error={!!error}
				/>
			</div>
		</section>
	)
}

export const SpendingItemsPage = ({ link }: { link: (p: string) => string }) => {
	const [query, setQuery] = useState("")
	const { data: breakdown, loading, error } = useApi<SpendingBreakdown>("/api/spending?range=all")

	const filtered = useMemo(() => {
		if (!breakdown) return []
		const q = query.trim().toLowerCase()
		const all = flattenItems(breakdown)
		if (!q) return all
		return all.filter((item) => {
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
			return q.split(/\s+/).every((term) => haystack.includes(term))
		})
	}, [breakdown, query])

	const shown = filtered.slice(0, query.trim() ? 100 : 50)
	const total = breakdown?.item_count ?? 0

	return (
		<section className="workspace workspace--single">
			<div className="spending-breakdown-panel">
				<div className="section-header">
					<h2>Receipt Items</h2>
				</div>
				<div className="toolbar">
					<input
						id="spending-items-search"
						type="search"
						placeholder="Search product, store, category, receipt id"
						autoComplete="off"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
					/>
					<button id="spending-items-clear" className="secondary" type="button" onClick={() => setQuery("")}>
						Clear
					</button>
				</div>
				<div id="spending-items-results">
					{loading ? <p className="page-copy">Loading receipt items...</p> : null}
					{!loading && total === 0 ? <Empty message="No receipt items recorded yet." /> : null}
					{!loading && total > 0 && filtered.length === 0 ? <Empty message="No receipt items match that search." /> : null}
					{!loading && shown.length > 0 ? (
						<div className="spending-items-list">
							{shown.map((item) => (
								<a
									key={`${item.id}-${item.receipt_id}`}
									className="spending-breakdown-item"
									href={link(item.product_id === null ? `/receipts/${item.receipt_id}` : `/products/${item.product_id}`)}
									data-link=""
								>
									<div className="spending-breakdown-item__main">
										<strong>{item.product_name}</strong>
										<span>{`${item.store_name} · ${formatReceiptDateTime(item.purchased_at)}`}</span>
									</div>
									<div className="spending-breakdown-item__meta">
										<span>{`${item.quantity} ${item.unit} · ${item.category}`}</span>
										<strong>{formatMoney(item.amount, item.currency)}</strong>
									</div>
								</a>
							))}
						</div>
					) : null}
				</div>
				<Status
					message={
						loading
							? "Loading receipt items..."
							: error ??
								(total === 0
									? "No receipt items recorded yet."
									: filtered.length === 0
										? "No receipt items match that search."
										: query.trim()
											? `${shown.length} of ${filtered.length} matching receipt item(s), ${total} total.`
											: `${shown.length} of ${total} receipt item(s).`)
					}
					error={!!error}
				/>
			</div>
		</section>
	)
}
