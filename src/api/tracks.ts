import type { BunRequest } from "bun"
import { db } from "../db"
import { requireAuthenticatedUser } from "./auth"
import { assertKnownFields, empty, expectNullableString, expectString, HttpError, json, parseIdParam, readJsonObject, readOptionalBodyField, requireBodyField, utcNow, type JsonValue } from "./core"
import { pointInclude } from "./location-points"

const include = { added_by_user: { select: { id: true, name: true } }, _count: { select: { points: true } } } as const
const expectName = (value: JsonValue, field: string) => {
    const name = expectString(value, field).trim()
    if (!name) throw new HttpError(400, "Track name cannot be empty")
    return name
}
const values = async (req: Request) => {
    const body = await readJsonObject(req)
    assertKnownFields(body, ["name", "notes", "activity_type"])
    const data = {
        name: req.method === "PATCH" ? readOptionalBodyField(body, "name", expectName) : requireBodyField(body, "name", expectName),
        notes: readOptionalBodyField(body, "notes", expectNullableString),
        activity_type: readOptionalBodyField(body, "activity_type", expectNullableString),
    }
    if (req.method === "PATCH" && Object.values(data).every(value => value === undefined)) throw new HttpError(400, "PATCH request must contain at least one writable field")
    return data
}
export const tracksCollectionRoute = async (req: Request) => {
    const user = await requireAuthenticatedUser(req)
    if (req.method === "GET") return json(200, await db.client.track.findMany({ include, orderBy: [{ created_at: "desc" }, { id: "desc" }] }))
    if (req.method === "POST") {
        const data = await values(req)
        const now = utcNow()
        return json(201, await db.client.track.create({ data: { ...data, name: data.name!, added_by: user.id, created_at: now, updated_at: now }, include }))
    }
    throw new HttpError(405, "Method not allowed for this route")
}
export const trackDetailRoute = async (req: BunRequest<string>) => {
    const user = await requireAuthenticatedUser(req)
    const id = parseIdParam(req.params.id ?? "")
    const track = await db.client.track.findUnique({ where: { id }, include })
    if (!track) throw new HttpError(404, "Resource not found")
    if (req.method === "GET") return json(200, { ...track, points: await db.client.locationPoint.findMany({ where: { track_id: id }, include: pointInclude, orderBy: [{ sequence: "asc" }, { id: "asc" }] }) })
    if (!["PUT", "PATCH", "DELETE"].includes(req.method)) throw new HttpError(405, "Method not allowed for this route")
    if (track.added_by !== user.id && !user.is_admin) throw new HttpError(403, "Only the creator or an administrator can change this track")
    if (req.method === "DELETE") {
        // Detach points so deleting a track preserves annotated places.
        await db.client.track.delete({ where: { id } })
        return empty(204)
    }
    const data = await values(req)
    return json(200, await db.client.track.update({ where: { id }, data: { ...data, ...(req.method === "PUT" ? { notes: data.notes ?? null, activity_type: data.activity_type ?? null } : {}), updated_at: utcNow() }, include }))
}
