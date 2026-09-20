import { useState } from "react"
import { apiFetch } from "../api"
import { Empty, Modal, Status, useApi, type Product } from "../lib"
import { ProductCard, UnitSelect, findOrCreateIngredientByName, uploadProductPicture } from "../catalog"

type SearchType = "auto" | "barcode" | "name" | "includes"

const queryFor = (search: string, field: "barcode" | "name" | "name_contains") =>
	search ? `/api/products?${field}=${encodeURIComponent(search)}` : "/api/products"

export const ProductsPage = ({ link }: { link: (p: string) => string }) => {
	const [search, setSearch] = useState("")
	const [searchType, setSearchType] = useState<SearchType>("auto")
	const [submitted, setSubmitted] = useState<{ q: string; t: SearchType }>({ q: "", t: "auto" })
	const [status, setStatus] = useState("")
	const [statusError, setStatusError] = useState(false)
	const [modalOpen, setModalOpen] = useState(false)
	const [modalStatus, setModalStatus] = useState("")

	const [name, setName] = useState("")
	const [category, setCategory] = useState("")
	const [barcode, setBarcode] = useState("")
	const [ingredientName, setIngredientName] = useState("")
	const [defaultUnit, setDefaultUnit] = useState<string | null>(null)
	const [isPerishable, setIsPerishable] = useState("true")
	const [picture, setPicture] = useState<File | null>(null)

	const field =
		submitted.t === "barcode" ? "barcode" : submitted.t === "name" ? "name" : submitted.t === "includes" ? "name_contains" : "barcode"
	const { data, loading, error, reload } = useApi<Product[]>(queryFor(submitted.q, field))

	const find = () => {
		setSubmitted({ q: search.trim(), t: searchType })
	}

	const create = async (event: React.FormEvent) => {
		event.preventDefault()
		try {
			const trimmedIngredient = ingredientName.trim()
			const ingredient = trimmedIngredient
				? await findOrCreateIngredientByName(trimmedIngredient, defaultUnit)
				: null
			const created = await apiFetch<Product>("/api/products", {
				method: "POST",
				body: JSON.stringify({
					ingredient_id: ingredient?.id ?? null,
					name: name.trim(),
					category: category.trim(),
					barcode: barcode.trim() || null,
					default_unit: defaultUnit,
					is_perishable: isPerishable === "true",
				}),
			})
			if (picture) await uploadProductPicture(created.id, picture)
			setName("")
			setCategory("")
			setBarcode("")
			setIngredientName("")
			setDefaultUnit(null)
			setIsPerishable("true")
			setPicture(null)
			setSearch(created.barcode ?? "")
			setSubmitted({ q: created.barcode ?? "", t: "barcode" })
			setModalOpen(false)
			const msg = picture ? `Created product #${created.id} and uploaded picture` : `Created product #${created.id}: ${created.name}`
			setStatus(msg)
			setStatusError(false)
			setModalStatus(msg)
			reload()
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Failed to create product"
			setModalStatus(msg)
			setStatus(msg)
			setStatusError(true)
		}
	}

	const products = data ?? []

	return (
		<>
			<section className="workspace workspace--single">
				<div className="card panel">
					<h2>Product Lookup</h2>
					<div className="toolbar">
						<select
							id="product-search-type"
							className="toolbar__select"
							aria-label="Product search type"
							value={searchType}
							onChange={(e) => setSearchType(e.target.value as SearchType)}
						>
							<option value="auto">Auto</option>
							<option value="barcode">Barcode</option>
							<option value="name">Name</option>
							<option value="includes">Includes</option>
						</select>
						<input
							id="barcode-filter"
							placeholder="Scan barcode or type product name"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault()
									find()
								}
							}}
						/>
						<button id="filter-button" className="secondary" type="button" onClick={find}>
							Find
						</button>
						<a className="secondary action-link" href={link("/products/stats")} data-link="">
							Stats
						</a>
						<button id="open-product-modal-button" className="primary" type="button" onClick={() => { setModalStatus(""); setModalOpen(true) }}>
							Add
						</button>
					</div>
					<Status message={loading ? "Loading…" : error ?? status} error={!!error || statusError} />
					{!loading && !error ? (
						products.length === 0 ? (
							<Empty message="No products found." />
						) : (
							<div id="results" className="results">
								{products.map((p) => (
									<ProductCard key={p.id} product={p} link={link} />
								))}
							</div>
						)
					) : null}
				</div>
			</section>
			<Modal id="product-create-modal" title="Create Product" open={modalOpen} onClose={() => setModalOpen(false)} className="product-create-modal">
				<form id="product-form" onSubmit={create}>
					<label>
						Name
						<input id="name" name="name" placeholder="Milk" required value={name} onChange={(e) => setName(e.target.value)} />
					</label>
					<div className="row">
						<label>
							Category
							<input id="category" name="category" required value={category} onChange={(e) => setCategory(e.target.value)} />
						</label>
						<UnitSelect id="default_unit" name="default_unit" label="Unit" value={defaultUnit} onChange={(v) => setDefaultUnit(v || null)} allowEmpty />
					</div>
					<label>
						Barcode
						<input id="barcode" name="barcode" placeholder="6414893400012" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
					</label>
					<label>
						Ingredient
						<input id="ingredient_name" name="ingredient_name" placeholder="Sausage" value={ingredientName} onChange={(e) => setIngredientName(e.target.value)} />
					</label>
					<label>
						Picture
						<input id="picture" name="picture" type="file" accept="image/*" onChange={(e) => setPicture(e.target.files?.[0] ?? null)} />
					</label>
					<label>
						Perishable
						<select id="is_perishable" name="is_perishable" value={isPerishable} onChange={(e) => setIsPerishable(e.target.value)}>
							<option value="true">true</option>
							<option value="false">false</option>
						</select>
					</label>
					<div className="actions">
						<button className="primary" type="submit">
							Create Product
						</button>
					</div>
				</form>
				<Status message={modalStatus} error={!!modalStatus} />
			</Modal>
		</>
	)
}
