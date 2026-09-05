export type DomChild = Node | string | number | null | undefined | false

export const escapeHtml = (value: unknown) =>
	String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;")

export const createHtmlFragment = (html: string) => {
	const template = document.createElement("template")
	template.innerHTML = html
	return template.content
}

let queryRoot: ParentNode | null = null

const currentQueryRoot = () => queryRoot ?? document

export const getElementById = <T extends HTMLElement = HTMLElement>(
	id: string,
) => {
	const root = currentQueryRoot()
	if (root instanceof HTMLElement && root.id === id) {
		return root as T
	}
	return root.querySelector<T>(`#${id}`)
}

export const querySelector = <T extends Element = Element>(selector: string) =>
	currentQueryRoot().querySelector<T>(selector)

export const querySelectorAll = <T extends Element = Element>(
	selector: string,
) => currentQueryRoot().querySelectorAll<T>(selector)

export const withQueryRoot = <T>(root: ParentNode, callback: () => T): T => {
	const previousRoot = queryRoot
	queryRoot = root
	try {
		return callback()
	} finally {
		queryRoot = previousRoot
	}
}

export const appendChildren = (
	parent: Node,
	...children: Array<DomChild | DomChild[]>
) => {
	for (const child of children.flat()) {
		if (child === null || child === undefined || child === false) continue
		parent.appendChild(
			child instanceof Node
				? child
				: document.createTextNode(String(child)),
		)
	}
	return parent
}

export const createElement = <K extends keyof HTMLElementTagNameMap>(
	tag: K,
	options: {
		id?: string
		className?: string
		text?: string
		attributes?: Record<string, string>
		properties?: Partial<HTMLElementTagNameMap[K]>
	} = {},
	...children: Array<DomChild | DomChild[]>
): HTMLElementTagNameMap[K] => {
	const element = document.createElement(tag)
	if (options.id) element.id = options.id
	if (options.className) element.className = options.className
	if (options.text !== undefined) element.textContent = options.text
	if (options.properties) Object.assign(element, options.properties)
	for (const [name, value] of Object.entries(options.attributes ?? {})) {
		element.setAttribute(name, value)
	}
	appendChildren(element, ...children)
	return element
}

export const createEmptyState = (message: string) =>
	createElement("div", { className: "empty", text: message })

export const createPageMessage = (message: string) =>
	createElement(
		"div",
		{ className: "card panel page-panel" },
		createElement("p", { className: "page-copy", text: message }),
	)
