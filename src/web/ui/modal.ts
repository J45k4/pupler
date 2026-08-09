import { createElement, escapeHtml, getElementById, type DomChild } from "../lib/dom"

type CreateModalOptions = {
	id: string
	title: string
	children: DomChild | DomChild[]
	closeDataAttribute: string
	ariaLabel?: string
	className?: string
	headerClassName?: string
	titleId?: string
}

type AttachModalOptions = {
	modalId: string
	closeSelector: string
	openButtonId?: string
	focusSelector?: string
	onOpen?: () => void
	onClose?: () => void
}

type RenderModalOptions = Omit<CreateModalOptions, "children"> & {
	children: string
}

export const renderModal = ({
	id,
	title,
	children,
	closeDataAttribute,
	ariaLabel,
	className = "",
	headerClassName = "",
	titleId = `${id}-title`,
}: RenderModalOptions) => `
	<div class="app-modal ${escapeHtml(className)}" id="${escapeHtml(id)}" hidden>
		<div class="app-modal__backdrop" ${closeDataAttribute}></div>
		<div
			class="app-modal__dialog card panel"
			role="dialog"
			aria-modal="true"
			${ariaLabel ? `aria-label="${escapeHtml(ariaLabel)}"` : `aria-labelledby="${escapeHtml(titleId)}"`}
		>
			<div class="section-header ${escapeHtml(headerClassName)}">
				<h2 id="${escapeHtml(titleId)}">${escapeHtml(title)}</h2>
				<button
					class="secondary"
					type="button"
					aria-label="Close ${escapeHtml(title.toLowerCase())} modal"
					${closeDataAttribute}
				>
					Close
				</button>
			</div>
			${children}
		</div>
	</div>
`

export const createModal = ({
	id,
	title,
	children,
	closeDataAttribute,
	ariaLabel,
	className = "",
	headerClassName = "",
	titleId = `${id}-title`,
}: CreateModalOptions) => {
	const backdrop = createElement("div", { className: "app-modal__backdrop" })
	backdrop.setAttribute(closeDataAttribute, "")
	const close = createElement("button", {
		className: "secondary",
		text: "Close",
	})
	close.type = "button"
	close.setAttribute("aria-label", `Close ${title.toLowerCase()} modal`)
	close.setAttribute(closeDataAttribute, "")
	const header = createElement(
		"div",
		{
			className: `section-header${headerClassName ? ` ${headerClassName}` : ""}`,
		},
		createElement("h2", { id: titleId, text: title }),
		close,
	)
	const dialog = createElement(
		"div",
		{ className: "app-modal__dialog card panel" },
		header,
		children,
	)
	dialog.role = "dialog"
	dialog.setAttribute("aria-modal", "true")
	if (ariaLabel) dialog.setAttribute("aria-label", ariaLabel)
	else dialog.setAttribute("aria-labelledby", titleId)
	const modal = createElement(
		"div",
		{ id, className: `app-modal${className ? ` ${className}` : ""}` },
		backdrop,
		dialog,
	)
	modal.hidden = true
	return modal
}

export const attachModalControls = ({
	modalId,
	closeSelector,
	openButtonId,
	focusSelector,
	onOpen,
	onClose,
}: AttachModalOptions) => {
	const modal = getElementById(modalId)
	if (!(modal instanceof HTMLElement)) {
		return {
			open: () => {},
			close: () => {},
		}
	}

	const close = () => {
		modal.hidden = true
		document.body.classList.remove("modal-open")
		onClose?.()
	}

	const open = () => {
		modal.hidden = false
		document.body.classList.add("modal-open")
		onOpen?.()
		if (focusSelector) {
			const focusTarget = modal.querySelector<HTMLElement>(focusSelector)
			focusTarget?.focus()
		}
	}

	if (openButtonId) {
		getElementById(openButtonId)?.addEventListener("click", open)
	}

	modal.addEventListener("click", (event) => {
		const target = event.target
		if (target instanceof HTMLElement && target.closest(closeSelector)) {
			close()
		}
	})

	window.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && !modal.hidden) {
			close()
		}
	})

	return { open, close }
}
