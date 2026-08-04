export type UiChild = UiComponent<HTMLElement> | HTMLElement | string

const childNode = (child: UiChild): Node => {
	if (typeof child === "string") return document.createTextNode(child)
	return child instanceof HTMLElement ? child : child.root
}

export class UiComponent<T extends HTMLElement = HTMLElement> {
	public readonly root: T

	constructor(root: T) {
		this.root = root
	}

	public destroy() {}
}

export class Container<
	T extends HTMLElement = HTMLElement,
> extends UiComponent<T> {
	constructor(root: T) {
		super(root)
	}

	public add(...components: UiChild[]) {
		this.root.append(...components.map(childNode))
		return this
	}

	public clear() {
		this.root.replaceChildren()
		return this
	}
}

export class VList extends UiComponent<HTMLDivElement> {
	constructor(args?: {
		className?: string
		style?: Partial<CSSStyleDeclaration>
	}) {
		super(document.createElement("div"))
		this.root.style.display = "flex"
		this.root.style.flexDirection = "column"
		if (args?.className) this.root.className = args.className
		if (args?.style) Object.assign(this.root.style, args.style)
	}

	public add(...components: UiChild[]) {
		this.root.append(...components.map(childNode))
		return this
	}
}

export class HList extends UiComponent<HTMLDivElement> {
	constructor(args?: {
		className?: string
		style?: Partial<CSSStyleDeclaration>
	}) {
		super(document.createElement("div"))
		this.root.style.display = "flex"
		this.root.style.flexDirection = "row"
		if (args?.className) this.root.className = args.className
		if (args?.style) Object.assign(this.root.style, args.style)
	}

	public add(...components: UiChild[]) {
		this.root.append(...components.map(childNode))
		return this
	}
}

export class Button extends UiComponent<HTMLButtonElement> {
	constructor(args: {
		text: string
		className?: string
		type?: "button" | "submit" | "reset"
	}) {
		super(document.createElement("button"))
		this.root.textContent = args.text
		this.root.type = args.type ?? "button"
		if (args.className) this.root.className = args.className
	}

	public set onClick(callback: () => void) {
		this.root.onclick = callback
	}
}

export class Label extends UiComponent<HTMLLabelElement> {
	constructor(args: { text: string; control?: UiChild; className?: string }) {
		super(document.createElement("label"))
		if (args.className) this.root.className = args.className
		this.root.append(args.text)
		if (args.control) this.root.append(childNode(args.control))
	}

	public add(...components: UiChild[]) {
		this.root.append(...components.map(childNode))
		return this
	}
}

export class TextInput extends UiComponent<HTMLDivElement> {
	private readonly input: HTMLInputElement

	constructor(args: {
		id?: string
		label?: string
		value?: string
		placeholder?: string
		autocomplete?: string
		type?: string
		required?: boolean
	}) {
		super(document.createElement("div"))
		this.root.style.display = "flex"
		this.root.style.flexDirection = "column"

		if (args.label) {
			const label = document.createElement("label")
			label.textContent = args.label
			this.root.appendChild(label)
		}

		this.input = document.createElement("input")
		if (args.id) this.input.id = args.id
		this.input.type = args.type ?? "text"
		this.input.placeholder = args.placeholder ?? ""
		this.input.setAttribute("autocomplete", args.autocomplete ?? "off")
		this.input.value = args.value ?? ""
		this.input.required = args.required ?? false
		this.root.appendChild(this.input)
	}

	public get value() {
		return this.input.value
	}

	public set value(value: string) {
		this.input.value = value
	}
}

export type SelectOption = {
	value: string
	text: string
}

export class Select extends UiComponent<HTMLSelectElement> {
	constructor(args: {
		value?: string
		options: SelectOption[]
		id?: string
		required?: boolean
	}) {
		super(document.createElement("select"))
		if (args.id) this.root.id = args.id
		this.root.required = args.required ?? false
		for (const option of args.options) {
			const optionEl = document.createElement("option")
			optionEl.value = option.value
			optionEl.textContent = option.text
			this.root.appendChild(optionEl)
		}
		this.root.value = args.value ?? ""
	}

	public get value() {
		return this.root.value
	}

	public set value(value: string) {
		this.root.value = value
	}

	public set onChange(callback: (value: string) => void) {
		this.root.onchange = () => callback(this.root.value)
	}
}
