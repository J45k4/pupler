import { apiReadCache } from "./api-cache"
import { invalidateOfflineReads } from "./offline"
import { configureOfflineTransport, offlineAvailable, offlineEpoch, offlineReadVersion, readOfflineData, rememberOfflineRead, shouldQueueOfflineMutation, queueOfflineMutation } from "./offline"

export class ApiError extends Error {
	status: number

	constructor(status: number, message: string) {
		super(message)
		this.status = status
	}
}

const networkFetch = async <T>(
	path: string,
	options: RequestInit = {},
): Promise<T> => {
	const response = await fetch(path, {
		...options,
		credentials: "same-origin",
		headers: {
			...(typeof options.body === "string" ? { "Content-Type": "application/json" } : {}),
			...(options.headers ?? {}),
		},
	})
	if (response.status === 401 || (response.ok && !["GET", "HEAD"].includes((options.method ?? "GET").toUpperCase()))) {
		apiReadCache.clear()
		invalidateOfflineReads()
	}
	if (response.status === 204) return undefined as T
	const body = (await response.json().catch(() => null)) as
		| (T & { error?: string })
		| null
	if (!response.ok) {
		const message =
			body && typeof body === "object" && "error" in body && body.error
				? String(body.error)
				: `Request failed with status ${response.status}`
		throw new ApiError(response.status, message)
	}
	return body as T
}

configureOfflineTransport(networkFetch)

export const apiFetch = async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
	const requestEpoch = offlineEpoch()
	const requestVersion = offlineReadVersion()
	if (shouldQueueOfflineMutation(path, options)) return queueOfflineMutation<T>(path, options)
	const read = (options.method ?? "GET").toUpperCase() === "GET"
	if (read && offlineAvailable() && /[?&]shopping_list_id=-\d+(?:&|$)/.test(path)) return readOfflineData<T>(path)
	if (read && offlineAvailable() && !navigator.onLine && path !== "/api/auth/session") return readOfflineData<T>(path)
	try {
		const data = await networkFetch<T>(path, options)
		return read && offlineAvailable() ? rememberOfflineRead(path, data, requestEpoch, requestVersion) : data
	} catch (error) {
		if (read && offlineAvailable() && !(error instanceof ApiError) && !options.signal?.aborted && path !== "/api/auth/session") return readOfflineData<T>(path)
		throw error
	}
}

export const apiGet = <T>(path: string) => apiFetch<T>(path)

export const apiPost = <T>(path: string, payload: unknown) =>
	apiFetch<T>(path, { method: "POST", body: JSON.stringify(payload) })

export const apiPut = <T>(path: string, payload: unknown) =>
	apiFetch<T>(path, { method: "PUT", body: JSON.stringify(payload) })

export const apiDelete = (path: string) =>
	apiFetch<void>(path, { method: "DELETE" })
