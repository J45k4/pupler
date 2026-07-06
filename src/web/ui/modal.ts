import { escapeHtml } from "../lib/html";

type RenderModalOptions = {
	id: string;
	title: string;
	children: string;
	closeDataAttribute: string;
	ariaLabel?: string;
	className?: string;
	headerClassName?: string;
	titleId?: string;
};

type AttachModalOptions = {
	modalId: string;
	closeSelector: string;
	openButtonId?: string;
	focusSelector?: string;
	onOpen?: () => void;
	onClose?: () => void;
};

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
	<div class="app-modal ${className}" id="${id}" hidden>
		<div class="app-modal__backdrop" ${closeDataAttribute}></div>
		<div
			class="app-modal__dialog card panel"
			role="dialog"
			aria-modal="true"
			${ariaLabel ? `aria-label="${escapeHtml(ariaLabel)}"` : `aria-labelledby="${titleId}"`}
		>
			<div class="section-header ${headerClassName}">
				<h2 id="${titleId}">${escapeHtml(title)}</h2>
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
`;

export const attachModalControls = ({
	modalId,
	closeSelector,
	openButtonId,
	focusSelector,
	onOpen,
	onClose,
}: AttachModalOptions) => {
	const modal = document.getElementById(modalId);
	if (!(modal instanceof HTMLElement)) {
		return {
			open: () => {},
			close: () => {},
		};
	}

	const close = () => {
		modal.hidden = true;
		document.body.classList.remove("modal-open");
		onClose?.();
	};

	const open = () => {
		modal.hidden = false;
		document.body.classList.add("modal-open");
		onOpen?.();
		if (focusSelector) {
			const focusTarget = modal.querySelector<HTMLElement>(focusSelector);
			focusTarget?.focus();
		}
	};

	if (openButtonId) {
		document.getElementById(openButtonId)?.addEventListener("click", open);
	}

	modal.addEventListener("click", (event) => {
		const target = event.target;
		if (target instanceof HTMLElement && target.closest(closeSelector)) {
			close();
		}
	});

	window.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && !modal.hidden) {
			close();
		}
	});

	return { open, close };
};
