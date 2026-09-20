import { useRef } from "react"

export type DragPayload = {
	kind: string
	id: number
}

export const setDragPayload = (event: React.DragEvent, payload: DragPayload) => {
	if (!event.dataTransfer) return
	event.dataTransfer.effectAllowed = "move"
	event.dataTransfer.setData("text/plain", JSON.stringify(payload))
}

export const getDragPayload = (event: React.DragEvent): DragPayload | null => {
	if (!event.dataTransfer) return null
	const raw = event.dataTransfer.getData("text/plain")
	if (!raw) return null
	try {
		const payload = JSON.parse(raw) as { kind?: unknown; id?: unknown }
		if (typeof payload.kind !== "string" || typeof payload.id !== "number" || !Number.isInteger(payload.id)) {
			return null
		}
		return { kind: payload.kind, id: payload.id }
	} catch {
		return null
	}
}

export const closest = (target: EventTarget | null, selector: string): HTMLElement | null => {
	if (!(target instanceof HTMLElement)) return null
	return target.closest<HTMLElement>(selector)
}

export const useDropHighlight = (activeClass: string) => {
	const active = useRef<HTMLElement | null>(null)

	const clear = () => {
		active.current?.classList.remove(activeClass)
		active.current = null
	}

	const highlight = (element: HTMLElement | null) => {
		if (active.current !== element) {
			clear()
			if (element) {
				active.current = element
				active.current.classList.add(activeClass)
			}
		}
	}

	return { clear, highlight }
}
