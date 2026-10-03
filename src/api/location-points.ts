import type { BunRequest } from "bun"
import { db } from "../db"
import { requireAuthenticatedUser } from "./auth"
import { assertKnownFields, empty, expectDecimal, expectNullableDecimal, expectNullableInteger, expectNullableString, expectNullableTimestamp, HttpError, json, parseIdParam, readJsonObject, readOptionalBodyField, requireBodyField, utcNow, type JsonObject, type JsonValue } from "./core"

const WRITABLE_FIELDS = ["name", "notes", "latitude", "longitude", "track_id", "sequence", "recorded_at", "altitude", "accuracy"]
export const pointInclude = { added_by_user: { select: { id: true, name: true } }, track: { select: { id: true, name: true } } } as const

const expectName = (value: JsonValue, field: string) => {
    const name = expectNullableString(value, field)?.trim() ?? null
    if (name === "") throw new HttpError(400, "Field `name` cannot be empty")
    return name
}
const expectCoordinate = (value: JsonValue, field: string) => {
    const coordinate = expectDecimal(value, field)
    const limit = field === "latitude" ? 90 : 180
    if (Math.abs(coordinate) > limit) throw new HttpError(400, `Field \`${field}\` must be between ${-limit} and ${limit}`)
    return coordinate
}
const expectSequence = (value: JsonValue, field: string) => {
    const sequence = expectNullableInteger(value, field)
    if (sequence !== null && (!Number.isSafeInteger(sequence) || sequence < 0)) throw new HttpError(400, "Sequence must be a non-negative safe integer")
    return sequence
}
const expectAccuracy = (value: JsonValue, field: string) => {
    const accuracy = expectNullableDecimal(value, field)
    if (accuracy !== null && accuracy < 0) throw new HttpError(400, "Accuracy cannot be negative")
    return accuracy
}
const parseValues = (body: JsonObject, partial: boolean) => {
    assertKnownFields(body, WRITABLE_FIELDS)
    const read = partial ? readOptionalBodyField : requireBodyField
    const values = {
        name: readOptionalBodyField(body, "name", expectName),
        latitude: read(body, "latitude", expectCoordinate),
        longitude: read(body, "longitude", expectCoordinate),
        notes: readOptionalBodyField(body, "notes", expectNullableString),
        track_id: readOptionalBodyField(body, "track_id", expectNullableInteger),
        sequence: readOptionalBodyField(body, "sequence", expectSequence),
        recorded_at: readOptionalBodyField(body, "recorded_at", expectNullableTimestamp),
        altitude: readOptionalBodyField(body, "altitude", expectNullableDecimal),
        accuracy: readOptionalBodyField(body, "accuracy", expectAccuracy),
    }
    if (partial && Object.values(values).every(value => value === undefined)) throw new HttpError(400, "PATCH request must contain at least one writable field")
    return values
}

const validateTrack = async (trackId: number | null, sequence: number | null, user: { id: number; is_admin: boolean }) => {
    if (trackId === null) return
    if (sequence === null) throw new HttpError(400, "Track points require a sequence")
    const track = await db.client.track.findUnique({ where: { id: trackId } })
    if (!track) throw new HttpError(404, "Track not found")
    if (track.added_by !== user.id && !user.is_admin) throw new HttpError(403, "Only the track creator or an administrator can change its points")
}

const filters = (url: URL) => {
    const where: { track_id?: number | null | { not: null } } = {}
    for (const [key, value] of url.searchParams) {
        if (key === "kind") {
            if (value === "places") where.track_id = null
            else if (value === "tracks") where.track_id = { not: null }
            else if (value !== "all") throw new HttpError(400, "Kind must be places, tracks or all")
        } else if (key === "track_id") {
            const id = Number(value)
            if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(id)) throw new HttpError(400, "Track id must be a positive integer")
        } else throw new HttpError(400, `Unknown query parameter \`${key}\``)
    }
    const trackId = url.searchParams.get("track_id")
    if (trackId !== null) {
        if (url.searchParams.get("kind") === "places") throw new HttpError(400, "Places cannot be filtered by a track")
        where.track_id = Number(trackId)
    }
    return where
}

export const locationPointsCollectionRoute = async (req: Request) => {
    const user = await requireAuthenticatedUser(req)
    if (req.method === "GET") return json(200, await db.client.locationPoint.findMany({ where: filters(new URL(req.url)), include: pointInclude, orderBy: [{ track_id: "asc" }, { sequence: "asc" }, { id: "asc" }] }))
    if (req.method === "POST") {
        const values = parseValues(await readJsonObject(req), false)
        await validateTrack(values.track_id ?? null, values.sequence ?? null, user)
        const now = utcNow()
        return json(201, await db.client.locationPoint.create({
            data: { ...values, name: values.name ?? null, latitude: values.latitude!, longitude: values.longitude!, added_by: user.id, created_at: now, updated_at: now },
            include: pointInclude,
        }))
    }
    throw new HttpError(405, "Method not allowed for this route")
}

export const locationPointDetailRoute = async (req: BunRequest<string>) => {
    const user = await requireAuthenticatedUser(req)
    const id = parseIdParam(req.params.id ?? "")
    const point = await db.client.locationPoint.findUnique({ where: { id }, include: pointInclude })
    if (!point) throw new HttpError(404, "Resource not found")
    if (req.method === "GET") return json(200, point)
    if (!["PUT", "PATCH", "DELETE"].includes(req.method)) throw new HttpError(405, "Method not allowed for this route")
    if (point.added_by !== user.id && !user.is_admin) throw new HttpError(403, "Only the creator or an administrator can change this point")
    await validateTrack(point.track_id, point.sequence, user)
    if (req.method === "DELETE") {
        await db.client.locationPoint.delete({ where: { id } })
        return empty(204)
    }
    const parsed = parseValues(await readJsonObject(req), req.method === "PATCH")
    const values = req.method === "PUT" ? { ...parsed, name: parsed.name ?? null, notes: parsed.notes ?? null, track_id: parsed.track_id ?? null, sequence: parsed.sequence ?? null, recorded_at: parsed.recorded_at ?? null, altitude: parsed.altitude ?? null, accuracy: parsed.accuracy ?? null } : parsed
    await validateTrack(values.track_id === undefined ? point.track_id : values.track_id, values.sequence === undefined ? point.sequence : values.sequence, user)
    return json(200, await db.client.locationPoint.update({ where: { id }, data: { ...values, updated_at: utcNow() }, include: pointInclude }))
}
