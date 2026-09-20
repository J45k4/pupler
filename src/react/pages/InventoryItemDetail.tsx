import { useEffect, useState } from "react"
import { apiFetch } from "../api"
import {
	Empty,
	Status,
	formatMoney,
	formatReceiptDateTime,
	useApi,
	type InventoryContainer,
	type InventoryItem,
	type Product,
	type PurchaseReceipt,
	type ReceiptItem,
} from "../lib"
import { expirationTag, updateInventoryItem } from "../inventory"

type ItemImage = {
	id: number
	inventory_item_id: number
	file_id: number
	created_at: string
	file: { id: number; content_type: string; filename: string | null; size_bytes: number; created_at: string }
}

type ItemDetail = InventoryItem & { inventory_item_images?: ItemImage[] }

const rowLabel = (
	receiptItem: ReceiptItem,
	receiptsById: Map<number, PurchaseReceipt>,
	productsById: Map<number, Product>,
) => {
	const receipt = receiptsById.get(receiptItem.receipt_id)
	const product = productsById.get(receiptItem.product_id)
	const receiptLabel = receipt ? `${receipt.store_name}, ${formatReceiptDateTime(receipt.purchased_at)}` : `Receipt #${receiptItem.receipt_id}`
	const productLabel = product?.name ?? `Product #${receiptItem.product_id}`
	const totalLabel = receipt && receiptItem.line_total !== null ? `, ${formatMoney(receiptItem.line_total, receipt.currency)}` : ""
	return `${receiptLabel} · ${productLabel} · ${receiptItem.quantity} ${receiptItem.unit}${totalLabel}`
}

