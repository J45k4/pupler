import { escapeHtml } from "../lib/html";

const formatFileSize = (bytes: number) => {
	if (bytes >= 1024 * 1024) {
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
	if (bytes >= 1024) {
		return `${Math.round(bytes / 1024)} KB`;
	}
	return `${bytes} B`;
};

export const renderUploadDropzone = (options: {
	inputId: string;
	label: string;
	emptyText: string;
	name?: string;
	multiple?: boolean;
	submitOnDrop?: boolean;
}) => `
	<label
		class="upload-dropzone"
		for="${options.inputId}"
		data-upload-dropzone
		data-upload-dropzone-empty="${escapeHtml(options.emptyText)}"
		${options.submitOnDrop ? 'data-upload-dropzone-submit-on-drop="true"' : ""}
	>
		<span class="upload-dropzone__label">${options.label}</span>
		<span class="upload-dropzone__surface">
			<span class="upload-dropzone__title">${
				options.multiple ? "Drop image files here" : "Drop an image here"
			}</span>
			<span class="upload-dropzone__meta" data-upload-dropzone-meta>${options.emptyText}</span>
		</span>
		<input
			id="${options.inputId}"
			name="${options.name ?? options.inputId}"
			class="upload-dropzone__input"
			type="file"
			accept="image/*"
			${options.multiple ? "multiple" : ""}
		/>
	</label>
`;

export const attachUploadDropzones = (root: ParentNode = document) => {
	for (const dropzone of root.querySelectorAll<HTMLElement>(
		"[data-upload-dropzone]",
	)) {
		const input = dropzone.querySelector<HTMLInputElement>(
			'input[type="file"]',
		);
		const meta = dropzone.querySelector<HTMLElement>(
			"[data-upload-dropzone-meta]",
		);
		const emptyText = dropzone.dataset.uploadDropzoneEmpty ?? "No file selected";
		const submitOnDrop =
			dropzone.dataset.uploadDropzoneSubmitOnDrop === "true";
		if (!input || !meta) {
			continue;
		}

		const sync = () => {
			const files = input.files ? Array.from(input.files) : [];
			meta.textContent = files.length
				? files.length === 1
					? `${files[0]!.name} • ${formatFileSize(files[0]!.size)}`
					: `${files.length} images selected`
				: emptyText;
			dropzone.classList.toggle("upload-dropzone--has-file", files.length > 0);
		};

		const activate = (event: DragEvent) => {
			event.preventDefault();
			dropzone.classList.add("upload-dropzone--active");
		};

		const deactivate = (event?: DragEvent) => {
			event?.preventDefault();
			dropzone.classList.remove("upload-dropzone--active");
		};

		input.addEventListener("change", sync);
		input.form?.addEventListener("reset", () => {
			queueMicrotask(sync);
		});
		dropzone.addEventListener("dragenter", activate);
		dropzone.addEventListener("dragover", activate);
		dropzone.addEventListener("dragleave", deactivate);
		dropzone.addEventListener("dragend", deactivate);
		dropzone.addEventListener("drop", (event) => {
			event.preventDefault();
			dropzone.classList.remove("upload-dropzone--active");
			const files = event.dataTransfer?.files;
			if (!files?.length) {
				return;
			}

			const transfer = new DataTransfer();
			for (const file of files) {
				if (file.type.startsWith("image/")) {
					transfer.items.add(file);
					if (!input.multiple) {
						break;
					}
				}
			}
			if (!transfer.files.length) {
				return;
			}

			input.files = transfer.files;
			input.dispatchEvent(new Event("change", { bubbles: true }));
			if (submitOnDrop) {
				queueMicrotask(() => input.form?.requestSubmit());
			}
		});
		sync();
	}
};
