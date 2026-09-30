import type { BunRequest } from "bun"

export const requestFor = (id: number, method: string, body?: unknown) => Object.assign(new Request(`http://pupler.internal/resource/${id}`, { method, ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) }), { params: { id: String(id) } }) as unknown as BunRequest<string>
export const bodyOf = async (response: Response) => response.status === 204 ? { success: true } : response.json()
