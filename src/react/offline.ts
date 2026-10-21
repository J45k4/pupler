import type { AuthUser } from "./auth"
import { apiReadCache } from "./api-cache"
import {
	acknowledgeOfflineOperation,
	createOfflineOperation,
	offlineReadPath,
	offlineWritePath,
	operationPayload,
	nextOfflineBatch,
	prepareOfflineBatch,
	projectedSnapshots,
	type OfflineAccount,
	type OfflineEntity,
	type OfflineOperation,
} from "./offline-data"

type Transport = <T>(path: string, options?: RequestInit) => Promise<T>
let transport: Transport
let activeUser: AuthUser | null = null
let storageAvailable = true
let opening: Promise<IDBDatabase> | undefined
let syncing = false
let retry: ReturnType<typeof setTimeout> | undefined
let failures = 0
let epoch = 0
let readVersion = 0
let channel: BroadcastChannel | undefined
const notifyOtherTabs = (paths: string[], pending = false) => {
	if (activeUser) channel?.postMessage({ user_id: activeUser.id, paths, pending })
}
export type OfflineStatus = { pending: number; syncing: boolean; error: string; operations: OfflineOperation[] }
let status: OfflineStatus = { pending: 0, syncing: false, error: "", operations: [] }
const notify = () => {
	if (typeof window !== "undefined") window.dispatchEvent(new Event("pupler:offline"))
}
export const offlineStatus = () => status
export const offlineAvailable = () => activeUser !== null && storageAvailable && typeof indexedDB !== "undefined"
export const offlineEpoch = () => epoch
export const offlineReadVersion = () => readVersion

const database = () =>
	(opening ??= new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB.open("pupler-offline", 1)
		request.onupgradeneeded = () => {
			request.result.createObjectStore("accounts", { keyPath: "user.id" })
			request.result.createObjectStore("meta")
		}
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => {
			opening = undefined
			reject(new Error("Could not save changes on this device. Free some storage and try again."))
		}
	}))
