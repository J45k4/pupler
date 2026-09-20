import { useEffect, useState } from "react"
import { apiFetch } from "../api"
import { Empty, Status, formatReceiptDateTime, useApi, type Product } from "../lib"
import { UnitSelect, deleteProductPicture, findOrCreateIngredientByName, uploadProductPicture } from "../catalog"

export const ProductDetailPage = ({ id, link }: { id: string; link: (p: string) => string }) => {
	const productId = Number.parseInt(id, 10)
	const { data: product, loading, error, reload } = useApi<Product>(
		Number.isInteger(productId) ? `/api/products/${productId}` : null,
	)

	const [name, setName] = useState("")
	const [category, setCategory] = useState("")
	const [barcode, setBarcode] = useState("")
	const [ingredientName, setIngredientName] = useState("")
	const [defaultUnit, setDefaultUnit] = useState<string | null>(null)
	const [isPerishable, setIsPerishable] = useState("true")
	const [status, setStatus] = useState("")
	const [statusError, setStatusError] = useState(false)
	const [pictureStatus, setPictureStatus] = useState("")
	const [pictureError, setPictureError] = useState(false)
	const [picture, setPicture] = useState<File | null>(null)
	const [pictureBroken, setPictureBroken] = useState(false)

	useEffect(() => {
		if (!product) return
		setName(product.name)
		setCategory(product.category)
		setBarcode(product.barcode ?? "")
		setIngredientName(product.ingredient?.name ?? "")
		setDefaultUnit(product.default_unit)
		setIsPerishable(String(product.is_perishable))
		setPictureBroken(false)
	}, [product?.id])

	if (!Number.isInteger(productId)) return <div className="card panel page-panel"><p className="page-copy">Product id is invalid.</p></div>
	if (loading) return <p className="page-copy">Loading…</p>
	if (error || !product) return <Status message={error ?? "Failed to load product."} error />

	const pictureUrl = product.picture_file?.created_at
		? `/api/products/${product.id}/picture?updated=${encodeURIComponent(product.picture_file.created_at)}`
		: `/api/products/${product.id}/picture`

	const save = async (event: React.FormEvent) => {
		event.preventDefault()
		try {
			const trimmed = ingredientName.trim()
			const ingredient = trimmed ? await findOrCreateIngredientByName(trimmed, defaultUnit) : null
			const updated = await apiFetch<Product>(`/api/products/${product.id}`, {
				method: "PATCH",
				body: JSON.stringify({
					ingredient_id: ingredient?.id ?? null,
					name: name.trim(),
					category: category.trim(),
					barcode: barcode.trim() || null,
					default_unit: defaultUnit,
					is_perishable: isPerishable === "true",
				}),
			})
			setStatus(`Saved ${updated.name}.`)
			setStatusError(false)
			reload()
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to update product")
			setStatusError(true)
		}
	}

	const upload = async (event: React.FormEvent) => {
		event.preventDefault()
		if (!picture) {
			setPictureStatus("Choose an image before uploading.")
			setPictureError(true)
			return
		}
		try {
			await uploadProductPicture(product.id, picture)
			setPicture(null)
			setPictureStatus(`Uploaded picture for ${product.name}.`)
			setPictureError(false)
			reload()
		} catch (err) {
			setPictureStatus(err instanceof Error ? err.message : "Failed to upload product picture")
			setPictureError(true)
		}
	}

	const removePicture = async () => {
		try {
			await deleteProductPicture(product.id)
			setPictureStatus(`Removed picture for ${product.name}.`)
			setPictureError(false)
			reload()
		} catch (err) {
			setPictureStatus(err instanceof Error ? err.message : "Failed to remove product picture")
			setPictureError(true)
		}
	}

	return (
		<>
			<section className="page-heading page-heading--compact">
				<div>
					<span className="eyebrow">Product</span>
				</div>
				<a className="secondary action-link" href={link("/products")} data-link="">
					Back To Products
				</a>
			</section>
			<section className="workspace product-detail-grid">
				<div className="card panel">
					<h2>Picture</h2>
					<div className="receipt-picture">
						{pictureBroken ? (
							<Empty message="No product picture uploaded." />
						) : (
							<img className="receipt-picture__image" src={pictureUrl} alt={product.name} loading="lazy" onError={() => setPictureBroken(true)} />
						)}
					</div>
					<form id="product-picture-form" className="product-picture__form" onSubmit={upload}>
						<label>
							Picture
							<input id="product-picture-input" name="picture" type="file" accept="image/*" onChange={(e) => setPicture(e.target.files?.[0] ?? null)} />
						</label>
						<div className="actions">
							<button className="secondary" type="submit">
								Upload Picture
							</button>
							{product.picture_file ? (
								<button id="product-picture-delete" className="secondary" type="button" onClick={() => void removePicture()}>
									Remove Picture
								</button>
							) : null}
						</div>
					</form>
					<Status message={pictureStatus} error={pictureError} />
				</div>
				<div className="card panel">
					<div className="section-header">
						<h2>Details</h2>
						<span className={product.is_perishable ? "tag" : "tag tag--neutral"}>
							{product.is_perishable ? "Perishable" : "Shelf stable"}
						</span>
					</div>
					<form id="product-detail-form" onSubmit={save}>
						<label>
							Name
							<input id="product-detail-name" required value={name} onChange={(e) => setName(e.target.value)} />
						</label>
						<div className="row">
							<label>
								Category
								<input id="product-detail-category" required value={category} onChange={(e) => setCategory(e.target.value)} />
							</label>
							<UnitSelect id="product-detail-default-unit" name="default_unit" label="Unit" value={defaultUnit} onChange={(v) => setDefaultUnit(v || null)} allowEmpty />
						</div>
						<label>
							Ingredient
							<input id="product-detail-ingredient-name" placeholder="Sausage" value={ingredientName} onChange={(e) => setIngredientName(e.target.value)} />
						</label>
						<label>
							Barcode
							<input id="product-detail-barcode" placeholder="6414893400012" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
						</label>
						<label>
							Perishable
							<select id="product-detail-is-perishable" value={isPerishable} onChange={(e) => setIsPerishable(e.target.value)}>
								<option value="true">true</option>
								<option value="false">false</option>
							</select>
						</label>
						<div className="actions">
							<button className="primary" type="submit">
								Save Product
							</button>
						</div>
					</form>
					<dl className="receipt-metadata">
						<div>
							<dt>Ingredient Link</dt>
							<dd>{product.ingredient?.name ?? "-"}</dd>
						</div>
						<div>
							<dt>Created</dt>
							<dd>{formatReceiptDateTime(product.created_at)}</dd>
						</div>
						<div>
							<dt>Updated</dt>
							<dd>{formatReceiptDateTime(product.updated_at)}</dd>
						</div>
					</dl>
					<Status message={status} error={statusError} />
				</div>
			</section>
		</>
	)
}
