import { createElement } from "../lib/dom"

type ApiKey = { id: number, name: string, prefix: string, created_at: string, last_used_at: string | null }

export const apiKeySettings = () => {
	const status = createElement("p", { attributes: { role: "status" } })
	const list = createElement("div")
	const secret = createElement("div")
	const name = createElement("input", { properties: { required: true, maxLength: 100 }, attributes: { placeholder: "Omarchy toolbar" } })
	const submit = createElement("button", { text: "Create API key", properties: { type: "submit" } })
	const form = createElement("form", {}, createElement("label", {}, "Key name", name), submit)
	const request = async (path = "", options: RequestInit = {}) => {
		const response = await fetch(`/api/auth/api-keys${path}`, options)
		if (response.status === 204) return null
		const body = await response.json()
		if (!response.ok) throw new Error(body.error || "API key request failed")
		return body
	}
	const showError = (error: unknown) => { status.textContent = error instanceof Error ? error.message : "API key request failed" }
	const refresh = async () => {
		const keys: ApiKey[] = await request()
		list.replaceChildren(...keys.map(key => {
			const revoke = createElement("button", { text: "Revoke", properties: { type: "button" } })
			revoke.addEventListener("click", async () => {
				if (!window.confirm(`Revoke API key “${key.name}”? Apps using it will lose access.`)) return
				revoke.disabled = true
				try {
					await request(`/${key.id}`, { method: "DELETE" })
					secret.replaceChildren()
					status.textContent = "API key revoked."
					await refresh()
				} catch (error) { showError(error) }
				finally { revoke.disabled = false }
			})
			return createElement("div", { className: "card" },
				createElement("strong", { text: key.name }),
				createElement("p", { text: `${key.prefix}… · Created ${new Date(key.created_at).toLocaleString()} · Last used ${key.last_used_at ? new Date(key.last_used_at).toLocaleString() : "never"}` }), revoke)
		}))
		if (!keys.length) list.textContent = "No API keys yet."
	}
	form.addEventListener("submit", async event => {
		event.preventDefault()
		submit.disabled = true
		secret.replaceChildren()
		try {
			const result = await request("", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.value }) })
			const value = createElement("input", { attributes: { "aria-label": "New API key" }, properties: { readOnly: true, value: result.key } })
			const copy = createElement("button", { text: "Copy key", properties: { type: "button" } })
			copy.addEventListener("click", async () => {
				try {
					await navigator.clipboard.writeText(result.key)
					status.textContent = "API key copied."
				}
				catch {
					value.select()
					status.textContent = "Select and copy the key manually."
				}
			})
			secret.append(createElement("p", { text: "Save this key now. It will not be shown again." }), value, copy)
			name.value = ""
			status.textContent = "API key created."
			await refresh()
		} catch (error) { showError(error) }
		finally { submit.disabled = false }
	})
	void refresh().catch(showError)
	return createElement("div", { className: "card panel settings-panel" },
		createElement("h2", { text: "API keys" }),
		createElement("p", { text: "Keys give apps your account’s API access. Revoke a key here to disable it. Key management requires a browser sign-in." }),
		form, secret, status, list)
}
