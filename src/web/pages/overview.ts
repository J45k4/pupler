import {
	attachDashboardTimerEvents,
	loadDashboardShoppingList,
	loadDashboardTimer,
	renderPage,
} from "../app";

export const renderOverviewPage = () => {
	renderPage(
		`
			<section class="dashboard-grid">
				<div class="card panel dashboard-timer-panel">
					<div class="section-header">
						<h2>Timer</h2>
						<a class="secondary action-link" href="/time" data-link>Open Time</a>
					</div>
					<div id="dashboard-timer"></div>
					<div id="dashboard-timer-status" class="status"></div>
				</div>

				<div class="card panel dashboard-shopping-panel">
					<div class="section-header">
						<h2>Shoppinglist</h2>
						<a class="secondary action-link" href="/shoppinglist" data-link>View All</a>
					</div>
					<div id="dashboard-shopping-list"></div>
					<div id="dashboard-shopping-status" class="status"></div>
				</div>
			</section>
		`,
	);

	attachDashboardTimerEvents();
	void loadDashboardTimer();
	void loadDashboardShoppingList();
};
