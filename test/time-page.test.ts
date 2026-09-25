import { afterEach, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { openDatabase, closeDatabase } from "../src/api/core"
import { applyTestSchema } from "./support/test-db"
import { fetchTimePage, fetchTimeDescriptions } from "../src/api/time-page"

let db: ReturnType<typeof openDatabase>
let directory: string
const url = (query = "") => new URL(`http://localhost/api/time-entries?${query}`)
afterEach(async () => {
	if (db) await closeDatabase(db)
	if (directory) rmSync(directory, { recursive: true, force: true })
})
const setup = async () => {
	directory = mkdtempSync(join(tmpdir(), "pupler-page-"))
	const path = join(directory, "test.sqlite")
	applyTestSchema(path)
	db = openDatabase(path, join(directory, "files"))
	const timestamps = { created_at: "2026-09-01T00:00:00.000Z", updated_at: "2026-09-01T00:00:00.000Z" }
	const user = await db.client.user.create({ data: { name: "Owner", ...timestamps } })
	const other = await db.client.user.create({ data: { name: "Other", ...timestamps } })
	const project = await db.client.project.create({ data: { name: "Project", color: "#123456", ...timestamps } })
	await db.client.timeEntry.createMany({ data: Array.from({ length: 123 }, (_, index) => ({
		...timestamps, user_id: user.id, project_id: project.id, description: index < 60 ? "Older repeated work" : `Task ${index}`,
		started_at: new Date(Date.UTC(2026, 8, 1, index)).toISOString(), ended_at: new Date(Date.UTC(2026, 8, 1, index + 1)).toISOString(),
	})) })
	const running = await db.client.timeEntry.create({ data: { ...timestamps, user_id: user.id, project_id: project.id, description: "Running", started_at: timestamps.created_at } })
	await db.client.timeEntry.create({ data: { ...timestamps, user_id: other.id, project_id: project.id, description: "Private", started_at: timestamps.created_at, ended_at: timestamps.created_at } })
	return { user, other, project, running }
}

test("timer history returns independent pages of at most 50 and keeps the running timer separate", async () => {
	const { user, running } = await setup()
	const first = await fetchTimePage(db, user, url(), {})
	const second = await fetchTimePage(db, user, url("offset=50"), {})
	const last = await fetchTimePage(db, user, url("offset=100"), {})
	expect([first.entries.length, second.entries.length, last.entries.length]).toEqual([50, 50, 23])
	expect(first.total).toBe(123)
	expect(new Set([...first.entries, ...second.entries, ...last.entries].map(entry => entry.id)).size).toBe(123)
	for (const page of [first, second, last]) expect(page.running?.id).toBe(running.id)
	expect(first.entries.every(entry => entry.ended_at !== null)).toBe(true)
	expect((await fetchTimePage(db, user, url("offset=500"), {})).offset).toBe(100)
})

test("full-history summaries and suggestions are scoped to the owner independently of the loaded page", async () => {
	const { user, project } = await setup()
	const page = await fetchTimePage(db, user, url(), {})
	expect(page.entries.some(entry => entry.description === "Older repeated work")).toBe(false)
	expect(page.quick_actions[0]?.description).toBe("Older repeated work")
	expect(page.quick_actions[0]?.entry_count).toBe(60)
	expect(page.quick_actions[0]?.total_seconds).toBe(60 * 3600)
	expect(page.project_usage[0]?.entry_count).toBe(124)
	const descriptions = await fetchTimeDescriptions(db, user, url(`project_id=${project.id}&q=older`))
	expect(descriptions.map(value => [value.text, value.count])).toEqual([["Older repeated work", 60]])
	expect((await fetchTimeDescriptions(db, user, url(`project_id=${project.id}`))).length).toBe(12)
	expect(await fetchTimeDescriptions(db, user, url(`project_id=${project.id}&q=private`))).toEqual([])
})

test("pagination rejects invalid offsets and access to another owner's entries", async () => {
	const { user, other } = await setup()
	for (const offset of ["-1", "1.5", "no", "9007199254740992"]) {
		await expect(fetchTimePage(db, user, url(`offset=${offset}`), {})).rejects.toMatchObject({ status: 400 })
	}
	await expect(fetchTimePage(db, user, url(`user_id=${other.id}`), {})).rejects.toMatchObject({ status: 403 })
	await expect(fetchTimeDescriptions(db, user, url(`user_id=${other.id}&project_id=1`))).rejects.toMatchObject({ status: 403 })
})
