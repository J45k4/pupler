import { escapeHtml } from "../lib/html";
import { UiComponent } from "./component";

export type SearchSelectOption = {
	value: string;
	label: string;
};

type SearchSelectState = {
	options: SearchSelectOption[];
	activeIndex: number;
};

type SearchSelectItem =
	| { kind: "option"; option: SearchSelectOption; optionIndex: number }
	| { kind: "create"; label: string }
	| { kind: "empty"; label: string };

const searchSelectState = new WeakMap<HTMLElement, SearchSelectState>();
const searchSelectRegistry = new Map<string, SearchSelect>();
let searchSelectId = 0;

export const renderSearchSelect = (options: {
	id: string;
	placeholder?: string;
	allowCreate?: boolean;
	createLabelPrefix?: string;
	required?: boolean;
}) => {
	const menuId = `${options.id}-menu`;
	const valueId = `${options.id}-value`;

	return `
		<div
			class="search-select"
			data-search-select="${escapeHtml(options.id)}"
			data-search-select-allow-create="${options.allowCreate ? "true" : "false"}"
			data-search-select-create-label-prefix="${escapeHtml(options.createLabelPrefix ?? "Create")}"
		>
			<input
				id="${escapeHtml(options.id)}"
				class="search-select__input"
				data-search-select-input
				role="combobox"
				aria-autocomplete="list"
				aria-expanded="false"
				aria-controls="${escapeHtml(menuId)}"
				placeholder="${escapeHtml(options.placeholder ?? "")}"
				autocomplete="off"
				${options.required ? "required" : ""}
			/>
			<input id="${escapeHtml(valueId)}" type="hidden" data-search-select-value />
			<div
				id="${escapeHtml(menuId)}"
				class="search-select__menu"
				role="listbox"
				hidden
			></div>
		</div>
	`;
};

export class SearchSelect extends UiComponent<HTMLDivElement> {
	private readonly input: HTMLInputElement;
	private readonly hiddenInput: HTMLInputElement;
	private readonly menu: HTMLDivElement;
	private readonly registryId: string | null;

	constructor(options: {
		id?: string;
		placeholder?: string;
		allowCreate?: boolean;
		createLabelPrefix?: string;
		required?: boolean;
	}) {
		super(document.createElement("div"));
		const componentId = options.id ?? `search-select-${++searchSelectId}`;
		this.registryId = options.id ?? null;
		const menuId = `${componentId}-menu`;
		const valueId = `${componentId}-value`;

		this.root.className = "search-select";
		this.root.dataset.searchSelect = componentId;
		this.root.dataset.searchSelectAllowCreate = options.allowCreate
			? "true"
			: "false";
		this.root.dataset.searchSelectCreateLabelPrefix =
			options.createLabelPrefix ?? "Create";
		this.root.dataset.searchSelectManaged = "component";

		this.input = document.createElement("input");
		this.input.id = componentId;
		this.input.className = "search-select__input";
		this.input.dataset.searchSelectInput = "";
		this.input.role = "combobox";
		this.input.setAttribute("aria-autocomplete", "list");
		this.input.setAttribute("aria-expanded", "false");
		this.input.setAttribute("aria-controls", menuId);
		this.input.placeholder = options.placeholder ?? "";
		this.input.autocomplete = "off";
		this.input.required = options.required ?? false;

		this.hiddenInput = document.createElement("input");
		this.hiddenInput.id = valueId;
		this.hiddenInput.type = "hidden";
		this.hiddenInput.dataset.searchSelectValue = "";

		this.menu = document.createElement("div");
		this.menu.id = menuId;
		this.menu.className = "search-select__menu";
		this.menu.role = "listbox";
		this.menu.hidden = true;

		this.root.append(this.input, this.hiddenInput, this.menu);
		searchSelectState.set(this.root, { options: [], activeIndex: 0 });
		if (this.registryId) {
			searchSelectRegistry.set(this.registryId, this);
		}
		attachSearchSelects(this.root);
	}

	public setOptions(options: SearchSelectOption[]) {
		getSearchSelectState(this.root).options = options;
		syncSearchSelectSelectedValue(this.root);
		if (!this.menu.hidden) {
			renderSearchSelectMenu(this.root);
		}
		return this;
	}

	public get text() {
		return this.input.value.trim();
	}

	public get value() {
		return this.hiddenInput.value;
	}

	public clear() {
		this.input.value = "";
		this.hiddenInput.value = "";
		this.root.dataset.searchSelectSelectedValue = "";
		return this;
	}

	public focus() {
		this.input.focus();
		return this;
	}

	public override destroy() {
		if (this.registryId && searchSelectRegistry.get(this.registryId) === this) {
			searchSelectRegistry.delete(this.registryId);
		}
	}
}

const normalizeSearchSelectText = (value: string) =>
	value.trim().toLowerCase();

