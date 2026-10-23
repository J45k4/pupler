import type { AuthUser } from "./auth"
import type { TimeEntry } from "./lib"
import type { TimeChange } from "./time-changes"

export type OfflineEntity = { id: number; [key: string]: any }
export type OfflinePayload = {
	id: string
	path: string
	method: string
	body: Record<string, any>
	local_id: number | null
	expected_running_id: number | null
	expected_updated_at: string | null
	base_operation_id: string | null
}
export type OfflineOperation = OfflinePayload & {
	optimistic: OfflineEntity
	time: string
	error?: string
	attempt?: { session: string; payload: OfflinePayload }
	time_changes?: TimeChange[]
}
export type OfflineAccount = {
	user: AuthUser
	client_id: string
	queue: OfflineOperation[]
	snapshots: Record<string, { data: any; time: number }>
}

export const offlineChangeAffects = (path: string, changed?: string[]) => {
	const family = (value: string) => {
		const name = new URL(value, "http://localhost").pathname.split("/")[2] ?? ""
		return name.startsWith("shopping-") ? "shopping" : name
	}
	return !changed?.length || changed.some(value => family(value) === family(path))
}

export const offlineReadPath = (path: string) => {
	const url = new URL(path, "http://localhost")
	if (["/api/shopping-lists", "/api/projects", "/api/clients"].includes(url.pathname)) return true
	if (/^\/api\/time-entries\/\d+$/.test(url.pathname)) return true
	if (url.pathname === "/api/time-entries") return ["timer", "descriptions"].includes(url.searchParams.get("view") ?? "")
	return (
		url.pathname === "/api/shopping-list-items" &&
		(url.searchParams.get("view") === "board" ||
			(url.searchParams.has("shopping_list_id") && url.searchParams.get("removed") === "true"))
	)
}
export const offlineWritePath = (path: string, method: string) =>
	(method === "POST" &&
		["/api/time-entries", "/api/time-entries/start", "/api/shopping-list-items", "/api/shopping-lists"].includes(path)) ||
	(method === "POST" && /^\/api\/time-entries\/-?\d+\/stop$/.test(path)) ||
	(["PATCH", "DELETE"].includes(method) && /^\/api\/(?:time-entries|shopping-list-items|shopping-lists)\/-?\d+$/.test(path))
export const operationPayload = (operation: OfflineOperation): OfflinePayload => {
	if (operation.attempt) return operation.attempt.payload
	const { id, path, method, body, local_id, expected_running_id, expected_updated_at, base_operation_id } = operation
	return { id, path, method, body, local_id, expected_running_id, expected_updated_at, base_operation_id }
}
export const nextOfflineBatch = (account: OfflineAccount) => {
	const pending = account.queue.filter((operation) => !operation.error)
	const session = pending[0]?.attempt?.session
	return pending.filter((operation) => operation.attempt?.session === session).slice(0, 50)
}
export const prepareOfflineBatch = (account: OfflineAccount, ids: string[], session: string) => {
	const batch = account.queue.filter((operation) => ids.includes(operation.id) && !operation.error)
	for (const operation of batch) operation.attempt ??= { session, payload: structuredClone(operationPayload(operation)) }
	return batch
}
const upsert = (items: OfflineEntity[], item: OfflineEntity) =>
	items.some((value) => value.id === item.id) ? items.map((value) => (value.id === item.id ? item : value)) : [item, ...items]
const findEntity = (snapshots: OfflineAccount["snapshots"], kind: string, id: number) => {
	for (const [path, snapshot] of Object.entries(snapshots).sort(([, a], [, b]) => b.time - a.time)) {
		if (!path.startsWith(`/api/${kind}`) || !offlineReadPath(path)) continue
		const data = snapshot.data
		if (data?.id === id) return data as OfflineEntity
		const found =
			(Array.isArray(data) ? data : (data?.items ?? data?.entries ?? [])).find((value: OfflineEntity) => value.id === id) ??
			(data?.running?.id === id ? data.running : null)
		if (found) return found as OfflineEntity
	}
	return null
}

