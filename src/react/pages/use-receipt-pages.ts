import { useCallback, useEffect, useRef, useState } from "react"
import { apiFetch } from "../api"
import type { PurchaseReceipt } from "../lib"
import { applyReceiptChanges, mergeReceiptPage, type ReceiptPage } from "./receipt-page-data"

type Session = { key: string; controller: AbortController; busy: boolean }
type Feed = { key: string; receipts: PurchaseReceipt[]; cursor: string | null; loading: boolean; error: string | null }

export const useReceiptPages = (params: string | null) => {
	const [revision, setRevision] = useState(0)
	const key = `${params}:${revision}`
	const session = useRef<Session | null>(null)
	const changes = useRef(new Map<number, { version: number; receipt: PurchaseReceipt }>())
	const changeVersion = useRef(0)
	const [feed, setFeed] = useState<Feed>({ key: "", receipts: [], cursor: null, loading: true, error: null })
	const current = feed.key === key ? feed : { key, receipts: [], cursor: null, loading: params !== null, error: null }
	const reload = useCallback(() => setRevision((value) => value + 1), [])

	const requestPage = useCallback(async (active: Session, cursor: string | null) => {
		if (params === null || active.busy || session.current !== active) return
		active.busy = true
		const readVersion = changeVersion.current
		setFeed((previous) => ({ ...previous, loading: true, error: null }))
		try {
			const query = new URLSearchParams(params)
			if (cursor !== null) query.set("cursor", cursor)
			const page = await apiFetch<ReceiptPage>(`/api/receipts?${query}`, { signal: active.controller.signal })
			if (!active.controller.signal.aborted && session.current === active) {
				const newer = [...changes.current.values()].filter(change => change.version > readVersion).map(change => change.receipt)
				setFeed((previous) => ({ key: active.key, receipts: applyReceiptChanges(cursor === null ? page.receipts : mergeReceiptPage(previous.receipts, page.receipts), newer, params), cursor: page.next_cursor, loading: false, error: null }))
			}
		} catch (error) {
			if (!active.controller.signal.aborted && session.current === active) setFeed((previous) => ({ ...previous, loading: false, error: error instanceof Error ? error.message : "Failed to load receipts" }))
		} finally {
			active.busy = false
		}
	}, [params])

	useEffect(() => {
		if (params === null) {
			session.current = null
			setFeed({ key, receipts: [], cursor: null, loading: false, error: null })
			return
		}
		const active = { key, controller: new AbortController(), busy: false }
		session.current = active
		setFeed({ key, receipts: [], cursor: null, loading: true, error: null })
		void requestPage(active, null)
		return () => active.controller.abort()
	}, [key, requestPage])

	const loadMore = useCallback(async () => {
		const active = session.current
		if (!active || active.key !== key || current.loading || (current.cursor === null && !current.error)) return
		await requestPage(active, current.cursor)
	}, [key, current.loading, current.cursor, current.error, requestPage])

	const updateReceipt = useCallback((receipt: PurchaseReceipt) => {
		if (params === null) return
		changes.current.set(receipt.id, { version: ++changeVersion.current, receipt })
		setFeed(previous => previous.key !== key ? previous : ({ ...previous, receipts: applyReceiptChanges(previous.receipts, [receipt], params) }))
	}, [params, key])

	return { receipts: current.receipts, loading: current.loading, error: current.error, hasMore: current.cursor !== null, loadMore, reload, updateReceipt }
}
