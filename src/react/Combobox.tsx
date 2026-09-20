import { useEffect, useId, useRef, useState } from "react"

export type ComboOption = {
	value: string
	label: string
}

export const Combobox = ({
	id,
	placeholder,
	options,
	value,
	onChange,
	allowCreate = false,
	createLabelPrefix = "Create",
	autoComplete = "off",
}: {
	id?: string
	placeholder?: string
	options: ComboOption[]
	value: string
	onChange: (text: string) => void
	allowCreate?: boolean
	createLabelPrefix?: string
	autoComplete?: string
}) => {
	const [open, setOpen] = useState(false)
	const [activeIndex, setActiveIndex] = useState(-1)
	const rootRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)
	const listId = useId()
	const fallbackId = useId()
	const inputId = id ?? fallbackId

	const normalized = value.trim().toLowerCase()
	const matches = options.filter((option) => !normalized || option.label.toLowerCase().includes(normalized))
	const exactMatch = options.some((option) => option.label.toLowerCase() === normalized)
	const showCreate = allowCreate && value.trim() !== "" && !exactMatch

	useEffect(() => {
		if (!open) return
		const onClick = (event: MouseEvent) => {
			if (!(event.target instanceof Node)) return
			if (!rootRef.current?.contains(event.target)) setOpen(false)
		}
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false)
		}
		document.addEventListener("click", onClick)
		document.addEventListener("keydown", onKey)
		return () => {
			document.removeEventListener("click", onClick)
			document.removeEventListener("keydown", onKey)
		}
	}, [open ])

	const pick = (label: string) => {
		onChange(label)
		setOpen(false)
		setActiveIndex(-1)
		inputRef.current?.focus()
	}

	const totalRows = matches.length + (showCreate ? 1 : 0)

	const onKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "ArrowDown") {
			event.preventDefault()
			setOpen(true)
			setActiveIndex((i) => (totalRows === 0 ? -1 : (i + 1) % totalRows))
		} else if (event.key === "ArrowUp") {
			event.preventDefault()
			setOpen(true)
			setActiveIndex((i) => (totalRows === 0 ? -1 : (i - 1 + totalRows) % totalRows))
		} else if (event.key === "Enter") {
			if (open && activeIndex >= 0 && activeIndex < totalRows) {
				event.preventDefault()
				if (activeIndex < matches.length) pick(matches[activeIndex]!.label)
				else if (showCreate) pick(value.trim())
			}
		} else if (event.key === "Escape") {
			setOpen(false)
		}
	}

	return (
		<div ref={rootRef} className="search-select">
			<div className="search-select__control">
				<input
					ref={inputRef}
					id={inputId}
					className="search-select__input"
					role="combobox"
					aria-autocomplete="list"
					aria-expanded={String(open)}
					aria-controls={listId}
					placeholder={placeholder}
					autoComplete={autoComplete}
					value={value}
					onChange={(e) => {
						onChange(e.target.value)
						setOpen(true)
						setActiveIndex(-1)
					}}
					onFocus={() => setOpen(true)}
					onKeyDown={onKeyDown}
				/>
			</div>
			<div id={listId} className="search-select__menu" role="listbox" hidden={!open}>
				{matches.map((option, index) => (
					<div
						key={option.value}
						role="option"
						aria-selected={index === activeIndex}
						className={`search-select__option${index === activeIndex ? " search-select__option--active" : ""}`}
						onMouseDown={(e) => {
							e.preventDefault()
							pick(option.label)
						}}
						onMouseEnter={() => setActiveIndex(index)}
					>
						{option.label}
					</div>
				))}
				{showCreate ? (
					<div
						role="option"
						aria-selected={activeIndex === matches.length}
						className={`search-select__option search-select__option--create${activeIndex === matches.length ? " search-select__option--active" : ""}`}
						onMouseDown={(e) => {
							e.preventDefault()
							pick(value.trim())
						}}
						onMouseEnter={() => setActiveIndex(matches.length)}
					>
						{createLabelPrefix} “{value.trim()}”
					</div>
				) : null}
				{matches.length === 0 && !showCreate ? (
					<div className="search-select__empty">No matches.</div>
				) : null}
			</div>
		</div>
	)
}
