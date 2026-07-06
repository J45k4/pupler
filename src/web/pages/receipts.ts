import {
	attachReceiptsPageEvents,
	attachUploadDropzones,
	getDefaultReceiptViewMode,
	loadReceipts,
	receiptViewModeOverride,
	renderPage,
	renderUploadDropzone,
} from "../app";
import { renderModal } from "../ui/modal";

export const renderReceiptsPage = () => {
	const defaultPurchasedAt = new Date(
		Date.now() - new Date().getTimezoneOffset() * 60000,
	)
		.toISOString()
		.slice(0, 16);
	const initialReceiptViewMode =
		receiptViewModeOverride ?? getDefaultReceiptViewMode();

	renderPage(
		`
			<section class="receipts-page">
				<div class="receipts-page__controls">
					<div class="toolbar toolbar--wrap receipts-page__filters">
						<select
							id="receipt-group-filter"
							class="toolbar__select"
							aria-label="Receipt group filter"
						>
							<option value="all">All groups</option>
							<option value="ungrouped">Ungrouped</option>
						</select>
						<label class="checkbox-toggle receipt-view-toggle">
							<input id="receipt-chronological-view" type="checkbox" ${initialReceiptViewMode === "chronological" ? "checked" : ""} />
							Chronological view
						</label>
					</div>
					<div class="actions receipts-page__actions">
						<button class="secondary" type="button" id="receipt-refresh-button">Refresh</button>
						<button
							class="secondary"
							type="button"
							id="open-group-modal-button"
						>
							New group
						</button>
						<button
							class="primary"
							type="button"
							id="open-receipt-modal-button"
						>
							Add Receipt
						</button>
					</div>
				</div>
				<div id="receipt-status" class="status"></div>
				<div id="receipt-results" class="results"></div>
			</section>

			${renderModal({
				id: "receipt-create-modal",
				title: "Create Receipt",
				titleId: "receipt-create-modal-title",
				closeDataAttribute: "data-receipt-create-modal-close",
				className: "receipt-create-modal",
				children: `
					<form id="receipt-form">
						<label>
							Store Name
							<input id="receipt-store-name" name="receipt-store-name" placeholder="K-Market" required />
						</label>

						<label>
							Purchased At
							<input id="receipt-purchased-at" type="datetime-local" value="${defaultPurchasedAt}" required />
						</label>

						<div class="row">
							<label>
								Currency
								<input id="receipt-currency" value="EUR" maxlength="3" required />
							</label>

							<label>
								Total Amount
								<input id="receipt-total-amount" type="number" step="0.01" min="0" placeholder="23.40" />
							</label>
						</div>

						<label>
							Group
							<input id="receipt-group-name" list="receipt-group-options" placeholder="grocery" />
							<datalist id="receipt-group-options"></datalist>
						</label>

						${renderUploadDropzone({
							inputId: "receipt-picture",
							label: "Receipt Picture",
							emptyText: "Choose a receipt image or drop one here.",
						})}

						<div class="actions">
							<button class="primary" type="submit">Create Receipt</button>
							<button
								class="secondary"
								type="button"
								data-receipt-create-modal-close
							>
								Cancel
							</button>
						</div>
					</form>
					<div id="receipt-create-status" class="status"></div>
				`,
			})}

			${renderModal({
				id: "group-create-modal",
				title: "New Group",
				titleId: "group-create-modal-title",
				closeDataAttribute: "data-group-create-modal-close",
				className: "receipt-create-modal",
				children: `
					<form id="group-create-form">
						<label>
							Group Name
							<input id="group-create-name" name="group-name" placeholder="grocery" required />
						</label>
						<div class="actions">
							<button class="primary" type="submit">Create Group</button>
							<button
								class="secondary"
								type="button"
								data-group-create-modal-close
							>
								Cancel
							</button>
						</div>
					</form>
					<div id="group-create-status" class="status"></div>
				`,
			})}
		`,
	);

	attachUploadDropzones(document.body);
	attachReceiptsPageEvents();
	void loadReceipts();
};