const readAccount = async (id: number) => {
	const db = await database()
	return new Promise<OfflineAccount | undefined>((resolve, reject) => {
		const request = db.transaction("accounts").objectStore("accounts").get(id)
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
	})
}
const updateAccount = async <T>(user: AuthUser, update: (account: OfflineAccount) => T): Promise<T> => {
	const db = await database()
	return new Promise<T>((resolve, reject) => {
		const transaction = db.transaction("accounts", "readwrite")
		const store = transaction.objectStore("accounts")
		let value: T
		const request = store.get(user.id)
		request.onsuccess = () => {
			try {
				const account: OfflineAccount = request.result ?? { user, client_id: crypto.randomUUID(), queue: [], snapshots: {} }
				account.user = user
				value = update(account)
				store.put(account)
			} catch (error) {
				transaction.abort()
				reject(error)
			}
		}
		transaction.oncomplete = () => resolve(value)
		transaction.onerror = transaction.onabort = () => reject(transaction.error ?? new Error("Could not save this change on the device"))
	})
}
const rememberActive = async (user: AuthUser | null) => {
	const db = await database()
	await new Promise<void>((resolve, reject) => {
		const transaction = db.transaction("meta", "readwrite")
		if (user) {
			transaction.objectStore("meta").put(user, "active")
			transaction.objectStore("meta").delete("signed-out")
		} else {
			transaction.objectStore("meta").delete("active")
			transaction.objectStore("meta").put(true, "signed-out")
		}
		transaction.oncomplete = () => resolve()
		transaction.onerror = () => reject(transaction.error)
	})
}
export const savedOfflineUser = async (): Promise<AuthUser | null> => {
	if (typeof indexedDB === "undefined") return null
	const db = await database()
	return new Promise((resolve, reject) => {
		const request = db.transaction("meta").objectStore("meta").get("active")
		request.onsuccess = () => resolve(request.result ?? null)
		request.onerror = () => reject(request.error)
	})
}
export const offlineSignedOut = async (): Promise<boolean> => {
	if (typeof indexedDB === "undefined") return false
	const db = await database()
	return new Promise((resolve, reject) => {
		const request = db.transaction("meta").objectStore("meta").get("signed-out")
		request.onsuccess = () => resolve(request.result === true)
		request.onerror = () => reject(request.error)
	})
}
const refreshStatus = async () => {
	if (!storageAvailable) return
	const user = activeUser
	let account: OfflineAccount | undefined
	try {
		account = user ? await readAccount(user.id) : undefined
	} catch {
		storageAvailable = false
		status = { ...status, syncing: false, error: "Offline storage is unavailable. Connect to save changes." }
		notify()
		return
	}
	if (user?.id !== activeUser?.id) return
	const operations = account?.queue ?? []
	status = { pending: operations.length, syncing, error: operations.find((operation) => operation.error)?.error ?? "", operations }
	notify()
}
export const activateOfflineUser = async (user: AuthUser | null) => {
	if (activeUser?.id !== user?.id) {
		epoch++
		apiReadCache.clear()
	}
	activeUser = user
	storageAvailable = true
	clearTimeout(retry)
	status = { pending: 0, syncing: false, error: "", operations: [] }
	notify()
	if (typeof indexedDB === "undefined") return
	try {
		await rememberActive(user)
		if (user)
			await updateAccount(user, (account) => {
				for (const path of Object.keys(account.snapshots)) if (!offlineReadPath(path)) delete account.snapshots[path]
			})
		await refreshStatus()
		if (user && navigator.onLine) void syncOfflineChanges()
	} catch {
		storageAvailable = false
		status = { pending: 0, syncing: false, error: "Offline storage is unavailable. Connect to save changes.", operations: [] }
		notify()
	}
}
export const rememberOfflineRead = async <T>(path: string, data: T, expectedEpoch = epoch, expectedVersion = readVersion): Promise<T> => {
	const user = activeUser
	if (!user || expectedEpoch !== epoch || !offlineReadPath(path)) return data
	return updateAccount(user, (account) => {
		const family = path.startsWith("/api/time-entries")
			? "/api/time-entries"
			: path.startsWith("/api/shopping-")
				? "/api/shopping-"
				: null
		const pending = family !== null && account.queue.some((operation) => operation.path.startsWith(family))
		if (expectedVersion === readVersion && (!pending || !account.snapshots[path])) account.snapshots[path] = { data, time: Date.now() }
		const details = Object.keys(account.snapshots).filter((key) => /^\/api\/time-entries\/\d+$/.test(key))
		for (const key of details.sort((a, b) => account.snapshots[b]!.time - account.snapshots[a]!.time).slice(100))
			delete account.snapshots[key]
		return (projectedSnapshots(account)[path]?.data ?? data) as T
	}).catch(() => data)
}
export const readOfflineData = async <T>(path: string): Promise<T> => {
	if (!activeUser) throw new Error("Sign in online first to use Pupler offline")
	const userId = activeUser.id
	const account = await readAccount(userId)
	if (userId !== activeUser?.id) throw new Error("Account changed")
	const data = account ? projectedSnapshots(account)[path]?.data : undefined
	if (data !== undefined) return data as T
	if (path.includes("view=descriptions")) return [] as T
	throw new Error("This page has not been saved on this device yet. Open it once while connected.")
}
export const queueOfflineMutation = async <T>(path: string, options: RequestInit): Promise<T> => {
	const user = activeUser
	if (!user) throw new Error("Sign in before saving changes")
	const result = await updateAccount(user, (account) => {
		const operation = createOfflineOperation(
			account,
			path,
			(options.method ?? "GET").toUpperCase(),
			typeof options.body === "string" ? JSON.parse(options.body) : {},
		)
		account.queue.push(operation)
		readVersion++
		return operation.optimistic
	})
	apiReadCache.clear()
	await refreshStatus()
	notifyOtherTabs([path], true)
	if (navigator.onLine) void syncOfflineChanges()
	return result as T
}
export const shouldQueueOfflineMutation = (path: string, options: RequestInit) =>
	offlineAvailable() && offlineWritePath(path, (options.method ?? "GET").toUpperCase())

