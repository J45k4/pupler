import { useMemo, useState } from "react"
import { Empty, Status, formatMoney, useApi } from "../lib"

type UnitQuantity = { unit: string; quantity: number }
type MoneyTotal = { currency: string; total: number }

type ProductStatsRow = {
	product_id: number
	product_name: string
	category: string
	default_unit: string | null
	bought_count: number
	bought_quantities: UnitQuantity[]
	total_costs: MoneyTotal[]
	total_cost_sort: number
	used_count: number
	used_quantities: UnitQuantity[]
	used_sort_quantity: number
}

type SortKey = "product_name" | "category" | "bought_count" | "total_cost_sort" | "used_count" | "used_sort_quantity"

const columns: Array<{ key: SortKey; label: string }> = [
	{ key: "product_name", label: "Product" },
	{ key: "category", label: "Category" },
	{ key: "bought_count", label: "Times Bought" },
	{ key: "total_cost_sort", label: "Total Cost" },
	{ key: "used_count", label: "Used Entries" },
	{ key: "used_sort_quantity", label: "Used Amount" },
]

const formatQuantity = (value: number) =>
	Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")

export const ProductStatsPage = ({ link }: { link: (p: string) => string }) => {
	const { data, loading, error } = useApi<ProductStatsRow[]>("/api/product-stats")
	const [sortKey, setSortKey] = useState<SortKey>("bought_count")
	const [direction, setDirection] = useState<"asc" | "desc">("desc")

	const rows = useMemo(() => {
		const mult = direction === "asc" ? 1 : -1
		return [...(data ?? [])].sort((l, r) => {
			const lv = l[sortKey]
			const rv = r[sortKey]
			if (typeof lv === "number" && typeof rv === "number") {
				return (lv - rv) * mult || l.product_name.localeCompare(r.product_name)
			}
			return String(lv).localeCompare(String(rv)) * mult || l.product_name.localeCompare(r.product_name)
		})
	}, [data, sortKey, direction])

	const toggle = (key: SortKey) => {
		if (sortKey === key) {
			setDirection((d) => (d === "asc" ? "desc" : "asc"))
		} else {
			setSortKey(key)
			setDirection(key === "product_name" || key === "category" ? "asc" : "desc")
		}
	}

	return (
		<section className="workspace workspace--single">
			<div className="card panel">
				<div className="section-header">
					<div>
						<h2>Product Stats</h2>
					</div>
					<a className="secondary action-link" href={link("/products")} data-link="">
						Products
					</a>
				</div>
				<Status
					message={loading ? "Loading product stats..." : error ?? `${rows.length} products loaded.`}
					error={!!error}
				/>
				{!loading && !error ? (
					rows.length === 0 ? (
						<Empty message="No products yet." />
					) : (
						<table className="shoppinglist-table product-stats-table">
							<thead>
								<tr>
									{columns.map((col) => (
										<th key={col.key} scope="col">
											<button
												className={`product-stats-sort${sortKey === col.key ? " product-stats-sort--active" : ""}`}
												aria-label={`Sort by ${col.label}`}
												onClick={() => toggle(col.key)}
											>
												<span>{col.label}</span>
												<span className="product-stats-sort__marker">
													{sortKey === col.key ? (direction === "asc" ? "^" : "v") : ""}
												</span>
											</button>
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{rows.map((row) => (
									<tr key={row.product_id}>
										<td>
											<a href={link(`/products/${row.product_id}`)} data-link="">
												{row.product_name}
											</a>
										</td>
										<td>{row.category}</td>
										<td>{String(row.bought_count)}</td>
										<td>
											{row.total_costs.length
												? row.total_costs.map((t) => formatMoney(t.total, t.currency)).join(", ")
												: "-"}
										</td>
										<td>{String(row.used_count)}</td>
										<td>
											{row.used_quantities.length
												? row.used_quantities.map((q) => `${formatQuantity(q.quantity)} ${q.unit}`).join(", ")
												: "-"}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)
				) : null}
			</div>
		</section>
	)
}
