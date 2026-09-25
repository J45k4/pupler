import { afterEach, describe, expect, setSystemTime, test } from "bun:test"
import * as data from "../src/react/pages/time-report-data"
import type { TimeEntry } from "../src/react/lib"

afterEach(() => setSystemTime())

const report = (seconds: number): data.TimeReport => ({
	period: { from: "2026-09-21T00:00:00.000Z", to: "2026-09-22T00:00:00.000Z", range: "custom" },
	total_seconds: seconds,
	project_totals: [{ project_id: 1, project_name: "Project", project_color: "#123456", client_id: 2, client_name: "Client", client_color: "#654321", total_seconds: seconds, entry_count: 1 }],
	client_totals: [{ client_id: 2, client_name: "Client", client_color: "#654321", total_seconds: seconds, entry_count: 1, project_count: 1 }],
})
const selection = (span: string, values: Partial<data.TimeOverviewSelection> = {}): data.TimeOverviewSelection => ({ span: data.getTimeOverviewSpan(span), day: "2026-09-21", fromDay: "2026-09-21", toDay: "2026-09-23", clientKey: null, projectKey: null, ...values })
const fixedNow = () => setSystemTime(new Date(2026, 8, 25, 12))

describe("Time report calculations", () => {
	test("week uses local Monday boundaries, clips today and gives future days no unknown time", () => {
		fixedNow()
		const days = data.getTimeWeeklyDays("2026-09-23")
		expect(days.map(day => day.date)).toEqual(["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"])
		expect(new Date(days[0]!.from).getHours()).toBe(0)
		expect(days[4]!.to).toBe(new Date().toISOString())
		expect(days[4]!.baselineSeconds).toBe(86400)
		expect(days[5]!.baselineSeconds).toBe(0)
	})

	test("daily totals account for untracked time and exclude future days", () => {
		fixedNow()
		const days = data.getTimeWeeklyDays("2026-09-21")
		days[0]!.report = report(7200)
		const chart = data.getTimePeriodChartData(days)
		expect(chart.dayClientSeconds[0]!.get(data.UNKNOWN_TIME_KEY)).toBe(79200)
		expect(chart.dayTotals[0]).toBe(86400)
		expect(chart.dayTotals[5]).toBe(0)
	})

	test("overlapping tracked time never produces negative unknown time", () => {
		fixedNow()
		const day = data.getTimeWeeklyDays("2026-09-21")[0]!
		day.report = report(100000)
		const chart = data.getTimePeriodChartData([day])
		expect(chart.dayTotals).toEqual([100000])
		expect(chart.clients.some(client => client.synthetic)).toBe(false)
	})

	test("overview uses inclusive ranges and completed-day averages", () => {
		fixedNow()
		const period = data.getTimeOverviewPeriod(selection("custom-range"))
		expect(new Date(period.from).getDate()).toBe(21)
		expect(new Date(period.to).getDate()).toBe(24)
		expect(data.countFullLocalDays(period)).toBe(3)
		expect(data.getTimeOverviewBaselineSeconds(selection("custom-range"))).toBe(3 * 86400)
		const current = data.getTimeOverviewPeriod(selection("this-week"))
		expect(data.countFullLocalDays(current)).toBe(4)
		expect(data.getTimeOverviewBaselineSeconds(selection("this-week"))).toBe(5 * 86400)
	})

	test("project/client filters preserve totals and account for untracked time", () => {
		const original = report(7200)
		expect(data.filterTimeOverviewReport(original, selection("today", { clientKey: "2" })).total_seconds).toBe(7200)
		expect(data.filterTimeOverviewReport(original, selection("today", { projectKey: "999" })).total_seconds).toBe(0)
		expect(original.total_seconds).toBe(7200)
		const items = data.getTimeOverviewItems(original, "client", 86400)
		expect(items.find(item => item.synthetic)?.totalSeconds).toBe(79200)
	})

	test("overnight duration is clipped to each local day", () => {
		fixedNow()
		const days = data.getTimeWeeklyDays("2026-09-21")
		const entry: TimeEntry = { id: 1, user_id: null, project_id: null, description: "Overnight", started_at: new Date(2026, 8, 21, 23).toISOString(), ended_at: new Date(2026, 8, 22, 1).toISOString(), created_at: "", updated_at: "" }
		expect(data.timeEntryDurationInPeriod(entry, days[0]!)).toBe(3600)
		expect(data.timeEntryDurationInPeriod(entry, days[1]!)).toBe(3600)
		expect(data.timeEntryDurationInPeriod(entry, days[2]!)).toBe(0)
	})

	test("month boundaries include every day and handle leap years", () => {
		fixedNow()
		const days = data.getTimeMonthlyDays("2026-09")
		expect(days.length).toBe(30)
		expect(days[0]!.date).toBe("2026-09-01")
		expect(days.at(-1)!.date).toBe("2026-09-30")
		expect(data.getTimeMonthlyDays("2024-02").length).toBe(29)
	})
})
