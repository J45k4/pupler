import { createElement } from "../lib/dom"

const formatFileSize = (bytes: number) => {
	if (bytes >= 1024 * 1024) {
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
	}
	if (bytes >= 1024) {
		return `${Math.round(bytes / 1024)} KB`
	}
	return `${bytes} B`
}

export const createUploadDropzone = (options: {
	inputId: string
	label: string
	emptyText: string
	name?: string
	multiple?: boolean
	submitOnDrop?: boolean
}) => {
	const input = createElement("input", {
		id: options.inputId,
		className: "upload-dropzone__input",
		properties: {
			name: options.name ?? options.inputId,
			type: "file",
			accept: "image/*",
			multiple: options.multiple ?? false,
		},
	})
	const root = createElement(
		"label",
		{ className: "upload-dropzone", attributes: { for: options.inputId } },
		createElement("span", {
			className: "upload-dropzone__label",
			text: options.label,
		}),
		createElement(
			"span",
			{ className: "upload-dropzone__surface" },
			createElement("span", {
				className: "upload-dropzone__title",
				text: options.multiple
					? "Drop image files here"
					: "Drop an image here",
			}),
			createElement("span", {
				className: "upload-dropzone__meta",
				text: options.emptyText,
				attributes: { "data-upload-dropzone-meta": "" },
			}),
		),
		input,
	)
	root.dataset.uploadDropzone = ""
	root.dataset.uploadDropzoneEmpty = options.emptyText
	if (options.submitOnDrop) root.dataset.uploadDropzoneSubmitOnDrop = "true"
	return root
}

export const attachUploadDropzones = (root: ParentNode = document) => {
	for (const dropzone of root.querySelectorAll<HTMLElement>(
		"[data-upload-dropzone]",
	)) {
		const input =
			dropzone.querySelector<HTMLInputElement>('input[type="file"]')
		const meta = dropzone.querySelector<HTMLElement>(
			"[data-upload-dropzone-meta]",
		)
		const emptyText =
			dropzone.dataset.uploadDropzoneEmpty ?? "No file selected"
		const submitOnDrop =
			dropzone.dataset.uploadDropzoneSubmitOnDrop === "true"
		if (!input || !meta) {
			continue
		}

		const sync = () => {
			const files = input.files ? Array.from(input.files) : []
			meta.textContent = files.length
				? files.length === 1
					? `${files[0]!.name} • ${formatFileSize(files[0]!.size)}`
					: `${files.length} images selected`
				: emptyText
			dropzone.classList.toggle(
				"upload-dropzone--has-file",
				files.length > 0,
			)
		}

		const activate = (event: DragEvent) => {
			event.preventDefault()
			dropzone.classList.add("upload-dropzone--active")
		}

		const deactivate = (event?: DragEvent) => {
			event?.preventDefault()
			dropzone.classList.remove("upload-dropzone--active")
		}

		input.addEventListener("change", sync)
		input.form?.addEventListener("reset", () => {
			queueMicrotask(sync)
		})
		dropzone.addEventListener("dragenter", activate)
		dropzone.addEventListener("dragover", activate)
		dropzone.addEventListener("dragleave", deactivate)
		dropzone.addEventListener("dragend", deactivate)
		dropzone.addEventListener("drop", (event) => {
			event.preventDefault()
			dropzone.classList.remove("upload-dropzone--active")
			const files = event.dataTransfer?.files
			if (!files?.length) {
				return
			}

			const transfer = new DataTransfer()
			for (const file of files) {
				if (file.type.startsWith("image/")) {
					transfer.items.add(file)
					if (!input.multiple) {
						break
					}
				}
			}
			if (!transfer.files.length) {
				return
			}

			input.files = transfer.files
			input.dispatchEvent(new Event("change", { bubbles: true }))
			if (submitOnDrop) {
				queueMicrotask(() => input.form?.requestSubmit())
			}
		})
		sync()
	}
}
