import {
	deleteInventoryContainer,
	fetchInventoryContainer,
	fetchInventoryContainers,
	fetchInventoryItemsByContainer,
	navigate,
	renderInventoryItemNodeLink,
	renderPage,
	setStatus,
	updateInventoryContainer,
} from "../app";

export const renderInventoryContainerDetailPage = (params: Record<string, string>) => {
	renderPage('<div id="inventory-container-detail-page"></div>');

	void (async () => {
		const rawId = params.id ?? "";
		const containerId = Number.parseInt(rawId, 10);
		const page = document.getElementById("inventory-container-detail-page");
		if (!page) {
			return;
		}

		if (!Number.isInteger(containerId)) {
			page.innerHTML =
				'<div class="card panel page-panel"><p class="page-copy">Container id is invalid.</p></div>';
			return;
		}

		try {
			const [container, containers, items] = await Promise.all([
				fetchInventoryContainer(containerId),
				fetchInventoryContainers(),
				fetchInventoryItemsByContainer(containerId),
			]);
			const children = containers
				.filter(
					(candidate) =>
						candidate.parent_container_id === containerId,
				)
				.sort((left, right) => left.name.localeCompare(right.name));
			const descendants = new Set<number>([containerId]);
			let foundDescendant = true;
			while (foundDescendant) {
				foundDescendant = false;
				for (const candidate of containers) {
					if (
						candidate.parent_container_id !== null &&
						descendants.has(candidate.parent_container_id) &&
						!descendants.has(candidate.id)
					) {
						descendants.add(candidate.id);
						foundDescendant = true;
					}
				}
			}

			const parentOptions = containers
				.filter((candidate) => !descendants.has(candidate.id))
				.sort((left, right) => left.name.localeCompare(right.name))
				.map(
					(candidate) => `
						<option
							value="${candidate.id}"
							${container.parent_container_id === candidate.id ? "selected" : ""}
						>
							${candidate.name}
						</option>
					`,
				)
				.join("");

			page.innerHTML = `
				<section class="page-heading page-heading--compact">
					<a class="secondary action-link" href="/inventory" data-link>Back To Inventory</a>
				</section>

				<section class="workspace">
					<div class="card panel">
						<h2>Container Details</h2>
						<form id="inventory-container-detail-form">
							<label>
								Name
								<input id="inventory-container-detail-name" name="name" value="${container.name}" required />
							</label>
							<label>
								Inside
								<select id="inventory-container-detail-parent" name="parent_container_id">
									<option value="">Top level</option>
									${parentOptions}
								</select>
							</label>
							<label>
								Notes
								<input id="inventory-container-detail-notes" name="notes" value="${container.notes ?? ""}" placeholder="Pantry shelf or freezer drawer" />
							</label>
							<div class="actions">
								<button class="primary" type="submit">Save</button>
								<button
									class="secondary"
									type="button"
									id="inventory-container-detail-delete"
								>
									Delete
								</button>
							</div>
						</form>
						<div id="inventory-container-detail-status" class="status"></div>
					</div>

					<div class="card panel">
						<h2>Contents</h2>
						<div class="results">
							<div class="inventory-detail-block">
								<h3>Child Containers</h3>
								${
									children.length
										? `<div class="inventory-detail-list">${children
												.map(
													(child) => `
														<a class="receipt-card" href="/inventory/containers/${child.id}" data-link>
															<div class="receipt-card__header">
																<h3>${child.name}</h3>
															</div>
															<div class="section-copy">${child.notes ?? "No notes"}</div>
														</a>
													`,
												)
												.join("")}</div>`
										: '<div class="empty">No child containers.</div>'
								}
							</div>

							<div class="inventory-detail-block">
								<h3>Active Items</h3>
								${
									items.length
										? `<div class="inventory-detail-list">${items
												.map((item) => {
													return `
														${renderInventoryItemNodeLink(item)}
													`;
												})
												.join("")}</div>`
										: '<div class="empty">No active items in this container.</div>'
								}
							</div>
						</div>
					</div>
				</section>
			`;

			const form = document.getElementById(
				"inventory-container-detail-form",
			);
			const deleteButton = document.getElementById(
				"inventory-container-detail-delete",
			);

			form?.addEventListener("submit", async (event) => {
				event.preventDefault();
				const nameInput = document.getElementById(
					"inventory-container-detail-name",
				);
				const parentInput = document.getElementById(
					"inventory-container-detail-parent",
				);
				const notesInput = document.getElementById(
					"inventory-container-detail-notes",
				);

				if (
					!(nameInput instanceof HTMLInputElement) ||
					!(parentInput instanceof HTMLSelectElement) ||
					!(notesInput instanceof HTMLInputElement)
				) {
					return;
				}

				try {
					const updated = await updateInventoryContainer(
						containerId,
						{
							name: nameInput.value.trim(),
							parent_container_id: parentInput.value
								? Number(parentInput.value)
								: null,
							notes: notesInput.value.trim() || null,
						},
					);
					setStatus(
						"inventory-container-detail-status",
						`Saved ${updated.name}.`,
					);
				} catch (error) {
					setStatus(
						"inventory-container-detail-status",
						error instanceof Error
							? error.message
							: "Failed to save container.",
						true,
					);
				}
			});

			deleteButton?.addEventListener("click", async () => {
				const confirmed = window.confirm(
					`Delete ${container.name}? Child containers and inventory items will be unassigned.`,
				);
				if (!confirmed) {
					return;
				}

				try {
					await deleteInventoryContainer(containerId);
					navigate("/inventory");
				} catch (error) {
					setStatus(
						"inventory-container-detail-status",
						error instanceof Error
							? error.message
							: "Failed to delete container.",
						true,
					);
				}
			});
		} catch (error) {
			page.innerHTML = `
				<div class="card panel page-panel">
					<p class="page-copy">${error instanceof Error ? error.message : "Failed to load inventory container."}</p>
				</div>
			`;
		}
	})();
};
