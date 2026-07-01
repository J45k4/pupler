import { changePassword } from "../auth";
import { renderPage, setStatus } from "../app";

const attachSettingsEvents = () => {
	const form = document.getElementById("password-settings-form");
	if (!(form instanceof HTMLFormElement)) {
		return;
	}

	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		const currentPasswordInput = document.getElementById(
			"settings-current-password",
		);
		const newPasswordInput = document.getElementById("settings-new-password");
		const confirmPasswordInput = document.getElementById(
			"settings-confirm-password",
		);
		const submitButton = form.querySelector("button[type='submit']");
		if (
			!(currentPasswordInput instanceof HTMLInputElement) ||
			!(newPasswordInput instanceof HTMLInputElement) ||
			!(confirmPasswordInput instanceof HTMLInputElement) ||
			!(submitButton instanceof HTMLButtonElement)
		) {
			return;
		}

		if (newPasswordInput.value !== confirmPasswordInput.value) {
			setStatus("settings-password-status", "New passwords do not match.", true);
			return;
		}

		setStatus("settings-password-status", "Changing password...");
		submitButton.disabled = true;
		try {
			await changePassword(currentPasswordInput.value, newPasswordInput.value);
			form.reset();
			setStatus("settings-password-status", "Password changed.");
		} catch (error) {
			setStatus(
				"settings-password-status",
				error instanceof Error ? error.message : "Failed to change password.",
				true,
			);
		} finally {
			submitButton.disabled = false;
		}
	});
};

export const renderSettingsPage = () => {
	renderPage(
		`
			<section class="page-heading page-heading--compact">
				<div>
					<h1 class="page-title">Settings</h1>
				</div>
			</section>

			<section class="workspace workspace--single">
				<div class="card panel settings-panel">
					<div class="section-header">
						<h2>Password</h2>
					</div>
					<form id="password-settings-form" autocomplete="on">
						<label>
							Current Password
							<input id="settings-current-password" name="current-password" type="password" autocomplete="current-password" required />
						</label>
						<label>
							New Password
							<input id="settings-new-password" name="new-password" type="password" autocomplete="new-password" minlength="8" required />
						</label>
						<label>
							Confirm New Password
							<input id="settings-confirm-password" name="confirm-password" type="password" autocomplete="new-password" minlength="8" required />
						</label>
						<div class="actions">
							<button class="primary" type="submit">Change Password</button>
						</div>
						<div id="settings-password-status" class="status" role="status"></div>
					</form>
				</div>
			</section>
		`,
	);

	attachSettingsEvents();
};
