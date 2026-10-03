import { afterEach, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { TestServer } from "./support/test-server"

type Location = { id: number; name: string; notes: string | null; latitude: number; longitude: number; added_by: number; added_by_user: { id: number; name: string }; created_at: string }
let server: TestServer | null = null
afterEach(async () => { await server?.close(); server = null })
const point = { name: "  Harbour  ", notes: "Boat landing", latitude: 60.16, longitude: 24.95 }

test("locations preserve coordinates, notes and creator through CRUD", async () => {
    server = await TestServer.start()
    const session = await server.call<{ user: { id: number; name: string } }>("/api/auth/session")
    const created = await server.call<Location>("/api/locations", { method: "POST", body: point })
    expect(created.response.status).toBe(201)
    expect(created.body).toMatchObject({ ...point, name: "Harbour", added_by: session.body.user.id, added_by_user: { id: session.body.user.id, name: session.body.user.name } })
    const path = `/api/locations/${created.body.id}`
    expect((await server.call<Location[]>("/api/locations")).body).toEqual([created.body])
    expect((await server.call<Location>(path)).body).toEqual(created.body)
    const patched = await server.call<Location>(path, { method: "PATCH", body: { notes: null, longitude: -180 } })
    expect(patched.response.status).toBe(200)
    expect(patched.body).toMatchObject({ name: "Harbour", latitude: 60.16, longitude: -180, notes: null, added_by: created.body.added_by, created_at: created.body.created_at })
    const replaced = await server.call<Location>(path, { method: "PUT", body: { name: "North pole", latitude: 90, longitude: 180 } })
    expect(replaced.response.status).toBe(200)
    expect(replaced.body.notes).toBeNull()
    expect((await server.call(path, { method: "DELETE" })).response.status).toBe(204)
    expect((await server.call(path)).response.status).toBe(404)
}, 20000)

test("locations reject invalid coordinates and caller-supplied attribution", async () => {
    server = await TestServer.start()
    for (const changes of [{ latitude: 90.001 }, { latitude: -90.001 }, { longitude: 180.001 }, { longitude: -180.001 }, { latitude: "60" }, { longitude: null }, { name: " \n " }, { added_by: 1 }]) {
        expect((await server.call("/api/locations", { method: "POST", body: { ...point, ...changes } })).response.status).toBe(400)
    }
    expect((await server.call("/api/locations", { method: "POST", body: { name: "Missing coordinates" } })).response.status).toBe(400)
    const created = await server.call<Location>("/api/locations", { method: "POST", body: { name: "Origin", latitude: 0, longitude: 0 } })
    expect(created.response.status).toBe(201)
    for (const body of [{}, { latitude: 91 }, { added_by: 2 }]) {
        expect((await server.call(`/api/locations/${created.body.id}`, { method: "PATCH", body })).response.status).toBe(400)
    }
    expect((await server.call<Location>(`/api/locations/${created.body.id}`)).body.latitude).toBe(0)
}, 20000)

test("location reads require login and writes require the creator or admin", async () => {
    server = await TestServer.start()
    expect((await server.call("/api/locations", { headers: { cookie: "" } })).response.status).toBe(401)
    expect((await server.call("/api/locations", { method: "POST", headers: { cookie: "" }, body: point })).response.status).toBe(401)
    const created = await server.call<Location>("/api/locations", { method: "POST", body: point })
    const path = `/api/locations/${created.body.id}`
    const sqlite = new Database(server.dbPath)
    const now = new Date().toISOString()
    sqlite.query("INSERT INTO users (name, username, password_hash, is_admin, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)").run("Other", "other", await Bun.password.hash("password"), now, now)
    sqlite.close()
    const login = await server.call("/api/auth/login", { method: "POST", body: { username: "other", password: "password" } })
    const cookie = login.response.headers.get("set-cookie")!.match(/pupler_session=[^;]+/)![0]
    const headers = { cookie }
    expect((await server.call(path, { headers })).response.status).toBe(200)
    for (const method of ["PATCH", "PUT", "DELETE"]) {
        expect((await server.call(path, { method, headers, ...(method === "DELETE" ? {} : { body: point }) })).response.status).toBe(403)
    }
    const own = await server.call<Location>("/api/locations", { method: "POST", headers, body: point })
    expect(own.body.added_by).not.toBe(created.body.added_by)
    expect((await server.call(`/api/locations/${own.body.id}`, { method: "PATCH", headers, body: { notes: "Own edit" } })).response.status).toBe(200)
    expect((await server.call(`/api/locations/${own.body.id}`, { method: "PATCH", body: { notes: "Admin edit" } })).response.status).toBe(200)
    expect((await server.call(`/api/locations/${own.body.id}`, { method: "DELETE", headers })).response.status).toBe(204)
}, 20000)
