import {
	attachInventoryPageEvents,
	loadInventoryPageData,
	renderPage,
} from "../app";
import { renderModal } from "../ui/modal";

export const renderInventoryPage = () => {
	renderPage(
		`
			<section class="inventory-page">
				<div id="inventory-tree-root"></div>
			</section>

			${renderModal({
				id: "inventory-container-modal",
				title: "Add Container",
				ariaLabel: "Create inventory container",
				closeDataAttribute: "data-close-inventory-container-modal",
				headerClassName: "section-header--end",
				className: "inventory-container-modal",
				children: `
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
				`,
			})}

			${renderModal({
				id: "inventory-consume-modal",
				title: "Consume Item",
				ariaLabel: "Consume inventory item",
				closeDataAttribute: "data-close-inventory-consume-modal",
				headerClassName: "section-header--end",
				className: "inventory-container-modal",
				children: `
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
				`,
			})}
		`,
	);

	attachInventoryPageEvents();
	void loadInventoryPageData();
};
