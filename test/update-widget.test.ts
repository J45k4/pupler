import { expect, test } from "bun:test"
import { mountUpdateWidget, type UpdateInfo } from "../src/web/update-widget"

test("completed updates close the panel and do not block the next update", async () => {
	class Element extends EventTarget {
		children: Element[] = []
		hidden = false
		textContent = ""
		append(...children: Element[]) { this.children.push(...children) }
		setAttribute() {}
		remove() {}
	}
	const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document")
	const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
	const originalFetch = globalThis.fetch
	const windowMock = Object.assign(new EventTarget(), { setTimeout: () => 1, clearTimeout: () => {}, location: { reload() {} } })
	Object.defineProperty(globalThis, "document", { configurable: true, value: { body: new Element(), createElement: () => new Element(), createElementNS: () => new Element() } })
	Object.defineProperty(globalThis, "window", { configurable: true, value: windowMock })
	let info: UpdateInfo = { version: "v0.0.6", supported: true, latest: "v0.0.7", available: true, status: null, check_error: null }
	let posts = 0
	globalThis.fetch = (async (_url: unknown, options?: RequestInit) => {
		if (options?.method === "POST") {
			posts += 1
			info.status = { phase: "downloading", progress: 30, tag: info.latest!, message: "Downloading" }
		}
		return Response.json(info)
	}) as typeof fetch
	const settle = () => new Promise(resolve => setTimeout(resolve, 0))
	let stop: (() => void) | undefined
	try {
		const host = new Element()
		stop = mountUpdateWidget(host as unknown as HTMLElement, true)
		await settle()
		const [button, panel] = host.children
		button!.dispatchEvent(new Event("click"))
		await settle()
		expect(posts).toBe(1)
		expect(panel!.hidden).toBe(false)
		info = { ...info, version: "v0.0.7", available: false, status: { phase: "complete", progress: 100, tag: "v0.0.7", message: "Update complete" } }
		windowMock.dispatchEvent(new Event("pupler:update-checked"))
		await settle()
		expect(panel!.hidden).toBe(true)
		expect(button!.hidden).toBe(true)
		info.latest = "v0.0.8"
		info.available = true
		windowMock.dispatchEvent(new Event("pupler:update-checked"))
		await settle()
		expect(button!.hidden).toBe(false)
		expect(panel!.hidden).toBe(true)
		button!.dispatchEvent(new Event("click"))
		await settle()
		expect(posts).toBe(2)
		expect(panel!.hidden).toBe(false)
	} finally {
		stop?.()
		globalThis.fetch = originalFetch
		if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument)
		else Reflect.deleteProperty(globalThis, "document")
		if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow)
		else Reflect.deleteProperty(globalThis, "window")
	}
})
