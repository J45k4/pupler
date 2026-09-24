type UpdateStatus = { phase: string; progress: number; tag: string; message: string }
export type UpdateInfo = { version: string; supported: boolean; latest: string | null; available: boolean; status: UpdateStatus | null; check_error: string | null }

const runningPhases = new Set(["starting", "downloading", "verifying", "backing_up", "migrating", "restarting"])

export const mountUpdateWidget = (host: HTMLElement, isAdmin: boolean, signal?: AbortSignal) => {
	const version = document.createElement("div")
	version.className = "app-version"
	version.textContent = "Pupler"
	document.body.append(version)
	let stopped = false
	let timer: number | null = null
	let updating = false
	let info: UpdateInfo | null = null
	const button = document.createElement("button")
	button.type = "button"
	button.className = "update-indicator"
	button.setAttribute("aria-label", "Install Pupler update")
	button.title = "Pupler update available"
	const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg")
	icon.setAttribute("viewBox", "0 0 24 24")
	icon.setAttribute("aria-hidden", "true")
	const iconPath = document.createElementNS("http://www.w3.org/2000/svg", "path")
	iconPath.setAttribute("d", "M12 3v12m0 0 4-4m-4 4-4-4M4 17v3h16v-3")
	icon.append(iconPath)
	const label = document.createElement("span")
	label.textContent = "Update"
	button.append(icon, label)
	button.hidden = true
	const panel = document.createElement("div")
	panel.className = "update-panel card"
	panel.hidden = true
	const title = document.createElement("strong")
	const message = document.createElement("p")
	const progress = document.createElement("progress")
	progress.max = 100
	const percent = document.createElement("small")
	const reload = document.createElement("button")
	reload.type = "button"
	reload.textContent = "Reload Pupler"
	reload.hidden = true
	reload.addEventListener("click", () => window.location.reload())
	panel.append(title, message, progress, percent, reload)
	if (isAdmin) host.append(button, panel)

	const render = () => {
		if (!info) return
		version.textContent = `Pupler ${info.version}`
		const status = info.status
		updating = Boolean(status && runningPhases.has(status.phase))
		const completedCurrent = status?.phase === "complete" && (status.tag === info.version || status.tag === `v${info.version}`)
		button.hidden = !info.available && !updating && status?.phase !== "failed" && !((status?.phase === "complete") && !completedCurrent)
		if (panel.hidden) return
		title.textContent = status ? `Updating to ${status.tag}` : `Update to ${info.latest}`
		message.textContent = status?.message ?? info.check_error ?? "A new version is ready"
		progress.hidden = !status || status.phase === "failed"
		progress.value = status?.progress ?? 0
		percent.textContent = status && status.phase !== "failed" ? `${status.progress}%` : ""
		reload.hidden = status?.phase !== "complete"
	}

	const schedule = (delay: number) => {
		if (timer !== null) window.clearTimeout(timer)
		if (!stopped) timer = window.setTimeout(() => { void refresh() }, delay)
	}

	const refresh = async () => {
		try {
			if (isAdmin) {
				const response = await fetch("/api/update", { credentials: "same-origin", cache: "no-store" })
				if (!response.ok) throw new Error("Could not read update status")
				info = await response.json() as UpdateInfo
			} else {
				const response = await fetch("/version", { credentials: "same-origin", cache: "no-store" })
				if (!response.ok) throw new Error("Could not read version")
				info = { version: (await response.json() as { version: string }).version, supported: false, latest: null, available: false, status: null, check_error: null }
			}
			if (stopped) return
			render()
			schedule(updating ? 1500 : 5 * 60_000)
		} catch {
			if (stopped) return
			if (!panel.hidden) message.textContent = "Reconnecting to Pupler…"
			schedule(2000)
		}
	}

	button.addEventListener("click", async () => {
		panel.hidden = false
		if (!info?.available || updating || info.status?.phase === "complete") { render(); return }
		button.disabled = true
		message.textContent = "Starting update…"
		try {
			const response = await fetch("/api/update", { method: "POST", credentials: "same-origin" })
			if (!response.ok) {
				const body = await response.json().catch(() => null) as { error?: string } | null
				throw new Error(body?.error ?? "Could not start update")
			}
			updating = true
			if (info) info.status = { phase: "starting", progress: 0, tag: info.latest ?? "", message: "Starting update" }
			render()
			await refresh()
		} catch (error) {
			message.textContent = error instanceof Error ? error.message : "Could not start update"
		} finally {
			button.disabled = false
		}
	})

	const onUpdateChecked = () => { void refresh() }
	if (isAdmin) window.addEventListener("pupler:update-checked", onUpdateChecked)
	const stop = () => {
		stopped = true
		window.removeEventListener("pupler:update-checked", onUpdateChecked)
		if (timer !== null) window.clearTimeout(timer)
		version.remove()
	}
	signal?.addEventListener("abort", stop, { once: true })
	void refresh()
	return stop
}