export const InventoryItemDetailPage = ({ id, link }: { id: string; link: (p: string) => string }) => {
	const itemId = Number.parseInt(id, 10)
	const valid = Number.isInteger(itemId)
	const { data: item, loading, error, reload } = useApi<ItemDetail>(valid ? `/api/inventory-items/${itemId}` : null)
	const { data: products } = useApi<Product[]>("/api/products")
	const { data: receiptItems } = useApi<ReceiptItem[]>("/api/receipt-items?sort=created_at&order=desc")
	const { data: receipts } = useApi<PurchaseReceipt[]>("/api/receipts?sort=purchased_at&order=desc")
	const { data: container } = useApi<InventoryContainer>(
		item?.container_id != null ? `/api/inventory-containers/${item.container_id}` : null,
	)

	const [productId, setProductId] = useState("")
	const [receiptItemId, setReceiptItemId] = useState("")
	const [linksStatus, setLinksStatus] = useState("")
	const [linksError, setLinksError] = useState(false)
	const [pictureStatus, setPictureStatus] = useState("")
	const [pictureError, setPictureError] = useState(false)
	const [files, setFiles] = useState<FileList | null>(null)

	useEffect(() => {
		if (!item) return
		setProductId(item.product_id === null ? "" : String(item.product_id))
		setReceiptItemId(item.receipt_item_id === null ? "" : String(item.receipt_item_id))
	}, [item?.id])

	if (!valid) return <div className="card panel page-panel"><p className="page-copy">Inventory item id is invalid.</p></div>
	if (loading) return <p className="page-copy">Loading…</p>
	if (error || !item) return <Status message={error ?? "Failed to load inventory item."} error />

	const expiration = expirationTag(item)
	const allProducts = products ?? []
	const allReceiptItems = receiptItems ?? []
	const allReceipts = receipts ?? []
	const receiptsById = new Map(allReceipts.map((r) => [r.id, r]))
	const productsById = new Map(allProducts.map((p) => [p.id, p]))
	const images = item.inventory_item_images ?? []
	const date = (v: string | null) => (v ? formatReceiptDateTime(v) : "-")

	const saveLinks = async (event: React.FormEvent) => {
		event.preventDefault()
		try {
			await updateInventoryItem(item.id, {
				product_id: productId ? Number.parseInt(productId, 10) : null,
				receipt_item_id: receiptItemId ? Number.parseInt(receiptItemId, 10) : null,
			})
			setLinksStatus("Saved links.")
			setLinksError(false)
			reload()
		} catch (err) {
			setLinksStatus(err instanceof Error ? err.message : "Failed to save links.")
			setLinksError(true)
		}
	}

	const upload = async (event: React.FormEvent) => {
		event.preventDefault()
		if (!files?.length) {
			setPictureStatus("Choose one or more images before uploading.")
			setPictureError(true)
			return
		}
		try {
			for (const file of Array.from(files)) {
				const formData = new FormData()
				formData.set("file", file)
				const response = await fetch(`/api/inventory-items/${item.id}/pictures`, { method: "POST", body: formData })
				if (!response.ok) {
					const body = (await response.json().catch(() => null)) as { error?: string } | null
					throw new Error(body?.error ?? "Failed to upload image")
				}
			}
			setFiles(null)
			setPictureStatus("Uploaded images.")
			setPictureError(false)
			reload()
		} catch (err) {
			setPictureStatus(err instanceof Error ? err.message : "Failed to upload images.")
			setPictureError(true)
		}
	}

	const removeImage = async (imageId: number) => {
		try {
			const response = await fetch(`/api/inventory-items/${item.id}/pictures/${imageId}`, { method: "DELETE" })
			if (!response.ok) {
				const body = (await response.json().catch(() => null)) as { error?: string } | null
				throw new Error(body?.error ?? "Failed to remove image")
			}
			setPictureStatus("Removed image.")
			setPictureError(false)
			reload()
		} catch (err) {
			setPictureStatus(err instanceof Error ? err.message : "Failed to remove image.")
			setPictureError(true)
		}
	}

	const meta = (label: string, value: React.ReactNode) => (
		<div>
			<dt>{label}</dt>
			<dd>{value}</dd>
		</div>
	)

	return (
		<>
			<section className="page-heading page-heading--compact">
				<div>
					<span className="eyebrow">Inventory Item</span>
				</div>
				<a className="secondary action-link" href={link("/inventory")} data-link="">
					Back To Inventory
				</a>
			</section>
			<section className="workspace inventory-item-detail-grid">
				<div className="card panel">
					<div className="section-header">
						<h2>Properties</h2>
						<span className={item.consumed_at ? "tag tag--neutral" : "tag"}>
							{item.consumed_at ? "Consumed" : "Active"}
						</span>
					</div>
					<dl className="receipt-metadata">
						{meta("Name", item.name)}
						{meta("Quantity", String(item.quantity))}
						{meta("Unit", item.unit)}
						{meta("Purchased", date(item.purchased_at))}
						{meta("Expires", date(item.expires_at))}
						{meta("Consumed", date(item.consumed_at))}
						{meta("Notes", item.notes ?? "-")}
						{meta("Created", formatReceiptDateTime(item.created_at))}
						{meta("Updated", formatReceiptDateTime(item.updated_at))}
					</dl>
				</div>
				<div className="card panel">
					<div className="section-header">
						<h2>Links & IDs</h2>
						<span className={expiration.className}>{expiration.label}</span>
					</div>
					<form id="inventory-item-links-form" className="inventory-link-form" onSubmit={saveLinks}>
						<label>
							Product
							<select id="inventory-item-product-id" name="product_id" value={productId} onChange={(e) => setProductId(e.target.value)}>
								{allProducts.length === 0 && item.product_id === null ? (
									<option value="">No products in Pupler yet</option>
								) : (
									<>
										<option value="">No product link</option>
										{item.product_id !== null && !allProducts.some((p) => p.id === item.product_id) ? (
											<option value={String(item.product_id)}>{item.product?.name ?? `Product #${item.product_id}`}</option>
										) : null}
										{allProducts.map((p) => (
											<option key={p.id} value={String(p.id)}>
												{p.barcode ? `${p.name} (${p.barcode})` : p.name}
											</option>
										))}
									</>
								)}
							</select>
						</label>
						<label>
							Receipt Row
							<select id="inventory-item-receipt-item-id" name="receipt_item_id" value={receiptItemId} onChange={(e) => setReceiptItemId(e.target.value)}>
								{allReceiptItems.length === 0 && item.receipt_item_id === null ? (
									<option value="">No receipt rows in Pupler yet</option>
								) : (
									<>
										<option value="">No receipt row link</option>
										{item.receipt_item_id !== null && !allReceiptItems.some((r) => r.id === item.receipt_item_id) ? (
											<option value={String(item.receipt_item_id)}>{`Receipt row #${item.receipt_item_id}`}</option>
										) : null}
										{allReceiptItems.map((r) => (
											<option key={r.id} value={String(r.id)}>
												{rowLabel(r, receiptsById, productsById)}
											</option>
										))}
									</>
								)}
							</select>
						</label>
						<div className="actions">
							<button className="primary" type="submit">
								Save Links
							</button>
						</div>
					</form>
					<Status message={linksStatus} error={linksError} />
					<dl className="receipt-metadata">
						{meta("Inventory Item ID", String(item.id))}
						{meta(
							"Location",
							item.container_id === null ? (
								"Top level"
							) : container ? (
								<a className="metadata-link" href={link(`/inventory/containers/${container.id}`)} data-link="">
									{container.name}
								</a>
							) : (
								`Container #${item.container_id}`
							),
						)}
						{meta("Container ID", item.container_id === null ? "-" : String(item.container_id))}
						{meta(
							"Product",
							item.product_id === null ? (
								"-"
							) : item.product ? (
								<a className="metadata-link" href={link(`/products/${item.product.id}`)} data-link="">
									{item.product.name}
								</a>
							) : (
								`Product #${item.product_id}`
							),
						)}
						{meta("Product ID", item.product_id === null ? "-" : String(item.product_id))}
						{meta("Ingredient", item.ingredient?.name ?? (item.ingredient_id === null ? "-" : `Ingredient #${item.ingredient_id}`))}
						{meta("Ingredient ID", item.ingredient_id === null ? "-" : String(item.ingredient_id))}
						{meta("Receipt Row ID", item.receipt_item_id === null ? "-" : String(item.receipt_item_id))}
					</dl>
				</div>
				<div className="card panel inventory-item-images-panel">
					<h2>Images</h2>
					{images.length ? (
						<div className="recipe-image-gallery inventory-item-image-gallery">
							{images.map((image) => (
								<article key={image.id} className="recipe-image-card">
									<img
										className="recipe-image-card__image"
										src={`/api/inventory-items/${item.id}/pictures/${image.id}?updated=${encodeURIComponent(image.created_at)}`}
										alt={image.file.filename ?? item.name}
									/>
									<div className="recipe-image-card__meta">
										<div>
											<strong>{image.file.filename ?? `Image #${image.id}`}</strong>
											<div className="section-copy">{formatReceiptDateTime(image.created_at)}</div>
										</div>
										<button className="secondary" type="button" onClick={() => void removeImage(image.id)}>
											Remove
										</button>
									</div>
								</article>
							))}
						</div>
					) : (
						<Empty message="No inventory item images uploaded yet." />
					)}
					<form id="inventory-item-picture-form" className="recipe-picture__form inventory-item-picture__form" onSubmit={upload}>
						<label>
							Images
							<input
								id="inventory-item-picture-input"
								name="picture"
								type="file"
								accept="image/*"
								multiple
								onChange={(e) => setFiles(e.target.files)}
							/>
						</label>
						<div className="actions">
							<button className="secondary" type="submit">
								Upload Images
							</button>
						</div>
					</form>
					<Status message={pictureStatus} error={pictureError} />
				</div>
			</section>
		</>
	)
}