export const applyOfflineOperation = (
	snapshots: OfflineAccount["snapshots"],
	operation: OfflineOperation,
	result = operation.optimistic,
) => {
	const path = operation.path
	const item = result
	if (path === "/api/shopping-lists" && operation.method === "POST")
		snapshots[`/api/shopping-list-items?shopping_list_id=${item.id}&removed=true`] ??= { data: [], time: 0 }
	if (path.startsWith("/api/shopping-list-items") && item.removed_at !== null) {
		const removedPath = `/api/shopping-list-items?shopping_list_id=${item.shopping_list_id}&removed=true`
		snapshots[removedPath] ??= { data: [], time: 0 }
	}
	for (const [key, snapshot] of Object.entries(snapshots)) {
		const url = new URL(key, "http://localhost")
		const data = snapshot.data
		if (path.startsWith("/api/time-entries") && url.pathname === `/api/time-entries/${item.id}`) snapshot.data = item
		if (path.startsWith("/api/shopping-list-items") && url.pathname === "/api/shopping-list-items") {
			if (Array.isArray(data)) {
				const matches = url.searchParams.get("shopping_list_id") === String(item.shopping_list_id)
				if (matches)
					snapshot.data = upsert(data, item).filter((value) =>
						url.searchParams.get("removed") === "true" ? value.removed_at !== null : true,
					)
			} else if (data?.items && url.searchParams.get("view") === "board") {
				const old = data.items.find((value: OfflineEntity) => value.id === item.id)
				const delta = item.removed_at !== null ? (old ? 1 : 0) : operation.body.removed === false && !old ? -1 : 0
				data.items =
					item.removed_at === null ? upsert(data.items, item) : data.items.filter((value: OfflineEntity) => value.id !== item.id)
				data.removed_counts[item.shopping_list_id] = Math.max(0, (data.removed_counts[item.shopping_list_id] ?? 0) + delta)
			}
		}
		if (path.startsWith("/api/shopping-lists") && url.pathname === "/api/shopping-lists")
			snapshot.data = item.deleted ? data.filter((value: OfflineEntity) => value.id !== item.id) : upsert(data, item)
		if (path.startsWith("/api/shopping-lists") && item.deleted && url.pathname === "/api/shopping-list-items" && data?.items)
			data.items = data.items.filter((value: OfflineEntity) => value.shopping_list_id !== item.id)
		if (
			path.startsWith("/api/time-entries") &&
			url.pathname === "/api/time-entries" &&
			url.searchParams.get("view") === "timer" &&
			data?.entries
		) {
			const target = Number(path.match(/\/(-?\d+)(?:\/stop)?$/)?.[1] ?? item.id)
			const previous = data.running
			if (item.deleted) {
				if (data.running?.id === target) data.running = null
				if (data.entries.some((value: OfflineEntity) => value.id === target)) data.total = Math.max(0, data.total - 1)
				data.entries = data.entries.filter((value: OfflineEntity) => value.id !== target)
			} else if (item.ended_at === null) {
				if (previous && previous.id !== item.id) {
					const stopped = { ...previous, ended_at: item.started_at, updated_at: item.updated_at }
					if (data.offset === 0) data.entries = upsert(data.entries, stopped).slice(0, data.limit)
					data.total++
					data.previous_ended_at = item.started_at
				}
				data.running = item
				if (data.entries.some((value: OfflineEntity) => value.id === item.id)) data.total = Math.max(0, data.total - 1)
				data.entries = data.entries.filter((value: OfflineEntity) => value.id !== item.id)
			} else {
				if (previous?.id === target) {
					data.running = null
					data.previous_ended_at = item.ended_at
				}
				if (!data.entries.some((value: OfflineEntity) => value.id === item.id)) data.total++
				if (data.offset === 0 || data.entries.some((value: OfflineEntity) => value.id === item.id))
					data.entries = upsert(data.entries, item)
						.sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))
						.slice(0, data.limit)
			}
		}
	}
}

export const projectedSnapshots = (account: OfflineAccount) => {
	const snapshots = structuredClone(account.snapshots)
	for (const operation of account.queue) applyOfflineOperation(snapshots, operation)
	return snapshots
}

