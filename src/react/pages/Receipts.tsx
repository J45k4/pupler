import { DateInput } from "../DateInput"
import { upsertItem } from "../data-updates"
import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { formatDate } from "../dates"
import { apiFetch } from "../api"
import { Empty, Modal, Status, formatMoney, formatReceiptDateTime, toDateTimeLocalValue, useApi, type Group, type PurchaseReceipt } from "../lib"
import { ReceiptCard } from "../catalog"
import { closest, getDragPayload, useDropHighlight } from "../dnd"
import { receiptCutoffDate, receiptCutoffIndex, receiptGroupPageParams, receiptPageParams, receiptTotalsParams, type ReceiptGroupTotal } from "./receipt-page-data"
import { useReceiptPages } from "./use-receipt-pages"

export const findOrCreateGroup = async (name: string, groups: Group[]): Promise<Group> => {
	const normalized = name.trim().toLowerCase()
	const existing = groups.find((g) => g.name.trim().toLowerCase() === normalized)
	if (existing) return existing
	return apiFetch<Group>("/api/groups", { method: "POST", body: JSON.stringify({ name: name.trim() }) })
}

const ReceiptGroupHeader = ({ groupId, name, href, totals, error }: { groupId: number | null; name: string; href?: string; totals: ReceiptGroupTotal[] | null; error: string | null }) => {
	const rows = totals?.filter(row => row.group_id === groupId)
	return <header className="receipt-kanban__header">
		<div className="receipt-kanban__heading"><h3>{href ? <a className="receipt-kanban__title-link" href={href} data-link="">{name}</a> : name}</h3><span className="tag tag--neutral">{rows ? rows.reduce((sum, row) => sum + row.receipt_count, 0) : "…"}</span></div>
		<div className="receipt-kanban__totals">{error ? <span>Total unavailable</span> : !rows ? <span>Loading total…</span> : rows.length === 0 ? <span>Total: 0</span> : rows.map(row => <div key={row.currency}><strong>{row.total_amount === null ? `— ${row.currency}` : formatMoney(row.total_amount, row.currency)}</strong>{row.unknown_count > 0 ? <span>{row.unknown_count} missing amount{row.unknown_count === 1 ? "" : "s"}</span> : null}</div>)}</div>
	</header>
}

const ReceiptGroupColumn = ({ groupId, name, params, totals, totalsError, updatedReceipt, link }: { groupId: number | null; name: string; params: string; totals: ReceiptGroupTotal[] | null; totalsError: string | null; updatedReceipt: PurchaseReceipt | null; link: (path: string) => string }) => {
	const groupParams = useMemo(() => receiptGroupPageParams(params, groupId), [params, groupId])
	const { receipts, loading, error, hasMore, loadMore, updateReceipt } = useReceiptPages(groupParams)
	const cutoff = receiptCutoffDate()
	const cutoffIndex = receiptCutoffIndex(receipts, cutoff)
	useEffect(() => {
		if (updatedReceipt) updateReceipt(updatedReceipt)
	}, [updatedReceipt, updateReceipt])
	return <section className="receipt-kanban__column" data-receipt-drop-group-id={groupId === null ? "" : String(groupId)}>
		<ReceiptGroupHeader groupId={groupId} name={name} href={groupId === null ? undefined : link(`/groups/${groupId}`)} totals={totals} error={totalsError} />
		<div className="receipt-kanban__list">
			{receipts.map((receipt, index) => <Fragment key={receipt.id}>
				{index === cutoffIndex ? <div className="receipt-kanban__cutoff" role="separator" aria-label={`30-day cutoff: ${formatDate(cutoff.toISOString())}`}><span>30-day cutoff · <time dateTime={cutoff.toISOString()}>{formatDate(cutoff.toISOString())}</time></span></div> : null}
				<ReceiptCard receipt={receipt} link={link} compact />
			</Fragment>)}
			{loading && receipts.length === 0 ? <div className="receipt-kanban__empty">Loading receipts…</div> : !error && receipts.length === 0 ? <div className="receipt-kanban__empty">No receipts</div> : null}
		</div>
		{error ? <Status message={error} error /> : null}
		{hasMore || error ? <button className="secondary receipt-kanban__more" type="button" aria-label={`${error ? "Retry" : "Load more"} receipts in ${name}`} disabled={loading} onClick={() => void loadMore()}>{loading ? "Loading…" : error ? "Try again" : "Load more"}</button> : null}
	</section>
}

