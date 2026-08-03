import { renderPage, setStatus } from "../app";
import { login } from "../auth";
import { navigate } from "../router";

const attachLoginEvents = () => {
	const form = document.getElementById("login-form");
	if (!(form instanceof HTMLFormElement)) {
		return;
	}

	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		const usernameInput = document.getElementById("login-username");
		const passwordInput = document.getElementById("login-password");
		const submitButton = form.querySelector<HTMLButtonElement>("button[type='submit']");
		if (
			!(usernameInput instanceof HTMLInputElement) ||
			!(passwordInput instanceof HTMLInputElement)
		) {
			return;
		}

		submitButton?.setAttribute("disabled", "true");
		setStatus("login-status", "Signing in...");
		try {
			await login(usernameInput.value, passwordInput.value);
			const redirect = new URL(window.location.href).searchParams.get("redirect");
			navigate(redirect && redirect.startsWith("/") ? redirect : "/");
		} catch (error) {
			setStatus(
				"login-status",
				error instanceof Error ? error.message : "Login failed",
				true,
			);
		} finally {
			submitButton?.removeAttribute("disabled");
		}
	});
};

export const renderLoginPage = () => {
	renderPage(
		`
			<section class="login-page">
				<div class="card panel login-panel">
					<form id="login-form" autocomplete="on">
						<label>
							Username
							<input id="login-username" name="username" type="text" autocomplete="username" required />
						</label>
						<label>
							Password
							<input id="login-password" name="password" type="password" autocomplete="current-password" required />
						</label>
						<div class="actions">
							<button class="primary" type="submit">Login</button>
						</div>
						<div id="login-status" class="status" role="status"></div>
					</form>
				</div>
			</section>
		`,
		"page-shell--auth",
	);

	attachLoginEvents();
};