export const createOfflineOperation = (
	account: OfflineAccount,
	path: string,
	method: string,
	payload: Record<string, any>,
	now = new Date().toISOString(),
	localId = -((crypto.getRandomValues(new Uint32Array(1))[0]! % 2147483646) + 1),
): OfflineOperation => {
	const snapshots = projectedSnapshots(account)
	const target = Number(path.match(/\/(-?\d+)(?:\/stop)?$/)?.[1])
	const timer = Object.entries(snapshots).find(
		([key]) => key.startsWith("/api/time-entries?") && new URL(key, "http://localhost").searchParams.get("view") === "timer",
	)?.[1].data
	const existing = Number.isFinite(target)
		? (findEntity(
				snapshots,
				path.includes("shopping-list-items")
					? "shopping-list-items"
					: path.includes("shopping-lists")
						? "shopping-lists"
						: "time-entries",
				target,
			) ??
			[...account.queue].reverse().find((operation) => operation.optimistic.id === target)?.optimistic ??
			null)
		: null
	const isNew = method === "POST" && !Number.isFinite(target)
	const body = { ...payload }
	let optimistic: OfflineEntity
	if (path.startsWith("/api/time-entries")) {
		if (!timer) throw new Error("Open Timer online once to make it available offline")
		if (isNew && path.endsWith("/start")) body.started_at ??= now
		if (path.endsWith("/stop")) body.ended_at ??= now
		if (!isNew && !existing) throw new Error("This time entry is not saved on this device")
		if ((path.endsWith("/stop") || body.ended_at) && !(body.project_id ?? existing?.project_id))
			throw new Error("Choose a project before stopping the timer")
		if (path.endsWith("/start") && timer.running && !timer.running.project_id)
			throw new Error("Choose a project before stopping the current timer")
		const projectId = body.project_id === undefined ? (existing?.project_id ?? null) : body.project_id
		const projects = Object.entries(snapshots).find(([key]) => key.startsWith("/api/projects"))?.[1].data ?? []
		optimistic = {
			user_id: account.user.id,
			project_id: projectId,
			description: null,
			ended_at: null,
			created_at: now,
			...existing,
			...body,
			id: isNew ? localId : target,
			updated_at: now,
			project: projects.find((value: OfflineEntity) => value.id === projectId) ?? null,
		}
		if (optimistic.ended_at && Date.parse(optimistic.ended_at) <= Date.parse(optimistic.started_at))
			throw new Error("End must be after start")
	} else if (path.startsWith("/api/shopping-list-items")) {
		if (isNew) {
			body.done ??= false
			body.quantity ??= 1
			body.unit ??= "pcs"
		}
		const listId = body.shopping_list_id ?? existing?.shopping_list_id
		const list = findEntity(snapshots, "shopping-lists", listId)
		if (!list || list.role !== "editor") throw new Error("Editor access is required to change this list offline")
		if (!isNew && !existing) throw new Error("Open this item's list online before editing it offline")
		optimistic = {
			name: "",
			quantity: 1,
			unit: "pcs",
			done: false,
			removed_at: null,
			ingredient_id: null,
			product_id: null,
			source_recipe_id: null,
			notes: null,
			created_at: now,
			...existing,
			...body,
			id: isNew ? localId : target,
			shopping_list_id: listId,
			updated_at: now,
		}
		if (!optimistic.name.trim()) throw new Error("Item name is required")
		if ("removed" in body || method === "DELETE") {
			optimistic.removed_at = method === "DELETE" || body.removed ? now : null
			optimistic.done = false
		}
		delete optimistic.removed
	} else {
		if (!isNew && !existing) throw new Error("This list is not saved on this device")
		if (!isNew && (method === "DELETE" || "name" in body) && existing?.role !== "editor") throw new Error("Editor access is required")
		optimistic = { role: "editor", hidden: false, created_at: now, ...existing, ...body, id: isNew ? localId : target, updated_at: now }
		if ("name" in optimistic && !optimistic.name.trim()) throw new Error("List name is required")
	}
	if (method === "DELETE") optimistic = { ...optimistic, deleted: true }
	const startsTimer = path.startsWith("/api/time-entries") && isNew && optimistic.ended_at === null
	const base = startsTimer ? timer?.running : existing
	const previous = [...account.queue]
		.reverse()
		.find((operation) => operation.path.startsWith("/api/time-entries") && operation.optimistic.id === base?.id)
	return {
		id: crypto.randomUUID(),
		...(path.startsWith("/api/time-entries") ? { time_changes: [
			...(startsTimer && timer?.running ? [{ before: timer.running, after: { ...timer.running, ended_at: optimistic.started_at, updated_at: optimistic.updated_at } }] : []),
			{ before: (existing ?? null) as TimeEntry | null, after: optimistic.deleted ? null : optimistic as TimeEntry },
		] } : {}),
		path,
		method,
		body,
		local_id: isNew ? localId : null,
		expected_running_id: path.startsWith("/api/time-entries") && optimistic.ended_at === null ? (timer?.running?.id ?? null) : null,
		expected_updated_at: base?.updated_at ?? null,
		base_operation_id: previous?.id ?? null,
		optimistic,
		time: now,
	}
}

export const acknowledgeOfflineOperation = (account: OfflineAccount, operation: OfflineOperation, result: OfflineEntity) => {
	applyOfflineOperation(account.snapshots, operation, result)
	account.queue = account.queue.filter((value) => value.id !== operation.id)
	for (const pending of account.queue)
		if (pending.base_operation_id === operation.id) {
			pending.base_operation_id = null
			pending.expected_updated_at = result.updated_at ?? null
		}
	if (operation.local_id !== null && result.id !== operation.local_id) {
		const oldId = operation.local_id
		if (operation.path.startsWith("/api/shopping-lists")) {
			for (const key of Object.keys(account.snapshots))
				if (key.includes(`shopping_list_id=${oldId}&`)) {
					account.snapshots[key.replace(`shopping_list_id=${oldId}&`, `shopping_list_id=${result.id}&`)] = account.snapshots[key]!
					delete account.snapshots[key]
				}
		}
		for (const pending of account.queue) {
			pending.path = pending.path.replace(new RegExp(`/${oldId}(?=/|$)`), `/${result.id}`)
			if (pending.body.shopping_list_id === oldId) pending.body.shopping_list_id = result.id
			if (pending.optimistic.shopping_list_id === oldId) pending.optimistic.shopping_list_id = result.id
			if (pending.expected_running_id === oldId) pending.expected_running_id = result.id
			if (pending.optimistic.id === oldId) pending.optimistic.id = result.id
			for (const change of pending.time_changes ?? []) {
				if (change.before?.id === oldId) change.before.id = result.id
				if (change.after?.id === oldId) change.after.id = result.id
			}
		}
	}
}
