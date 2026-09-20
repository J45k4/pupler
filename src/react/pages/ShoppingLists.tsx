import { useState } from "react"
import { apiFetch } from "../api"
import { Empty, Status, formatShoppingDate, useApi, type ShoppingListItem } from "../lib"

export const ShoppingListsPage = ({ link }: { link: (p: string) => string }) => {
	const [showDone, setShowDone] = useState(false)
	const [name, setName] = useState("")
	const [status, setStatus] = useState("")
	const [statusError, setStatusError] = useState(false)

	const query = showDone ? "" : "?done=false"
	const { data, loading, error, reload } = useApi<ShoppingListItem[]>(`/api/shopping-list-items${query}`)
	const items = data ?? []

	const toggle = async (item: ShoppingListItem, done: boolean) => {
		try {
			await apiFetch(`/api/shopping-list-items/${item.id}`, {
				method: "PATCH",
				body: JSON.stringify({ done }),
			})
			setStatus("Shoppinglist updated.")
			setStatusError(false)
			reload()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to update shoppinglist item")
			setStatusError(true)
		}
	}

	const add = async (event: React.FormEvent) => {
		event.preventDefault()
		const trimmed = name.trim()
		if (!trimmed) {
			setStatus("Thing name is required")
			setStatusError(true)
			return
		}
		try {
			await apiFetch("/api/shopping-list-items", {
				method: "POST",
				body: JSON.stringify({
					name: trimmed,
					ingredient_id: null,
					product_id: null,
					quantity: 1,
					unit: "pcs",
					done: false,
					source_recipe_id: null,
					notes: null,
				}),
			})
			setStatus(`Added ${trimmed} to shoppinglist.`)
			setStatusError(false)
			setName("")
			reload()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to add thing to shoppinglist")
			setStatusError(true)
		}
	}

	return (
		<section className="workspace workspace--single">
			<div className="card panel shoppinglist-create-panel">
				<form id="shopping-list-item-form" onSubmit={add}>
					<div className="shoppinglist-input">
						<input
							id="shopping-thing-name"
							name="shopping-thing-name"
							placeholder="Milk"
							autoComplete="off"
							required
							value={name}
							onChange={(e) => setName(e.target.value)}
						/>
						<button className="primary" type="submit">
							Add
						</button>
					</div>
				</form>
				<Status
					message={loading ? "Loading…" : (error ?? status) || (showDone ? `Loaded ${items.length} shoppinglist item(s).` : `Loaded ${items.length} active shoppinglist item(s).`)}
					error={!!error || statusError}
				/>
			</div>
			<div className="card panel shoppinglist-results-panel">
				<div className="section-header section-header--end">
					<label className="checkbox-toggle" htmlFor="shoppinglist-show-done">
						<input
							id="shoppinglist-show-done"
							type="checkbox"
							checked={showDone}
							onChange={(e) => setShowDone(e.target.checked)}
							aria-label="Show done shoppinglist items"
						/>
						<span>Show done</span>
					</label>
				</div>
				<div id="shopping-list-item-results" className="results">
					{!loading && !error ? (
						items.length === 0 ? (
							<Empty message="No items in the shoppinglist yet." />
						) : (
							<table className="shoppinglist-table shoppinglist-table--shopping">
								<thead>
									<tr>
										<th>Done</th>
										<th>Name</th>
										<th>Date</th>
									</tr>
								</thead>
								<tbody>
									{items.map((item) => {
										const pictureUpdated = item.product?.picture_file?.created_at ?? null
										return (
											<tr key={item.id} className={item.done ? "shoppinglist-table__row shoppinglist-table__row--done" : "shoppinglist-table__row"}>
												<td className="shoppinglist-table__check">
													<input
														type="checkbox"
														checked={item.done}
														aria-label={`Mark ${item.name} done`}
														onChange={(e) => void toggle(item, e.target.checked)}
													/>
												</td>
												<td>
													<div className="shoppinglist-product">
														{item.product_id ? (
															<img
																className="shoppinglist-product__image"
																src={pictureUpdated ? `/api/products/${item.product_id}/picture?updated=${encodeURIComponent(pictureUpdated)}` : `/api/products/${item.product_id}/picture`}
																alt={item.product?.name ?? item.name}
																loading="lazy"
																onError={(e) => e.currentTarget.remove()}
															/>
														) : null}
														<div>
															<div className="shoppinglist-product__name">{item.name}</div>
															{item.product ? (
																<a className="shoppinglist-product__linked" href={link(`/products/${item.product.id}`)} data-link="">
																	{`Product: ${item.product.name}`}
																</a>
															) : null}
														</div>
													</div>
												</td>
												<td className="shoppinglist-table__date">
													<span className="shoppinglist-table__date-label">{item.done ? "Done" : "Added"}</span>
													<span className="shoppinglist-table__date-value">
														{formatShoppingDate(item.done ? item.updated_at : item.created_at)}
													</span>
												</td>
											</tr>
										)
									})}
								</tbody>
							</table>
						)
					) : null}
				</div>
			</div>
		</section>
	)
}
