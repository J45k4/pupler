import { useLayoutEffect, useRef, useState, type InputHTMLAttributes } from "react"
import { formatDateField, parseDateField, type DateInputKind } from "./dates"

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "min" | "max"> & {
	type: DateInputKind
	value: string
	min?: string
	max?: string
	onChange: (value: string) => void
}

export const DateInput = ({ type, value, min, max, onChange, ...props }: Props) => {
	const [draft, setDraft] = useState({ value, text: formatDateField(value, type) })
	const input = useRef<HTMLInputElement>(null)
	const picker = useRef<HTMLInputElement>(null)
	const text = draft.value === value ? draft.text : formatDateField(value, type)
	const parsed = parseDateField(text, type)
	const placeholder = type === "month" ? "kk.vvvv" : type === "date" ? "pp.kk.vvvv" : "pp.kk.vvvv tt.mm"
	const error = parsed === null ? `Use ${placeholder} with a 24-hour clock.` : parsed && max && parsed > max ? `Use ${formatDateField(max, type)} or earlier.` : parsed && min && parsed < min ? `Use ${formatDateField(min, type)} or later.` : ""
	useLayoutEffect(() => { input.current?.setCustomValidity(error) }, [error])
	const change = (text: string) => {
		const next = parseDateField(text, type)
		const valid = next !== null && (!next || ((!max || next <= max) && (!min || next >= min)))
		setDraft({ value: valid ? next : value, text })
		if (valid) onChange(next)
	}
	return <span className="date-input">
		<input {...props} ref={input} type="text" lang="fi" placeholder={placeholder} value={text} onChange={event => change(event.target.value)} onBlur={event => {
			if (parsed !== null) setDraft({ value, text: formatDateField(parsed, type) })
			props.onBlur?.(event)
		}} />
		<button type="button" className="secondary date-input__calendar" aria-label={type === "month" ? "Choose month" : "Choose date"} disabled={props.disabled || props.readOnly} onClick={() => {
			if (picker.current?.showPicker) picker.current.showPicker()
			else picker.current?.click()
		}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></svg></button>
		<input ref={picker} className="date-input__picker" type={type === "month" ? "month" : "date"} tabIndex={-1} aria-hidden="true" value={value.split("T")[0]} min={min?.split("T")[0]} max={max?.split("T")[0]} disabled={props.disabled || props.readOnly} onChange={event => {
			const date = event.target.value
			const next = date && type === "datetime-local" ? `${date}T${value.split("T")[1] ?? "00:00"}` : date
			setDraft({ value: next, text: formatDateField(next, type) })
			onChange(next)
		}} />
	</span>
}
