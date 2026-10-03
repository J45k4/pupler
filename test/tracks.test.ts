import { afterEach, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { TestServer } from "./support/test-server"

let server: TestServer | null = null
afterEach(async () => { await server?.close(); server = null })
type Point = { id: number; name: string | null; notes: string | null; track_id: number | null; sequence: number | null; recorded_at: string | null; added_by: number }
type Track = { id: number; name: string; added_by: number; activity_type: string | null; points: Point[]; _count: { points: number } }

test("location points support standalone places and ordered annotated tracks", async () => {
    server = await TestServer.start()
    const place = await server.call<Point>("/api/location-points", { method: "POST", body: { latitude: 60, longitude: 24, notes: "Standalone" } })
    expect(place.response.status).toBe(201)
    expect(place.body.name).toBeNull()
    expect(place.body.track_id).toBeNull()
    const track = await server.call<Track>("/api/tracks", { method: "POST", body: { name: "  Walk  ", activity_type: "walking", notes: "Morning route" } })
    expect(track.response.status).toBe(201)
    expect(track.body.name).toBe("Walk")
    expect(track.body.added_by).toBe(place.body.added_by)
    const points: Point[] = []
    for (const sequence of [2, 0, 1]) {
        const point = await server.call<Point>("/api/location-points", { method: "POST", body: { latitude: 60 + sequence / 100, longitude: 24, track_id: track.body.id, sequence, notes: `Stop ${sequence}`, recorded_at: "2026-10-03T12:00:00Z", altitude: -2, accuracy: 5 } })
        expect(point.response.status).toBe(201)
        points.push(point.body)
    }
    const details = await server.call<Track>(`/api/tracks/${track.body.id}`)
    expect(details.body.points.map(point => point.sequence)).toEqual([0, 1, 2])
    expect(details.body.points.map(point => point.notes)).toEqual(["Stop 0", "Stop 1", "Stop 2"])
    expect(details.body._count.points).toBe(3)
    const places = await server.call<Point[]>("/api/location-points?kind=places")
    expect(places.body.map(point => point.id)).toEqual([place.body.id])
    const linked = await server.call<Point[]>("/api/location-points?kind=tracks")
    expect(linked.body.map(point => point.sequence)).toEqual([0, 1, 2])
    expect((await server.call<Point[]>("/api/location-points?kind=all")).body).toHaveLength(4)
    expect((await server.call<Point[]>(`/api/location-points?track_id=${track.body.id}`)).body).toHaveLength(3)
    expect((await server.call(`/api/location-points/${points[0]!.id}`, { method: "PATCH", body: { notes: "Scenic stop" } })).response.status).toBe(200)
    expect((await server.call(`/api/location-points/${points[0]!.id}`, { method: "PATCH", body: { track_id: null } })).response.status).toBe(200)
    expect((await server.call<Point[]>("/api/location-points?kind=places")).body).toHaveLength(2)
    expect((await server.call(`/api/tracks/${track.body.id}`, { method: "PATCH", body: { name: "Afternoon walk" } })).response.status).toBe(200)
    expect((await server.call(`/api/tracks/${track.body.id}`, { method: "DELETE" })).response.status).toBe(204)
    expect((await server.call<Point[]>("/api/location-points?kind=places")).body).toHaveLength(4)
    expect((await server.call<Point[]>("/api/location-points?kind=tracks")).body).toHaveLength(0)
}, 20000)

test("track metadata and filters reject invalid input and preserve sequence uniqueness", async () => {
    server = await TestServer.start()
    const track = await server.call<Track>("/api/tracks", { method: "POST", body: { name: "Route" } })
    const base = { latitude: 0, longitude: 0, track_id: track.body.id, sequence: 0 }
    for (const extra of [{ sequence: null }, { sequence: -1 }, { sequence: 0.5 }, { accuracy: -1 }, { accuracy: "5" }, { altitude: "10" }, { recorded_at: "not a date" }, { track_id: "1" }]) {
        expect((await server.call("/api/location-points", { method: "POST", body: { ...base, ...extra } })).response.status).toBe(400)
    }
    expect((await server.call("/api/location-points", { method: "POST", body: { ...base, track_id: 99999 } })).response.status).toBe(404)
    const first = await server.call<Point>("/api/location-points", { method: "POST", body: base })
    expect(first.response.status).toBe(201)
    expect((await server.call("/api/location-points", { method: "POST", body: base })).response.status).toBe(409)
    expect((await server.call(`/api/location-points/${first.body.id}`, { method: "PATCH", body: { sequence: null } })).response.status).toBe(400)
    const standalone = await server.call<Point>("/api/location-points", { method: "POST", body: { latitude: 0, longitude: 0 } })
    expect((await server.call(`/api/location-points/${standalone.body.id}`, { method: "PATCH", body: { track_id: track.body.id } })).response.status).toBe(400)
    expect((await server.call(`/api/location-points/${standalone.body.id}`, { method: "PATCH", body: { track_id: track.body.id, sequence: 1 } })).response.status).toBe(200)
    expect((await server.call(`/api/location-points/${standalone.body.id}`, { method: "PATCH", body: { sequence: 0 } })).response.status).toBe(409)
    for (const query of ["kind=nope", "track_id=1abc", "track_id=", "kind=places&track_id=1", "unknown=yes"]) {
        expect((await server.call(`/api/location-points?${query}`)).response.status).toBe(400)
    }
    for (const body of [{ name: " " }, { name: "Route", added_by: 2 }]) expect((await server.call("/api/tracks", { method: "POST", body })).response.status).toBe(400)
    expect((await server.call(`/api/tracks/${track.body.id}`, { method: "PATCH", body: {} })).response.status).toBe(400)
}, 20000)

test("users cannot append to or detach points from another user's track", async () => {
    server = await TestServer.start()
    const track = await server.call<Track>("/api/tracks", { method: "POST", body: { name: "Admin route" } })
    const sqlite = new Database(server.dbPath)
    const now = new Date().toISOString()
    sqlite.query("INSERT INTO users (name, username, password_hash, is_admin, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)").run("Other", "other", await Bun.password.hash("password"), now, now)
    sqlite.close()
    const login = await server.call("/api/auth/login", { method: "POST", body: { username: "other", password: "password" } })
    const headers = { cookie: login.response.headers.get("set-cookie")!.match(/pupler_session=[^;]+/)![0] }
    expect((await server.call("/api/tracks", { headers: { cookie: "" } })).response.status).toBe(401)
    for (const method of ["PATCH", "PUT", "DELETE"]) expect((await server.call(`/api/tracks/${track.body.id}`, { method, headers, ...(method === "DELETE" ? {} : { body: { name: "Changed" } }) })).response.status).toBe(403)
    expect((await server.call("/api/location-points", { method: "POST", headers, body: { latitude: 0, longitude: 0, track_id: track.body.id, sequence: 0 } })).response.status).toBe(403)
    const own = await server.call<Point>("/api/location-points", { method: "POST", headers, body: { latitude: 0, longitude: 0 } })
    expect((await server.call(`/api/location-points/${own.body.id}`, { method: "PATCH", body: { track_id: track.body.id, sequence: 0 } })).response.status).toBe(200)
    expect((await server.call(`/api/location-points/${own.body.id}`, { method: "PATCH", headers, body: { track_id: null } })).response.status).toBe(403)
    expect((await server.call(`/api/location-points/${own.body.id}`, { method: "DELETE", headers })).response.status).toBe(403)
    const ownTrack = await server.call<Track>("/api/tracks", { method: "POST", headers, body: { name: "Own route" } })
    expect(ownTrack.response.status).toBe(201)
    expect((await server.call("/api/location-points", { method: "POST", headers, body: { latitude: 0, longitude: 0, track_id: ownTrack.body.id, sequence: 0 } })).response.status).toBe(201)
}, 20000)
