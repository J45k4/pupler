import {
	createReceiptCard,
	fetchReceipts,
	formatReceiptDateTime,
	renderPage,
	setStatus,
} from "../app";
import type { Group, PurchaseReceipt } from "../app";
import {
	createElement,
	createEmptyState,
	createPageMessage,
	getElementById,
	withQueryRoot,
} from "../lib/dom";

const renderGroupDetail = (group: Group, receipts: PurchaseReceipt[]) => {
	const page = getElementById("group-detail-page");
	if (!page) {
		return;
	}

	const back = createElement("a", { className: "secondary action-link", properties: { href: "/receipts" }, attributes: { "data-link": "" } }, "Back To Receipts");
	const form = createElement("form", { id: "group-detail-form" }, createElement("label", {}, "Name", createElement("input", { id: "group-detail-name", properties: { name: "name", required: true } })), createElement("div", { className: "actions" }, createElement("button", { className: "primary", properties: { type: "submit" } }, "Save Group")));
	const metadata = createElement("dl", { className: "receipt-metadata" }, createElement("div", {}, createElement("dt", {}, "Created"), createElement("dd", { id: "group-detail-created" })), createElement("div", {}, createElement("dt", {}, "Updated"), createElement("dd", { id: "group-detail-updated" })));
	page.replaceChildren(
		createElement("section", { className: "page-heading page-heading--compact" }, createElement("div", {}, createElement("span", { className: "eyebrow" }, "Group")), back),
		createElement("section", { className: "workspace" },
			createElement("div", { className: "card panel" }, createElement("h2", {}, "Group Details"), form, createElement("div", { id: "group-detail-status", className: "status" }), metadata),
			createElement("div", { className: "card panel" }, createElement("div", { className: "section-header" }, createElement("h2", {}, "Receipts"), createElement("span", { id: "group-detail-receipt-count", className: "tag tag--neutral" })), createElement("div", { id: "group-detail-receipts", className: "results" })),
		),
	);
	const nameInput = getElementById("group-detail-name");
	if (nameInput instanceof HTMLInputElement) nameInput.value = group.name;
	const setText = (id: string, value: string) => {
		const element = getElementById(id);
		if (element) element.textContent = value;
	};
	setText("group-detail-created", formatReceiptDateTime(group.created_at));
	setText("group-detail-updated", formatReceiptDateTime(group.updated_at));
	setText("group-detail-receipt-count", String(receipts.length));
	const results = getElementById("group-detail-receipts");
	if (results) {
		results.replaceChildren(
			...(receipts.length
				? receipts.map((receipt) => createReceiptCard(receipt, { draggable: false }))
				: [createEmptyState("No receipts in this group.")]),
		);
	}
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
	const form = getElementById("group-detail-form");
	const nameInput = getElementById("group-detail-name");
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

export const renderGroupDetailPage = async (params: Record<string, string>) => {
	const groupId = Number.parseInt(params.id ?? "", 10);
	const page = createElement("div", { id: "group-detail-page" });
	if (!Number.isInteger(groupId)) {
		page.append(createPageMessage("Group id is invalid."));
		renderPage(page);
		return;
	}

	try {
		const [group, receipts] = await Promise.all([
			fetchGroup(groupId),
			fetchReceipts(String(groupId)),
		]);
		withQueryRoot(page, () => {
			renderGroupDetail(group, receipts);
			attachGroupDetailEvents(group);
		});
	} catch (error) {
		page.append(
			createPageMessage(
				error instanceof Error ? error.message : "Failed to load group.",
			),
		);
	}
	renderPage(page);
};
