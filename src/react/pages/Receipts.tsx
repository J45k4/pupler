import { useEffect, useMemo, useRef, useState } from "react"
import { apiFetch } from "../api"
import { Empty, Modal, Status, toDateTimeLocalValue, useApi, type Group, type PurchaseReceipt } from "../lib"
import { ReceiptCard } from "../catalog"
import { closest, getDragPayload, useDropHighlight } from "../dnd"
import { receiptPageParams } from "./receipt-page-data"
import { useReceiptPages } from "./use-receipt-pages"

export const findOrCreateGroup = async (name: string, groups: Group[]): Promise<Group> => {
	const normalized = name.trim().toLowerCase()
	const existing = groups.find((g) => g.name.trim().toLowerCase() === normalized)
	if (existing) return existing
	return apiFetch<Group>("/api/groups", { method: "POST", body: JSON.stringify({ name: name.trim() }) })
}

export const ReceiptsPage = ({ link }: { link: (p: string) => string }) => {
	const [groupFilter, setGroupFilter] = useState("all")
	const [chronological, setChronological] = useState(true)
	const [newestDate, setNewestDate] = useState("")
	const loadMoreRef = useRef<HTMLDivElement>(null)
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

	const params = useMemo(() => receiptPageParams(groupFilter, newestDate), [groupFilter, newestDate])
	const { receipts, loading: receiptsLoading, error: receiptsError, hasMore, loadMore, reload: reloadReceipts, updateReceipt } = useReceiptPages(params)
	const { data: groupsData, loading: groupsLoading, error: groupsError, reload: reloadGroups } = useApi<Group[]>("/api/groups?sort=name&order=asc")

	const reload = () => {
		reloadReceipts()
		reloadGroups()
	}

	const groups = groupsData ?? []
	const loading = (receiptsLoading && receipts.length === 0) || (groupsLoading && groupsData === null)
	const error = (receipts.length === 0 ? receiptsError : null) ?? groupsError
	const dropHighlight = useDropHighlight("receipt-drop-target--active")

	useEffect(() => {
		const target = loadMoreRef.current
		if (!target || !hasMore || receiptsLoading || receiptsError || typeof IntersectionObserver === "undefined") return
		const observer = new IntersectionObserver((entries) => {
			if (entries.some((entry) => entry.isIntersecting)) void loadMore()
		}, { rootMargin: "400px" })
		observer.observe(target)
		return () => observer.disconnect()
	}, [hasMore, receiptsLoading, receiptsError, loadMore])

	const moveReceipt = async (receiptId: number, targetGroupId: number | null) => {
		const receipt = receipts.find((r) => r.id === receiptId)
		if ((receipt?.group_id ?? null) === targetGroupId) return
		const targetName =
			targetGroupId === null ? "Ungrouped" : (groups.find((g) => g.id === targetGroupId)?.name ?? "selected group")
		try {
			const saved = await apiFetch<PurchaseReceipt>(`/api/receipts/${receiptId}`, {
				method: "PATCH",
				body: JSON.stringify({ group_id: targetGroupId }),
			})
			updateReceipt(saved)
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

	const visibleGroups =
		groupFilter === "all" ? groups : groupFilter === "ungrouped" ? [] : groups.filter((g) => String(g.id) === groupFilter)
	const showUngrouped = groupFilter === "all" || groupFilter === "ungrouped"

	const createReceipt = async (event: React.FormEvent) => {
		event.preventDefault()
		try {
			let groupId: number | null = null
			if (groupName.trim()) {
				const group = await findOrCreateGroup(groupName, groups)
				groupId = group.id
			}
			const created = await apiFetch<PurchaseReceipt>("/api/receipts", {
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
				const response = await fetch(`/api/receipts/${created.id}/picture`, { method: "POST", body: formData })
				if (!response.ok) {
					const body = (await response.json().catch(() => null)) as { error?: string } | null
					throw new Error(body?.error ?? "Failed to upload receipt picture")
				}
			}
			setStoreName("")
			setPurchasedAt(toDateTimeLocalValue())
			setCurrency("EUR")
			setTotalAmount("")
			setGroupName("")
			setPicture(null)
			setReceiptOpen(false)
			setStatus(picture ? `Created receipt #${created.id} and uploaded picture` : `Created receipt #${created.id}`)
			setStatusError(false)
			reload()
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
			setStatus(`Created group ${group.name}.`)
			setStatusError(false)
			reload()
		} catch (err) {
			setGroupStatus(err instanceof Error ? err.message : "Failed to create group")
		}
	}

	return (
		<>
			<section className="receipts-page">
				<div className="receipts-page__controls">
					<div className="toolbar toolbar--wrap receipts-page__filters">
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
							<input id="receipt-newest-date" type="date" value={newestDate} onChange={(event) => setNewestDate(event.target.value)} />
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
				<Status message={loading ? "Loading…" : (error ?? status) || `${receipts.length} receipts loaded.`} error={!!error || statusError} />
				<div
					id="receipt-results"
					className="results"
					aria-busy={receiptsLoading}
					onDragOver={chronological ? undefined : onBoardDragOver}
					onDrop={chronological ? undefined : onBoardDrop}
					onDragEnd={() => dropHighlight.clear()}
				>
					{!loading && !error ? (
						receipts.length === 0 && (chronological || groups.length === 0) ? (
							<Empty message={newestDate || groupFilter !== "all" ? "No receipts match these filters." : "No receipts yet."} />
						) : chronological ? (
							<div className="receipt-timeline">
								{receipts.map((r) => (
									<ReceiptCard key={r.id} receipt={r} link={link} draggable={false} className="receipt-card--timeline" />
								))}
							</div>
						) : (
							<div className="receipt-kanban" data-receipt-kanban="">
								{showUngrouped ? (
									<section className="receipt-kanban__column" data-receipt-drop-group-id="">
										<header className="receipt-kanban__header">
											<h3>Ungrouped</h3>
											<span className="tag tag--neutral">{receipts.filter((r) => r.group_id === null).length}</span>
										</header>
										<div className="receipt-kanban__list">
											{receipts.filter((r) => r.group_id === null).map((r) => (
												<ReceiptCard key={r.id} receipt={r} link={link} />
											))}
										</div>
									</section>
								) : null}
								{visibleGroups.map((g) => {
									const columnReceipts = receipts.filter((r) => r.group_id === g.id)
									return (
										<section key={g.id} className="receipt-kanban__column" data-receipt-drop-group-id={String(g.id)}>
											<header className="receipt-kanban__header">
												<h3>
													<a className="receipt-kanban__title-link" href={link(`/groups/${g.id}`)} data-link="">
														{g.name}
													</a>
												</h3>
												<span className="tag tag--neutral">{columnReceipts.length}</span>
											</header>
											<div className="receipt-kanban__list">
												{columnReceipts.length === 0 ? (
													<div className="receipt-kanban__empty">No receipts</div>
												) : (
													columnReceipts.map((r) => <ReceiptCard key={r.id} receipt={r} link={link} />)
												)}
											</div>
										</section>
									)
								})}
							</div>
						)
					) : null}
				</div>
				<div ref={loadMoreRef} className="receipt-pagination">
					{receiptsError && receipts.length > 0 ? <Status message={receiptsError} error /> : null}
					{hasMore || receiptsError ? <button className="secondary" type="button" disabled={receiptsLoading} onClick={() => void loadMore()}>{receiptsLoading ? "Loading older receipts…" : receiptsError ? "Try again" : "Load older receipts"}</button> : receipts.length > 0 ? <span className="section-copy">All receipts loaded.</span> : null}
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
						<input id="receipt-purchased-at" type="datetime-local" required value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} />
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