const performSync = async (user: AuthUser, startedEpoch: number) => {
	if (syncing || !offlineAvailable() || !navigator.onLine || activeUser?.id !== user.id) return
	syncing = true
	clearTimeout(retry)
	try {
		await refreshStatus()
		while (navigator.onLine && activeUser?.id === user.id && epoch === startedEpoch) {
			const account = await readAccount(user.id)
			let batch = account ? nextOfflineBatch(account) : []
			if (!account || !batch.length) break
			if (activeUser?.id !== user.id || epoch !== startedEpoch) break
			if (!batch[0]!.attempt) {
				const { sync_session } = await transport<{ sync_session: string }>("/api/offline/sync")
				if (typeof sync_session !== "string" || !sync_session) throw new Error("Could not prepare saved changes")
				if (activeUser?.id !== user.id || epoch !== startedEpoch) break
				const ids = batch.map((operation) => operation.id)
				// Save the server session and exact payload before any request can commit.
				// A restarted server must reject uncertain attempts rather than duplicate them.
				batch = await updateAccount(user, (current) => prepareOfflineBatch(current, ids, sync_session))
				if (!batch.length) continue
			}
			if (activeUser?.id !== user.id || epoch !== startedEpoch) break
			const response = await transport<{ results: { id: string; status: number; result?: OfflineEntity; error?: string }[] }>(
				"/api/offline/sync",
				{
					method: "POST",
					body: JSON.stringify({
						user_id: user.id,
						client_id: account.client_id,
						sync_session: batch[0]!.attempt!.session,
						operations: batch.map(operationPayload),
					}),
				},
			)
			if (activeUser?.id !== user.id || epoch !== startedEpoch) break
			if (!Array.isArray(response.results) || response.results.length !== batch.length)
				throw new Error("Could not confirm saved changes")
			let transient = false
			await updateAccount(user, (current) => {
				for (const result of response.results) {
					const operation = current.queue.find((value) => value.id === result.id)
					if (!operation) continue
					if (result.status === 200 && result.result) acknowledgeOfflineOperation(current, operation, result.result)
					else if (result.status >= 500) transient = true
					else operation.error = result.error ?? "This change needs review before it can sync"
				}
				readVersion++
			})
			apiReadCache.clear()
			window.dispatchEvent(new CustomEvent("pupler:synced", { detail: { paths: batch.map((operation) => operation.path) } }))
			notifyOtherTabs(batch.map((operation) => operation.path))
			await refreshStatus()
			if (transient) throw new Error("Server unavailable")
			failures = 0
		}
	} catch {
		if (navigator.onLine && activeUser?.id === user.id)
			retry = setTimeout(
				() => {
					void syncOfflineChanges()
				},
				Math.min(60_000, 2000 * 2 ** Math.min(failures++, 5)),
			)
	} finally {
		syncing = false
		await refreshStatus()
		if (activeUser && epoch !== startedEpoch && navigator.onLine)
			setTimeout(() => {
				void syncOfflineChanges()
			}, 0)
	}
}
export const syncOfflineChanges = async (retryBlocked = false) => {
	const user = activeUser
	if (!user || !offlineAvailable() || !navigator.onLine || !transport) return
	if (retryBlocked)
		await updateAccount(user, (account) => {
			for (const operation of account.queue) delete operation.error
		})
	if (navigator.locks)
		await navigator.locks.request("pupler-offline-sync", { ifAvailable: true }, (lock) => {
			if (lock) return performSync(user, epoch)
			clearTimeout(retry)
			retry = setTimeout(() => {
				void syncOfflineChanges()
			}, 1000)
		})
	else await performSync(user, epoch)
}
export const discardOfflineChanges = async () => {
	if (!activeUser) return
	await updateAccount(activeUser, (account) => {
		account.queue = []
		readVersion++
	})
	apiReadCache.clear()
	if (navigator.onLine) await prepareOfflinePages(true)
	window.dispatchEvent(new Event("pupler:synced"))
	notifyOtherTabs([])
	await refreshStatus()
}
export const configureOfflineTransport = (send: Transport) => {
	transport = send
	if (typeof window === "undefined") return
	if (typeof BroadcastChannel !== "undefined") {
		channel = new BroadcastChannel("pupler-offline")
		channel.onmessage = ({ data }) => {
			if (data?.user_id !== activeUser?.id || !Array.isArray(data.paths)) return
			readVersion++
			apiReadCache.clear()
			window.dispatchEvent(new CustomEvent("pupler:synced", { detail: { paths: data.paths, pending: data.pending } }))
			void refreshStatus()
		}
	}
	window.addEventListener("online", () => {
		void syncOfflineChanges()
		notify()
	})
	window.addEventListener("offline", notify)
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible") {
			void refreshStatus()
			void syncOfflineChanges()
		}
	})
}
export const prepareOfflinePages = async (refresh = false) => {
	if (!offlineAvailable() || !activeUser || !navigator.onLine) return
	const startedEpoch = epoch
	const startedVersion = readVersion
	const account = await readAccount(activeUser.id)
	const paths = [
		"/api/time-entries?view=timer&offset=0",
		"/api/projects?sort=name&order=asc",
		"/api/clients?sort=name&order=asc",
		"/api/shopping-lists",
		"/api/shopping-list-items?view=board",
	]
	await Promise.allSettled(
		paths
			.filter((path) => refresh || !account?.snapshots[path] || Date.now() - account.snapshots[path]!.time > 15_000)
			.map((path) =>
				apiReadCache.read(
					path,
					async (signal) => rememberOfflineRead(path, await transport(path, { signal }), startedEpoch, startedVersion),
					new AbortController().signal,
				),
			),
	)
	if ("serviceWorker" in navigator)
		await navigator.serviceWorker.register("/service-worker.js", { updateViaCache: "none" }).catch(() => {})
}