const getSearchSelectState = (root: HTMLElement) => {
	let state = searchSelectState.get(root);
	if (!state) {
		state = { options: [], activeIndex: 0 };
		searchSelectState.set(root, state);
	}
	return state;
};

const searchSelectInput = (root: HTMLElement) =>
	root.querySelector<HTMLInputElement>("[data-search-select-input]");

const searchSelectHiddenInput = (root: HTMLElement) =>
	root.querySelector<HTMLInputElement>("[data-search-select-value]");

const searchSelectMenu = (root: HTMLElement) =>
	root.querySelector<HTMLElement>(".search-select__menu");

const searchSelectAllowsCreate = (root: HTMLElement) =>
	root.dataset.searchSelectAllowCreate === "true";

const searchSelectItems = (root: HTMLElement): SearchSelectItem[] => {
	const state = getSearchSelectState(root);
	const input = searchSelectInput(root);
	const query = input?.value.trim() ?? "";
	const normalizedQuery = normalizeSearchSelectText(query);
	const matches = normalizedQuery
		? state.options.filter((option) =>
				normalizeSearchSelectText(option.label).includes(normalizedQuery),
			)
		: state.options;
	const items: SearchSelectItem[] = matches.slice(0, 8).map((option) => ({
		kind: "option",
		option,
		optionIndex: state.options.indexOf(option),
	}));
	const exactMatch = state.options.some(
		(option) => normalizeSearchSelectText(option.label) === normalizedQuery,
	);

	if (query && searchSelectAllowsCreate(root) && !exactMatch) {
		items.push({ kind: "create", label: query });
	}
	if (!items.length) {
		items.push({
			kind: "empty",
			label: query ? "No matches" : "No options",
		});
	}
	return items;
};

const syncSearchSelectSelectedValue = (root: HTMLElement) => {
	const input = searchSelectInput(root);
	const hiddenInput = searchSelectHiddenInput(root);
	if (!input || !hiddenInput) return;
	const normalizedValue = normalizeSearchSelectText(input.value);
	const option = getSearchSelectState(root).options.find(
		(candidate) => normalizeSearchSelectText(candidate.label) === normalizedValue,
	);
	root.dataset.searchSelectSelectedValue = option?.value ?? "";
	hiddenInput.value = option?.value ?? "";
};

const closeSearchSelect = (root: HTMLElement) => {
	const input = searchSelectInput(root);
	const menu = searchSelectMenu(root);
	if (menu) menu.hidden = true;
	if (input) input.setAttribute("aria-expanded", "false");
};

const renderSearchSelectMenu = (root: HTMLElement) => {
	const input = searchSelectInput(root);
	const menu = searchSelectMenu(root);
	if (!input || !menu) return;
	const state = getSearchSelectState(root);
	const items = searchSelectItems(root);
	const selectableCount = items.filter((item) => item.kind !== "empty").length;
	state.activeIndex =
		selectableCount === 0
			? -1
			: Math.min(Math.max(state.activeIndex, 0), selectableCount - 1);

	let selectableIndex = 0;
	menu.innerHTML = items
		.map((item) => {
			if (item.kind === "empty") {
				return `<div class="search-select__empty">${escapeHtml(item.label)}</div>`;
			}

			const currentIndex = selectableIndex;
			selectableIndex += 1;
			const isActive = currentIndex === state.activeIndex;
			if (item.kind === "create") {
				const prefix = root.dataset.searchSelectCreateLabelPrefix ?? "Create";
				return `
					<button
						class="search-select__option ${isActive ? "search-select__option--active" : ""}"
						type="button"
						role="option"
						aria-selected="${isActive ? "true" : "false"}"
						data-search-select-create
					>
						<span>${escapeHtml(prefix)}</span>
						<strong>${escapeHtml(item.label)}</strong>
					</button>
				`;
			}

			return `
				<button
					class="search-select__option ${isActive ? "search-select__option--active" : ""}"
					type="button"
					role="option"
					aria-selected="${isActive ? "true" : "false"}"
					data-search-select-option-index="${item.optionIndex}"
				>
					${escapeHtml(item.option.label)}
				</button>
			`;
		})
		.join("");
	menu.hidden = false;
	input.setAttribute("aria-expanded", "true");
};

const selectSearchSelectOption = (
	root: HTMLElement,
	option: SearchSelectOption,
) => {
	const input = searchSelectInput(root);
	const hiddenInput = searchSelectHiddenInput(root);
	if (!input || !hiddenInput) return;
	input.value = option.label;
	hiddenInput.value = option.value;
	root.dataset.searchSelectSelectedValue = option.value;
	closeSearchSelect(root);
};

const selectSearchSelectCreateValue = (root: HTMLElement) => {
	const input = searchSelectInput(root);
	const hiddenInput = searchSelectHiddenInput(root);
	if (!input || !hiddenInput) return;
	input.value = input.value.trim();
	hiddenInput.value = "";
	root.dataset.searchSelectSelectedValue = "";
	closeSearchSelect(root);
};

