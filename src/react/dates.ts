export { dateLocale, formatDate, formatDateTime, formatTime } from "../date-format"

export type DateInputKind = "date" | "datetime-local" | "month"

export const formatDateField = (value: string, kind: DateInputKind) => {
	if (!value) return ""
	const [date, time] = value.split("T")
	const [year, month, day] = date!.split("-")
	return kind === "month" ? `${month}.${year}` : `${day}.${month}.${year}${kind === "datetime-local" ? ` ${time?.replace(":", ".")}` : ""}`
}

// Keep form values in local ISO format; only the text shown to the user is Finnish.
export const parseDateField = (value: string, kind: DateInputKind): string | null => {
	if (!value.trim()) return ""
	const match = (kind === "month" ? /^(\d{1,2})\.(\d{4})$/ : kind === "date" ? /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/ : /^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2})[.:](\d{2})$/).exec(value.trim())
	if (!match) return null
	const day = kind === "month" ? 1 : Number(match[1])
	const month = Number(match[kind === "month" ? 1 : 2])
	const year = Number(match[kind === "month" ? 2 : 3])
	const hour = Number(match[4] ?? 0)
	const minute = Number(match[5] ?? 0)
	if (year < 1 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59) return null
	const date = new Date(0)
	date.setUTCFullYear(year, month - 1, day)
	if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
	const pad = (part: number) => String(part).padStart(2, "0")
	return `${String(year).padStart(4, "0")}-${pad(month)}${kind === "month" ? "" : `-${pad(day)}`}${kind === "datetime-local" ? `T${pad(hour)}:${pad(minute)}` : ""}`
}
