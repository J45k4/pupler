import {
	attachExpirationPageEvents,
	loadExpirationPageData,
	renderPage,
} from "../app"
import { createElement, withQueryRoot } from "../lib/dom"

export const renderExpirationsPage = () => {
	const back = createElement("a", {
		className: "secondary action-link",
		text: "Back To Inventory",
		properties: { href: "/inventory" },
	})
	back.dataset.link = ""
	const page = document.createDocumentFragment()
	page.append(
		createElement(
			"section",
			{ className: "page-heading page-heading--compact" },
			back,
		),
		createElement(
			"section",
			{ className: "workspace workspace--single" },
			createElement(
				"div",
				{ className: "card panel inventory-expiration-panel" },
				createElement(
					"div",
					{ className: "section-header section-header--end" },
					createElement("div", {
						id: "expiration-status",
						className: "status",
					}),
				),
				createElement("div", { id: "expiration-results" }),
			),
		),
	)
	withQueryRoot(page, attachExpirationPageEvents)
	renderPage(page)
	void loadExpirationPageData()
}