const searchSelectRootForId = (id: string) =>
	[...document.querySelectorAll<HTMLElement>("[data-search-select]")].find(
		(root) => root.dataset.searchSelect === id,
	) ?? null;

const searchSelectRootForTarget = (target: EventTarget | null) =>
	target instanceof HTMLElement
		? target.closest<HTMLElement>("[data-search-select]")
		: null;

const activeSearchSelectItem = (root: HTMLElement) => {
	const state = getSearchSelectState(root);
	const items = searchSelectItems(root).filter((item) => item.kind !== "empty");
	return items[state.activeIndex] ?? null;
};

export const setSearchSelectOptions = (
	id: string,
	options: SearchSelectOption[],
) => {
	const component = searchSelectRegistry.get(id);
	if (component) {
		component.setOptions(options);
		return;
	}
	const root = searchSelectRootForId(id);
	if (!root) return;
	getSearchSelectState(root).options = options;
	syncSearchSelectSelectedValue(root);
	const menu = searchSelectMenu(root);
	if (menu && !menu.hidden) {
		renderSearchSelectMenu(root);
	}
};

export const getSearchSelectText = (id: string) => {
	const component = searchSelectRegistry.get(id);
	if (component) return component.text;
	const root = searchSelectRootForId(id);
	return root ? (searchSelectInput(root)?.value.trim() ?? "") : "";
};

export const attachSearchSelects = (root: Document | HTMLElement) => {
	const shouldSkipSearchRoot = (searchRoot: HTMLElement) =>
		searchRoot.dataset.searchSelectManaged === "component" &&
		searchRoot !== root;

	root.addEventListener("focusin", (event) => {
		const searchRoot = searchSelectRootForTarget(event.target);
		if (!searchRoot) return;
		if (shouldSkipSearchRoot(searchRoot)) return;
		renderSearchSelectMenu(searchRoot);
	});

	root.addEventListener("input", (event) => {
		const searchRoot = searchSelectRootForTarget(event.target);
		if (!searchRoot) return;
		if (shouldSkipSearchRoot(searchRoot)) return;
		getSearchSelectState(searchRoot).activeIndex = 0;
		syncSearchSelectSelectedValue(searchRoot);
		renderSearchSelectMenu(searchRoot);
	});

	root.addEventListener("keydown", (event) => {
		if (!(event instanceof KeyboardEvent)) return;
		if (!(event.target instanceof HTMLInputElement)) return;
		const searchRoot = searchSelectRootForTarget(event.target);
		if (!searchRoot) return;
		if (shouldSkipSearchRoot(searchRoot)) return;
		const state = getSearchSelectState(searchRoot);
		const selectableItems = searchSelectItems(searchRoot).filter(
			(item) => item.kind !== "empty",
		);
		if (event.key === "ArrowDown") {
			event.preventDefault();
			state.activeIndex =
				selectableItems.length === 0
					? -1
					: Math.min(state.activeIndex + 1, selectableItems.length - 1);
			renderSearchSelectMenu(searchRoot);
			return;
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			state.activeIndex =
				selectableItems.length === 0
					? -1
					: Math.max(state.activeIndex - 1, 0);
			renderSearchSelectMenu(searchRoot);
			return;
		}
		if (event.key === "Escape") {
			closeSearchSelect(searchRoot);
			return;
		}
		if (event.key === "Enter") {
			const item = activeSearchSelectItem(searchRoot);
			if (!item) return;
			event.preventDefault();
			if (item.kind === "create") {
				selectSearchSelectCreateValue(searchRoot);
				return;
			}
			selectSearchSelectOption(searchRoot, item.option);
		}
	});

	root.addEventListener("mousedown", (event) => {
		const target = event.target;
		if (!(target instanceof HTMLElement)) return;
		const searchRoot = searchSelectRootForTarget(target);
		if (!searchRoot) return;
		if (shouldSkipSearchRoot(searchRoot)) return;
		const optionButton = target.closest<HTMLElement>(
			"[data-search-select-option-index]",
		);
		const createButton = target.closest<HTMLElement>("[data-search-select-create]");
		if (!optionButton && !createButton) return;
		event.preventDefault();
		if (createButton) {
			selectSearchSelectCreateValue(searchRoot);
			return;
		}
		const optionIndex = Number(optionButton?.dataset.searchSelectOptionIndex);
		const option = getSearchSelectState(searchRoot).options[optionIndex];
		if (option) {
			selectSearchSelectOption(searchRoot, option);
		}
	});

	root.addEventListener("focusout", (event) => {
		const searchRoot = searchSelectRootForTarget(event.target);
		if (!searchRoot) return;
		if (shouldSkipSearchRoot(searchRoot)) return;
		window.setTimeout(() => {
			if (!searchRoot.contains(document.activeElement)) {
				closeSearchSelect(searchRoot);
			}
		});
	});
};
