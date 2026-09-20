import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { apiFetch } from "./api"

export type Todo = {
	id: number
	title: string
	notes: string | null
	status: number
	due_at: string | null
	completed_at: string | null
	created_at: string
	updated_at: string
}

export type StoredFile = {
	id: number
	content_type: string
	filename: string | null
	size_bytes: number
	created_at: string
}

export type IngredientSummary = {
	id: number
	name: string
	default_unit: string | null
}

export type Product = {
	id: number
	ingredient_id: number | null
	name: string
	category: string
	barcode: string | null
	default_unit: string | null
	is_perishable: boolean
	picture_file_id?: number | null
	picture_file?: StoredFile | null
	created_at: string
	updated_at: string
	ingredient?: IngredientSummary | null
}

export type Group = {
	id: number
	name: string
	created_at: string
	updated_at: string
}

export type PurchaseReceipt = {
	id: number
	group_id: number | null
	store_name: string
	purchased_at: string
	currency: string
	total_amount: number | null
	created_at: string
	updated_at: string
	group?: { id: number; name: string } | null
	picture_file_id?: number | null
	picture_file?: StoredFile | null
}

export type ReceiptItem = {
	id: number
	receipt_id: number
	product_id: number
	quantity: number
	unit: string
	unit_price: number | null
	line_total: number | null
	created_at: string
	product?: { id: number; name: string } | null
}

export type InventoryContainer = {
	id: number
	name: string
	parent_container_id: number | null
	notes: string | null
	created_at: string
	updated_at: string
}

export type InventoryItem = {
	id: number
	name: string
	ingredient_id: number | null
	product_id: number | null
	receipt_item_id: number | null
	container_id: number | null
	quantity: number
	unit: string
	purchased_at: string | null
	expires_at: string | null
	consumed_at: string | null
	notes: string | null
	created_at: string
	updated_at: string
	ingredient?: IngredientSummary | null
	product?: (IngredientSummary & { ingredient_id: number | null }) | null
}

export type Recipe = {
	id: number
	name: string
	description: string | null
	instructions: string | null
	servings: number | null
	is_active: boolean
	created_at: string
	updated_at: string
}

export type ShoppingListItem = {
	id: number
	name: string
	ingredient_id: number | null
	product_id: number | null
	quantity: number
	unit: string
	done: boolean
	source_recipe_id: number | null
	notes: string | null
	created_at: string
	updated_at: string
}

export type Client = {
	id: number
	name: string
	color: string
	archived_at: string | null
	created_at: string
	updated_at: string
}

export type Project = {
	id: number
	client_id: number | null
	name: string
	color: string
	archived_at: string | null
	created_at: string
	updated_at: string
	client?: Client | null
}

export type TimeEntry = {
	id: number
	user_id: number | null
	project_id: number | null
	description: string | null
	started_at: string
	ended_at: string | null
	created_at: string
	updated_at: string
	user?: { id: number; name: string; email: string | null } | null
	project?: Project | null
}

export type AppUser = {
	id: number
	name: string
	username: string | null
	email: string | null
	is_admin: boolean
	created_at: string
	updated_at: string
}

export const TodoStatus = {
	Open: 1,
	Done: 2,
	Archived: 3,
} as const

export const formatShoppingDate = (value: string) =>
	new Intl.DateTimeFormat(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	}).format(new Date(value))

export const formatReceiptDateTime = (value: string) =>
	new Intl.DateTimeFormat(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(value))

export const formatMoney = (value: number | null, currency: string) => {
	if (value === null) return "-"
	try {
		return new Intl.NumberFormat(undefined, {
			style: "currency",
			currency,
		}).format(value)
	} catch {
		return `${value} ${currency}`
	}
}

export const formatDuration = (totalSeconds: number) => {
	const seconds = Math.max(0, Math.floor(totalSeconds))
	const hours = Math.floor(seconds / 3600)
	const minutes = Math.floor((seconds % 3600) / 60)
	const rest = seconds % 60
	if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`
	if (minutes > 0) return `${minutes}m ${String(rest).padStart(2, "0")}s`
	return `${rest}s`
}

export const timeEntryDurationSeconds = (entry: TimeEntry) => {
	const end = entry.ended_at ? Date.parse(entry.ended_at) : Date.now()
	return Math.max(0, Math.floor((end - Date.parse(entry.started_at)) / 1000))
}

export const TickingDuration = ({ startedAt }: { startedAt: string }) => {
	const [, setTick] = useState(0)
	useEffect(() => {
		const id = window.setInterval(() => setTick((t) => t + 1), 1000)
		return () => window.clearInterval(id)
	}, [])
	return <>{formatDuration(Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000)))}</>
}

export const toDateTimeLocalValue = (date = new Date()) =>
	new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

export const fromDateTimeLocalValue = (value: string) => {
	if (!value) return null
	const date = new Date(value)
	return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export const useApi = <T,>(path: string | null) => {
	const [data, setData] = useState<T | null>(null)
	const [loading, setLoading] = useState(path !== null)
	const [error, setError] = useState<string | null>(null)
	const [version, setVersion] = useState(0)
	const reload = useCallback(() => setVersion((v) => v + 1), [])

	useEffect(() => {
		if (path === null) {
			setLoading(false)
			return
		}
		let cancelled = false
		setLoading(true)
		setError(null)
		apiFetch<T>(path)
			.then((body) => {
				if (!cancelled) setData(body)
			})
			.catch((err) => {
				if (!cancelled) setError(err instanceof Error ? err.message : "Request failed")
			})
			.finally(() => {
				if (!cancelled) setLoading(false)
			})
		return () => {
			cancelled = true
		}
	}, [path, version])

	return { data, loading, error, reload }
}

export const Empty = ({ message }: { message: string }) => (
	<div className="empty">{message}</div>
)

export const Status = ({ message, error }: { message: string; error?: boolean }) =>
	message ? <div className={`status${error ? " error" : ""}`}>{message}</div> : null

export const Modal = ({
	id,
	title,
	open,
	onClose,
	className = "",
	children,
}: {
	id: string
	title: string
	open: boolean
	onClose: () => void
	className?: string
	children: ReactNode
}) => {
	const dialogRef = useRef<HTMLDivElement>(null)
	const onCloseRef = useRef(onClose)
	onCloseRef.current = onClose
	const wasOpen = useRef(false)

	useEffect(() => {
		if (!open) {
			wasOpen.current = false
			return
		}
		document.body.classList.add("modal-open")
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onCloseRef.current()
		}
		document.addEventListener("keydown", onKey)
		if (!wasOpen.current && !dialogRef.current?.contains(document.activeElement)) {
			dialogRef.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus()
		}
		wasOpen.current = true
		return () => {
			document.body.classList.remove("modal-open")
			document.removeEventListener("keydown", onKey)
		}
	}, [open ])

	if (!open) return null

	return (
		<div className={`app-modal${className ? ` ${className}` : ""}`} id={id}>
			<div className="app-modal__backdrop" onClick={onClose} />
			<div
				ref={dialogRef}
				className="app-modal__dialog card panel"
				role="dialog"
				aria-modal="true"
				aria-label={title}
			>
				<div className="section-header">
					<h2>{title}</h2>
					<button className="secondary" type="button" aria-label={`Close ${title.toLowerCase()} modal`} onClick={onClose}>
						Close
					</button>
				</div>
				{children}
			</div>
		</div>
	)
}
