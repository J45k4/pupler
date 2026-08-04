import { changePassword } from "../auth";
import { renderPage, setStatus } from "../app";
import {
	createElement,
	getElementById,
	withQueryRoot,
} from "../lib/dom";

const attachSettingsEvents = () => {
	const form = getElementById("password-settings-form");
	if (!(form instanceof HTMLFormElement)) {
		return;
	}

	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		const currentPasswordInput = getElementById(
			"settings-current-password",
		);
		const newPasswordInput = getElementById("settings-new-password");
		const confirmPasswordInput = getElementById(
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
	const passwordField = (
		label: string,
		id: string,
		name: string,
		autocomplete: string,
		minLength = 0,
	) => createElement(
		"label",
		{},
		label,
			createElement("input", {
				id,
				attributes: { autocomplete },
				properties: {
					name,
					type: "password",
				minLength,
				required: true,
			},
		}),
	);
	const form = createElement(
		"form",
		{ id: "password-settings-form", properties: { autocomplete: "on" } },
		passwordField("Current Password", "settings-current-password", "current-password", "current-password"),
		passwordField("New Password", "settings-new-password", "new-password", "new-password", 8),
		passwordField("Confirm New Password", "settings-confirm-password", "confirm-password", "new-password", 8),
		createElement(
			"div",
			{ className: "actions" },
			createElement("button", {
				className: "primary",
				text: "Change Password",
				properties: { type: "submit" },
			}),
		),
		createElement("div", {
			id: "settings-password-status",
			className: "status",
			attributes: { role: "status" },
		}),
	);
	const page = createElement(
		"section",
		{ className: "workspace workspace--single" },
		createElement(
			"div",
			{ className: "card panel settings-panel" },
			createElement(
				"div",
				{ className: "section-header" },
				createElement("h2", { text: "Password" }),
			),
			form,
		),
	);
	withQueryRoot(page, attachSettingsEvents);
	renderPage(page);
};
