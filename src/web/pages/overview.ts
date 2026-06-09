import {
	loadDashboardExpirationPreview,
	loadDashboardSpendingSummary,
	renderPage,
} from "../app";

export const renderOverviewPage = () => {
	renderPage(
		`
			<section class="dashboard-grid">
				<div class="card panel dashboard-spending-panel">
					<div class="section-header">
						<h2>Spending</h2>
						<div class="actions">
							<a class="secondary action-link" href="/spending" data-link>Breakdown</a>
							<a class="secondary action-link" href="/receipts" data-link>Receipts</a>
						</div>
					</div>
					<div id="dashboard-spending-summary"></div>
					<div id="dashboard-spending-status" class="status"></div>
				</div>

				<div class="card panel inventory-expiration-panel">
					<div class="section-header">
						<h2>Expiration Dates</h2>
						<a class="secondary action-link" href="/expirations" data-link>View All</a>
					</div>
					<div id="dashboard-expiration-list"></div>
					<div id="dashboard-expiration-status" class="status"></div>
				</div>
			</section>
		`,
	);

	void loadDashboardSpendingSummary();
	void loadDashboardExpirationPreview();
};
