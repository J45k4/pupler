import { expect, test } from "bun:test"
import type { Project, TimeEntry } from "../src/react/lib"
import { applyEntryChange, applyTimeChange, confirmTimeEntries } from "../src/react/time-changes"
import { createEmptyTimeReport } from "../src/react/pages/time-report-data"

const project = (id: number, client_id: number | null = null) => ({ id, name: `Project ${id}`, color: "#123456", client_id, client: client_id === null ? null : { id: client_id, name: `Client ${client_id}`, color: "#abcdef" } }) as Project
const entry = (id: number, start: string, end: string | null, value: Project | null = project(1)) => ({ id, project_id: value?.id ?? null, project: value, started_at: start, ended_at: end, description: "Work", updated_at: start }) as TimeEntry
const start = "2026-10-24T21:00:00.000Z", end = "2026-10-25T22:00:00.000Z"
const empty = () => createEmptyTimeReport(start, end)

test("report projection clips overnight work to a 25 hour daylight saving day", () => {
	const work = entry(1, "2026-10-24T20:00:00.000Z", "2026-10-25T23:00:00.000Z", project(1, 7))
	const report = applyTimeChange(empty(), { before: null, after: work })
	expect(report.total_seconds).toBe(25 * 3600)
	expect(report.project_totals[0]!.entry_count).toBe(1)
	expect(report.client_totals[0]).toMatchObject({ client_id: 7, total_seconds: 25 * 3600, project_count: 1, entry_count: 1 })
	expect(applyTimeChange(report, { before: work, after: null })).toEqual(empty())
})

test("edits transfer duration and entry counts between clients and projects", () => {
	const a = entry(1, start, "2026-10-24T22:00:00Z", project(1, 7))
	const b = entry(2, start, "2026-10-24T23:00:00Z", project(2, 7))
	const initial = applyTimeChange(applyTimeChange(empty(), { before: null, after: a }), { before: null, after: b })
	expect(initial.client_totals[0]).toMatchObject({ total_seconds: 10800, entry_count: 2, project_count: 2 })
	const edited = { ...a, ended_at: "2026-10-24T23:00:00Z", project_id: 3, project: project(3, 8) }
	const next = applyTimeChange(initial, { before: a, after: edited })
	expect(next.total_seconds).toBe(14400)
	expect(next.client_totals.map(client => [client.client_id, client.total_seconds, client.entry_count, client.project_count])).toEqual([[7, 7200, 1, 1], [8, 7200, 1, 1]])
	expect(initial.total_seconds).toBe(10800)
})

test("running and unassigned work retains separate no-project and no-client totals", () => {
	const running = entry(1, "2026-10-25T21:00:00Z", null, null)
	const assigned = entry(2, start, "2026-10-24T22:00:00Z")
	const report = applyTimeChange(applyTimeChange(empty(), { before: null, after: running }), { before: null, after: assigned })
	expect(report.total_seconds).toBe(7200)
	expect(report.client_totals.map(client => client.client_name).sort()).toEqual(["No client", "No project"])
	expect(report.client_totals.find(client => client.client_name === "No project")!.project_count).toBe(0)
	expect(applyTimeChange(empty(), { before: null, after: entry(3, end, "2026-10-25T23:00:00Z") })).toEqual(empty())
})

test("entry moves and acknowledgements preserve later pending edits while replacing temporary IDs", () => {
	const a = entry(-1, start, "2026-10-24T22:00:00Z")
	const b = entry(2, "2026-10-24T23:00:00Z", end)
	const edited = { ...a, description: "Later edit" }
	const list = applyEntryChange([a, b], { before: a, after: edited }, start, end)
	expect(list.map(item => item.id)).toEqual([2, -1])
	const confirmed = confirmTimeEntries(list, [{ local_id: -1, result: { ...a, id: 99, description: "Earlier save", updated_at: end } }])
	expect(confirmed[1]).toMatchObject({ id: 99, description: "Later edit", updated_at: end })
	expect(applyEntryChange(confirmed, { before: confirmed[1]!, after: null }, start, end)).toEqual([b])
	expect(confirmTimeEntries(confirmed, [{ local_id: 99, result: { id: 99, deleted: true } }])).toEqual([b])
})
