import { expect, test } from "bun:test"
import { previousTimeEntryEnd } from "../src/react/pages/time-entry-data"
import type { TimeEntry } from "../src/react/lib"

const entry = (id: number, user_id: number | null, ended_at: string | null) => ({ id, user_id, ended_at }) as TimeEntry

test("previous end belongs to the edited timer's owner and compares actual instants", () => {
	const running = entry(1, 7, null)
	const older = entry(2, 7, "2026-10-25T12:00:00+03:00")
	const previous = entry(3, 7, "2026-10-25T10:00:45.123Z")
	const other = entry(4, 8, "2026-10-25T14:00:00Z")
	expect(previousTimeEntryEnd([running, other, previous, older], running)).toBe(previous.ended_at)
	expect(previousTimeEntryEnd([other, entry(5, 7, "invalid")], running)).toBeNull()
	expect(previousTimeEntryEnd([previous], undefined)).toBeNull()
})

test("legacy unassigned timers use only unassigned previous entries and exclude themselves", () => {
	const current = entry(1, null, "2026-10-25T14:00:00Z")
	const previous = entry(2, null, "2026-10-25T10:00:00Z")
	expect(previousTimeEntryEnd([current, entry(3, 7, "2026-10-25T13:00:00Z"), previous], current)).toBe(previous.ended_at)
	expect(previousTimeEntryEnd([current], current)).toBeNull()
})
