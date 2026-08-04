import {
	attachDashboardTimerEvents,
	loadDashboardShoppingList,
	loadDashboardTimer,
	renderPage,
} from "../app"
import { createElement, withQueryRoot } from "../lib/dom"

const dashboardPanel = (
	title: string,
	href: string,
	linkText: string,
	contentId: string,
	statusId: string,
	className: string,
) => {
	const link = createElement("a", {
		className: "secondary action-link",
		text: linkText,
		properties: { href },
	})
	link.dataset.link = ""
	return createElement(
		"div",
		{ className: `card panel ${className}` },
		createElement(
			"div",
			{ className: "section-header" },
			createElement("h2", { text: title }),
			link,
		),
		createElement("div", { id: contentId }),
		createElement("div", { id: statusId, className: "status" }),
	)
}

export const renderOverviewPage = () => {
	const page = createElement(
		"section",
		{ className: "dashboard-grid" },
		dashboardPanel(
			"Timer",
			"/time",
			"Open Time",
			"dashboard-timer",
			"dashboard-timer-status",
			"dashboard-timer-panel",
		),
		dashboardPanel(
			"Shoppinglist",
			"/shoppinglist",
			"View All",
			"dashboard-shopping-list",
			"dashboard-shopping-status",
			"dashboard-shopping-panel",
		),
	)
	withQueryRoot(page, attachDashboardTimerEvents)
	renderPage(page)
	void loadDashboardTimer()
	void loadDashboardShoppingList()
}