export const ReceiptsPage = ({ link }: { link: (p: string) => string }) => {
	const [groupFilter, setGroupFilter] = useState("all")
	const [chronological, setChronological] = useState(true)
	const [newestDate, setNewestDate] = useState("")
	const [search, setSearch] = useState("")
	const [query, setQuery] = useState("")
	const [groupRevision, setGroupRevision] = useState(0)
	const [updatedReceipt, setUpdatedReceipt] = useState<PurchaseReceipt | null>(null)
	const loadMoreRef = useRef<HTMLDivElement>(null)
	const resultsRef = useRef<HTMLDivElement>(null)
	const pageRef = useRef<HTMLElement>(null)
	const [status, setStatus] = useState("")
	const [statusError, setStatusError] = useState(false)
	const [receiptOpen, setReceiptOpen] = useState(false)
	const [groupOpen, setGroupOpen] = useState(false)
	const [createStatus, setCreateStatus] = useState("")
	const [groupStatus, setGroupStatus] = useState("")

	const [storeName, setStoreName] = useState("")
	const [purchasedAt, setPurchasedAt] = useState(toDateTimeLocalValue())
	const [currency, setCurrency] = useState("EUR")
	const [totalAmount, setTotalAmount] = useState("")
	const [groupName, setGroupName] = useState("")
	const [picture, setPicture] = useState<File | null>(null)
	const [newGroupName, setNewGroupName] = useState("")

	useEffect(() => {
		const header = document.querySelector(".site-header")
		const page = pageRef.current
		if (!header || !page) return
		const update = () => page.style.setProperty("--receipt-sticky-top", `${header.getBoundingClientRect().height}px`)
		const observer = new ResizeObserver(update)
		update()
		observer.observe(header)
		return () => observer.disconnect()
	}, [])

	useEffect(() => {
		if (!search.trim()) { setQuery(""); return }
		const timer = window.setTimeout(() => setQuery(search.trim()), 200)
		return () => window.clearTimeout(timer)
	}, [search])

	const params = useMemo(() => receiptPageParams(groupFilter, newestDate, query), [groupFilter, newestDate, query])
	const { receipts, loading: receiptsLoading, error: receiptsError, hasMore, loadMore, reload: reloadReceipts, updateReceipt } = useReceiptPages(chronological ? params : null)
	const { data: totals, error: totalsError, reload: reloadTotals } = useApi<ReceiptGroupTotal[]>(chronological ? null : `/api/receipts?${receiptTotalsParams(params)}`)
	const { data: groupsData, loading: groupsLoading, error: groupsError, reload: reloadGroups, update: updateGroups } = useApi<Group[]>("/api/groups?sort=name&order=asc")

	const reload = () => {
		setUpdatedReceipt(null)
		reloadReceipts()
		reloadGroups()
		reloadTotals()
		setGroupRevision(value => value + 1)
	}

	const groups = groupsData ?? []
	const loading = (receiptsLoading && receipts.length === 0) || (groupsLoading && groupsData === null)
	const error = (receipts.length === 0 ? receiptsError : null) ?? groupsError
	const dropHighlight = useDropHighlight("receipt-drop-target--active")

	useEffect(() => {
		const target = loadMoreRef.current
		if (!chronological || !target || !hasMore || receiptsLoading || receiptsError || typeof IntersectionObserver === "undefined") return
		const observer = new IntersectionObserver((entries) => {
			if (entries.some((entry) => entry.isIntersecting)) void loadMore()
		}, { root: resultsRef.current, rootMargin: "400px" })
		observer.observe(target)
		return () => observer.disconnect()
	}, [hasMore, receiptsLoading, receiptsError, loadMore, chronological])

	const moveReceipt = async (receiptId: number, targetGroupId: number | null) => {
		const receipt = receipts.find((r) => r.id === receiptId)
		if (receipt && receipt.group_id === targetGroupId) return
		const targetName =
			targetGroupId === null ? "Ungrouped" : (groups.find((g) => g.id === targetGroupId)?.name ?? "selected group")
		try {
			const saved = await apiFetch<PurchaseReceipt>(`/api/receipts/${receiptId}`, {
				method: "PATCH",
				body: JSON.stringify({ group_id: targetGroupId }),
			})
			updateReceipt(saved)
			setUpdatedReceipt(saved)
			reloadTotals()
			setStatus(`Moved receipt to ${targetName}.`)
			setStatusError(false)
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to move receipt")
			setStatusError(true)
		}
	}

	const onBoardDragOver = (event: React.DragEvent) => {
		const dropTarget = closest(event.target, "[data-receipt-drop-group-id]")
		if (!dropTarget) {
			dropHighlight.clear()
			return
		}
		event.preventDefault()
		if (event.dataTransfer) event.dataTransfer.dropEffect = "move"
		dropHighlight.highlight(dropTarget)
	}

	const onBoardDrop = (event: React.DragEvent) => {
		const dropTarget = closest(event.target, "[data-receipt-drop-group-id]")
		dropHighlight.clear()
		if (!dropTarget) return
		event.preventDefault()
		const payload = getDragPayload(event)
		if (!payload || payload.kind !== "receipt") return
		const raw = dropTarget.dataset.receiptDropGroupId ?? ""
		const targetGroupId = raw === "" ? null : Number.parseInt(raw, 10)
		if (targetGroupId !== null && !Number.isInteger(targetGroupId)) return
		void moveReceipt(payload.id, targetGroupId)
	}

	const hasSearchMatches = (groupId: number | null) => !query || !totals || totals.some(row => row.group_id === groupId && row.receipt_count > 0)
	const visibleGroups = (groupFilter === "all" ? groups : groupFilter === "ungrouped" ? [] : groups.filter((g) => String(g.id) === groupFilter)).filter(group => hasSearchMatches(group.id))
	const showUngrouped = (groupFilter === "all" || groupFilter === "ungrouped") && hasSearchMatches(null)
	const noReceipts = chronological ? receipts.length === 0 : totals !== null && totals.every(row => row.receipt_count === 0)
	const receiptCount = totals?.reduce((sum, row) => sum + row.receipt_count, 0)

	const createReceipt = async (event: React.FormEvent) => {
		event.preventDefault()
		try {
			let groupId: number | null = null
			if (groupName.trim()) {
				const group = await findOrCreateGroup(groupName, groups)
				groupId = group.id
				updateGroups(current => upsertItem(current, group))
			}
			let created = await apiFetch<PurchaseReceipt>("/api/receipts", {
				method: "POST",
				body: JSON.stringify({
					group_id: groupId,
					store_name: storeName.trim(),
					purchased_at: new Date(purchasedAt).toISOString(),
					currency: currency.trim().toUpperCase(),
					total_amount: totalAmount ? Number(totalAmount) : null,
				}),
			})
			if (picture) {
				const formData = new FormData()
				formData.set("file", picture)
				const uploaded = await apiFetch<{ receipt: PurchaseReceipt }>(`/api/receipts/${created.id}/picture`, { method: "POST", body: formData })
				created = uploaded.receipt
			}
			setStoreName("")
			setPurchasedAt(toDateTimeLocalValue())
			setCurrency("EUR")
			setTotalAmount("")
			setGroupName("")
			setPicture(null)
			updateReceipt(created)
			setUpdatedReceipt(created)
			reloadTotals()
			setReceiptOpen(false)
			setStatus(picture ? `Created receipt #${created.id} and uploaded picture` : `Created receipt #${created.id}`)
			setStatusError(false)
			reloadGroups()
		} catch (err) {
			setCreateStatus(err instanceof Error ? err.message : "Failed to create receipt")
		}
	}

	const createGroup = async (event: React.FormEvent) => {
		event.preventDefault()
		if (!newGroupName.trim()) {
			setGroupStatus("Group name is required.")
			return
		}
		try {
			const group = await apiFetch<Group>("/api/groups", {
				method: "POST",
				body: JSON.stringify({ name: newGroupName.trim() }),
			})
			setNewGroupName("")
			setGroupOpen(false)
			updateGroups(current => upsertItem(current, group))
			setStatus(`Created group ${group.name}.`)
			setStatusError(false)
			reloadGroups()
		} catch (err) {
			setGroupStatus(err instanceof Error ? err.message : "Failed to create group")
		}
	}

	return (
		<>
			<section ref={pageRef} className={`receipts-page${chronological ? " receipts-page--table" : ""}`}>
				<div className="receipts-page__controls">
					<div className="toolbar toolbar--wrap receipts-page__filters">
						<label className="receipt-search" htmlFor="receipt-search">Search receipts<input id="receipt-search" type="search" placeholder="Store name or receipt number" autoComplete="off" maxLength={200} value={search} onChange={event => { setSearch(event.target.value); setStatus(""); setStatusError(false) }} /></label>
						<select
							id="receipt-group-filter"
							className="toolbar__select"
							aria-label="Receipt group filter"
							value={groupFilter}
							onChange={(e) => setGroupFilter(e.target.value)}
						>
							<option value="all">All groups</option>
							<option value="ungrouped">Ungrouped</option>
							{groups.map((g) => (
								<option key={g.id} value={String(g.id)}>
									{g.name}
								</option>
							))}
						</select>
						<label className="receipt-date-filter" htmlFor="receipt-newest-date">
							Newest date
							<DateInput id="receipt-newest-date" type="date" value={newestDate} onChange={value => setNewestDate(value)} />
						</label>
						{newestDate ? <button className="secondary" type="button" onClick={() => setNewestDate("")}>Latest</button> : null}
						<label className="checkbox-toggle receipt-view-toggle">
							<input
								id="receipt-chronological-view"
								type="checkbox"
								checked={chronological}
								onChange={(e) => setChronological(e.target.checked)}
							/>
							Chronological view
						</label>
					</div>
					<div className="actions receipts-page__actions">
						<button id="receipt-refresh-button" className="secondary" type="button" onClick={reload}>
							Refresh
						</button>
						<button id="open-group-modal-button" className="secondary" type="button" onClick={() => { setGroupStatus(""); setGroupOpen(true) }}>
							New group
						</button>
						<button
							id="open-receipt-modal-button"
							className="primary"
							type="button"
							onClick={() => { setCreateStatus(""); setReceiptOpen(true) }}
						>
							Add Receipt
						</button>
					</div>
				</div>
				{newestDate ? <p className="section-copy">Showing the selected date and older, newest first.</p> : null}
				<Status message={search.trim() !== query ? "Searching…" : loading ? "Loading…" : (error ?? status) || (chronological ? `${receipts.length} receipts loaded.` : receiptCount === undefined ? "Loading totals…" : `${receiptCount} receipts.`)} error={!!error || statusError} />
				<div
					id="receipt-results"
					ref={resultsRef}
					className="results"
					role={chronological ? "region" : undefined}
					aria-label={chronological ? "Receipts table" : undefined}
					tabIndex={chronological ? 0 : undefined}
					aria-busy={receiptsLoading}
					onDragOver={chronological ? undefined : onBoardDragOver}
					onDrop={chronological ? undefined : onBoardDrop}
					onDragEnd={() => dropHighlight.clear()}
				>
					{!loading && !error ? (
						noReceipts && (query || chronological || groups.length === 0) ? (
							<Empty message={query || newestDate || groupFilter !== "all" ? "No receipts match these filters." : "No receipts yet."} />
						) : chronological ? (
							<table className="receipt-table" aria-label="Receipts, newest first">
								<thead><tr><th scope="col">Date and time</th><th scope="col">Store</th><th scope="col">Group</th><th scope="col" className="receipt-table__amount">Amount</th></tr></thead>
								<tbody>{receipts.map(receipt => <tr key={receipt.id}>
									<td><time dateTime={receipt.purchased_at}>{formatReceiptDateTime(receipt.purchased_at)}</time></td>
									<td><a href={link(`/receipts/${receipt.id}`)} data-link="">{receipt.store_name}</a></td>
									<td>{receipt.group_id === null ? <span className="muted">Ungrouped</span> : <a href={link(`/groups/${receipt.group_id}`)} data-link="">{receipt.group?.name ?? groups.find(group => group.id === receipt.group_id)?.name ?? "Unknown group"}</a>}</td>
									<td className="receipt-table__amount">{receipt.total_amount === null ? `— ${receipt.currency}` : formatMoney(receipt.total_amount, receipt.currency)}</td>
								</tr>)}</tbody>
							</table>
						) : (
							<div className="receipt-kanban" data-receipt-kanban="">
								{showUngrouped ? <ReceiptGroupColumn key={`ungrouped:${groupRevision}`} groupId={null} name="Ungrouped" params={params} totals={totals} totalsError={totalsError} updatedReceipt={updatedReceipt} link={link} /> : null}
								{visibleGroups.map(group => <ReceiptGroupColumn key={`${group.id}:${groupRevision}`} groupId={group.id} name={group.name} params={params} totals={totals} totalsError={totalsError} updatedReceipt={updatedReceipt} link={link} />)}
							</div>
						)
					) : null}
					{chronological ? <div ref={loadMoreRef} className="receipt-pagination">
						{receiptsError && receipts.length > 0 ? <Status message={receiptsError} error /> : null}
						{hasMore || receiptsError ? <button className="secondary" type="button" disabled={receiptsLoading} onClick={() => void loadMore()}>{receiptsLoading ? "Loading older receipts…" : receiptsError ? "Try again" : "Load older receipts"}</button> : receipts.length > 0 ? <span className="section-copy">All receipts loaded.</span> : null}
					</div> : null}
				</div>
			</section>
			<Modal id="receipt-create-modal" title="Create Receipt" open={receiptOpen} onClose={() => setReceiptOpen(false)} className="receipt-create-modal">
				<form id="receipt-form" onSubmit={createReceipt}>
					<label>
						Store Name
						<input id="receipt-store-name" name="receipt-store-name" placeholder="K-Market" required value={storeName} onChange={(e) => setStoreName(e.target.value)} />
					</label>
					<label>
						Purchased At
						<DateInput id="receipt-purchased-at" type="datetime-local" required value={purchasedAt} onChange={value => setPurchasedAt(value)} />
					</label>
					<div className="row">
						<label>
							Currency
							<input id="receipt-currency" value={currency} maxLength={3} required onChange={(e) => setCurrency(e.target.value)} />
						</label>
						<label>
							Total Amount
							<input id="receipt-total-amount" type="number" step="0.01" min="0" placeholder="23.40" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
						</label>
					</div>
					<label>
						Group
						<input id="receipt-group-name" placeholder="grocery" list="receipt-group-options" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
						<datalist id="receipt-group-options">
							{groups.map((g) => (
								<option key={g.id} value={g.name} />
							))}
						</datalist>
					</label>
					<label>
						Receipt Picture
						<input id="receipt-picture" name="picture" type="file" accept="image/*" onChange={(e) => setPicture(e.target.files?.[0] ?? null)} />
					</label>
					<div className="actions">
						<button className="primary" type="submit">
							Create Receipt
						</button>
						<button className="secondary" type="button" onClick={() => setReceiptOpen(false)}>
							Cancel
						</button>
					</div>
				</form>
				<Status message={createStatus} error={!!createStatus} />
			</Modal>
			<Modal id="group-create-modal" title="New Group" open={groupOpen} onClose={() => setGroupOpen(false)} className="receipt-create-modal">
				<form id="group-create-form" onSubmit={createGroup}>
					<label>
						Group Name
						<input id="group-create-name" name="group-name" placeholder="grocery" required value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
					</label>
					<div className="actions">
						<button className="primary" type="submit">
							Create Group
						</button>
						<button className="secondary" type="button" onClick={() => setGroupOpen(false)}>
							Cancel
						</button>
					</div>
				</form>
				<Status message={groupStatus} error={!!groupStatus} />
			</Modal>
		</>
	)
}
