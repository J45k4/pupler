import { expect, test } from "bun:test"
import { offlineChangeAffects } from "../src/react/offline-data"

const scenario = async (action: string) => {
	// Isolate browser globals and the offline module's account/storage lifecycle.
	const source = `
		import { indexedDB, IDBObjectStore } from "fake-indexeddb"
		import { activateOfflineUser, configureOfflineTransport, offlineReadVersion, offlineEpoch, rememberOfflineRead, readOfflineData, queueOfflineMutation, offlineStatus, invalidateOfflineReads, discardOfflineChanges, queuedTimeChanges, syncOfflineChanges } from ${JSON.stringify(new URL("../src/react/offline.ts", import.meta.url).href)}
		Object.assign(globalThis, { indexedDB, window: new EventTarget(), document: Object.assign(new EventTarget(), { visibilityState: "visible" }) })
		Object.defineProperty(globalThis, "navigator", { value: { onLine: true, locks: { request: async (_name, _options, callback) => callback(null) } }, configurable: true })
		globalThis.BroadcastChannel = class {
			constructor() { globalThis.syncChannel = this; this.messages = [] }
			postMessage(message) { this.messages.push(message) }
		}
		let networkCalls = 0
		let networkHandler = async () => { throw new Error("Network is stalled") }
		configureOfflineTransport(async (path, options) => { networkCalls++; return networkHandler(path, options) })
		const user = { id: 1, name: "Phone", username: "phone", email: null, is_admin: false, created_at: "", updated_at: "" }
		await activateOfflineUser(user)
		const timerPath = "/api/time-entries?view=timer&offset=0"
		const boardPath = "/api/shopping-list-items?view=board"
		const running = { id: 11, user_id: 1, project_id: 1, description: "Phone work", started_at: "2026-10-23T08:00:00.000Z", ended_at: null, created_at: "2026-10-23T08:00:00.000Z", updated_at: "2026-10-23T08:00:00.000Z" }
		const timer = { entries: [], running, total: 0, offset: 0, limit: 50, previous_ended_at: null, quick_actions: [], project_usage: [] }
		await rememberOfflineRead(timerPath, timer)
		await rememberOfflineRead(boardPath, { items: [], removed_counts: {} })
		await rememberOfflineRead("/api/shopping-lists", [{ id: 1, name: "Groceries", role: "editor", hidden: false }])
		const changes = []
		window.addEventListener("pupler:synced", event => changes.push(event.detail))
		const result = await (async () => { ${action} })()
		console.log(JSON.stringify(result))
		process.exit(0)
	`
	const child = Bun.spawn([process.execPath, "-e", source], { cwd: new URL("..", import.meta.url).pathname, stdout: "pipe", stderr: "pipe" })
	const [code, output, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
	if (code) throw new Error(error)
	return JSON.parse(output)
}

test("offline notifications affect matching data families and keep unrelated requests active", () => {
	expect(offlineChangeAffects("/api/time-entries?view=timer&offset=50", ["/api/time-entries/11/stop"])).toBe(true)
	expect(offlineChangeAffects("/api/shopping-lists", ["/api/shopping-list-items/2"])).toBe(true)
	expect(offlineChangeAffects("/api/shopping-list-items?view=board", ["/api/shopping-lists/1"])).toBe(true)
	expect(offlineChangeAffects("/api/projects", ["/api/time-entries/start"])).toBe(false)
	expect(offlineChangeAffects("/api/time-entries?view=timer", ["/api/shopping-lists"])).toBe(false)
	expect(offlineChangeAffects("/api/time-entries?view=timer")).toBe(true)
})

test("durably saved actions notify their own tab and project updated data before any network confirmation", async () => {
	const result = await scenario(`
		const version = offlineReadVersion(), epoch = offlineEpoch()
		await queueOfflineMutation("/api/time-entries/11/stop", { method: "POST", body: JSON.stringify({ ended_at: "2026-10-23T09:00:00.000Z" }) })
		const stopped = await readOfflineData(timerPath)
		const stale = await rememberOfflineRead(timerPath, timer, epoch, version)
		await queueOfflineMutation("/api/shopping-list-items", { method: "POST", body: JSON.stringify({ shopping_list_id: 1, name: "Milk" }) })
		return { stopped, stale, changes, board: await readOfflineData(boardPath), pending: offlineStatus().pending, networkCalls }
	`)
	expect(result.networkCalls).toBe(0)
	expect(result.pending).toBe(2)
	expect(result.changes).toMatchObject([
		{ paths: ["/api/time-entries/11/stop"], pending: true },
		{ paths: ["/api/shopping-list-items"], pending: true },
	])
	expect(result.changes[0].time_changes[0].before.id).toBe(11)
	expect(result.changes[0].time_changes[0].after.ended_at).toBe("2026-10-23T09:00:00.000Z")
	expect(result.stopped.running).toBeNull()
	expect(result.stopped.entries[0].ended_at).toBe("2026-10-23T09:00:00.000Z")
	expect(result.stale.running).toBeNull()
	expect(result.stale.entries).toEqual(result.stopped.entries)
	expect(result.board.items[0].name).toBe("Milk")
})

test("a failed device save neither announces nor projects a successful timer stop", async () => {
	const result = await scenario(`
		const put = IDBObjectStore.prototype.put
		IDBObjectStore.prototype.put = () => { throw new DOMException("Storage full", "QuotaExceededError") }
		let error
		try { await queueOfflineMutation("/api/time-entries/11/stop", { method: "POST", body: JSON.stringify({ ended_at: "2026-10-23T09:00:00.000Z" }) }) }
		catch (failure) { error = failure.message }
		finally { IDBObjectStore.prototype.put = put }
		return { error, changes, data: await readOfflineData(timerPath), networkCalls }
	`)
	expect(result.error).toBe("Storage full")
	expect(result.changes).toMatchObject([])
	expect(result.data.running.id).toBe(11)
	expect(result.networkCalls).toBe(0)
})

test("successful connected saves prevent old reads from replacing saved selectors", async () => {
	const result = await scenario(`
		const path = "/api/projects?sort=name&order=asc"
		await rememberOfflineRead(path, [{ id: 1, name: "Old" }])
		const version = offlineReadVersion(), epoch = offlineEpoch()
		invalidateOfflineReads()
		await rememberOfflineRead(path, [{ id: 1, name: "Saved" }])
		const late = await rememberOfflineRead(path, [{ id: 1, name: "Old" }], epoch, version)
		return { late, saved: await readOfflineData(path) }
	`)
	expect(result.late).toEqual([{ id: 1, name: "Saved" }])
	expect(result.saved).toEqual(result.late)
})

test("discarding unsent edits emits their inverse changes and restores the saved timer", async () => {
	const result = await scenario(`
		await queueOfflineMutation("/api/time-entries/11/stop", { method: "POST", body: JSON.stringify({ ended_at: "2026-10-23T09:00:00.000Z" }) })
		const queued = await queuedTimeChanges()
		navigator.onLine = false
		await discardOfflineChanges()
		return { queued, undo: changes.find(change => change?.pending && change?.time_changes?.[0]?.after?.ended_at === null), pending: offlineStatus().pending, timer: await readOfflineData(timerPath) }
	`)
	expect(result.queued).toHaveLength(1)
	expect(result.undo.time_changes[0].before.ended_at).toBe("2026-10-23T09:00:00.000Z")
	expect(result.undo.time_changes[0].after.ended_at).toBeNull()
	expect(result.pending).toBe(0)
	expect(result.timer.running.id).toBe(11)
})

for (const failure of ["prepare", "send", "partial"]) test(`a failed sync during ${failure} reports an error and retries without losing or duplicating the saved change`, async () => {
	const result = await scenario(`
		navigator.onLine = false
		await queueOfflineMutation("/api/time-entries/11/stop", { method: "POST", body: JSON.stringify({ ended_at: "2026-10-23T09:00:00.000Z" }) })
		navigator.onLine = true
		navigator.locks.request = async (_name, _options, callback) => callback({})
		let failed = true
		const sent = []
		networkHandler = async (_path, options) => {
			if (options?.method !== "POST") {
				if (failed && ${JSON.stringify(failure)} === "prepare") throw Object.assign(new Error("Service unavailable"), { status: 503 })
				return { sync_session: "test-session" }
			}
			const payload = JSON.parse(options.body)
			sent.push(payload)
			if (failed && ${JSON.stringify(failure)} === "send") throw new TypeError("Failed to fetch")
			return { results: payload.operations.map(operation => ({ id: operation.id, status: failed ? 503 : 200,
				...(failed ? { error: "Server unavailable" } : { result: { ...offlineStatus().operations.find(value => value.id === operation.id).optimistic } }) })) }
		}
		await syncOfflineChanges()
		const error = structuredClone(offlineStatus())
		failed = false
		await syncOfflineChanges(true)
		return { error, final: offlineStatus(), sent, messages: syncChannel.messages, timer: await readOfflineData(timerPath) }
	`)
	expect(result.error.error).toContain("Could not sync changes")
	expect(result.error.error).toContain("saved on this device")
	expect(result.error.pending).toBe(1)
	expect(result.error.operations[0].error).toBeUndefined()
	expect(result.final.error).toBe("")
	expect(result.final.pending).toBe(0)
	expect(result.timer.running).toBeNull()
	expect(result.timer.entries.filter((entry: { id: number }) => entry.id === 11)).toHaveLength(1)
	expect(result.messages.some((message: { sync_error?: string }) => message.sync_error?.includes("Could not sync"))).toBe(true)
	expect(result.messages.some((message: { sync_error?: string }) => message.sync_error === "")).toBe(true)
	if (failure !== "prepare") expect(result.sent[1]).toEqual(result.sent[0])
})

test("authentication failures explain how to resume syncing and clearing the queue clears the error", async () => {
	const result = await scenario(`
		navigator.onLine = false
		await queueOfflineMutation("/api/time-entries/11/stop", { method: "POST", body: "{}" })
		navigator.onLine = true
		navigator.locks.request = async (_name, _options, callback) => callback({})
		networkHandler = async () => { throw Object.assign(new Error("Authentication required"), { status: 401 }) }
		await syncOfflineChanges()
		const error = offlineStatus().error
		navigator.onLine = false
		await discardOfflineChanges()
		return { error, final: offlineStatus() }
	`)
	expect(result.error).toBe("Sign in again to sync your saved changes.")
	expect(result.final.error).toBe("")
	expect(result.final.pending).toBe(0)
})

test("sync failures from another tab stay within the account and clear when that tab recovers", async () => {
	const result = await scenario(`
		navigator.onLine = false
		await queueOfflineMutation("/api/time-entries/11/stop", { method: "POST", body: "{}" })
		const receive = async (user_id, sync_error) => {
			syncChannel.onmessage({ data: { user_id, sync_error } })
			await new Promise(resolve => setTimeout(resolve, 10))
			return offlineStatus().error
		}
		const wrongAccount = await receive(2, "Other account error")
		const failed = await receive(1, "Could not sync changes")
		const recovered = await receive(1, "")
		await activateOfflineUser({ ...user, id: 2 })
		await receive(1, "Previous account error")
		return { wrongAccount, failed, recovered, final: offlineStatus() }
	`)
	expect(result.wrongAccount).toBe("")
	expect(result.failed).toBe("Could not sync changes")
	expect(result.recovered).toBe("")
	expect(result.final.error).toBe("")
	expect(result.final.pending).toBe(0)
})
