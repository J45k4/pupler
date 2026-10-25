import { expect, test } from "bun:test"
import { renderHuman } from "../cli/format"

test("human CLI output uses Finnish dates and local 24-hour timestamps", () => {
	const timestamp = new Date(2026, 9, 25, 17, 5).toISOString()
	const payload = { created_at: timestamp, date: "2026-10-25", name: "Example" }
	const output = renderHuman(payload)
	expect(output).toContain("created_at: 25.10.2026 klo 17.05")
	expect(output).toContain("date: 25.10.2026")
	expect(renderHuman([payload])).toContain("25.10.2026 klo 17.05")
	expect(payload.created_at).toBe(timestamp)
	expect(renderHuman("not a date")).toBe("not a date")
	expect(renderHuman("2026-99-99T00:00:00Z")).toBe("2026-99-99T00:00:00Z")
})
