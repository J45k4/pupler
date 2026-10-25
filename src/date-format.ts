export const dateLocale = "fi-FI"

const dateFormatter = new Intl.DateTimeFormat(dateLocale, { day: "numeric", month: "numeric", year: "numeric" })
const dateTimeFormatter = new Intl.DateTimeFormat(dateLocale, { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
const timeFormatter = new Intl.DateTimeFormat(dateLocale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })

export const formatDate = (value: string | Date) => dateFormatter.format(new Date(value))
export const formatDateTime = (value: string | Date | null | undefined) => value ? dateTimeFormatter.format(new Date(value)) : "Not set"
export const formatTime = (value: string | Date) => timeFormatter.format(new Date(value))
