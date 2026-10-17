import { useCallback, useEffect, useRef, useState } from "react"
import { apiFetch } from "../api"
import type { PurchaseReceipt } from "../lib"
import { mergeReceiptPage, type ReceiptPage } from "./receipt-page-data"

type Session = { key: string; controller: AbortController; busy: boolean }
type Feed = { key: string; receipts: PurchaseReceipt[]; cursor: string | null; loading: boolean; error: string | null }

export const useReceiptPages = (params: string) => {
	const [revision, setRevision] = useState(0)
	const key = `${params}:${revision}`
	const session = useRef<Session | null>(null)
	const [feed, setFeed] = useState<Feed>({ key: "", receipts: [], cursor: null, loading: true, error: null })
	const current = feed.key === key ? feed : { key, receipts: [], cursor: null, loading: true, error: null }
	const reload = useCallback(() => setRevision((value) => value + 1), [])

	const requestPage = useCallback(async (active: Session, cursor: string | null) => {
		if (active.busy || session.current !== active) return
		active.busy = true
		setFeed((previous) => ({ ...previous, loading: true, error: null }))
		try {
			const query = new URLSearchParams(params)
			if (cursor !== null) query.set("cursor", cursor)
			const page = await apiFetch<ReceiptPage>(`/api/receipts?${query}`, { signal: active.controller.signal })
			if (!active.controller.signal.aborted && session.current === active) {
				setFeed((previous) => ({ key: active.key, receipts: cursor === null ? page.receipts : mergeReceiptPage(previous.receipts, page.receipts), cursor: page.next_cursor, loading: false, error: null }))
			}
		} catch (error) {
			if (!active.controller.signal.aborted && session.current === active) setFeed((previous) => ({ ...previous, loading: false, error: error instanceof Error ? error.message : "Failed to load receipts" }))
		} finally {
			active.busy = false
		}
	}, [params])

	useEffect(() => {
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
		const group = new URLSearchParams(params).get("group_id")
		setFeed((previous) => previous.key !== key ? previous : ({ ...previous, receipts: previous.receipts.flatMap((item) => item.id !== receipt.id ? [item] : group !== null && String(receipt.group_id) !== group ? [] : [receipt]) }))
	}, [params, key])

	return { receipts: current.receipts, loading: current.loading, error: current.error, hasMore: current.cursor !== null, loadMore, reload, updateReceipt }
}
