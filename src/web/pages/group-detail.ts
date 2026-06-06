import {
	escapeHtml,
	fetchReceipts,
	formatReceiptDateTime,
	renderPage,
	renderReceiptCard,
	setStatus,
} from "../app";
import type { Group, PurchaseReceipt } from "../app";

const renderGroupDetail = (group: Group, receipts: PurchaseReceipt[]) => {
	const page = document.getElementById("group-detail-page");
	if (!page) {
		return;
	}

	page.innerHTML = `
		<section class="page-heading page-heading--compact">
			<div>
				<span class="eyebrow">Group</span>
				<h1 class="page-title">${escapeHtml(group.name)}</h1>
			</div>
			<a class="secondary action-link" href="/receipts" data-link>Back To Receipts</a>
		</section>

		<section class="workspace">
			<div class="card panel">
				<h2>Group Details</h2>
				<form id="group-detail-form">
					<label>
						Name
						<input
							id="group-detail-name"
							name="name"
							value="${escapeHtml(group.name)}"
							required
						/>
					</label>
					<div class="actions">
						<button class="primary" type="submit">Save Group</button>
					</div>
				</form>
				<div id="group-detail-status" class="status"></div>
				<dl class="receipt-metadata">
					<div>
						<dt>Created</dt>
						<dd>${formatReceiptDateTime(group.created_at)}</dd>
					</div>
					<div>
						<dt>Updated</dt>
						<dd>${formatReceiptDateTime(group.updated_at)}</dd>
					</div>
				</dl>
			</div>

			<div class="card panel">
				<div class="section-header">
					<h2>Receipts</h2>
					<span class="tag tag--neutral">${receipts.length}</span>
				</div>
				<div class="results">
					${
						receipts.length
							? receipts
									.map((receipt) =>
										renderReceiptCard(receipt, { draggable: false }),
									)
									.join("")
							: '<div class="empty">No receipts in this group.</div>'
					}
				</div>
			</div>
		</section>
	`;
};

const fetchGroup = async (groupId: number) => {
	const response = await fetch(`/api/groups/${groupId}`);
	const body = (await response.json()) as Group | { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to load group")
				: "Failed to load group",
		);
	}

	return body as Group;
};

const updateGroup = async (groupId: number, payload: { name: string }) => {
	const response = await fetch(`/api/groups/${groupId}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	const body = (await response.json()) as Group | { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to update group")
				: "Failed to update group",
		);
	}

	return body as Group;
};

const attachGroupDetailEvents = (group: Group) => {
	const form = document.getElementById("group-detail-form");
	const nameInput = document.getElementById("group-detail-name");
	if (
		!(form instanceof HTMLFormElement) ||
		!(nameInput instanceof HTMLInputElement)
	) {
		return;
	}

	form.addEventListener("submit", async (event) => {
		event.preventDefault();

		const name = nameInput.value.trim();
		if (!name) {
			setStatus("group-detail-status", "Group name is required.", true);
			return;
		}

		try {
			const updatedGroup = await updateGroup(group.id, { name });
			const receipts = await fetchReceipts(String(group.id));
			renderGroupDetail(updatedGroup, receipts);
			attachGroupDetailEvents(updatedGroup);
			setStatus("group-detail-status", `Saved ${updatedGroup.name}.`);
		} catch (error) {
			setStatus(
				"group-detail-status",
				error instanceof Error ? error.message : "Failed to save group.",
				true,
			);
		}
	});
};

export const renderGroupDetailPage = (params: Record<string, string>) => {
	renderPage('<div id="group-detail-page"></div>');

	void (async () => {
		const rawId = params.id ?? "";
		const groupId = Number.parseInt(rawId, 10);
		const page = document.getElementById("group-detail-page");
		if (!page) {
			return;
		}

		if (!Number.isInteger(groupId)) {
			page.innerHTML =
				'<div class="card panel page-panel"><p class="page-copy">Group id is invalid.</p></div>';
			return;
		}

		try {
			const [group, receipts] = await Promise.all([
				fetchGroup(groupId),
				fetchReceipts(String(groupId)),
			]);
			renderGroupDetail(group, receipts);
			attachGroupDetailEvents(group);
		} catch (error) {
			page.innerHTML = `
				<div class="card panel page-panel">
					<p class="page-copy">${error instanceof Error ? error.message : "Failed to load group."}</p>
				</div>
			`;
		}
	})();
};
