import { renderPage, setStatus } from "../app"
import { login } from "../auth"
import { navigate } from "../router"
import { createElement, getElementById, withQueryRoot } from "../lib/dom"

const attachLoginEvents = () => {
	const form = getElementById("login-form")
	if (!(form instanceof HTMLFormElement)) {
		return
	}

	form.addEventListener("submit", async (event) => {
		event.preventDefault()
		const usernameInput = getElementById("login-username")
		const passwordInput = getElementById("login-password")
		const submitButton = form.querySelector<HTMLButtonElement>(
			"button[type='submit']",
		)
		if (
			!(usernameInput instanceof HTMLInputElement) ||
			!(passwordInput instanceof HTMLInputElement)
		) {
			return
		}

		submitButton?.setAttribute("disabled", "true")
		setStatus("login-status", "Signing in...")
		try {
			await login(usernameInput.value, passwordInput.value)
			const redirect = new URL(window.location.href).searchParams.get(
				"redirect",
			)
			navigate(redirect && redirect.startsWith("/") ? redirect : "/")
		} catch (error) {
			setStatus(
				"login-status",
				error instanceof Error ? error.message : "Login failed",
				true,
			)
		} finally {
			submitButton?.removeAttribute("disabled")
		}
	})
}

export const renderLoginPage = () => {
	const username = createElement("input", {
		id: "login-username",
		properties: {
			name: "username",
			type: "text",
			autocomplete: "username",
			required: true,
		},
	})
	const password = createElement("input", {
		id: "login-password",
		properties: {
			name: "password",
			type: "password",
			autocomplete: "current-password",
			required: true,
		},
	})
	const submit = createElement("button", {
		className: "primary",
		text: "Login",
		properties: { type: "submit" },
	})
	const form = createElement(
		"form",
		{ id: "login-form", properties: { autocomplete: "on" } },
		createElement("label", {}, "Username", username),
		createElement("label", {}, "Password", password),
		createElement("div", { className: "actions" }, submit),
		createElement("div", {
			id: "login-status",
			className: "status",
			attributes: { role: "status" },
		}),
	)
	const page = createElement(
		"section",
		{ className: "login-page" },
		createElement("div", { className: "card panel login-panel" }, form),
	)
	withQueryRoot(page, attachLoginEvents)
	renderPage(page, "page-shell--auth")
}
