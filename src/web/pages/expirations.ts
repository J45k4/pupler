import {
	attachExpirationPageEvents,
	loadExpirationPageData,
	renderPage,
} from "../app";

export const renderExpirationsPage = () => {
	renderPage(
		`
			<section class="page-heading page-heading--compact">
				<div>
					<h1 class="page-title">Expirations</h1>
				</div>
				<a class="secondary action-link" href="/inventory" data-link>Back To Inventory</a>
			</section>

			<section class="workspace workspace--single">
				<div class="card panel inventory-expiration-panel">
					<div class="section-header section-header--end">
						<div id="expiration-status" class="status"></div>
					</div>
					<div id="expiration-results"></div>
				</div>
			</section>
		`,
	);

	attachExpirationPageEvents();
	void loadExpirationPageData();
};
