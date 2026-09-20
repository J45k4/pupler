export class ApiError extends Error {
	status: number

	constructor(status: number, message: string) {
		super(message)
		this.status = status
	}
}

export const apiFetch = async <T>(
	path: string,
	options: RequestInit = {},
): Promise<T> => {
	const response = await fetch(path, {
		...options,
		credentials: "same-origin",
		headers: {
			...(options.body ? { "Content-Type": "application/json" } : {}),
			...(options.headers ?? {}),
		},
	})
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

export const apiGet = <T>(path: string) => apiFetch<T>(path)

export const apiPost = <T>(path: string, payload: unknown) =>
	apiFetch<T>(path, { method: "POST", body: JSON.stringify(payload) })

export const apiPut = <T>(path: string, payload: unknown) =>
	apiFetch<T>(path, { method: "PUT", body: JSON.stringify(payload) })

export const apiDelete = (path: string) =>
	apiFetch<void>(path, { method: "DELETE" })
