import { apiFetch } from "./api"
import { setDragPayload } from "./dnd"
import type { IngredientSummary, Product, PurchaseReceipt } from "./lib"
import { formatMoney, formatReceiptDateTime } from "./lib"

export const UNITS = ["pcs", "g", "kg", "ml", "l", "tbsp", "tsp", "cup", "can", "pack", "m", "cm", "mm"]

export const findOrCreateIngredientByName = async (
	name: string,
	defaultUnit: string | null = null,
): Promise<IngredientSummary> => {
	const matches = await apiFetch<IngredientSummary[]>(`/api/ingredients?name=${encodeURIComponent(name)}`)
	if (matches.length > 0) return matches[0]!
	return apiFetch<IngredientSummary>("/api/ingredients", {
		method: "POST",
		body: JSON.stringify({ name, default_unit: defaultUnit }),
	})
}

export const uploadProductPicture = async (productId: number, file: File) => {
	const formData = new FormData()
	formData.set("file", file)
	const response = await fetch(`/api/products/${productId}/picture`, {
		method: "POST",
		body: formData,
	})
	const body = (await response.json()) as { error?: string }
	if (!response.ok) throw new Error(body.error ?? "Failed to upload product picture")
}

export const deleteProductPicture = async (productId: number) => {
	const response = await fetch(`/api/products/${productId}/picture`, { method: "DELETE" })
	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as { error?: string } | null
		throw new Error(body?.error ?? "Failed to remove product picture")
	}
}

export const UnitSelect = ({
	id,
	name,
	label,
	value,
	onChange,
	allowEmpty = false,
	emptyLabel = "No default unit",
	required = false,
}: {
	id: string
	name: string
	label: string
	value: string | null
	onChange: (v: string) => void
	allowEmpty?: boolean
	emptyLabel?: string
	required?: boolean
}) => (
	<label htmlFor={id}>
		{label}
		<select id={id} name={name} value={value ?? ""} onChange={(e) => onChange(e.target.value)} required={required}>
			{allowEmpty ? <option value="">{emptyLabel}</option> : null}
			{UNITS.map((u) => (
				<option key={u} value={u}>
					{u}
				</option>
			))}
		</select>
	</label>
)

export const ReceiptCard = ({
	receipt,
	link,
	draggable = true,
	className = "",
}: {
	receipt: PurchaseReceipt
	link: (p: string) => string
	draggable?: boolean
	className?: string
}) => (
	<a
		className={`receipt-card${className ? ` ${className}` : ""}`}
		href={link(`/receipts/${receipt.id}`)}
		data-link=""
		draggable={draggable}
		data-receipt-drag-id={draggable ? String(receipt.id) : undefined}
		onDragStart={
			draggable
				? (event) => {
						setDragPayload(event, { kind: "receipt", id: receipt.id })
						event.currentTarget.classList.add("receipt-card--dragging")
					}
				: undefined
		}
		onDragEnd={
			draggable
				? (event) => {
						event.currentTarget.classList.remove("receipt-card--dragging")
					}
				: undefined
		}
	>
		<div className="receipt-card__tags">
			<span className={receipt.group ? "tag" : "tag tag--neutral"}>
				{receipt.group?.name ?? "Ungrouped"}
			</span>
			<span className="tag tag--neutral">{receipt.currency}</span>
		</div>
		<strong>{receipt.store_name}</strong>
		<div className="section-copy">{formatReceiptDateTime(receipt.purchased_at)}</div>
		<div className="section-copy">{formatMoney(receipt.total_amount, receipt.currency)}</div>
	</a>
)

export const ProductCard = ({
	product,
	link,
}: {
	product: Product
	link: (p: string) => string
}) => (
	<a className="product" href={link(`/products/${product.id}`)} data-link="">
		<div className="product__media">
			<img
				className="product__image"
				src={`/api/products/${product.id}/picture`}
				alt={product.name}
				loading="lazy"
				onError={(e) => e.currentTarget.parentElement?.remove()}
			/>
		</div>
		<header>
			<h3>{product.name}</h3>
			{product.is_perishable ? <span className="tag">Perishable</span> : null}
		</header>
		<dl>
			<div>
				<dt>Category</dt>
				<dd>{product.category ?? "-"}</dd>
			</div>
			<div>
				<dt>Barcode</dt>
				<dd>{product.barcode ?? "-"}</dd>
			</div>
			<div>
				<dt>Unit</dt>
				<dd>{product.default_unit ?? "-"}</dd>
			</div>
		</dl>
	</a>
)
