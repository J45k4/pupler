import { requireAuthenticatedUser } from "./auth"
import { HttpError, type JsonObject } from "./core"

export type TimeUser = Awaited<ReturnType<typeof requireAuthenticatedUser>>

export const scopeTimeOwner = (user: TimeUser, owner: unknown) => {
	if (user.is_admin) return owner
	if (owner !== undefined && owner !== user.id) throw new HttpError(403, "You can only manage your own time entries")
	return user.id
}

export const ownedTimeBody = async (user: TimeUser, body: JsonObject) => {
	if (!user.is_admin) body.user_id = scopeTimeOwner(user, body.user_id) as number
	return body
}

export const requireTimeOwner = (user: TimeUser, entry: { user_id: number | null } | null) => {
	if (!entry || (!user.is_admin && entry.user_id !== user.id)) throw new HttpError(404, "Resource not found")
}
