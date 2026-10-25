import { describe, expect, test } from "bun:test"
import { formatDate, formatDateField, formatDateTime, formatTime, parseDateField } from "../src/react/dates"

describe("Finnish date formatting", () => {
	test("formats local dates and 24-hour times independently of the default locale", () => {
		const date = new Date(2026, 9, 25, 17, 5)
		expect(formatDate(date)).toBe("25.10.2026")
		expect(formatTime(date)).toBe("17.05")
		expect(formatDateTime(date)).toBe("25.10.2026 klo 17.05")
		expect(formatTime(new Date(2026, 9, 25, 0, 5))).toBe("00.05")
		expect(formatDateTime(null)).toBe("Not set")
	})

	test("round trips local ISO form values without shifting the date or time", () => {
		for (const [value, kind, text] of [
			["2026-10-25", "date", "25.10.2026"],
			["2026-10-25T17:05", "datetime-local", "25.10.2026 17.05"],
			["2026-10-25T00:05", "datetime-local", "25.10.2026 00.05"],
			["2026-10", "month", "10.2026"],
		] as const) {
			expect(formatDateField(value, kind)).toBe(text)
			expect(parseDateField(text, kind)).toBe(value)
		}
	})

	test("accepts single digit dates, leap days, and colon-separated 24-hour times", () => {
		expect(parseDateField(" 1.2.2026 ", "date")).toBe("2026-02-01")
		expect(parseDateField("29.2.2024", "date")).toBe("2024-02-29")
		expect(parseDateField("25.10.2026 7:05", "datetime-local")).toBe("2026-10-25T07:05")
	})

	test("rejects impossible dates, incomplete values, and AM/PM times", () => {
		for (const value of ["29.2.2026", "31.4.2026", "0.10.2026", "1.13.2026", "1.1.0000", "25.10.", "10/25/2026"]) expect(parseDateField(value, "date")).toBeNull()
		for (const value of ["25.10.2026 24.00", "25.10.2026 17.60", "25.10.2026 5:05 PM", "25.10.2026 17"]) expect(parseDateField(value, "datetime-local")).toBeNull()
		expect(parseDateField("13.2026", "month")).toBeNull()
	})

	test("allows clearing optional date fields", () => {
		for (const kind of ["date", "datetime-local", "month"] as const) {
			expect(parseDateField("", kind)).toBe("")
			expect(formatDateField("", kind)).toBe("")
		}
	})
})
