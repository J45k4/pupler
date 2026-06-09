import {
	attachInventoryPageEvents,
	loadInventoryPageData,
	renderPage,
} from "../app";

export const renderInventoryPage = () => {
	renderPage(
		`
			<section class="inventory-page">
				<div id="inventory-tree-root"></div>
			</section>

			<div class="inventory-container-modal" id="inventory-container-modal" hidden>
				<div
					class="inventory-container-modal__backdrop"
					data-close-inventory-container-modal
				></div>
				<div
					class="inventory-container-modal__dialog card panel"
					role="dialog"
					aria-modal="true"
					aria-label="Create inventory container"
				>
					<div class="section-header section-header--end">
						<h2>Add Container</h2>
						<button
							class="secondary"
							type="button"
							aria-label="Close create inventory container modal"
							data-close-inventory-container-modal
						>
							Close
						</button>
					</div>
					<form id="inventory-container-modal-form">
						<label>
							Name
							<input
								id="inventory-container-name"
								name="name"
								placeholder="Room X"
								required
							/>
						</label>

						<label>
							Notes
							<input
								id="inventory-container-notes"
								name="notes"
								placeholder="Pantry shelf or freezer drawer"
							/>
						</label>

						<div class="actions">
							<button class="primary" type="submit">Add Container</button>
						</div>
					</form>
				</div>
			</div>

			<div class="inventory-container-modal" id="inventory-consume-modal" hidden>
				<div
					class="inventory-container-modal__backdrop"
					data-close-inventory-consume-modal
				></div>
				<div
					class="inventory-container-modal__dialog card panel"
					role="dialog"
					aria-modal="true"
					aria-label="Consume inventory item"
				>
					<div class="section-header section-header--end">
						<h2>Consume Item</h2>
						<button
							class="secondary"
							type="button"
							aria-label="Close consume inventory item modal"
							data-close-inventory-consume-modal
						>
							Close
						</button>
					</div>
					<form id="inventory-consume-form">
						<div class="inventory-consume-target" id="inventory-consume-item-name"></div>
						<label>
							Consumed At
							<input
								id="inventory-consume-date"
								name="consumed_at"
								type="datetime-local"
							/>
						</label>
						<div class="actions">
							<button class="primary" type="submit">Consume</button>
							<button
								class="secondary"
								type="button"
								data-close-inventory-consume-modal
							>
								Cancel
							</button>
						</div>
					</form>
					<div id="inventory-consume-status" class="status"></div>
				</div>
			</div>
		`,
	);

	attachInventoryPageEvents();
	void loadInventoryPageData();
};
