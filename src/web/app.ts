import { InfiniteScroll } from "./infinite-scroll";
import {
	getCurrentUser,
	logout,
} from "./auth";
import { escapeHtml } from "./lib/html";
import { renderNavbar } from "./navbar";
import {
	navigate,
} from "./router";
import {
	renderProductCategoryInput,
	renderUnitSelect,
	setUnitSelectValue,
} from "./ui/form-fields";
import {
	attachUploadDropzones,
	renderUploadDropzone,
} from "./ui/upload-dropzone";

export { escapeHtml } from "./lib/html";
export {
	renderProductCategoryInput,
	renderUnitSelect,
} from "./ui/form-fields";
export {
	attachUploadDropzones,
	renderUploadDropzone,
} from "./ui/upload-dropzone";

type IngredientSummary = {
	id: number;
	name: string;
	default_unit: string | null;
};

type Ingredient = IngredientSummary & {
	created_at: string;
	updated_at: string;
};

type StoredFile = {
	id: number;
	content_type: string;
	filename: string | null;
	size_bytes: number;
	created_at: string;
};

type Product = {
	id: number;
	ingredient_id: number | null;
	name: string;
	category: string;
	barcode: string | null;
	default_unit: string | null;
	is_perishable: boolean;
	picture_file_id?: number | null;
	picture_file?: StoredFile | null;
	created_at: string;
	updated_at: string;
	ingredient?: IngredientSummary | null;
};

type GroupSummary = {
	id: number;
	name: string;
};

export type Group = GroupSummary & {
	created_at: string;
	updated_at: string;
};

export type PurchaseReceipt = {
	id: number;
	group_id: number | null;
	store_name: string;
	purchased_at: string;
	currency: string;
	total_amount: number | null;
	created_at: string;
	updated_at: string;
	group?: GroupSummary | null;
	picture_file_id?: number | null;
	picture_file?: StoredFile | null;
};

type PurchaseReceiptItem = {
	id: number;
	receipt_id: number;
	product_id: number;
	quantity: number;
	unit: string;
	unit_price: number | null;
	line_total: number | null;
	created_at: string;
};

type SpendingCurrencyTotal = {
	currency: string;
	total: number;
};

type SpendingAverageTotal = SpendingCurrencyTotal & {
	day_count: number;
};

type SpendingBreakdown = {
	item_count: number;
	monthly_average_totals: SpendingAverageTotal[];
	daily_average_totals: SpendingAverageTotal[];
	current_month_totals: SpendingCurrencyTotal[];
};

type InventoryItemImage = {
	id: number;
	inventory_item_id: number;
	file_id: number;
	created_at: string;
	file: StoredFile;
};

type InventoryItem = {
	id: number;
	name: string;
	ingredient_id: number | null;
	product_id: number | null;
	receipt_item_id: number | null;
	container_id: number | null;
	quantity: number;
	unit: string;
	purchased_at: string | null;
	expires_at: string | null;
	consumed_at: string | null;
	notes: string | null;
	created_at: string;
	updated_at: string;
	ingredient?: IngredientSummary | null;
	product?: IngredientSummary & { ingredient_id: number | null } | null;
	inventory_item_images?: InventoryItemImage[];
};

export type InventoryContainer = {
	id: number;
	name: string;
	parent_container_id: number | null;
	notes: string | null;
	created_at: string;
	updated_at: string;
};

export type ShoppingListItem = {
	id: number;
	name: string;
	ingredient_id: number | null;
	product_id: number | null;
	quantity: number;
	unit: string;
	done: boolean;
	source_recipe_id: number | null;
	notes: string | null;
	created_at: string;
	updated_at: string;
	ingredient?: IngredientSummary | null;
	product?: (IngredientSummary & {
		ingredient_id: number | null;
		picture_file_id?: number | null;
		picture_file?: StoredFile | null;
	}) | null;
};

export type Todo = {
	id: number;
	title: string;
	notes: string | null;
	status: number;
	due_at: string | null;
	completed_at: string | null;
	created_at: string;
	updated_at: string;
};

type TimeProject = {
	id: number;
	name: string;
	color: string;
	archived_at: string | null;
	created_at: string;
	updated_at: string;
};

type UserSummary = {
	id: number;
	name: string;
	email: string | null;
};

type TimeEntry = {
	id: number;
	user_id: number | null;
	project_id: number | null;
	description: string | null;
	started_at: string;
	ended_at: string | null;
	created_at: string;
	updated_at: string;
	user?: UserSummary | null;
	project?: TimeProject;
};

type TimeReportProjectTotal = {
	project_id: number;
	project_name: string;
	project_color: string;
	total_seconds: number;
	entry_count: number;
};

type TimeReport = {
	period: {
		from: string | null;
		to: string;
		range: "custom" | "all";
	};
	total_seconds: number;
	running_entry: TimeEntry | null;
	project_totals: TimeReportProjectTotal[];
};

type TimeQuickAction = {
	project_id: number;
	description: string;
	entry_count: number;
	latest_started_at: string;
	total_seconds: number;
	project?: TimeProject;
};

type TimeProjectChoice = {
	project: TimeProject;
	entry_count: number;
	total_seconds: number;
	latest_started_at: string | null;
};

type RecipeIngredient = {
	id: number;
	recipe_id: number;
	ingredient_id: number | null;
	product_id: number | null;
	name: string;
	quantity: number;
	unit: string;
	is_optional: boolean;
	notes: string | null;
	created_at: string;
	ingredient?: IngredientSummary | null;
	product?: IngredientSummary & { ingredient_id: number | null } | null;
};

export type Recipe = {
	id: number;
	name: string;
	description: string | null;
	instructions: string | null;
	servings: number | null;
	is_active: boolean;
	created_at: string;
	updated_at: string;
	ingredients?: RecipeIngredient[];
	recipe_images?: RecipeImage[];
};

type RecipeImage = {
	id: number;
	recipe_id: number;
	file_id: number;
	created_at: string;
	file: StoredFile;
};

type DraftRecipeIngredient = {
	name: string;
	quantity: number;
	unit: string;
	is_optional: boolean;
	notes: string | null;
};

type InventoryItemMode = "active" | "consumed" | "all";
type ReceiptViewMode = "board" | "chronological";
type ReceiptTimelineEntry =
	| { kind: "cutoff" }
	| { kind: "receipt"; receipt: PurchaseReceipt };

let receiptDetailAbortController: AbortController | null = null;
let productPageAbortController: AbortController | null = null;
let productDetailAbortController: AbortController | null = null;
let productInfiniteScroll: InfiniteScroll<Product> | null = null;
let expirationInfiniteScroll: InfiniteScroll<InventoryItem> | null = null;
let receiptInfiniteScroll: InfiniteScroll<ReceiptTimelineEntry> | null = null;
let timeTimerInterval: number | null = null;
let dashboardTimerInterval: number | null = null;
let currentTimeProjectChoices: TimeProjectChoice[] = [];
let receiptBoardState: {
	groups: Group[];
	receipts: PurchaseReceipt[];
} | null = null;
export let receiptViewModeOverride: ReceiptViewMode | null = null;
let inventoryTreeState: {
	containers: InventoryContainer[];
	items: InventoryItem[];
} | null = null;
let collapsedInventoryContainerIds = new Set<number>();
let inventoryItemMode: InventoryItemMode = "active";

const render = (html: string) => {
	productInfiniteScroll?.destroy();
	productInfiniteScroll = null;
	expirationInfiniteScroll?.destroy();
	expirationInfiniteScroll = null;
	receiptInfiniteScroll?.destroy();
	receiptInfiniteScroll = null;
	if (timeTimerInterval !== null) {
		window.clearInterval(timeTimerInterval);
		timeTimerInterval = null;
	}
	if (dashboardTimerInterval !== null) {
		window.clearInterval(dashboardTimerInterval);
		dashboardTimerInterval = null;
	}
	document.body.classList.remove("modal-open");
	document.body.innerHTML = html;
};

export const renderAppShell = (shellClassName = "") => {
	const shellClasses = [
		...new Set(["page-shell", "page-shell--wide", shellClassName].filter(Boolean)),
	].join(" ");
	render(`
		${renderNavbar(window.location.pathname, getCurrentUser())}
		<main class="${shellClasses}"></main>
	`);
	document
		.querySelector(".account-menu__logout")
		?.addEventListener("click", async () => {
			try {
				await logout();
				navigate("/login");
			} catch (error) {
				console.error(error);
			}
		});
	requestAnimationFrame(() => {
		const activeLink = document.querySelector<HTMLElement>(
			".navbar__link--active",
		);
		const navbar = activeLink?.closest<HTMLElement>(".navbar");
		if (!activeLink || !navbar) {
			return;
		}

		activeLink.scrollIntoView({
			behavior: "auto",
			block: "nearest",
			inline: "center",
		});

		if (window.scrollX !== 0) {
			window.scrollTo({ left: 0, top: window.scrollY, behavior: "auto" });
		}
	});

	const main = document.querySelector<HTMLElement>("main");
	if (!main) {
		throw new Error("App shell main element was not rendered.");
	}
	return main;
};

export const renderPage = (content: string, shellClassName = "") => {
	const main = renderAppShell(shellClassName);
	main.innerHTML = content;
	return main;
};

export const setStatus = (elementId: string, message: string, isError = false) => {
	const status = document.getElementById(elementId);
	if (!status) {
		return;
	}
	status.textContent = message;
	status.className = isError ? "status error" : "status";
};

const TIME_RANGE_OPTIONS = [
	{ value: "today", label: "Today" },
	{ value: "7", label: "Last 7 Days" },
	{ value: "30", label: "Last 30 Days" },
	{ value: "all", label: "All Time" },
] as const;

type TimeRangeOption = (typeof TIME_RANGE_OPTIONS)[number];

const DEFAULT_TIME_RANGE_VALUE = "today";

const getTimeRangeOption = (
	value: string | null | undefined,
): TimeRangeOption =>
	TIME_RANGE_OPTIONS.find((option) => option.value === value) ??
	TIME_RANGE_OPTIONS.find(
		(option) => option.value === DEFAULT_TIME_RANGE_VALUE,
	)!;

const getCurrentTimeRangeOption = () =>
	getTimeRangeOption(new URLSearchParams(window.location.search).get("span"));

const renderTimeRangeOptions = (selectedValue: string) =>
	TIME_RANGE_OPTIONS.map(
		(option) => `
			<option value="${escapeHtml(option.value)}" ${
				option.value === selectedValue ? "selected" : ""
			}>
				${escapeHtml(option.label)}
			</option>
		`,
	).join("");

export const formatShoppingDate = (value: string) =>
	new Intl.DateTimeFormat(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	}).format(new Date(value));

export const formatReceiptDateTime = (value: string) =>
	new Intl.DateTimeFormat(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(value));

const formatDuration = (totalSeconds: number) => {
	const seconds = Math.max(0, Math.floor(totalSeconds));
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainingSeconds = seconds % 60;
	if (hours > 0) {
		return `${hours}h ${String(minutes).padStart(2, "0")}m`;
	}
	if (minutes > 0) {
		return `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`;
	}
	return `${remainingSeconds}s`;
};

const timeEntryDurationSeconds = (entry: TimeEntry) => {
	const end = entry.ended_at ? Date.parse(entry.ended_at) : Date.now();
	return Math.max(0, Math.floor((end - Date.parse(entry.started_at)) / 1000));
};

const formatDateTimeLocalInput = (date = new Date()) =>
	new Date(date.getTime() - date.getTimezoneOffset() * 60000)
		.toISOString()
		.slice(0, 16);

const formatTimestampForDateTimeLocalInput = (value: string) =>
	formatDateTimeLocalInput(new Date(value));

const parseDateTimeLocalInput = (value: string) => {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return null;
	}
	return date.toISOString();
};

export const formatMoney = (value: number | null, currency: string) => {
	if (value === null) {
		return "-";
	}

	try {
		return new Intl.NumberFormat(undefined, {
			style: "currency",
			currency,
		}).format(value);
	} catch {
		return `${value} ${currency}`;
	}
};

const normalizeGroupName = (name: string) => name.trim().toLowerCase();

export const attachExpirationPageEvents = () => {
	const results = document.getElementById("expiration-results");
	if (!results) {
		return;
	}

	results.addEventListener("click", async (event) => {
		const target = event.target;
		if (!(target instanceof HTMLElement)) {
			return;
		}

		const consumeButton = target.closest<HTMLButtonElement>(
			"[data-consume-expiration-item-id]",
		);
		if (!consumeButton) {
			return;
		}

		const itemId = Number(consumeButton.dataset.consumeExpirationItemId);
		if (!Number.isInteger(itemId)) {
			return;
		}

		const itemName = consumeButton.dataset.consumeExpirationItemName ?? "item";
		consumeButton.disabled = true;
		try {
			await updateInventoryItem(itemId, {
				consumed_at: new Date().toISOString(),
			});
			await loadExpirationPageData(`Consumed ${itemName}.`);
		} catch (error) {
			consumeButton.disabled = false;
			setStatus(
				"expiration-status",
				error instanceof Error
					? error.message
					: "Failed to consume inventory item.",
				true,
			);
		}
	});
};

const renderRecipeIngredientList = (ingredients: RecipeIngredient[]) => {
	if (!ingredients.length) {
		return '<div class="empty">No ingredients added yet.</div>';
	}

	return `
		<div class="recipe-ingredient-list">
			${ingredients
				.map((ingredient) => {
					return `
						<article class="recipe-ingredient-item">
							<button
								class="recipe-ingredient-item__select"
								type="button"
								data-edit-recipe-ingredient-id="${ingredient.id}"
								data-recipe-ingredient-name="${encodeURIComponent(ingredient.name)}"
								data-recipe-ingredient-quantity="${ingredient.quantity}"
								data-recipe-ingredient-unit="${encodeURIComponent(ingredient.unit)}"
								data-recipe-ingredient-optional="${ingredient.is_optional ? "true" : "false"}"
								data-recipe-ingredient-notes="${encodeURIComponent(ingredient.notes ?? "")}"
							>
								<div class="recipe-ingredient-item__main">
									<div class="recipe-ingredient-item__header">
										<strong>${escapeHtml(ingredient.name)}</strong>
										${ingredient.is_optional ? '<span class="tag tag--neutral">Optional</span>' : ""}
									</div>
									<div class="recipe-ingredient-item__meta">
										<span>${escapeHtml(String(ingredient.quantity))} ${escapeHtml(ingredient.unit)}</span>
										${
											(ingredient.ingredient?.default_unit ??
												ingredient.product?.default_unit) &&
											(ingredient.ingredient?.default_unit ??
												ingredient.product?.default_unit) !== ingredient.unit
												? `<span>Default unit: ${escapeHtml((ingredient.ingredient?.default_unit ?? ingredient.product?.default_unit) as string)}</span>`
												: ""
										}
									</div>
									${
										ingredient.product
											? `<div class="section-copy">Product link: ${escapeHtml(ingredient.product.name)}</div>`
											: ""
									}
									${
										ingredient.notes
											? `<div class="section-copy">${escapeHtml(ingredient.notes)}</div>`
											: ""
									}
								</div>
							</button>
							<button
								class="secondary"
								type="button"
								data-delete-recipe-ingredient-id="${ingredient.id}"
							>
								Remove
							</button>
						</article>
					`;
				})
				.join("")}
		</div>
	`;
};

export const renderRecipeDetail = (recipe: Recipe) => {
	const page = document.getElementById("recipe-detail-page");
	if (!page) {
		return;
	}
	const ingredients = recipe.ingredients ?? [];
	const recipeImages = recipe.recipe_images ?? [];

	const servingsLabel =
		recipe.servings === null
			? "-"
			: recipe.servings === 1
				? "1 serving"
				: `${recipe.servings} servings`;

	page.innerHTML = `
		<section class="page-heading page-heading--compact">
			<div>
				<h1 class="page-title">${recipe.name}</h1>
			</div>
			<a class="secondary action-link" href="/recipes" data-link>Back To Recipes</a>
		</section>

		<section class="workspace recipe-detail-grid">
			<div class="card panel">
				<h2>Images</h2>
				${
					recipeImages.length
						? `
							<div class="recipe-image-gallery">
								${recipeImages
									.map(
										(image) => `
											<article class="recipe-image-card">
												<img
													class="recipe-image-card__image"
													src="/api/recipes/${recipe.id}/pictures/${image.id}?updated=${encodeURIComponent(image.created_at)}"
													alt="${escapeHtml(image.file.filename ?? recipe.name)}"
												/>
												<div class="recipe-image-card__meta">
													<div>
														<strong>${escapeHtml(image.file.filename ?? `Image #${image.id}`)}</strong>
														<div class="section-copy">${formatReceiptDateTime(image.created_at)}</div>
													</div>
													<button
														class="secondary"
														type="button"
														data-delete-recipe-image-id="${image.id}"
													>
														Remove
													</button>
												</div>
											</article>
										`,
									)
									.join("")}
							</div>
						`
						: '<div class="empty">No recipe images uploaded yet.</div>'
				}
				<form id="recipe-picture-form" class="recipe-picture__form">
					${renderUploadDropzone({
						inputId: "recipe-picture-input",
						label: "Images",
						name: "picture",
						multiple: true,
						submitOnDrop: true,
						emptyText: "Choose one or more images or drop them here.",
					})}
					<div class="actions">
						<button class="secondary" type="submit">Upload Images</button>
					</div>
				</form>
				<h2>Summary</h2>
				<dl class="receipt-metadata">
					<div>
						<dt>Status</dt>
						<dd>${recipe.is_active ? "Active" : "Inactive"}</dd>
					</div>
					<div>
						<dt>Servings</dt>
						<dd>${servingsLabel}</dd>
					</div>
					<div>
						<dt>Created</dt>
						<dd>${formatReceiptDateTime(recipe.created_at)}</dd>
					</div>
					<div>
						<dt>Updated</dt>
						<dd>${formatReceiptDateTime(recipe.updated_at)}</dd>
					</div>
				</dl>
				<div id="recipe-picture-status" class="status"></div>
			</div>

			<div class="recipe-detail-stack">
				<div class="card panel">
					<section class="recipe-detail-section">
						<h2>Recipe Details</h2>
						<form id="recipe-detail-form">
							<label for="recipe-detail-name">
								Name
								<input
									id="recipe-detail-name"
									name="name"
									value="${escapeHtml(recipe.name)}"
									required
								/>
							</label>

							<div class="row">
								<label for="recipe-detail-servings">
									Servings
									<input
										id="recipe-detail-servings"
										name="servings"
										type="number"
										inputmode="numeric"
										min="1"
										step="1"
										value="${recipe.servings ?? ""}"
										placeholder="4"
									/>
								</label>

								<label class="checkbox-toggle recipe-form__toggle" for="recipe-detail-is-active">
									<input
										id="recipe-detail-is-active"
										name="is_active"
										type="checkbox"
										${recipe.is_active ? "checked" : ""}
									/>
									<span>Active recipe</span>
								</label>
							</div>

							<label for="recipe-detail-description">
								Description
								<textarea
									id="recipe-detail-description"
									name="description"
									rows="4"
									placeholder="Short summary of the recipe"
								>${escapeHtml(recipe.description ?? "")}</textarea>
							</label>

							<label for="recipe-detail-instructions">
								Instructions
								<textarea
									id="recipe-detail-instructions"
									name="instructions"
									rows="10"
									placeholder="Describe the cooking steps"
								>${escapeHtml(recipe.instructions ?? "")}</textarea>
							</label>

							<div class="actions">
								<button class="primary" type="submit">Save Recipe</button>
							</div>
						</form>
						<div id="recipe-detail-status" class="status"></div>
					</section>
				</div>

				<div class="card panel">
					<section class="recipe-detail-section">
						<div class="section-header recipe-detail-section__header">
							<div class="recipe-ingredient-summary">
								<h2>Ingredients</h2>
								<span class="tag tag--neutral">
									${ingredients.length} ${ingredients.length === 1 ? "item" : "items"}
								</span>
							</div>
							<button
								class="primary"
								type="button"
								id="open-recipe-ingredient-modal-button"
							>
								Add Ingredient
							</button>
						</div>
						${renderRecipeIngredientList(ingredients)}
						<div id="recipe-ingredient-status" class="status"></div>
					</section>
				</div>
			</div>
		</section>

		<div class="recipe-ingredient-modal" id="recipe-ingredient-modal" hidden>
			<div
				class="recipe-ingredient-modal__backdrop"
				data-recipe-ingredient-modal-close
			></div>
			<div
				class="recipe-ingredient-modal__dialog card panel"
				role="dialog"
				aria-modal="true"
				aria-labelledby="recipe-ingredient-modal-title"
			>
				<div class="section-header section-header--end">
					<h2 id="recipe-ingredient-modal-title">Add Ingredient</h2>
					<button
						class="secondary"
						type="button"
						aria-label="Close add ingredient modal"
						data-recipe-ingredient-modal-close
					>
						Close
					</button>
				</div>
				<form id="recipe-ingredient-modal-form" class="recipe-ingredient-form">
					<input id="recipe-ingredient-id" name="ingredient_id" type="hidden" />
					<label for="recipe-ingredient-name">
						Ingredient
						<input
							id="recipe-ingredient-name"
							name="name"
							placeholder="Tomatoes"
							required
						/>
					</label>

					<div class="recipe-ingredient-form__row">
						<label for="recipe-ingredient-quantity">
							Quantity
							<input
								id="recipe-ingredient-quantity"
								name="quantity"
								type="number"
								inputmode="decimal"
								min="0.01"
								step="0.01"
								value="1"
								required
							/>
						</label>

						${renderUnitSelect({
							id: "recipe-ingredient-unit",
							name: "unit",
							label: "Unit",
							selectedValue: "pcs",
							required: true,
						})}

						<label class="checkbox-toggle recipe-ingredient-form__toggle" for="recipe-ingredient-optional">
							<input
								id="recipe-ingredient-optional"
								name="is_optional"
								type="checkbox"
							/>
							<span>Optional</span>
						</label>
					</div>

					<label for="recipe-ingredient-notes">
						Notes
						<input
							id="recipe-ingredient-notes"
							name="notes"
							placeholder="Finely chopped or room temperature"
						/>
					</label>

					<div class="actions">
						<button
							class="primary"
							id="recipe-ingredient-modal-submit"
							type="submit"
						>
							Add Ingredient
						</button>
					</div>
				</form>
				<div id="recipe-ingredient-modal-status" class="status"></div>
			</div>
		</div>
		`;

	attachUploadDropzones(page);
	attachRecipeDetailEvents(recipe.id);
};

const renderProductCard = (product: Product) => {
	const badge = product.is_perishable
		? '<span class="tag">Perishable</span>'
		: "";
	return `
		<a class="product" href="/products/${product.id}" data-link>
			<div class="product__media">
				<img class="product__image" src="/api/products/${product.id}/picture" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.parentElement.remove()" />
			</div>
			<header>
				<h3>${escapeHtml(product.name)}</h3>
				${badge}
			</header>
			<dl>
				<div>
					<dt>Category</dt>
					<dd>${escapeHtml(product.category ?? "-")}</dd>
				</div>
				<div>
					<dt>Barcode</dt>
					<dd>${escapeHtml(product.barcode ?? "-")}</dd>
				</div>
				<div>
					<dt>Unit</dt>
					<dd>${escapeHtml(product.default_unit ?? "-")}</dd>
				</div>
			</dl>
		</a>
	`;
};

const renderProducts = (products: Product[]) => {
	const results = document.getElementById("results");
	if (!results) {
		return;
	}

	productInfiniteScroll?.destroy();
	productInfiniteScroll = new InfiniteScroll(
		{
			batchSize: 12,
			emptyHtml: '<div class="empty">No products found.</div>',
			renderItem: (product) => renderProductCard(product),
			root: results,
		},
		products,
	);
	productInfiniteScroll.render();
};

export const renderProductDetail = (product: Product) => {
	const page = document.getElementById("product-detail-page");
	if (!page) {
		return;
	}

	const productPictureUpdated = product.picture_file?.created_at ?? null;
	const pictureUrl = productPictureUpdated
		? `/api/products/${product.id}/picture?updated=${encodeURIComponent(productPictureUpdated)}`
		: `/api/products/${product.id}/picture`;

	page.innerHTML = `
		<section class="page-heading page-heading--compact">
			<div>
				<span class="eyebrow">Product</span>
				<h1 class="page-title">${escapeHtml(product.name)}</h1>
			</div>
			<a class="secondary action-link" href="/products" data-link>Back To Products</a>
		</section>

		<section class="workspace product-detail-grid">
			<div class="card panel">
				<h2>Picture</h2>
				<div class="receipt-picture">
					<img
						class="receipt-picture__image"
						src="${pictureUrl}"
						alt="${escapeHtml(product.name)}"
						loading="lazy"
						onerror="this.closest('.receipt-picture').innerHTML='<div class=&quot;empty&quot;>No product picture uploaded.</div>'"
					/>
				</div>
				<form id="product-picture-form" class="product-picture__form">
					${renderUploadDropzone({
						inputId: "product-picture-input",
						label: "Picture",
						name: "picture",
						submitOnDrop: true,
						emptyText: "Choose a product image or drop one here.",
					})}
					<div class="actions">
						<button class="secondary" type="submit">Upload Picture</button>
						${
								product.picture_file
									? '<button class="secondary" type="button" id="product-picture-delete">Remove Picture</button>'
									: ""
						}
					</div>
				</form>
				<div id="product-picture-status" class="status"></div>
			</div>

			<div class="card panel">
				<div class="section-header">
					<h2>Details</h2>
					${
						product.is_perishable
							? '<span class="tag">Perishable</span>'
							: '<span class="tag tag--neutral">Shelf stable</span>'
					}
				</div>
				<form id="product-detail-form">
					<label>
						Name
						<input id="product-detail-name" value="${escapeHtml(product.name)}" required />
					</label>

					<div class="row">
						${renderProductCategoryInput({
							id: "product-detail-category",
							label: "Category",
							value: product.category,
							required: true,
						})}

						${renderUnitSelect({
							id: "product-detail-default-unit",
							name: "default_unit",
							label: "Unit",
							selectedValue: product.default_unit,
							placeholderLabel: "No default unit",
						})}
					</div>

					<label>
						Ingredient
						<input
							id="product-detail-ingredient-name"
							value="${escapeHtml(product.ingredient?.name ?? "")}"
							placeholder="Sausage"
						/>
					</label>

					<label>
						Barcode
						<input id="product-detail-barcode" value="${escapeHtml(product.barcode ?? "")}" placeholder="6414893400012" />
					</label>

					<label>
						Perishable
						<select id="product-detail-is-perishable">
							<option value="true" ${product.is_perishable ? "selected" : ""}>true</option>
							<option value="false" ${product.is_perishable ? "" : "selected"}>false</option>
						</select>
					</label>

					<div class="actions">
						<button class="primary" type="submit">Save Product</button>
					</div>
				</form>
				<dl class="receipt-metadata">
					<div>
						<dt>Ingredient Link</dt>
						<dd>${escapeHtml(product.ingredient?.name ?? "-")}</dd>
					</div>
					<div>
						<dt>Created</dt>
						<dd>${formatReceiptDateTime(product.created_at)}</dd>
					</div>
					<div>
						<dt>Updated</dt>
						<dd>${formatReceiptDateTime(product.updated_at)}</dd>
					</div>
				</dl>
				<div id="product-detail-status" class="status"></div>
			</div>
		</section>
	`;

	attachUploadDropzones(page);
};

const timeApiJson = async <T>(path: string, options: RequestInit = {}) => {
	const response = await fetch(path, {
		...options,
		headers: {
			...(options.body ? { "Content-Type": "application/json" } : {}),
			...(options.headers ?? {}),
		},
	});
	const body = (await response.json()) as T | { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Time tracking request failed")
				: "Time tracking request failed",
		);
	}

	return body as T;
};

const fetchTimeProjects = () =>
	timeApiJson<TimeProject[]>("/api/time-projects?sort=name&order=asc");

const fetchTimeEntries = () =>
	timeApiJson<TimeEntry[]>("/api/time-entries?sort=started_at&order=desc");

const stopTimeEntry = (id: number) =>
	timeApiJson<TimeEntry>(`/api/time-entries/${id}/stop`, {
		method: "POST",
		body: JSON.stringify({}),
	});

const createTimeProject = (name: string) =>
	timeApiJson<TimeProject>("/api/time-projects", {
		method: "POST",
		body: JSON.stringify({ name, archived_at: null }),
	});

const createTimeEntry = (values: {
	project_id: number;
	description: string | null;
	started_at: string;
	ended_at: string | null;
}) =>
	timeApiJson<TimeEntry>("/api/time-entries", {
		method: "POST",
		body: JSON.stringify(values),
	});

const timeRangeQuery = (option: TimeRangeOption) => {
	const params = new URLSearchParams();
	const now = new Date();
	params.set("to", now.toISOString());
	if (option.value === "all") {
		params.delete("to");
		params.set("range", "all");
		return params;
	}
	if (option.value === "today") {
		const start = new Date(now);
		start.setHours(0, 0, 0, 0);
		params.set("from", start.toISOString());
		return params;
	}
	const days = Number.parseInt(option.value, 10);
	params.set(
		"from",
		new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString(),
	);
	return params;
};

const fetchTimeReport = (option: TimeRangeOption) =>
	timeApiJson<TimeReport>(`/api/time-report?${timeRangeQuery(option).toString()}`);

const renderTimeProjectOptions = (
	projects: TimeProject[],
	selectedId?: number | null,
) =>
	projects
		.filter((project) => project.archived_at === null || project.id === selectedId)
		.map(
			(project) => `
				<option value="${project.id}" ${project.id === selectedId ? "selected" : ""}>
					${escapeHtml(project.name)}
				</option>
			`,
		)
		.join("");

const normalizeTimeDescription = (description: string | null | undefined) =>
	description?.trim() ?? "";

const normalizeTimeProjectName = (name: string) => name.trim().toLowerCase();
const NEW_TIME_PROJECT_VALUE = "__new_time_project__";

const buildTimeProjectChoices = (
	entries: TimeEntry[],
	projects: TimeProject[],
): TimeProjectChoice[] => {
	const choiceByProjectId = new Map<number, TimeProjectChoice>();
	for (const project of projects) {
		if (project.archived_at !== null) continue;
		choiceByProjectId.set(project.id, {
			project,
			entry_count: 0,
			total_seconds: 0,
			latest_started_at: null,
		});
	}

	for (const entry of entries) {
		const choice = choiceByProjectId.get(entry.project_id);
		if (!choice) continue;
		choice.entry_count += 1;
		choice.total_seconds += timeEntryDurationSeconds(entry);
		if (
			choice.latest_started_at === null ||
			Date.parse(entry.started_at) > Date.parse(choice.latest_started_at)
		) {
			choice.latest_started_at = entry.started_at;
		}
	}

	return [...choiceByProjectId.values()].sort((first, second) => {
		if (second.entry_count !== first.entry_count) {
			return second.entry_count - first.entry_count;
		}
		if (second.total_seconds !== first.total_seconds) {
			return second.total_seconds - first.total_seconds;
		}
		const latestDifference =
			Date.parse(second.latest_started_at ?? "1970-01-01T00:00:00.000Z") -
			Date.parse(first.latest_started_at ?? "1970-01-01T00:00:00.000Z");
		if (latestDifference !== 0) return latestDifference;
		return first.project.name.localeCompare(second.project.name);
	});
};

const findTimeProjectChoice = (name: string) => {
	const normalizedName = normalizeTimeProjectName(name);
	return currentTimeProjectChoices.find(
		(choice) => normalizeTimeProjectName(choice.project.name) === normalizedName,
	);
};

const findTimeProjectChoiceById = (id: number) =>
	currentTimeProjectChoices.find((choice) => choice.project.id === id);

const renderTimeProjectSelectOptions = (
	choices: TimeProjectChoice[],
	selectedId?: number | null,
) =>
	choices
		.map(
			(choice) => `
				<option value="${choice.project.id}" ${choice.project.id === selectedId ? "selected" : ""}>
					${escapeHtml(choice.project.name)}
				</option>
			`,
		)
		.join("");

export const defaultTimeEntryCreateRange = () => {
	const endedAt = new Date();
	const startedAt = new Date(endedAt.getTime() - 60 * 60 * 1000);
	return {
		startedAt: formatDateTimeLocalInput(startedAt),
		endedAt: formatDateTimeLocalInput(endedAt),
	};
};

export const timeEntryCreateProjectOptions = () =>
	currentTimeProjectChoices.map((choice) => ({
		value: String(choice.project.id),
		label: choice.project.name,
	}));

export const addTimeEntryFromPage = async (values: {
	projectName: string;
	description: string | null;
	startedAt: string;
	endedAt: string | null;
}) => {
	const projectName = values.projectName.trim();
	const startedAt = parseDateTimeLocalInput(values.startedAt);
	const endedAt = values.endedAt?.trim()
		? parseDateTimeLocalInput(values.endedAt)
		: null;

	if (!projectName) {
		throw new Error("Project is required.");
	}
	if (!startedAt || (values.endedAt?.trim() && !endedAt)) {
		throw new Error("Entry times are invalid.");
	}

	const project =
		findTimeProjectChoice(projectName)?.project ??
		(await createTimeProject(projectName));
	if (!findTimeProjectChoiceById(project.id)) {
		currentTimeProjectChoices.push({
			project,
			entry_count: 0,
			total_seconds: 0,
			latest_started_at: null,
		});
	}

	await createTimeEntry({
		project_id: project.id,
		description: values.description?.trim() || null,
		started_at: startedAt,
		ended_at: endedAt,
	});
	setStatus("time-status", "Entry added.");
	await loadTimeTrackingPage();
};

const buildTimeQuickActions = (
	entries: TimeEntry[],
	projects: TimeProject[],
): TimeQuickAction[] => {
	const projectById = new Map(projects.map((project) => [project.id, project]));
	const activeProjectIds = new Set(
		projects
			.filter((project) => project.archived_at === null)
			.map((project) => project.id),
	);
	const actionByKey = new Map<string, TimeQuickAction>();

	for (const entry of entries) {
		if (!activeProjectIds.has(entry.project_id)) continue;
		const description = normalizeTimeDescription(entry.description);
		const key = `${entry.project_id}\u0000${description}`;
		const existing = actionByKey.get(key);
		if (existing) {
			existing.entry_count += 1;
			existing.total_seconds += timeEntryDurationSeconds(entry);
			if (Date.parse(entry.started_at) > Date.parse(existing.latest_started_at)) {
				existing.latest_started_at = entry.started_at;
			}
			continue;
		}
		actionByKey.set(key, {
			project_id: entry.project_id,
			description,
			entry_count: 1,
			latest_started_at: entry.started_at,
			total_seconds: timeEntryDurationSeconds(entry),
			project: entry.project ?? projectById.get(entry.project_id),
		});
	}

	return [...actionByKey.values()]
		.sort((first, second) => {
			if (second.entry_count !== first.entry_count) {
				return second.entry_count - first.entry_count;
			}
			return (
				Date.parse(second.latest_started_at) -
				Date.parse(first.latest_started_at)
			);
		})
		.slice(0, 8);
};

const findPreviousTimeEntryEnd = (
	entries: TimeEntry[],
	runningEntry: TimeEntry | null,
) => {
	if (!runningEntry) return null;
	const previousEntry = entries
		.filter((entry) => entry.id !== runningEntry.id && entry.ended_at !== null)
		.sort(
			(first, second) =>
				Date.parse(second.ended_at ?? "") - Date.parse(first.ended_at ?? ""),
		)[0];
	return previousEntry?.ended_at ?? null;
};

const renderTimeTimer = (
	runningEntry: TimeEntry | null,
	previousEndedAt: string | null,
) => {
	const root = document.getElementById("time-timer-panel");
	if (!root) return;

	root.innerHTML = `
		<div class="section-header">
			<h2>Start Timer</h2>
			${runningEntry ? '<span class="tag">Running</span>' : '<span class="tag tag--neutral">Stopped</span>'}
		</div>
		${runningEntry
			? `
				<div class="time-running">
					<div class="time-running__project">
						<span class="time-color" style="--time-color: ${escapeHtml(runningEntry.project?.color ?? "#2d7c6f")}"></span>
						<strong>${escapeHtml(runningEntry.project?.name ?? "Project")}</strong>
					</div>
					<div id="running-timer-duration" class="time-running__duration">
						${formatDuration(timeEntryDurationSeconds(runningEntry))}
					</div>
					${runningEntry.description ? `<p class="section-copy">${escapeHtml(runningEntry.description)}</p>` : ""}
					<div class="time-running__actions">
						<button class="secondary" type="button" data-time-running-edit-open>Edit</button>
						<button class="primary" type="button" id="time-stop-button" data-time-entry-id="${runningEntry.id}">Stop</button>
					</div>
				</div>
				<div class="time-entry-edit-modal" id="time-running-edit-modal" hidden>
					<div
						class="time-entry-edit-modal__backdrop"
						data-time-running-edit-modal-close
					></div>
					<div
						class="time-entry-edit-modal__dialog card panel"
						role="dialog"
						aria-modal="true"
						aria-labelledby="time-running-edit-modal-title"
					>
						<div class="section-header">
							<h2 id="time-running-edit-modal-title">Edit Timer</h2>
							<button
								class="secondary"
								type="button"
								aria-label="Close edit timer modal"
								data-time-running-edit-modal-close
							>
								Close
							</button>
						</div>
						<form class="time-running__start-form" id="time-running-start-form" data-time-entry-id="${runningEntry.id}">
							<label>
								Project
								<select id="time-running-project-select" aria-label="Running timer project" required>
									${renderTimeProjectSelectOptions(currentTimeProjectChoices, runningEntry.project_id)}
								</select>
							</label>
							<label>
								Description
								<input
									id="time-running-description"
									value="${escapeHtml(runningEntry.description ?? "")}"
									placeholder="What are you working on?"
									autocomplete="off"
								/>
							</label>
							<label>
								Started At
								<input
									id="time-running-started-at"
									type="datetime-local"
									value="${formatTimestampForDateTimeLocalInput(runningEntry.started_at)}"
									required
								/>
							</label>
							${previousEndedAt
								? `<div>
									<button
										class="secondary"
										type="button"
										data-time-running-previous-ended-at="${escapeHtml(previousEndedAt)}"
									>
										Set start to previous end
									</button>
									<div class="section-copy">Previous end: ${formatReceiptDateTime(previousEndedAt)}</div>
								</div>`
								: ""}
							<div class="actions">
								<button class="primary" type="submit">Update Timer</button>
							</div>
						</form>
					</div>
				</div>
			`
			: ""}
			<form id="time-entry-start-form" class="time-start-form">
				<label>
					Project
					<select id="time-entry-project-select" aria-label="Project">
						<option value="">Choose or create a project</option>
						${renderTimeProjectSelectOptions(currentTimeProjectChoices)}
						<option value="${NEW_TIME_PROJECT_VALUE}">Create new project...</option>
					</select>
				</label>
				<label>
					Description
				<input id="time-entry-description" placeholder="What are you working on?" autocomplete="off" />
			</label>
			<button class="primary" type="submit">Start Timer</button>
		</form>
	`;

	if (timeTimerInterval !== null) {
		window.clearInterval(timeTimerInterval);
		timeTimerInterval = null;
	}
	if (runningEntry) {
		timeTimerInterval = window.setInterval(() => {
			const duration = document.getElementById("running-timer-duration");
			if (duration) {
				duration.textContent = formatDuration(timeEntryDurationSeconds(runningEntry));
			}
		}, 1000);
	}
};

const renderTimeQuickActions = (actions: TimeQuickAction[]) => {
	const root = document.getElementById("time-quick-actions");
	if (!root) return;
	if (!actions.length) {
		root.innerHTML = '<div class="empty">No repeated timers yet.</div>';
		return;
	}

	root.innerHTML = actions
		.map(
			(action) => `
				<div class="time-action-row">
					<div class="time-action-row__main">
						<div class="time-entry-row__title">
							<span class="time-color" style="--time-color: ${escapeHtml(action.project?.color ?? "#2d7c6f")}"></span>
							<strong>${escapeHtml(action.project?.name ?? "Project")}</strong>
						</div>
						<div class="time-entry-row__description">
							${action.description ? escapeHtml(action.description) : "No description"}
						</div>
						<div class="section-copy">
							${action.entry_count} entr${action.entry_count === 1 ? "y" : "ies"} - ${formatDuration(action.total_seconds)}
						</div>
					</div>
					<button
						class="secondary"
						type="button"
						data-start-time-project-id="${action.project_id}"
						data-start-time-description="${escapeHtml(action.description)}"
					>
						Start
					</button>
				</div>
			`,
		)
		.join("");
};

const renderTimeProjects = (projects: TimeProject[]) => {
	const root = document.getElementById("time-project-results");
	if (!root) return;
	if (!projects.length) {
		root.innerHTML = '<div class="empty">No time projects yet.</div>';
		return;
	}

	root.innerHTML = projects
		.map(
			(project) => `
				<div class="time-project-row ${project.archived_at ? "time-project-row--archived" : ""}">
					<span class="time-color" style="--time-color: ${escapeHtml(project.color)}"></span>
					<input data-time-project-name="${project.id}" value="${escapeHtml(project.name)}" aria-label="Project name" />
					<input data-time-project-color="${project.id}" value="${escapeHtml(project.color)}" aria-label="Project color" />
					<button class="secondary" type="button" data-save-time-project-id="${project.id}">Save</button>
					<button class="secondary" type="button" data-archive-time-project-id="${project.id}" ${project.archived_at ? "disabled" : ""}>Archive</button>
				</div>
			`,
		)
		.join("");
};

const renderTimeEntries = (entries: TimeEntry[], projects: TimeProject[]) => {
	const root = document.getElementById("time-entry-results");
	if (!root) return;
	const recentEntries = entries.slice(0, 30);
	if (!recentEntries.length) {
		root.innerHTML = '<div class="empty">No time entries yet.</div>';
		return;
	}

	root.innerHTML = recentEntries
		.map((entry) => {
			const description = normalizeTimeDescription(entry.description);
			const startedAt = formatTimestampForDateTimeLocalInput(entry.started_at);
			const endedAt = entry.ended_at
				? formatTimestampForDateTimeLocalInput(entry.ended_at)
				: "";
			const project =
				entry.project ?? projects.find((item) => item.id === entry.project_id);
			const projectName = project?.name ?? "Project";
			const projectColor = project?.color ?? "#2d7c6f";
			const duration = entry.ended_at
				? formatDuration(timeEntryDurationSeconds(entry))
				: "Running";
			return `
				<div class="time-entry-row ${entry.ended_at ? "" : "time-entry-row--running"}" data-time-entry-row="${entry.id}">
					<div class="time-entry-row__summary" data-time-entry-summary="${entry.id}">
						<div class="time-entry-row__main">
							<div class="time-entry-row__header">
								<div class="time-entry-row__title">
									<span class="time-color" style="--time-color: ${escapeHtml(projectColor)}"></span>
									<strong>${escapeHtml(projectName)}</strong>
									<span class="tag ${entry.ended_at ? "tag--neutral" : ""}">
										${duration}
									</span>
								</div>
								<button class="secondary time-entry-row__edit" type="button" data-edit-time-entry-id="${entry.id}">Edit</button>
							</div>
							<div class="time-entry-row__description">
								${description ? escapeHtml(description) : "No description"}
							</div>
							<div class="section-copy">
								${formatReceiptDateTime(entry.started_at)}${entry.ended_at ? ` - ${formatReceiptDateTime(entry.ended_at)}` : ""}
							</div>
						</div>
						<div class="time-entry-row__actions">
							<button
								class="secondary"
								type="button"
								data-start-time-project-id="${entry.project_id}"
								data-start-time-description="${escapeHtml(description)}"
							>
								Start Again
							</button>
						</div>
					</div>
					<form class="time-entry-edit-form" data-time-entry-edit-form="${entry.id}" hidden>
						<label>
							Project
							<select data-time-entry-project="${entry.id}" aria-label="Entry project">
								${renderTimeProjectOptions(projects, entry.project_id)}
							</select>
						</label>
						<label>
							Description
							<input data-time-entry-description="${entry.id}" value="${escapeHtml(entry.description ?? "")}" aria-label="Entry description" />
						</label>
						<div class="row">
							<label>
								Start
								<input data-time-entry-started-at="${entry.id}" type="datetime-local" value="${startedAt}" required />
							</label>
							<label>
								End
								<input data-time-entry-ended-at="${entry.id}" type="datetime-local" value="${endedAt}" />
							</label>
						</div>
						<div class="actions">
							<button class="primary" type="button" data-save-time-entry-id="${entry.id}">Save</button>
							<button class="secondary" type="button" data-cancel-time-entry-id="${entry.id}">Cancel</button>
							<button class="secondary" type="button" data-delete-time-entry-id="${entry.id}">Delete</button>
						</div>
					</form>
				</div>
			`;
		})
		.join("");
};

const renderTimeReport = (report: TimeReport) => {
	const summaryRoot = document.getElementById("time-report-summary");
	const resultsRoot = document.getElementById("time-report-results");
	if (!summaryRoot || !resultsRoot) return;

	summaryRoot.innerHTML = `
		<div class="time-report-summary">
			<div>
				<span>Total</span>
				<strong>${formatDuration(report.total_seconds)}</strong>
			</div>
			<div>
				<span>Projects</span>
				<strong>${report.project_totals.length}</strong>
			</div>
		</div>
	`;

	if (!report.project_totals.length) {
		resultsRoot.innerHTML = '<div class="empty">No tracked time in this range.</div>';
		return;
	}

	resultsRoot.innerHTML = report.project_totals
		.map(
			(project) => `
				<div class="time-report-row">
					<div>
						<span class="time-color" style="--time-color: ${escapeHtml(project.project_color)}"></span>
						<strong>${escapeHtml(project.project_name)}</strong>
						<span class="section-copy">${project.entry_count} entr${project.entry_count === 1 ? "y" : "ies"}</span>
					</div>
					<strong>${formatDuration(project.total_seconds)}</strong>
				</div>
			`,
		)
		.join("");
};

export const loadTimeTrackingPage = async () => {
	try {
		setStatus("time-status", "Loading time tracking...");
		const [projects, entries] = await Promise.all([
			fetchTimeProjects(),
			fetchTimeEntries(),
		]);
		const runningEntry =
			entries.find((entry) => entry.ended_at === null) ?? null;
		currentTimeProjectChoices = buildTimeProjectChoices(entries, projects);
		renderTimeTimer(runningEntry, findPreviousTimeEntryEnd(entries, runningEntry));
		renderTimeQuickActions(buildTimeQuickActions(entries, projects));
		renderTimeEntries(entries, projects);
		setStatus("time-status", `Loaded ${entries.length} time entr${entries.length === 1 ? "y" : "ies"}.`);
	} catch (error) {
		setStatus(
			"time-status",
			error instanceof Error ? error.message : "Failed to load time tracking.",
			true,
		);
	}
};

const buildContainerChildren = (containers: InventoryContainer[]) => {
	const children = new Map<number | null, InventoryContainer[]>();

	for (const container of containers) {
		const parentId = container.parent_container_id ?? null;
		const siblings = children.get(parentId) ?? [];
		siblings.push(container);
		children.set(parentId, siblings);
	}

	for (const siblings of children.values()) {
		siblings.sort((left, right) => left.name.localeCompare(right.name));
	}

	return children;
};

const buildInventoryItemGroups = (items: InventoryItem[]) => {
	const groups = new Map<number | null, InventoryItem[]>();

	for (const item of items) {
		const containerId = item.container_id ?? null;
		const bucket = groups.get(containerId) ?? [];
		bucket.push(item);
		groups.set(containerId, bucket);
	}

	return groups;
};

const getInventoryItemMeta = (item: InventoryItem) => {
	const parts: string[] = [];

	if (item.product?.name && item.product.name !== item.name) {
		parts.push(`Product ${item.product.name}`);
	}
	if (item.ingredient?.name && item.ingredient.name !== item.name) {
		parts.push(`Ingredient ${item.ingredient.name}`);
	}
	if (item.purchased_at) {
		parts.push(`Bought ${formatReceiptDateTime(item.purchased_at)}`);
	}
	if (item.expires_at) {
		parts.push(`Expires ${formatReceiptDateTime(item.expires_at)}`);
	}
	if (item.consumed_at) {
		parts.push(`Consumed ${formatReceiptDateTime(item.consumed_at)}`);
	}
	if (item.notes) {
		parts.push(item.notes);
	}

	return parts.join(" • ");
};

export const renderInventoryItemNodeLink = (
	item: InventoryItem,
	options: { draggable?: boolean; showConsumeAction?: boolean } = {},
) => {
	const meta = getInventoryItemMeta(item);
	const isConsumed = item.consumed_at !== null;
	const draggableAttributes = options.draggable
		? `
			draggable="true"
			data-drag-kind="item"
			data-drag-id="${item.id}"
			data-source-container-id="${item.container_id ?? ""}"
		`
		: "";

	return `
		<div
			class="inventory-node inventory-node--item${isConsumed ? " inventory-node--consumed" : ""}"
			${draggableAttributes}
		>
			<a
				class="inventory-node__main inventory-node__link"
				href="/inventory/items/${item.id}"
				data-link
			>
				<strong>${escapeHtml(item.name)}</strong>
				<div class="inventory-node__meta">
					<span>${item.quantity} ${escapeHtml(item.unit)}</span>
					${meta ? `<span>${escapeHtml(meta)}</span>` : ""}
				</div>
			</a>
			${
				options.showConsumeAction
					? `
						<div class="inventory-node__actions">
							<button
								class="secondary inventory-node__button"
								type="button"
								data-consume-inventory-item-id="${item.id}"
							>
								Consume
							</button>
						</div>
					`
					: ""
			}
		</div>
	`;
};

const compareInventoryItemsByExpiration = (
	left: InventoryItem,
	right: InventoryItem,
) => {
	if (left.expires_at && right.expires_at) {
		const dateComparison =
			Date.parse(left.expires_at) - Date.parse(right.expires_at);
		if (dateComparison !== 0) {
			return dateComparison;
		}
	}
	if (left.expires_at) return -1;
	if (right.expires_at) return 1;
	return left.name.localeCompare(right.name);
};

const getExpirationTag = (item: InventoryItem) => {
	if (!item.expires_at) {
		return {
			className: "tag tag--neutral",
			label: "No date",
		};
	}

	const now = new Date();
	const today = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
	).getTime();
	const expires = new Date(item.expires_at);
	const expiresDay = new Date(
		expires.getFullYear(),
		expires.getMonth(),
		expires.getDate(),
	).getTime();
	const daysUntilExpiration = Math.round(
		(expiresDay - today) / 86_400_000,
	);

	if (daysUntilExpiration < 0) {
		return {
			className: "tag tag--danger",
			label: "Expired",
		};
	}
	if (daysUntilExpiration === 0) {
		return {
			className: "tag tag--warning",
			label: "Today",
		};
	}
	if (daysUntilExpiration <= 3) {
		return {
			className: "tag tag--warning",
			label: `${daysUntilExpiration}d`,
		};
	}
	return {
		className: "tag",
		label: `${daysUntilExpiration}d`,
	};
};

const getInventoryItemLocation = (
	item: InventoryItem,
	containersById: Map<number, string>,
) =>
	item.container_id === null
		? "Top level"
		: (containersById.get(item.container_id) ?? "Unknown container");

const renderExpirationItem = (
	item: InventoryItem,
	containersById: Map<number, string>,
	options: { showConsumeAction?: boolean } = {},
) => {
	const tag = getExpirationTag(item);
	const location = getInventoryItemLocation(item, containersById);

	return `
		<div class="inventory-expiration-item">
			<a
				class="inventory-expiration-item__main"
				href="/inventory/items/${item.id}"
				data-link
			>
				<strong>${escapeHtml(item.name)}</strong>
				<div class="inventory-node__meta">
					<span>${item.quantity} ${escapeHtml(item.unit)}</span>
					<span>${escapeHtml(location)}</span>
					<span>${
						item.expires_at
							? `Expires ${formatReceiptDateTime(item.expires_at)}`
							: "No expiration date"
					}</span>
				</div>
			</a>
			<div class="inventory-expiration-item__actions">
				<span class="${tag.className}">${escapeHtml(tag.label)}</span>
				${
					options.showConsumeAction
						? `
							<button
								class="secondary inventory-node__button"
								type="button"
								data-consume-expiration-item-id="${item.id}"
								data-consume-expiration-item-name="${escapeHtml(item.name)}"
							>
								Consume
							</button>
						`
						: ""
				}
			</div>
		</div>
	`;
};

const createContainerNameMap = (containers: InventoryContainer[]) =>
	new Map(containers.map((container) => [container.id, container.name]));

const sortInventoryItemsByExpiration = (items: InventoryItem[]) =>
	[...items].sort(compareInventoryItemsByExpiration);

const getInventoryModeLabel = (mode: InventoryItemMode) => {
	switch (mode) {
		case "consumed":
			return "consumed";
		case "all":
			return "total";
		case "active":
		default:
			return "active";
	}
};

const getInventoryEmptyMessage = (mode: InventoryItemMode) => {
	switch (mode) {
		case "consumed":
			return "No consumed inventory items.";
		case "all":
			return "No inventory items.";
		case "active":
		default:
			return "No active inventory items.";
	}
};

const renderExpirationPreview = (
	containers: InventoryContainer[],
	items: InventoryItem[],
) => {
	const root = document.getElementById("dashboard-expiration-list");
	if (!root) {
		return;
	}

	if (!items.length) {
		root.innerHTML = '<div class="empty">No active inventory items.</div>';
		return;
	}

	const containersById = createContainerNameMap(containers);
	const sortedItems = sortInventoryItemsByExpiration(items).slice(0, 5);

	root.innerHTML = `
		<div class="inventory-expiration-list">
			${sortedItems
				.map((item) => renderExpirationItem(item, containersById))
				.join("")}
		</div>
	`;
};

const renderExpirationResults = (
	containers: InventoryContainer[],
	items: InventoryItem[],
) => {
	const root = document.getElementById("expiration-results");
	if (!root) {
		return;
	}

	const containersById = createContainerNameMap(containers);
	expirationInfiniteScroll?.destroy();
	expirationInfiniteScroll = new InfiniteScroll(
		{
			batchSize: 20,
			emptyHtml: '<div class="empty">No active inventory items.</div>',
			renderItem: (item) =>
				renderExpirationItem(item, containersById, { showConsumeAction: true }),
			root,
		},
		sortInventoryItemsByExpiration(items),
	);
	expirationInfiniteScroll.render();
};

const getLast30DaysReceipts = (receipts: PurchaseReceipt[]) => {
	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - 30);

	return receipts.filter(
		(receipt) => new Date(receipt.purchased_at).getTime() >= cutoff.getTime(),
	);
};

const getYearToDateReceipts = (receipts: PurchaseReceipt[]) => {
	const now = new Date();
	const yearStart = new Date(now.getFullYear(), 0, 1);
	return receipts.filter(
		(receipt) => new Date(receipt.purchased_at).getTime() >= yearStart.getTime(),
	);
};

const getSpendingTotalsByCurrency = (receipts: PurchaseReceipt[]) => {
	const totals = new Map<string, number>();

	for (const receipt of receipts) {
		if (receipt.total_amount === null) {
			continue;
		}
		totals.set(
			receipt.currency,
			(totals.get(receipt.currency) ?? 0) + receipt.total_amount,
		);
	}

	return [...totals.entries()].sort(([leftCurrency], [rightCurrency]) =>
		leftCurrency.localeCompare(rightCurrency),
	);
};

const renderSpendingTotalValues = (totals: Array<[string, number]>) =>
	totals.length
		? totals
				.map(
					([currency, total]) => `
						<strong>${formatMoney(total, currency)}</strong>
					`,
				)
				.join("")
		: "<strong>-</strong>";

const renderSpendingSummary = (
	receipts: PurchaseReceipt[],
	spendingBreakdown?: SpendingBreakdown,
) => {
	const root = document.getElementById("dashboard-spending-summary");
	if (!root) {
		return;
	}

	const recentReceipts = getLast30DaysReceipts(receipts);
	const yearToDateReceipts = getYearToDateReceipts(receipts);
	const last30DayTotals = getSpendingTotalsByCurrency(recentReceipts);
	const yearToDateTotals = getSpendingTotalsByCurrency(yearToDateReceipts);
	const averageMonthTotals =
		spendingBreakdown?.monthly_average_totals.map(
			(total) => [total.currency, total.total] as [string, number],
		) ?? [];
	const averageDayTotals =
		spendingBreakdown?.daily_average_totals.map(
			(total) => [total.currency, total.total] as [string, number],
		) ?? [];
	const currentMonthTotals =
		spendingBreakdown?.current_month_totals.map(
			(total) => [total.currency, total.total] as [string, number],
		) ?? [];
	const missingTotalCount = yearToDateReceipts.filter(
		(receipt) => receipt.total_amount === null,
	).length;

	if (!receipts.length) {
		root.innerHTML =
			'<div class="empty">No receipts recorded yet.</div>';
		return;
	}

	root.innerHTML = `
		<div class="dashboard-spending-summary">
			<div class="dashboard-spending-total">
				<span>Last 30 Days</span>
				<div class="dashboard-spending-total__values">
					${renderSpendingTotalValues(last30DayTotals)}
				</div>
			</div>
			<div class="dashboard-spending-total">
				<span>Average Month Spending</span>
				<div class="dashboard-spending-total__values">
					${renderSpendingTotalValues(averageMonthTotals)}
				</div>
			</div>
			<div class="dashboard-spending-total">
				<span>Average Daily Spending</span>
				<div class="dashboard-spending-total__values">
					${renderSpendingTotalValues(averageDayTotals)}
				</div>
			</div>
			<div class="dashboard-spending-total">
				<span>This Month Spending</span>
				<div class="dashboard-spending-total__values">
					${renderSpendingTotalValues(currentMonthTotals)}
				</div>
			</div>
			<div class="dashboard-spending-total">
				<span>Year To Date Spending</span>
				<div class="dashboard-spending-total__values">
					${renderSpendingTotalValues(yearToDateTotals)}
				</div>
			</div>
			${
				missingTotalCount
					? `<div class="section-copy">${missingTotalCount} year-to-date receipt(s) have no total amount.</div>`
					: ""
			}
		</div>
	`;
};

const renderDashboardTimer = (runningEntry: TimeEntry | null) => {
	const root = document.getElementById("dashboard-timer");
	if (!root) {
		return;
	}

	if (dashboardTimerInterval !== null) {
		window.clearInterval(dashboardTimerInterval);
		dashboardTimerInterval = null;
	}

	if (!runningEntry) {
		root.innerHTML = `
			<div class="dashboard-timer-empty">
				<div class="empty">No timer running.</div>
				<a class="primary action-link" href="/time" data-link>Start Timer</a>
			</div>
		`;
		return;
	}

	root.innerHTML = `
		<div class="time-running dashboard-timer-running">
			<div class="time-running__project">
				<span class="time-color" style="--time-color: ${escapeHtml(runningEntry.project?.color ?? "#2d7c6f")}"></span>
				<strong>${escapeHtml(runningEntry.project?.name ?? "No project")}</strong>
			</div>
			<div id="dashboard-running-timer-duration" class="time-running__duration">
				${formatDuration(timeEntryDurationSeconds(runningEntry))}
			</div>
			${runningEntry.description ? `<p class="section-copy">${escapeHtml(runningEntry.description)}</p>` : ""}
			<div class="time-running__actions">
				<a class="secondary action-link" href="/time" data-link>Edit</a>
				<button
					class="primary"
					type="button"
					data-dashboard-stop-time-entry-id="${runningEntry.id}"
				>
					Stop
				</button>
			</div>
		</div>
	`;

	dashboardTimerInterval = window.setInterval(() => {
		if (!root.isConnected) {
			window.clearInterval(dashboardTimerInterval ?? undefined);
			dashboardTimerInterval = null;
			return;
		}
		const duration = document.getElementById("dashboard-running-timer-duration");
		if (duration) {
			duration.textContent = formatDuration(timeEntryDurationSeconds(runningEntry));
		}
	}, 1000);
};

const renderDashboardShoppingList = (items: ShoppingListItem[]) => {
	const root = document.getElementById("dashboard-shopping-list");
	if (!root) {
		return;
	}

	const activeItems = items.slice(0, 8);
	if (!activeItems.length) {
		root.innerHTML = '<div class="empty">No active shoppinglist items.</div>';
		return;
	}

	root.innerHTML = `
		<div class="dashboard-shopping-list">
			${activeItems
				.map((item) => {
					const productPictureUrl = item.product?.picture_file_id
						? `/api/products/${item.product.id}/picture?updated=${encodeURIComponent(item.product.picture_file?.created_at ?? item.updated_at)}`
						: null;
					return `
						<a class="dashboard-shopping-item" href="/shoppinglist" data-link>
							${
								productPictureUrl
									? `<img class="dashboard-shopping-item__image" src="${productPictureUrl}" alt="${escapeHtml(item.product?.name ?? item.name)}" loading="lazy" onerror="this.remove()" />`
									: '<span class="dashboard-shopping-item__image dashboard-shopping-item__image--placeholder"></span>'
							}
							<div class="dashboard-shopping-item__main">
								<strong>${escapeHtml(item.name)}</strong>
								<span>${escapeHtml(`${item.quantity} ${item.unit}`.trim())}</span>
							</div>
						</a>
					`;
				})
				.join("")}
		</div>
	`;
};

const renderInventoryTree = (
	containers: InventoryContainer[],
	items: InventoryItem[],
) => {
	const root = document.getElementById("inventory-tree-root");
	if (!root) {
		return;
	}

	const containerChildren = buildContainerChildren(containers);
	const containerItems = buildInventoryItemGroups(items);
	const containerIds = new Set(containers.map((container) => container.id));
	collapsedInventoryContainerIds = new Set(
		[...collapsedInventoryContainerIds].filter((id) =>
			containerIds.has(id),
		),
	);

	const countNestedItems = (containerId: number): number => {
		const directItems = containerItems.get(containerId)?.length ?? 0;
		const nestedContainers = containerChildren.get(containerId) ?? [];
		return (
			directItems +
			nestedContainers.reduce(
				(total, container) => total + countNestedItems(container.id),
				0,
			)
		);
	};

	const renderInventoryItemNode = (item: InventoryItem) => {
		const isConsumed = item.consumed_at !== null;

		return `
			<li class="inventory-tree__leaf">
				${renderInventoryItemNodeLink(item, {
					draggable: !isConsumed,
					showConsumeAction: !isConsumed,
				})}
			</li>
		`;
	};

	const renderInventoryItemsList = (containerId: number | null) => {
		const bucket = containerItems.get(containerId) ?? [];
		if (!bucket.length) {
			return "";
		}

		const sortedItems = [...bucket].sort((left, right) => {
			return left.name.localeCompare(right.name);
		});

		return `
			<ul class="inventory-tree__items">
				${sortedItems.map((item) => renderInventoryItemNode(item)).join("")}
			</ul>
		`;
	};

	const renderContainerNode = (container: InventoryContainer): string => {
		const childContainers = containerChildren.get(container.id) ?? [];
		const hasChildren =
			childContainers.length > 0 ||
			(containerItems.get(container.id)?.length ?? 0) > 0;
		const itemCount = countNestedItems(container.id);
		const isCollapsed =
			hasChildren && collapsedInventoryContainerIds.has(container.id);

		return `
			<li class="inventory-tree__branch">
				<div
					class="inventory-node inventory-node--container inventory-drop-target"
					draggable="true"
					data-drag-kind="container"
					data-drag-id="${container.id}"
					data-drop-kind="container"
					data-drop-id="${container.id}"
				>
					<div class="inventory-node__main">
						<div class="inventory-node__title-row">
							${
								hasChildren
									? `
										<button
											class="inventory-node__toggle"
											type="button"
											aria-label="${isCollapsed ? "Expand" : "Collapse"} ${container.name}"
											aria-expanded="${isCollapsed ? "false" : "true"}"
											data-toggle-inventory-container-id="${container.id}"
										>
											${isCollapsed ? "▸" : "▾"}
										</button>
									`
									: '<span class="inventory-node__toggle-placeholder"></span>'
							}
							<strong>${container.name}</strong>
						</div>
						<div class="inventory-node__meta">
							<span>${itemCount === 1 ? "1 item" : `${itemCount} items`}</span>
							${container.notes ? `<span>${container.notes}</span>` : ""}
						</div>
					</div>
					<div class="inventory-node__actions">
						<a
							class="secondary action-link inventory-node__button"
							href="/inventory/containers/${container.id}"
							data-link
						>
							Open
						</a>
						<button
							class="secondary inventory-node__button"
							type="button"
							data-delete-inventory-container-id="${container.id}"
							data-delete-inventory-container-name="${container.name}"
						>
							Delete
						</button>
					</div>
				</div>
				${
					isCollapsed
						? ""
						: `
							<div class="inventory-tree__children">
								${renderInventoryItemsList(container.id)}
								${
									childContainers.length
										? `<ul class="inventory-tree__containers">${childContainers
												.map((child) =>
													renderContainerNode(child),
												)
												.join("")}</ul>`
										: ""
								}
								${
									!hasChildren
										? ""
										: ""
								}
							</div>
						`
				}
			</li>
		`;
	};

	const topLevelContainers = containerChildren.get(null) ?? [];
	const unplacedItems = containerItems.get(null) ?? [];
	const hasRootContent =
		unplacedItems.length > 0 || topLevelContainers.length > 0;

	root.innerHTML = `
		<div
			class="inventory-root inventory-drop-target"
			data-drop-kind="root"
			data-drop-id=""
		>
			<div class="inventory-tree__toolbar">
				<div id="inventory-status" class="status"></div>
				<select
					id="inventory-item-mode"
					class="inventory-tree__filter"
					aria-label="Inventory view"
				>
					<option value="active" ${inventoryItemMode === "active" ? "selected" : ""}>Active</option>
					<option value="consumed" ${inventoryItemMode === "consumed" ? "selected" : ""}>Consumed</option>
					<option value="all" ${inventoryItemMode === "all" ? "selected" : ""}>All</option>
				</select>
				<button
					class="primary inventory-node__button"
					type="button"
					data-open-inventory-container-modal
				>
					Add Container
				</button>
			</div>
			<div class="inventory-tree__root-content">
				${
					items.length
						? ""
						: `<div class="inventory-tree__empty">${getInventoryEmptyMessage(inventoryItemMode)}</div>`
				}
				${unplacedItems.length ? renderInventoryItemsList(null) : ""}
				${
					topLevelContainers.length
						? `<ul class="inventory-tree__containers inventory-tree__containers--root">${topLevelContainers
								.map((container) =>
									renderContainerNode(container),
								)
								.join("")}</ul>`
						: ""
				}
				${
					hasRootContent || !items.length
						? ""
						: `<div class="inventory-tree__empty">${getInventoryEmptyMessage(inventoryItemMode)}</div>`
				}
			</div>
		</div>
	`;
};

export const renderReceiptCard = (
	receipt: PurchaseReceipt,
	options: { className?: string; draggable?: boolean } = {},
) => `
	<a
		class="receipt-card${options.className ? ` ${options.className}` : ""}"
		href="/receipts/${receipt.id}"
		data-link
		${options.draggable === false ? "" : `draggable="true" data-receipt-drag-id="${receipt.id}"`}
	>
		<div class="receipt-card__header">
			<h3>${escapeHtml(receipt.store_name)}</h3>
			<div class="receipt-card__tags">
				${
					receipt.group
						? `<span class="tag">${escapeHtml(receipt.group.name)}</span>`
						: '<span class="tag tag--neutral">Ungrouped</span>'
				}
				<span class="tag tag--neutral">${escapeHtml(receipt.currency)}</span>
			</div>
		</div>
		<dl class="receipt-card__meta">
			<div>
				<dt>Purchased</dt>
				<dd>${formatReceiptDateTime(receipt.purchased_at)}</dd>
			</div>
			<div>
				<dt>Total</dt>
				<dd>${formatMoney(receipt.total_amount, receipt.currency)}</dd>
			</div>
		</dl>
	</a>
`;

const createReceiptTimelineEntries = (receipts: PurchaseReceipt[]) => {
	if (!receipts.length) {
		return [];
	}

	const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
	const entries: ReceiptTimelineEntry[] = [];
	let insertedCutoff = false;

	for (const receipt of receipts) {
		if (!insertedCutoff && Date.parse(receipt.purchased_at) < cutoff) {
			entries.push({ kind: "cutoff" });
			insertedCutoff = true;
		}

		entries.push({ kind: "receipt", receipt });
	}

	if (!insertedCutoff) {
		entries.push({ kind: "cutoff" });
	}

	return entries;
};

const renderReceiptCutoffMarker = () => `
	<div class="receipt-timeline__cutoff" role="note">
		<span class="receipt-timeline__cutoff-line"></span>
		<span class="tag">30-day spending counter cutoff</span>
		<span class="receipt-timeline__cutoff-line"></span>
	</div>
`;

const renderReceiptTimelineEntry = (entry: ReceiptTimelineEntry) =>
	entry.kind === "cutoff"
		? renderReceiptCutoffMarker()
		: renderReceiptCard(entry.receipt, {
				className: "receipt-card--timeline",
				draggable: false,
			});

const renderReceiptTimeline = (receipts: PurchaseReceipt[]) => {
	const results = document.getElementById("receipt-results");
	if (!results) {
		return;
	}

	receiptInfiniteScroll?.destroy();
	receiptInfiniteScroll = new InfiniteScroll(
		{
			batchSize: 20,
			emptyHtml: '<div class="empty">No receipts yet.</div>',
			renderItem: renderReceiptTimelineEntry,
			root: results,
		},
		createReceiptTimelineEntries(receipts),
	);
	receiptInfiniteScroll.render();
};

const renderReceiptBoard = (
	receipts: PurchaseReceipt[],
	groups: Group[] = [],
	selectedFilter = "all",
) => {
	const results = document.getElementById("receipt-results");
	if (!results) {
		return;
	}

	if (!receipts.length && !groups.length) {
		results.innerHTML = '<div class="empty">No receipts yet.</div>';
		return;
	}

	const visibleGroups =
		selectedFilter === "all"
			? groups
			: selectedFilter === "ungrouped"
				? []
				: groups.filter((group) => String(group.id) === selectedFilter);
	const showUngrouped =
		selectedFilter === "all" || selectedFilter === "ungrouped";
	const columns: Array<{ id: number | null; name: string }> = [
		...(showUngrouped ? [{ id: null, name: "Ungrouped" }] : []),
		...visibleGroups.map((group) => ({ id: group.id, name: group.name })),
	];

	results.innerHTML = `
		<div class="receipt-kanban">
			${columns
				.map((column) => {
					const columnReceipts = receipts.filter((receipt) =>
						column.id === null
							? receipt.group_id === null
							: receipt.group_id === column.id,
					);

					return `
						<section
							class="receipt-kanban__column receipt-drop-target"
							data-receipt-drop-group-id="${column.id ?? ""}"
						>
							<header class="receipt-kanban__header">
								<h3>
									${
										column.id === null
											? escapeHtml(column.name)
											: `<a class="receipt-kanban__title-link" href="/groups/${column.id}" data-link>${escapeHtml(column.name)}</a>`
									}
								</h3>
								<span class="tag tag--neutral">${columnReceipts.length}</span>
							</header>
							<div class="receipt-kanban__list">
								${
									columnReceipts.length
										? columnReceipts
												.map((receipt) => renderReceiptCard(receipt))
												.join("")
										: '<div class="receipt-kanban__empty">No receipts</div>'
								}
							</div>
						</section>
					`;
				})
				.join("")}
		</div>
	`;
};

const renderReceipts = (
	receipts: PurchaseReceipt[],
	groups: Group[] = [],
	selectedFilter = "all",
	viewMode: ReceiptViewMode = "board",
) => {
	receiptInfiniteScroll?.destroy();
	receiptInfiniteScroll = null;

	if (viewMode === "chronological") {
		renderReceiptTimeline(receipts);
		return;
	}

	renderReceiptBoard(receipts, groups, selectedFilter);
};

const renderReceiptGroupControls = (groups: Group[], selectedFilter: string) => {
	const groupOptions = document.getElementById("receipt-group-options");
	if (groupOptions instanceof HTMLDataListElement) {
		groupOptions.innerHTML = groups
			.map((group) => `<option value="${escapeHtml(group.name)}"></option>`)
			.join("");
	}

	const groupFilter = document.getElementById("receipt-group-filter");
	if (!(groupFilter instanceof HTMLSelectElement)) {
		return;
	}

	groupFilter.innerHTML = `
		<option value="all">All groups</option>
		<option value="ungrouped">Ungrouped</option>
		${groups
			.map(
				(group) =>
					`<option value="${group.id}">${escapeHtml(group.name)}</option>`,
			)
			.join("")}
	`;
	groupFilter.value = selectedFilter;
	if (groupFilter.value !== selectedFilter) {
		groupFilter.value = "all";
	}
};

const getReceiptGroupFilter = () => {
	const groupFilter = document.getElementById("receipt-group-filter");
	if (!(groupFilter instanceof HTMLSelectElement)) {
		return "all";
	}
	return groupFilter.value || "all";
};

export const getDefaultReceiptViewMode = (): ReceiptViewMode =>
	window.matchMedia("(max-width: 860px)").matches ? "chronological" : "board";

const getReceiptViewMode = (): ReceiptViewMode => {
	if (receiptViewModeOverride) {
		return receiptViewModeOverride;
	}
	const viewToggle = document.getElementById("receipt-chronological-view");
	if (viewToggle instanceof HTMLInputElement) {
		return viewToggle.checked ? "chronological" : "board";
	}
	return getDefaultReceiptViewMode();
};

export const renderReceiptDetail = (
	receipt: PurchaseReceipt,
	items: PurchaseReceiptItem[],
	products: Product[],
	groups: Group[],
) => {
	const page = document.getElementById("receipt-detail-page");
	if (!page) {
		return;
	}

	const productsById = new Map(
		products.map((product) => [product.id, product]),
	);
	const receiptPictureUpdated = receipt.picture_file?.created_at ?? null;
	const receiptPictureUrl = receiptPictureUpdated
		? `/api/receipts/${receipt.id}/picture?updated=${encodeURIComponent(receiptPictureUpdated)}`
		: `/api/receipts/${receipt.id}/picture`;

	page.innerHTML = `
		<section class="page-heading page-heading--compact">
			<div>
				<span class="eyebrow">Receipt</span>
				<h1 class="page-title">${escapeHtml(receipt.store_name)}</h1>
			</div>
			<a class="secondary action-link" href="/receipts" data-link>Back To Receipts</a>
		</section>

		<section class="workspace receipt-detail-grid">
			<div class="card panel">
				<h2>Original Picture</h2>
				<div class="receipt-picture">
					<button
						class="receipt-picture__trigger"
						type="button"
						aria-label="Open receipt picture in fullscreen"
					>
						<img
								class="receipt-picture__image"
								src="${receiptPictureUrl}"
								alt="${escapeHtml(receipt.store_name)}"
							loading="lazy"
							onerror="this.closest('.receipt-picture').innerHTML='<div class=&quot;empty&quot;>No receipt picture uploaded.</div>'"
						/>
					</button>
				</div>
			</div>

			<div class="card panel">
				<h2>Extracted Metadata</h2>
				<dl class="receipt-metadata">
					<div>
						<dt>Store</dt>
						<dd>${escapeHtml(receipt.store_name)}</dd>
					</div>
					<div>
						<dt>Group</dt>
						<dd>${
							receipt.group
								? `<span class="tag">${escapeHtml(receipt.group.name)}</span>`
								: "-"
						}</dd>
					</div>
					<div>
						<dt>Purchased</dt>
						<dd>${formatReceiptDateTime(receipt.purchased_at)}</dd>
					</div>
					<div>
						<dt>Currency</dt>
						<dd>${receipt.currency}</dd>
					</div>
					<div>
						<dt>Total</dt>
						<dd>${formatMoney(receipt.total_amount, receipt.currency)}</dd>
					</div>
					<div>
						<dt>Created</dt>
						<dd>${formatReceiptDateTime(receipt.created_at)}</dd>
					</div>
					<div>
						<dt>Updated</dt>
						<dd>${formatReceiptDateTime(receipt.updated_at)}</dd>
					</div>
				</dl>

				<h2>Group</h2>
				<form id="receipt-detail-group-form" class="receipt-group-form">
					<label>
						Group
						<input
							id="receipt-detail-group-name"
							list="receipt-detail-group-options"
							value="${escapeHtml(receipt.group?.name ?? "")}"
							placeholder="grocery"
						/>
						<datalist id="receipt-detail-group-options">
							${groups
								.map(
									(group) =>
										`<option value="${escapeHtml(group.name)}"></option>`,
								)
								.join("")}
						</datalist>
					</label>
					<div class="actions">
						<button class="primary" type="submit">Save Group</button>
						<button
							class="secondary"
							type="button"
							id="receipt-detail-clear-group"
						>
							Clear Group
						</button>
					</div>
				</form>
				<div id="receipt-detail-group-status" class="status"></div>

				<h2>Extracted Items</h2>
				${
					items.length
						? `
							<table class="shoppinglist-table">
								<thead>
									<tr>
										<th>Product Name</th>
										<th>Quantity</th>
										<th>Line Total</th>
									</tr>
								</thead>
								<tbody>
									${items
										.map((item) => {
											const productName =
												productsById.get(
													item.product_id,
												)?.name ??
												`Product #${item.product_id}`;

											return `
												<tr>
													<td>${productName}</td>
													<td>${item.quantity} ${item.unit}</td>
													<td>${item.line_total === null ? "-" : formatMoney(item.line_total, receipt.currency)}</td>
												</tr>
											`;
										})
										.join("")}
								</tbody>
							</table>
						`
						: '<div class="empty">No extracted line items yet.</div>'
				}
			</div>
		</section>

		<div class="receipt-modal" id="receipt-picture-modal" hidden>
			<div class="receipt-modal__backdrop" data-receipt-modal-close></div>
			<div
				class="receipt-modal__dialog"
				role="dialog"
				aria-modal="true"
				aria-label="Receipt picture"
			>
				<button
					class="receipt-modal__close"
					type="button"
					aria-label="Close receipt picture"
					data-receipt-modal-close
				>
					Close
				</button>
				<div class="receipt-modal__viewport">
					<img
						class="receipt-modal__image"
						src="/api/receipts/${receipt.id}/picture"
						alt="${escapeHtml(receipt.store_name)}"
						draggable="false"
					/>
				</div>
			</div>
		</div>
	`;
};

export const attachReceiptDetailEvents = (
	receipt: PurchaseReceipt,
	items: PurchaseReceiptItem[],
	products: Product[],
	groups: Group[],
) => {
	receiptDetailAbortController?.abort();
	receiptDetailAbortController = new AbortController();

	const rerenderReceiptDetail = (
		nextReceipt: PurchaseReceipt,
		nextGroups: Group[],
		statusMessage: string,
	) => {
		renderReceiptDetail(nextReceipt, items, products, nextGroups);
		attachReceiptDetailEvents(nextReceipt, items, products, nextGroups);
		setStatus("receipt-detail-group-status", statusMessage);
	};

	const groupForm = document.getElementById("receipt-detail-group-form");
	const groupNameInput = document.getElementById("receipt-detail-group-name");
	const clearGroupButton = document.getElementById("receipt-detail-clear-group");

	if (
		groupForm instanceof HTMLFormElement &&
		groupNameInput instanceof HTMLInputElement
	) {
		groupForm.addEventListener(
			"submit",
			async (event) => {
				event.preventDefault();

				const groupName = groupNameInput.value.trim();
				try {
					const group = groupName
						? await findOrCreateGroup(groupName, groups)
						: null;
					const updatedReceipt = await updateReceiptGroup(
						receipt.id,
						group?.id ?? null,
					);
					const nextGroups =
						group && !groups.some((existing) => existing.id === group.id)
							? [...groups, group].sort((left, right) =>
									left.name.localeCompare(right.name),
								)
							: groups;

					rerenderReceiptDetail(
						updatedReceipt,
						nextGroups,
						group ? `Saved group ${group.name}.` : "Cleared receipt group.",
					);
				} catch (error) {
					setStatus(
						"receipt-detail-group-status",
						error instanceof Error
							? error.message
							: "Failed to save receipt group",
						true,
					);
				}
			},
			{ signal: receiptDetailAbortController.signal },
		);
	}

	if (clearGroupButton instanceof HTMLButtonElement) {
		clearGroupButton.addEventListener(
			"click",
			async () => {
				try {
					const updatedReceipt = await updateReceiptGroup(receipt.id, null);
					rerenderReceiptDetail(
						updatedReceipt,
						groups,
						"Cleared receipt group.",
					);
				} catch (error) {
					setStatus(
						"receipt-detail-group-status",
						error instanceof Error
							? error.message
							: "Failed to clear receipt group",
						true,
					);
				}
			},
			{ signal: receiptDetailAbortController.signal },
		);
	}

	const trigger = document.querySelector<HTMLButtonElement>(
		".receipt-picture__trigger",
	);
	const modal = document.getElementById("receipt-picture-modal");
	const modalViewport = document.querySelector<HTMLDivElement>(
		".receipt-modal__viewport",
	);
	const modalImage = document.querySelector<HTMLImageElement>(
		".receipt-modal__image",
	);
	if (!trigger || !modal || !modalViewport || !modalImage) {
		return;
	}

	let scale = 1;
	let offsetX = 0;
	let offsetY = 0;
	let isPanning = false;
	let panStartX = 0;
	let panStartY = 0;

	const clampScale = (value: number) => Math.min(6, Math.max(1, value));
	const syncTransform = () => {
		if (scale <= 1) {
			offsetX = 0;
			offsetY = 0;
		}

		modalImage.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
		modalImage.style.cursor = isPanning
			? "grabbing"
			: scale > 1
				? "grab"
				: "zoom-in";
	};

	const resetTransform = () => {
		scale = 1;
		offsetX = 0;
		offsetY = 0;
		isPanning = false;
		syncTransform();
	};

	const closeModal = () => {
		modal.hidden = true;
		document.body.classList.remove("modal-open");
		resetTransform();
	};

	const openModal = () => {
		modal.hidden = false;
		document.body.classList.add("modal-open");
		resetTransform();
	};

	trigger.addEventListener("click", openModal, {
		signal: receiptDetailAbortController.signal,
	});

	modalViewport.addEventListener(
		"wheel",
		(event) => {
			event.preventDefault();

			const nextScale = clampScale(
				scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12),
			);
			if (nextScale === scale) {
				return;
			}

			const viewportRect = modalViewport.getBoundingClientRect();
			const cursorX = event.clientX - viewportRect.left;
			const cursorY = event.clientY - viewportRect.top;
			const imageX = (cursorX - offsetX) / scale;
			const imageY = (cursorY - offsetY) / scale;

			scale = nextScale;
			offsetX = cursorX - imageX * scale;
			offsetY = cursorY - imageY * scale;
			syncTransform();
		},
		{
			passive: false,
			signal: receiptDetailAbortController.signal,
		},
	);

	modalImage.addEventListener(
		"mousedown",
		(event) => {
			if (event.button !== 1 || scale <= 1) {
				return;
			}

			event.preventDefault();
			isPanning = true;
			panStartX = event.clientX - offsetX;
			panStartY = event.clientY - offsetY;
			syncTransform();
		},
		{ signal: receiptDetailAbortController.signal },
	);

	window.addEventListener(
		"mousemove",
		(event) => {
			if (!isPanning) {
				return;
			}

			offsetX = event.clientX - panStartX;
			offsetY = event.clientY - panStartY;
			syncTransform();
		},
		{ signal: receiptDetailAbortController.signal },
	);

	window.addEventListener(
		"mouseup",
		(event) => {
			if (event.button !== 1 || !isPanning) {
				return;
			}

			isPanning = false;
			syncTransform();
		},
		{ signal: receiptDetailAbortController.signal },
	);

	modal.addEventListener(
		"click",
		(event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) {
				return;
			}

			if (target.dataset.receiptModalClose !== undefined) {
				closeModal();
			}
		},
		{ signal: receiptDetailAbortController.signal },
	);

	window.addEventListener(
		"keydown",
		(event) => {
			if (event.key === "Escape" && !modal.hidden) {
				closeModal();
			}
		},
		{ signal: receiptDetailAbortController.signal },
	);

	resetTransform();
};

export const fetchAllProducts = async () => {
	const response = await fetch("/api/products");
	const body = (await response.json()) as Product[] | { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to load products")
				: "Failed to load products",
		);
	}

	return body as Product[];
};

export const fetchProduct = async (productId: number) => {
	const response = await fetch(`/api/products/${productId}`);
	const body = (await response.json()) as Product | { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to load product")
				: "Failed to load product",
		);
	}

	return body as Product;
};

export const fetchRecipe = async (recipeId: number) => {
	const response = await fetch(`/api/recipes/${recipeId}`);
	const body = (await response.json()) as Recipe | { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to load recipe")
				: "Failed to load recipe",
		);
	}

	return body as Recipe;
};

const createRecipeIngredient = async (payload: {
	recipe_id: number;
	name: string;
	ingredient_id: number | null;
	product_id: number | null;
	quantity: number;
	unit: string;
	is_optional: boolean;
	notes: string | null;
}) => {
	const response = await fetch("/api/recipe-ingredients", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	const body = (await response.json()) as
		| RecipeIngredient
		| { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to create recipe ingredient")
				: "Failed to create recipe ingredient",
		);
	}

	return body as RecipeIngredient;
};

const updateRecipeIngredient = async (
	ingredientId: number,
	payload: {
		name?: string;
		ingredient_id?: number | null;
		product_id?: number | null;
		quantity?: number;
		unit?: string;
		is_optional?: boolean;
		notes?: string | null;
	},
) => {
	const response = await fetch(`/api/recipe-ingredients/${ingredientId}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	const body = (await response.json()) as
		| RecipeIngredient
		| { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to update recipe ingredient")
				: "Failed to update recipe ingredient",
		);
	}

	return body as RecipeIngredient;
};

const deleteRecipeIngredient = async (ingredientId: number) => {
	const response = await fetch(`/api/recipe-ingredients/${ingredientId}`, {
		method: "DELETE",
	});

	if (response.status !== 204) {
		const body = (await response.json()) as { error?: string };
		throw new Error(body.error ?? "Failed to delete recipe ingredient");
	}
};

const deleteRecipeImage = async (recipeId: number, imageId: number) => {
	const response = await fetch(
		`/api/recipes/${recipeId}/pictures/${imageId}`,
		{
			method: "DELETE",
		},
	);

	if (response.status !== 204) {
		const body = (await response.json()) as { error?: string };
		throw new Error(body.error ?? "Failed to delete recipe image");
	}
};

const deleteInventoryItemImage = async (itemId: number, imageId: number) => {
	const response = await fetch(
		`/api/inventory-items/${itemId}/pictures/${imageId}`,
		{
			method: "DELETE",
		},
	);

	if (response.status !== 204) {
		const body = (await response.json()) as { error?: string };
		throw new Error(body.error ?? "Failed to delete inventory item image");
	}
};

const updateRecipe = async (
	recipeId: number,
	payload: {
		name?: string;
		description?: string | null;
		instructions?: string | null;
		servings?: number | null;
		is_active?: boolean;
	},
) => {
	const response = await fetch(`/api/recipes/${recipeId}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	const body = (await response.json()) as Recipe | { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to update recipe")
				: "Failed to update recipe",
		);
	}

	return body as Recipe;
};

const createRecipe = async (payload: {
	name: string;
	description: string | null;
	instructions: string | null;
	servings: number | null;
	is_active: boolean;
}) => {
	const response = await fetch("/api/recipes", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	const body = (await response.json()) as Recipe | { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to create recipe")
				: "Failed to create recipe",
		);
	}

	return body as Recipe;
};

export const fetchGroups = async () => {
	const response = await fetch("/api/groups?sort=name&order=asc");
	const body = (await response.json()) as Group[] | { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to load groups")
				: "Failed to load groups",
		);
	}

	return body as Group[];
};

const createGroup = async (name: string) => {
	const response = await fetch("/api/groups", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name }),
	});
	const body = (await response.json()) as Group | { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to create group")
				: "Failed to create group",
		);
	}

	return body as Group;
};

const findOrCreateGroup = async (name: string, groups: Group[]) => {
	const normalizedName = normalizeGroupName(name);
	const existingGroup = groups.find(
		(group) => normalizeGroupName(group.name) === normalizedName,
	);
	if (existingGroup) {
		return existingGroup;
	}

	try {
		return await createGroup(name);
	} catch (error) {
		const refreshedGroups = await fetchGroups();
		const refreshedGroup = refreshedGroups.find(
			(group) => normalizeGroupName(group.name) === normalizedName,
		);
		if (refreshedGroup) {
			return refreshedGroup;
		}
		throw error;
	}
};

export const fetchReceipts = async (groupFilter = "all") => {
	const params = new URLSearchParams({
		sort: "purchased_at",
		order: "desc",
	});
	if (groupFilter === "ungrouped") {
		params.set("group_id", "null");
	} else if (groupFilter !== "all") {
		params.set("group_id", groupFilter);
	}
	const response = await fetch(`/api/receipts?${params.toString()}`);
	const body = (await response.json()) as
		| PurchaseReceipt[]
		| { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to load receipts")
				: "Failed to load receipts",
		);
	}

	return body as PurchaseReceipt[];
};

const fetchGlobalSpendingBreakdown = async () => {
	const response = await fetch("/api/spending?range=all");
	const body = (await response.json()) as
		| SpendingBreakdown
		| { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to load spending")
				: "Failed to load spending",
		);
	}

	return body as SpendingBreakdown;
};

const fetchActiveShoppingListItems = async () => {
	const params = new URLSearchParams({
		done: "false",
		sort: "created_at",
		order: "asc",
	});
	const response = await fetch(`/api/shopping-list-items?${params.toString()}`);
	const body = (await response.json()) as
		| ShoppingListItem[]
		| { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to load shoppinglist items")
				: "Failed to load shoppinglist items",
		);
	}

	return body as ShoppingListItem[];
};

export const fetchReceipt = async (receiptId: number) => {
	const response = await fetch(`/api/receipts/${receiptId}`);
	const body = (await response.json()) as
		| PurchaseReceipt
		| { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to load receipt")
				: "Failed to load receipt",
		);
	}

	return body as PurchaseReceipt;
};

const updateReceiptGroup = async (
	receiptId: number,
	groupId: number | null,
) => {
	const response = await fetch(`/api/receipts/${receiptId}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ group_id: groupId }),
	});
	const body = (await response.json()) as
		| PurchaseReceipt
		| { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to update receipt group")
				: "Failed to update receipt group",
		);
	}

	return body as PurchaseReceipt;
};

export const fetchReceiptItems = async (receiptId: number) => {
	const response = await fetch(
		`/api/receipt-items?receipt_id=${encodeURIComponent(String(receiptId))}`,
	);
	const body = (await response.json()) as
		| PurchaseReceiptItem[]
		| { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to load receipt items")
				: "Failed to load receipt items",
		);
	}

	return body as PurchaseReceiptItem[];
};

export const fetchAllReceiptItems = async () => {
	const response = await fetch("/api/receipt-items?sort=created_at&order=desc");
	const body = (await response.json()) as
		| PurchaseReceiptItem[]
		| { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to load receipt rows")
				: "Failed to load receipt rows",
		);
	}

	return body as PurchaseReceiptItem[];
};

const fetchInventoryItems = async (mode: InventoryItemMode = "active") => {
	const response = await fetch(
		mode === "active"
			? "/api/inventory-items?consumed_at=null&sort=expires_at&order=asc"
			: "/api/inventory-items?sort=expires_at&order=asc",
	);
	const body = (await response.json()) as
		| InventoryItem[]
		| { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to load inventory items")
				: "Failed to load inventory items",
		);
	}

	const items = body as InventoryItem[];
	if (mode === "consumed") {
		return items.filter((item) => item.consumed_at !== null);
	}
	return items;
};

export const fetchInventoryItem = async (itemId: number) => {
	const response = await fetch(`/api/inventory-items/${itemId}`);
	const body = (await response.json()) as InventoryItem | { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to load inventory item")
				: "Failed to load inventory item",
		);
	}

	return body as InventoryItem;
};

export const fetchInventoryContainers = async () => {
	const response = await fetch(
		"/api/inventory-containers?sort=name&order=asc",
	);
	const body = (await response.json()) as
		| InventoryContainer[]
		| { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to load inventory containers")
				: "Failed to load inventory containers",
		);
	}

	return body as InventoryContainer[];
};

export const fetchInventoryContainer = async (containerId: number) => {
	const response = await fetch(`/api/inventory-containers/${containerId}`);
	const body = (await response.json()) as
		| InventoryContainer
		| { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to load inventory container")
				: "Failed to load inventory container",
		);
	}

	return body as InventoryContainer;
};

const createInventoryContainer = async (payload: {
	name: string;
	parent_container_id: number | null;
	notes: string | null;
}) => {
	const response = await fetch("/api/inventory-containers", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	const body = (await response.json()) as
		| InventoryContainer
		| { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to create inventory container")
				: "Failed to create inventory container",
		);
	}

	return body as InventoryContainer;
};

export const updateInventoryContainer = async (
	containerId: number,
	payload: {
		name?: string;
		parent_container_id?: number | null;
		notes?: string | null;
	},
) => {
	const response = await fetch(`/api/inventory-containers/${containerId}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	const body = (await response.json()) as
		| InventoryContainer
		| { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to update inventory container")
				: "Failed to update inventory container",
		);
	}

	return body as InventoryContainer;
};

const updateInventoryContainerParent = async (
	containerId: number,
	parentContainerId: number | null,
) => {
	const response = await fetch(`/api/inventory-containers/${containerId}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ parent_container_id: parentContainerId }),
	});
	const body = (await response.json()) as
		| InventoryContainer
		| { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to update inventory container")
				: "Failed to update inventory container",
		);
	}

	return body as InventoryContainer;
};

export const deleteInventoryContainer = async (containerId: number) => {
	const response = await fetch(`/api/inventory-containers/${containerId}`, {
		method: "DELETE",
	});

	if (response.status !== 204) {
		const body = (await response.json()) as { error?: string };
		throw new Error(body.error ?? "Failed to delete inventory container");
	}
};

const updateInventoryItem = async (
	itemId: number,
	payload: {
		ingredient_id?: number | null;
		product_id?: number | null;
		receipt_item_id?: number | null;
		consumed_at?: string | null;
	},
) => {
	const response = await fetch(`/api/inventory-items/${itemId}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	const body = (await response.json()) as InventoryItem | { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to update inventory item")
				: "Failed to update inventory item",
		);
	}

	return body as InventoryItem;
};

const updateInventoryItemContainer = async (
	itemId: number,
	containerId: number | null,
) => {
	const response = await fetch(`/api/inventory-items/${itemId}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ container_id: containerId }),
	});
	const body = (await response.json()) as InventoryItem | { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to update inventory item")
				: "Failed to update inventory item",
		);
	}

	return body as InventoryItem;
};

export const fetchInventoryItemsByContainer = async (containerId: number) => {
	const response = await fetch(
		`/api/inventory-items?container_id=${encodeURIComponent(String(containerId))}&consumed_at=null&sort=expires_at&order=asc`,
	);
	const body = (await response.json()) as
		| InventoryItem[]
		| { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to load inventory items")
				: "Failed to load inventory items",
		);
	}

	return body as InventoryItem[];
};

export const loadInventoryPageData = async (statusMessage?: string) => {
	try {
		const mode = inventoryItemMode;
		const [items, containers] = await Promise.all([
			fetchInventoryItems(mode),
			fetchInventoryContainers(),
		]);
		inventoryTreeState = { containers, items };
		renderInventoryTree(containers, items);
		setStatus(
			"inventory-status",
			statusMessage ??
				`Loaded ${items.length} ${getInventoryModeLabel(mode)} item(s) across ${containers.length} container(s).`,
		);
	} catch (error) {
		inventoryTreeState = { containers: [], items: [] };
		renderInventoryTree([], []);
		setStatus(
			"inventory-status",
			error instanceof Error
				? error.message
				: "Failed to load inventory.",
			true,
		);
	}
};

export const loadDashboardSpendingSummary = async () => {
	try {
		const [receipts, spendingBreakdown] = await Promise.all([
			fetchReceipts(),
			fetchGlobalSpendingBreakdown(),
		]);
		renderSpendingSummary(receipts, spendingBreakdown);
		setStatus("dashboard-spending-status", "");
	} catch (error) {
		renderSpendingSummary([]);
		setStatus(
			"dashboard-spending-status",
			error instanceof Error ? error.message : "Failed to load spending.",
			true,
		);
	}
};

export const loadDashboardTimer = async (statusMessage?: string) => {
	try {
		const entries = await fetchTimeEntries();
		const runningEntry =
			entries.find((entry) => entry.ended_at === null) ?? null;
		renderDashboardTimer(runningEntry);
		setStatus(
			"dashboard-timer-status",
			statusMessage ??
				(runningEntry
					? `Running since ${formatReceiptDateTime(runningEntry.started_at)}.`
					: "Timer is stopped."),
		);
	} catch (error) {
		renderDashboardTimer(null);
		setStatus(
			"dashboard-timer-status",
			error instanceof Error ? error.message : "Failed to load timer.",
			true,
		);
	}
};

export const loadDashboardShoppingList = async () => {
	try {
		const items = await fetchActiveShoppingListItems();
		renderDashboardShoppingList(items);
		setStatus(
			"dashboard-shopping-status",
			items.length
				? `${Math.min(items.length, 8)} of ${items.length} active item(s).`
				: "Shoppinglist is empty.",
		);
	} catch (error) {
		renderDashboardShoppingList([]);
		setStatus(
			"dashboard-shopping-status",
			error instanceof Error
				? error.message
				: "Failed to load shoppinglist items.",
			true,
		);
	}
};

export const loadDashboardExpirationPreview = async () => {
	try {
		const [items, containers] = await Promise.all([
			fetchInventoryItems(),
			fetchInventoryContainers(),
		]);
		renderExpirationPreview(containers, items);
		setStatus(
			"dashboard-expiration-status",
			items.length
				? `${Math.min(items.length, 5)} of ${items.length} active item(s).`
				: "No active inventory items.",
		);
	} catch (error) {
		renderExpirationPreview([], []);
		setStatus(
			"dashboard-expiration-status",
			error instanceof Error
				? error.message
				: "Failed to load expiration dates.",
			true,
		);
	}
};

export const loadExpirationPageData = async (statusMessage?: string) => {
	try {
		const [items, containers] = await Promise.all([
			fetchInventoryItems(),
			fetchInventoryContainers(),
		]);
		renderExpirationResults(containers, items);
		setStatus(
			"expiration-status",
			statusMessage ??
				(items.length
					? `Loaded ${items.length} active item(s).`
					: "No active inventory items."),
		);
	} catch (error) {
		renderExpirationResults([], []);
		setStatus(
			"expiration-status",
			error instanceof Error
				? error.message
				: "Failed to load expiration dates.",
			true,
		);
	}
};

export const loadProducts = async () => {
	const barcodeFilter = document.getElementById("barcode-filter");
	const searchType = document.getElementById("product-search-type");
	if (
		!(barcodeFilter instanceof HTMLInputElement) ||
		!(searchType instanceof HTMLSelectElement)
	) {
		return;
	}

	const search = barcodeFilter.value.trim();
	const buildQuery = (field: "barcode" | "name" | "name_contains") =>
		search ? `?${field}=${encodeURIComponent(search)}` : "";

	try {
		const selectedType = searchType.value;
		const initialField =
			selectedType === "barcode"
				? "barcode"
				: selectedType === "name"
					? "name"
					: selectedType === "includes"
						? "name_contains"
						: "barcode";

		const response = await fetch(
			`/api/products${buildQuery(initialField)}`,
		);
		const body = (await response.json()) as Product[] | { error?: string };

		if (!response.ok) {
			throw new Error(
				"error" in body
					? (body.error ?? "Failed to load products")
					: "Failed to load products",
			);
		}

		let products = body as Product[];
		if (search && products.length === 0 && selectedType === "auto") {
			const nameResponse = await fetch(
				`/api/products${buildQuery("name")}`,
			);
			const nameBody = (await nameResponse.json()) as
				| Product[]
				| { error?: string };

			if (!nameResponse.ok) {
				throw new Error(
					"error" in nameBody
						? (nameBody.error ?? "Failed to load products")
						: "Failed to load products",
				);
			}

			products = nameBody as Product[];
			if (products.length === 0) {
				const containsResponse = await fetch(
					`/api/products${buildQuery("name_contains")}`,
				);
				const containsBody = (await containsResponse.json()) as
					| Product[]
					| { error?: string };

				if (!containsResponse.ok) {
					throw new Error(
						"error" in containsBody
							? (containsBody.error ?? "Failed to load products")
							: "Failed to load products",
					);
				}

				products = containsBody as Product[];
			}
		}

		renderProducts(products);
		setStatus(
			"status",
			search
				? `Loaded ${products.length} matching product(s).`
				: `Loaded ${products.length} product(s).`,
		);
	} catch (error) {
		renderProducts([]);
		setStatus(
			"status",
			error instanceof Error ? error.message : "Failed to load products",
			true,
		);
	}
};

const uploadProductPicture = async (productId: number, file: File) => {
	const formData = new FormData();
	formData.set("file", file);

	const response = await fetch(`/api/products/${productId}/picture`, {
		method: "POST",
		body: formData,
	});
	const body = (await response.json()) as { error?: string };
	if (!response.ok) {
		throw new Error(body.error ?? "Failed to upload product picture");
	}
};

const deleteProductPicture = async (productId: number) => {
	const response = await fetch(`/api/products/${productId}/picture`, {
		method: "DELETE",
	});
	if (!response.ok) {
		const body = (await response.json()) as { error?: string };
		throw new Error(body.error ?? "Failed to remove product picture");
	}
};

const uploadReceiptPicture = async (receiptId: number, file: File) => {
	const formData = new FormData();
	formData.set("file", file);

	const response = await fetch(`/api/receipts/${receiptId}/picture`, {
		method: "POST",
		body: formData,
	});
	const body = (await response.json()) as { error?: string };
	if (!response.ok) {
		throw new Error(body.error ?? "Failed to upload receipt picture");
	}
};

const uploadRecipePictures = async (recipeId: number, files: File[]) => {
	const formData = new FormData();
	for (const file of files) {
		formData.append("file", file);
	}

	const response = await fetch(`/api/recipes/${recipeId}/pictures`, {
		method: "POST",
		body: formData,
	});
	const body = (await response.json()) as { error?: string };
	if (!response.ok) {
		throw new Error(body.error ?? "Failed to upload recipe images");
	}
};

const uploadInventoryItemPictures = async (itemId: number, files: File[]) => {
	const formData = new FormData();
	for (const file of files) {
		formData.append("file", file);
	}

	const response = await fetch(`/api/inventory-items/${itemId}/pictures`, {
		method: "POST",
		body: formData,
	});
	const body = (await response.json()) as { error?: string };
	if (!response.ok) {
		throw new Error(body.error ?? "Failed to upload inventory item images");
	}
};

const findOrCreateIngredientByName = async (
	name: string,
	defaultUnit: string | null = null,
) => {
	const lookupResponse = await fetch(
		`/api/ingredients?name=${encodeURIComponent(name)}`,
	);
	const lookupBody = (await lookupResponse.json()) as
		| Ingredient[]
		| { error?: string };

	if (!lookupResponse.ok) {
		throw new Error(
			"error" in lookupBody
				? (lookupBody.error ?? "Failed to look up ingredient")
				: "Failed to look up ingredient",
		);
	}

	const matches = lookupBody as Ingredient[];
	if (matches.length > 0) {
		return matches[0]!;
	}

	const createResponse = await fetch("/api/ingredients", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			name,
			default_unit: defaultUnit,
		}),
	});
	const createBody = (await createResponse.json()) as
		| Ingredient
		| { error?: string };

	if (!createResponse.ok) {
		throw new Error(
			"error" in createBody
				? (createBody.error ?? "Failed to create ingredient")
				: "Failed to create ingredient",
		);
	}

	return createBody as Ingredient;
};

const updateProduct = async (
	productId: number,
	payload: {
		ingredient_id?: number | null;
		name?: string;
		category?: string;
		barcode?: string | null;
		default_unit?: string | null;
		is_perishable?: boolean;
	},
) => {
	const response = await fetch(`/api/products/${productId}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	const body = (await response.json()) as Product | { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to update product")
				: "Failed to update product",
		);
	}

	return body as Product;
};

export const attachProductPageEvents = () => {
	productPageAbortController?.abort();
	productPageAbortController = new AbortController();

	const form = document.getElementById("product-form");
	const barcodeFilter = document.getElementById("barcode-filter");
	const filterButton = document.getElementById("filter-button");
	const addButton = document.getElementById("open-product-modal-button");
	const modal = document.getElementById("product-create-modal");
	const modalCloseButtons = document.querySelectorAll(
		"[data-product-modal-close]",
	);

	const closeModal = () => {
		if (!modal) {
			return;
		}
		modal.hidden = true;
		document.body.classList.remove("modal-open");
	};

	const openModal = () => {
		if (!modal) {
			return;
		}
		modal.hidden = false;
		document.body.classList.add("modal-open");
		const nameInput = document.getElementById("name");
		if (nameInput instanceof HTMLInputElement) {
			nameInput.focus();
		}
	};

	addButton?.addEventListener("click", openModal, {
		signal: productPageAbortController.signal,
	});

	for (const button of modalCloseButtons) {
		button.addEventListener("click", closeModal, {
			signal: productPageAbortController.signal,
		});
	}

	window.addEventListener(
		"keydown",
		(event) => {
			if (event.key === "Escape" && modal && !modal.hidden) {
				closeModal();
			}
		},
		{ signal: productPageAbortController.signal },
	);

	form?.addEventListener("submit", async (event) => {
		event.preventDefault();

		const nameInput = document.getElementById("name");
		const categoryInput = document.getElementById("category");
		const ingredientNameInput = document.getElementById("ingredient_name");
		const barcodeInput = document.getElementById("barcode");
		const defaultUnitInput = document.getElementById("default_unit");
		const isPerishableInput = document.getElementById("is_perishable");
		const pictureInput = document.getElementById("picture");

			if (
				!(nameInput instanceof HTMLInputElement) ||
				!(categoryInput instanceof HTMLInputElement) ||
				!(ingredientNameInput instanceof HTMLInputElement) ||
				!(barcodeInput instanceof HTMLInputElement) ||
				!(defaultUnitInput instanceof HTMLSelectElement) ||
				!(isPerishableInput instanceof HTMLSelectElement) ||
				!(pictureInput instanceof HTMLInputElement)
			) {
			return;
		}

		try {
			const ingredientName = ingredientNameInput.value.trim();
			const ingredient = ingredientName
				? await findOrCreateIngredientByName(
						ingredientName,
						defaultUnitInput.value.trim() || null,
					)
				: null;
			const payload = {
				ingredient_id: ingredient?.id ?? null,
				name: nameInput.value.trim(),
				category: categoryInput.value.trim(),
				barcode: barcodeInput.value.trim() || null,
				default_unit: defaultUnitInput.value.trim() || null,
				is_perishable: isPerishableInput.value === "true",
			};
			const response = await fetch("/api/products", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const body = (await response.json()) as
				| Product
				| { error?: string };

			if (!response.ok) {
				throw new Error(
					"error" in body
						? (body.error ?? "Failed to create product")
						: "Failed to create product",
				);
			}

			const picture = pictureInput.files?.[0];
			if (picture) {
				await uploadProductPicture((body as Product).id, picture);
			}

			if (form instanceof HTMLFormElement) {
				form.reset();
			}
			isPerishableInput.value = "true";

			const barcodeFilter = document.getElementById("barcode-filter");
			if (barcodeFilter instanceof HTMLInputElement) {
				barcodeFilter.value = (body as Product).barcode ?? "";
			}

			closeModal();
			setStatus(
				"status",
				picture
					? `Created product #${(body as Product).id} and uploaded picture`
					: `Created product #${(body as Product).id}: ${(body as Product).name}`,
			);
			setStatus(
				"product-modal-status",
				picture
					? `Created product #${(body as Product).id} and uploaded picture`
					: `Created product #${(body as Product).id}: ${(body as Product).name}`,
			);
			await loadProducts();
		} catch (error) {
			setStatus(
				"product-modal-status",
				error instanceof Error
					? error.message
					: "Failed to create product",
				true,
			);
			setStatus(
				"status",
				error instanceof Error
					? error.message
					: "Failed to create product",
				true,
			);
		}
	});

	filterButton?.addEventListener("click", () => {
		void loadProducts();
	});

	barcodeFilter?.addEventListener("keydown", (event) => {
		if (!(event instanceof KeyboardEvent) || event.key !== "Enter") {
			return;
		}

		event.preventDefault();
		void loadProducts();
	});
};

export const attachProductDetailEvents = (productId: number) => {
	productDetailAbortController?.abort();
	productDetailAbortController = new AbortController();

	const refreshProductDetail = async () => {
		const updated = await fetchProduct(productId);
		renderProductDetail(updated);
		attachProductDetailEvents(updated.id);
		return updated;
	};

	const pictureForm = document.getElementById("product-picture-form");
	if (pictureForm instanceof HTMLFormElement) {
		pictureForm.addEventListener(
			"submit",
			async (event) => {
				event.preventDefault();

				const pictureInput = document.getElementById("product-picture-input");
				if (!(pictureInput instanceof HTMLInputElement)) {
					return;
				}

				const picture = pictureInput.files?.[0];
				if (!picture) {
					setStatus(
						"product-picture-status",
						"Choose an image before uploading.",
						true,
					);
					return;
				}

				try {
					await uploadProductPicture(productId, picture);
					const updated = await refreshProductDetail();
					setStatus(
						"product-picture-status",
						`Uploaded picture for ${updated.name}.`,
					);
				} catch (error) {
					setStatus(
						"product-picture-status",
						error instanceof Error
							? error.message
							: "Failed to upload product picture",
						true,
					);
				}
			},
			{ signal: productDetailAbortController.signal },
		);
	}

	document.getElementById("product-picture-delete")?.addEventListener(
		"click",
		async () => {
			try {
				await deleteProductPicture(productId);
				const updated = await refreshProductDetail();
				setStatus("product-picture-status", `Removed picture for ${updated.name}.`);
			} catch (error) {
				setStatus(
					"product-picture-status",
					error instanceof Error
						? error.message
						: "Failed to remove product picture",
					true,
				);
			}
		},
		{ signal: productDetailAbortController.signal },
	);

	const form = document.getElementById("product-detail-form");
	if (!(form instanceof HTMLFormElement)) {
		return;
	}

	form.addEventListener(
		"submit",
		async (event) => {
			event.preventDefault();

			const nameInput = document.getElementById("product-detail-name");
			const categoryInput = document.getElementById("product-detail-category");
			const ingredientNameInput = document.getElementById(
				"product-detail-ingredient-name",
			);
			const barcodeInput = document.getElementById("product-detail-barcode");
			const defaultUnitInput = document.getElementById(
				"product-detail-default-unit",
			);
			const isPerishableInput = document.getElementById(
				"product-detail-is-perishable",
			);

			if (
				!(nameInput instanceof HTMLInputElement) ||
				!(categoryInput instanceof HTMLInputElement) ||
				!(ingredientNameInput instanceof HTMLInputElement) ||
				!(barcodeInput instanceof HTMLInputElement) ||
				!(defaultUnitInput instanceof HTMLSelectElement) ||
				!(isPerishableInput instanceof HTMLSelectElement)
			) {
				return;
			}

			try {
				const ingredientName = ingredientNameInput.value.trim();
				const ingredient = ingredientName
					? await findOrCreateIngredientByName(
							ingredientName,
							defaultUnitInput.value.trim() || null,
						)
					: null;
				const updated = await updateProduct(productId, {
					ingredient_id: ingredient?.id ?? null,
					name: nameInput.value.trim(),
					category: categoryInput.value.trim(),
					barcode: barcodeInput.value.trim() || null,
					default_unit: defaultUnitInput.value.trim() || null,
					is_perishable: isPerishableInput.value === "true",
				});
				renderProductDetail(updated);
				attachProductDetailEvents(updated.id);
				setStatus("product-detail-status", `Saved ${updated.name}.`);
			} catch (error) {
				setStatus(
					"product-detail-status",
					error instanceof Error
						? error.message
						: "Failed to update product",
					true,
				);
			}
		},
		{ signal: productDetailAbortController.signal },
	);
};

export const attachDashboardTimerEvents = () => {
	const root = document.getElementById("dashboard-timer");
	if (!root) return;

	root.addEventListener("click", async (event) => {
		const target = event.target;
		if (!(target instanceof HTMLElement)) return;
		const stopButton = target.closest("[data-dashboard-stop-time-entry-id]");
		if (!(stopButton instanceof HTMLButtonElement)) return;

		const entryId = Number(stopButton.dataset.dashboardStopTimeEntryId);
		if (!Number.isFinite(entryId)) {
			return;
		}

		stopButton.disabled = true;
		try {
			await stopTimeEntry(entryId);
			await loadDashboardTimer("Timer stopped.");
		} catch (error) {
			stopButton.disabled = false;
			setStatus(
				"dashboard-timer-status",
				error instanceof Error ? error.message : "Failed to stop timer.",
				true,
			);
		}
	});
};

export const attachTimePageEvents = () => {
	const page = document.getElementById("time-page");
	if (!page) return;

	page.addEventListener("submit", async (event) => {
		const target = event.target;
		if (!(target instanceof HTMLFormElement)) return;
		if (
			target.id !== "time-entry-start-form" &&
			target.id !== "time-running-start-form"
		) {
			return;
		}
		event.preventDefault();

		if (target.id === "time-running-start-form") {
			const projectInput = document.getElementById("time-running-project-select");
			const descriptionInput = document.getElementById("time-running-description");
			const startInput = document.getElementById("time-running-started-at");
			const entryId = target.dataset.timeEntryId;
			if (
				!(projectInput instanceof HTMLSelectElement) ||
				!(startInput instanceof HTMLInputElement) ||
				!entryId
			) {
				return;
			}
			const startedAt = parseDateTimeLocalInput(startInput.value);
			const project = findTimeProjectChoiceById(Number(projectInput.value))?.project;
			if (!project) {
				setStatus("time-status", "Project is required.", true);
				return;
			}
			if (!startedAt) {
				setStatus("time-status", "Start time is invalid.", true);
				return;
			}

			try {
				await timeApiJson<TimeEntry>(`/api/time-entries/${entryId}`, {
					method: "PATCH",
					body: JSON.stringify({
						project_id: project.id,
						description:
							descriptionInput instanceof HTMLInputElement &&
							descriptionInput.value.trim()
								? descriptionInput.value.trim()
								: null,
						started_at: startedAt,
					}),
				});
				setStatus("time-status", "Running timer updated.");
				await loadTimeTrackingPage();
			} catch (error) {
				setStatus(
					"time-status",
					error instanceof Error
						? error.message
						: "Failed to update running timer.",
					true,
				);
			}
			return;
		}

		const projectInput = document.getElementById("time-entry-project-select");
		const descriptionInput = document.getElementById("time-entry-description");
		if (!(projectInput instanceof HTMLSelectElement)) return;
		if (!projectInput.value || projectInput.value === NEW_TIME_PROJECT_VALUE) {
			setStatus("time-status", "Project is required.", true);
			return;
		}

		try {
			const project = findTimeProjectChoiceById(Number(projectInput.value))?.project;
			if (!project) {
				setStatus("time-status", "Project is required.", true);
				return;
			}
			await timeApiJson<TimeEntry>("/api/time-entries/start", {
				method: "POST",
				body: JSON.stringify({
					project_id: project.id,
					description:
						descriptionInput instanceof HTMLInputElement &&
						descriptionInput.value.trim()
							? descriptionInput.value.trim()
							: null,
				}),
			});
			setStatus("time-status", "Timer started.");
			await loadTimeTrackingPage();
		} catch (error) {
			setStatus(
				"time-status",
				error instanceof Error ? error.message : "Failed to start timer.",
				true,
			);
		}
	});

	const projectModal = document.getElementById("time-project-modal");
	const projectModalForm = document.getElementById("time-project-modal-form");
	const projectModalNameInput = document.getElementById("time-project-modal-name");

	const closeTimeProjectModal = () => {
		if (!(projectModal instanceof HTMLElement)) return;
		projectModal.hidden = true;
		document.body.classList.remove("modal-open");
		if (projectModalForm instanceof HTMLFormElement) projectModalForm.reset();
		setStatus("time-project-modal-status", "");
		const projectSelect = document.getElementById("time-entry-project-select");
		if (
			projectSelect instanceof HTMLSelectElement &&
			projectSelect.value === NEW_TIME_PROJECT_VALUE
		) {
			projectSelect.value = "";
		}
	};

	const openTimeProjectModal = () => {
		if (!(projectModal instanceof HTMLElement)) return;
		projectModal.hidden = false;
		document.body.classList.add("modal-open");
		setStatus("time-project-modal-status", "");
		if (projectModalNameInput instanceof HTMLInputElement) {
			projectModalNameInput.focus();
		}
	};

	const closeTimeRunningEditModal = () => {
		const runningEditModal = document.getElementById("time-running-edit-modal");
		if (!(runningEditModal instanceof HTMLElement)) return;
		runningEditModal.hidden = true;
		document.body.classList.remove("modal-open");
	};

	const openTimeRunningEditModal = () => {
		const runningEditModal = document.getElementById("time-running-edit-modal");
		if (!(runningEditModal instanceof HTMLElement)) return;
		runningEditModal.hidden = false;
		document.body.classList.add("modal-open");
		document.getElementById("time-running-project-select")?.focus();
	};

	page.addEventListener("change", (event) => {
		const target = event.target;
		if (!(target instanceof HTMLSelectElement)) return;
		if (target.id !== "time-entry-project-select") return;
		if (target.value !== NEW_TIME_PROJECT_VALUE) {
			return;
		}
		target.value = "";
		openTimeProjectModal();
	});

	page.addEventListener("submit", async (event) => {
		const target = event.target;
		if (!(target instanceof HTMLFormElement)) return;
		if (target.id !== "time-project-modal-form") return;
		event.preventDefault();

		const projectName =
			projectModalNameInput instanceof HTMLInputElement
				? projectModalNameInput.value.trim()
				: "";
		if (!projectName) {
			setStatus("time-project-modal-status", "Project name is required.", true);
			return;
		}

		try {
			const project =
				findTimeProjectChoice(projectName)?.project ??
				(await createTimeProject(projectName));
			if (!findTimeProjectChoiceById(project.id)) {
				currentTimeProjectChoices.push({
					project,
					entry_count: 0,
					total_seconds: 0,
					latest_started_at: null,
				});
			}
			const projectSelect = document.getElementById("time-entry-project-select");
			if (projectSelect instanceof HTMLSelectElement) {
				const existingOption = projectSelect.querySelector<HTMLOptionElement>(
					`option[value="${project.id}"]`,
				);
				if (!existingOption) {
					const option = document.createElement("option");
					option.value = String(project.id);
					option.textContent = project.name;
					const createOption = projectSelect.querySelector<HTMLOptionElement>(
						`option[value="${NEW_TIME_PROJECT_VALUE}"]`,
					);
					projectSelect.insertBefore(option, createOption);
				}
				projectSelect.value = String(project.id);
			}

			closeTimeProjectModal();
		} catch (error) {
			setStatus(
				"time-project-modal-status",
				error instanceof Error ? error.message : "Failed to create project.",
				true,
			);
		}
	});

	page.addEventListener("click", (event) => {
		const target = event.target;
		if (!(target instanceof HTMLElement)) return;
		if (target.closest("[data-time-project-modal-close]")) {
			closeTimeProjectModal();
		}
		if (target.closest("[data-time-running-edit-modal-close]")) {
			closeTimeRunningEditModal();
		}
	});

	document.addEventListener("keydown", (event) => {
		const runningEditModal = document.getElementById("time-running-edit-modal");
		if (
			event.key === "Escape" &&
			projectModal instanceof HTMLElement &&
			!projectModal.hidden
		) {
			closeTimeProjectModal();
			return;
		}
		if (
			event.key === "Escape" &&
			runningEditModal instanceof HTMLElement &&
			!runningEditModal.hidden
		) {
			closeTimeRunningEditModal();
		}
	});

	page.addEventListener("click", async (event) => {
		const target = event.target;
		if (!(target instanceof HTMLElement)) return;

		const stopButton = target.closest("[data-time-entry-id]");
		const previousEndButton = target.closest(
			"[data-time-running-previous-ended-at]",
		);
		const startButton = target.closest("[data-start-time-project-id]");
		const runningEditButton = target.closest("[data-time-running-edit-open]");
		const editEntryButton = target.closest("[data-edit-time-entry-id]");
		const cancelEntryButton = target.closest("[data-cancel-time-entry-id]");
		const saveEntryButton = target.closest("[data-save-time-entry-id]");
		const deleteEntryButton = target.closest("[data-delete-time-entry-id]");

		if (runningEditButton instanceof HTMLButtonElement) {
			openTimeRunningEditModal();
			return;
		}

		if (editEntryButton instanceof HTMLButtonElement) {
			const id = editEntryButton.dataset.editTimeEntryId;
			if (!id) return;
			document.querySelector<HTMLElement>(`[data-time-entry-summary="${id}"]`)?.setAttribute("hidden", "");
			document.querySelector<HTMLElement>(`[data-time-entry-edit-form="${id}"]`)?.removeAttribute("hidden");
			return;
		}

		if (cancelEntryButton instanceof HTMLButtonElement) {
			const id = cancelEntryButton.dataset.cancelTimeEntryId;
			if (!id) return;
			document.querySelector<HTMLElement>(`[data-time-entry-edit-form="${id}"]`)?.setAttribute("hidden", "");
			document.querySelector<HTMLElement>(`[data-time-entry-summary="${id}"]`)?.removeAttribute("hidden");
			return;
		}

		try {
			if (previousEndButton instanceof HTMLButtonElement) {
				const runningForm = document.getElementById("time-running-start-form");
				const startedAtInput = document.getElementById("time-running-started-at");
				const entryId =
					runningForm instanceof HTMLFormElement
						? runningForm.dataset.timeEntryId
						: null;
				const previousEndedAt = previousEndButton.dataset.timeRunningPreviousEndedAt;
				if (
					!(startedAtInput instanceof HTMLInputElement) ||
					!entryId ||
					!previousEndedAt
				) {
					return;
				}
				startedAtInput.value = formatTimestampForDateTimeLocalInput(previousEndedAt);
				await timeApiJson<TimeEntry>(`/api/time-entries/${entryId}`, {
					method: "PATCH",
					body: JSON.stringify({ started_at: previousEndedAt }),
				});
				setStatus("time-status", "Timer start set to previous end.");
				await loadTimeTrackingPage();
				return;
			}

			if (stopButton instanceof HTMLButtonElement) {
				await timeApiJson<TimeEntry>(
					`/api/time-entries/${stopButton.dataset.timeEntryId}/stop`,
					{ method: "POST", body: JSON.stringify({}) },
				);
				setStatus("time-status", "Timer stopped.");
				await loadTimeTrackingPage();
				return;
			}

			if (saveEntryButton instanceof HTMLButtonElement) {
				const id = Number(saveEntryButton.dataset.saveTimeEntryId);
				const projectInput = document.querySelector<HTMLSelectElement>(
					`[data-time-entry-project="${id}"]`,
				);
				const descriptionInput = document.querySelector<HTMLInputElement>(
					`[data-time-entry-description="${id}"]`,
				);
				const startedAtInput = document.querySelector<HTMLInputElement>(
					`[data-time-entry-started-at="${id}"]`,
				);
				const endedAtInput = document.querySelector<HTMLInputElement>(
					`[data-time-entry-ended-at="${id}"]`,
				);
				const startedAt = startedAtInput
					? parseDateTimeLocalInput(startedAtInput.value)
					: null;
				const endedAt = endedAtInput?.value.trim()
					? parseDateTimeLocalInput(endedAtInput.value)
					: null;
				if (!projectInput || !startedAt || (endedAtInput?.value.trim() && !endedAt)) {
					setStatus("time-status", "Entry times are invalid.", true);
					return;
				}
				await timeApiJson<TimeEntry>(`/api/time-entries/${id}`, {
					method: "PATCH",
					body: JSON.stringify({
						project_id: Number(projectInput.value),
						description: descriptionInput?.value.trim() || null,
						started_at: startedAt,
						ended_at: endedAt,
					}),
				});
				setStatus("time-status", "Entry saved.");
				await loadTimeTrackingPage();
				return;
			}

			if (deleteEntryButton instanceof HTMLButtonElement) {
				const id = Number(deleteEntryButton.dataset.deleteTimeEntryId);
				const response = await fetch(`/api/time-entries/${id}`, { method: "DELETE" });
				if (!response.ok) {
					throw new Error("Failed to delete entry.");
				}
				setStatus("time-status", "Entry deleted.");
				await loadTimeTrackingPage();
				return;
			}

			if (startButton instanceof HTMLButtonElement) {
				await timeApiJson<TimeEntry>("/api/time-entries/start", {
					method: "POST",
					body: JSON.stringify({
						project_id: Number(startButton.dataset.startTimeProjectId),
						description: startButton.dataset.startTimeDescription?.trim() || null,
					}),
				});
				setStatus("time-status", "Timer started.");
				await loadTimeTrackingPage();
			}
		} catch (error) {
			setStatus(
				"time-status",
				error instanceof Error ? error.message : "Time tracking action failed.",
				true,
			);
		}
	});
};

export const attachRecipeCreatePageEvents = () => {
	const draftIngredients: DraftRecipeIngredient[] = [];

	const updateIngredientPreview = () => {
		const preview = document.getElementById("recipe-ingredient-preview");
		if (!preview) {
			return;
		}

		if (!draftIngredients.length) {
			preview.className = "recipe-create-ingredient-preview empty";
			preview.textContent = "No ingredients added yet.";
			return;
		}

		preview.className = "recipe-create-ingredient-preview";
		preview.innerHTML = draftIngredients
			.map(
				(ingredient, index) => `
					<div class="recipe-create-ingredient-preview__item">
						<span>${escapeHtml(ingredient.name)}</span>
						<div class="recipe-create-ingredient-preview__meta">
							<strong>${escapeHtml(`${ingredient.quantity} ${ingredient.unit}`)}</strong>
							<button
								class="secondary"
								type="button"
								data-remove-recipe-ingredient-draft="${index}"
							>Remove</button>
						</div>
					</div>
				`,
			)
			.join("");
	};

	document
		.getElementById("add-recipe-ingredient-draft-button")
		?.addEventListener("click", () => {
			const nameInput = document.getElementById("recipe-ingredient-draft-name");
			const quantityInput = document.getElementById(
				"recipe-ingredient-draft-quantity",
			);
			const unitInput = document.getElementById("recipe-ingredient-draft-unit");

			if (
				!(nameInput instanceof HTMLInputElement) ||
				!(quantityInput instanceof HTMLInputElement) ||
				!(unitInput instanceof HTMLSelectElement)
			) {
				return;
			}

			const name = nameInput.value.trim();
			const quantity = Number.parseFloat(quantityInput.value);
			const unit = unitInput.value.trim();
			if (!name) {
				setStatus("recipe-create-status", "Ingredient name is required", true);
				return;
			}
			if (!Number.isFinite(quantity) || quantity <= 0) {
				setStatus(
					"recipe-create-status",
					"Ingredient quantity must be greater than zero",
					true,
				);
				return;
			}
			if (!unit) {
				setStatus("recipe-create-status", "Ingredient unit is required", true);
				return;
			}

			draftIngredients.push({
				name,
				quantity,
				unit,
				is_optional: false,
				notes: null,
			});
			nameInput.value = "";
			quantityInput.value = "";
			setStatus("recipe-create-status", "");
			updateIngredientPreview();
			nameInput.focus();
		});

	document
		.getElementById("recipe-ingredient-preview")
		?.addEventListener("click", (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) {
				return;
			}

			const removeButton = target.closest<HTMLButtonElement>(
				"[data-remove-recipe-ingredient-draft]",
			);
			if (!removeButton) {
				return;
			}

			const index = Number.parseInt(
				removeButton.dataset.removeRecipeIngredientDraft ?? "",
				10,
			);
			if (!Number.isInteger(index)) {
				return;
			}

			draftIngredients.splice(index, 1);
			updateIngredientPreview();
		});

	updateIngredientPreview();

	document
		.getElementById("recipe-create-form")
		?.addEventListener("submit", async (event) => {
			event.preventDefault();

			const nameInput = document.getElementById("recipe-name");
			const servingsInput = document.getElementById("recipe-servings");
			const descriptionInput = document.getElementById("recipe-description");
			const instructionsInput = document.getElementById("recipe-instructions");
			const isActiveInput = document.getElementById("recipe-is-active");

			if (
				!(nameInput instanceof HTMLInputElement) ||
				!(servingsInput instanceof HTMLInputElement) ||
				!(descriptionInput instanceof HTMLTextAreaElement) ||
				!(instructionsInput instanceof HTMLTextAreaElement) ||
				!(isActiveInput instanceof HTMLInputElement)
			) {
				return;
			}

			const name = nameInput.value.trim();
			if (!name) {
				setStatus("recipe-create-status", "Recipe name is required", true);
				return;
			}

			const servings = servingsInput.value.trim();
			const parsedServings = servings
				? Number.parseInt(servings, 10)
				: null;
			if (
				parsedServings !== null &&
				(!Number.isInteger(parsedServings) || parsedServings < 1)
			) {
				setStatus(
					"recipe-create-status",
					"Servings must be a whole number greater than zero",
					true,
				);
				return;
			}

			try {
				const recipe = await createRecipe({
					name,
					description: descriptionInput.value.trim() || null,
					instructions: instructionsInput.value.trim() || null,
					servings: parsedServings,
					is_active: isActiveInput.checked,
				});

				for (const ingredient of draftIngredients) {
					await createRecipeIngredient({
						recipe_id: recipe.id,
						ingredient_id: null,
						product_id: null,
						name: ingredient.name,
						quantity: ingredient.quantity,
						unit: ingredient.unit,
						is_optional: ingredient.is_optional,
						notes: ingredient.notes,
					});
				}

				setStatus(
					"recipe-create-status",
					`Created recipe #${recipe.id}: ${recipe.name}`,
				);
				navigate(`/recipes/${recipe.id}`);
			} catch (error) {
				setStatus(
					"recipe-create-status",
					error instanceof Error
						? error.message
						: "Failed to create recipe",
					true,
				);
			}
		});
};

const attachRecipeDetailEvents = (recipeId: number) => {
	const refreshRecipeDetail = async () => {
		const updated = await fetchRecipe(recipeId);
		renderRecipeDetail(updated);
		return updated;
	};
	const modal = document.getElementById("recipe-ingredient-modal");
	const ingredientForm = document.getElementById("recipe-ingredient-modal-form");
	const ingredientIdInput = document.getElementById("recipe-ingredient-id");
	const ingredientNameInput = document.getElementById("recipe-ingredient-name");
	const ingredientQuantityInput = document.getElementById(
		"recipe-ingredient-quantity",
	);
	const ingredientUnitInput = document.getElementById("recipe-ingredient-unit");
	const ingredientNotesInput = document.getElementById("recipe-ingredient-notes");
	const ingredientOptionalInput = document.getElementById(
		"recipe-ingredient-optional",
	);
	const ingredientModalTitle = document.getElementById(
		"recipe-ingredient-modal-title",
	);
	const ingredientModalSubmitButton = document.getElementById(
		"recipe-ingredient-modal-submit",
	);
	const resetIngredientModal = () => {
		if (ingredientForm instanceof HTMLFormElement) {
			ingredientForm.reset();
		}
		if (ingredientUnitInput instanceof HTMLSelectElement) {
			setUnitSelectValue(ingredientUnitInput, "pcs", "pcs");
		}
		if (ingredientIdInput instanceof HTMLInputElement) {
			ingredientIdInput.value = "";
		}
		if (ingredientModalTitle instanceof HTMLElement) {
			ingredientModalTitle.textContent = "Add Ingredient";
		}
		if (ingredientModalSubmitButton instanceof HTMLButtonElement) {
			ingredientModalSubmitButton.textContent = "Add Ingredient";
		}
		setStatus("recipe-ingredient-modal-status", "");
	};
	const closeIngredientModal = () => {
		if (!(modal instanceof HTMLElement)) {
			return;
		}
		modal.hidden = true;
		document.body.classList.remove("modal-open");
	};
	const openIngredientModal = () => {
		if (!(modal instanceof HTMLElement)) {
			return;
		}
		modal.hidden = false;
		document.body.classList.add("modal-open");
		setStatus("recipe-ingredient-modal-status", "");
		if (ingredientNameInput instanceof HTMLInputElement) {
			ingredientNameInput.focus();
		}
	};
	const openIngredientCreateModal = () => {
		resetIngredientModal();
		openIngredientModal();
	};
	const openIngredientEditModal = (editButton: HTMLElement) => {
		if (
			!(ingredientIdInput instanceof HTMLInputElement) ||
			!(ingredientNameInput instanceof HTMLInputElement) ||
			!(ingredientQuantityInput instanceof HTMLInputElement) ||
			!(ingredientUnitInput instanceof HTMLSelectElement) ||
			!(ingredientNotesInput instanceof HTMLInputElement) ||
			!(ingredientOptionalInput instanceof HTMLInputElement)
		) {
			return;
		}

		ingredientIdInput.value = editButton.dataset.editRecipeIngredientId ?? "";
		ingredientNameInput.value = decodeURIComponent(
			editButton.dataset.recipeIngredientName ?? "",
		);
		ingredientQuantityInput.value =
			editButton.dataset.recipeIngredientQuantity ?? "1";
		setUnitSelectValue(
			ingredientUnitInput,
			decodeURIComponent(editButton.dataset.recipeIngredientUnit ?? ""),
			"pcs",
		);
		ingredientNotesInput.value = decodeURIComponent(
			editButton.dataset.recipeIngredientNotes ?? "",
		);
		ingredientOptionalInput.checked =
			editButton.dataset.recipeIngredientOptional === "true";
		if (ingredientModalTitle instanceof HTMLElement) {
			ingredientModalTitle.textContent = "Edit Ingredient";
		}
		if (ingredientModalSubmitButton instanceof HTMLButtonElement) {
			ingredientModalSubmitButton.textContent = "Save Ingredient";
		}
		setStatus("recipe-ingredient-modal-status", "");
		openIngredientModal();
	};

	document
		.getElementById("open-recipe-ingredient-modal-button")
		?.addEventListener("click", openIngredientCreateModal);

	for (const button of document.querySelectorAll(
		"[data-recipe-ingredient-modal-close]",
	)) {
		button.addEventListener("click", closeIngredientModal);
	}

	document
		.getElementById("recipe-ingredient-modal-form")
		?.addEventListener("submit", async (event) => {
			event.preventDefault();

			const nameInput = document.getElementById("recipe-ingredient-name");
			const quantityInput = document.getElementById(
				"recipe-ingredient-quantity",
			);
			const unitInput = document.getElementById("recipe-ingredient-unit");
			const notesInput = document.getElementById("recipe-ingredient-notes");
			const optionalInput = document.getElementById(
				"recipe-ingredient-optional",
			);

			if (
				!(nameInput instanceof HTMLInputElement) ||
				!(quantityInput instanceof HTMLInputElement) ||
				!(unitInput instanceof HTMLSelectElement) ||
				!(notesInput instanceof HTMLInputElement) ||
				!(optionalInput instanceof HTMLInputElement) ||
				!(ingredientIdInput instanceof HTMLInputElement)
			) {
				return;
			}

			const ingredientId = ingredientIdInput.value.trim();
			const name = nameInput.value.trim();
			if (!name) {
				setStatus(
					"recipe-ingredient-modal-status",
					"Ingredient name is required",
					true,
				);
				return;
			}

			const quantity = Number.parseFloat(quantityInput.value);
			if (!Number.isFinite(quantity) || quantity <= 0) {
				setStatus(
					"recipe-ingredient-modal-status",
					"Quantity must be greater than zero",
					true,
				);
				return;
			}

			try {
				const ingredient = await findOrCreateIngredientByName(
					name,
					unitInput.value.trim() || "pcs",
				);
				const unit = unitInput.value.trim() || ingredient.default_unit || "pcs";
				if (ingredientId) {
					const parsedIngredientId = Number.parseInt(ingredientId, 10);
					if (!Number.isInteger(parsedIngredientId)) {
						throw new Error("Ingredient id is invalid");
					}
					await updateRecipeIngredient(parsedIngredientId, {
						name,
						ingredient_id: ingredient.id,
						product_id: null,
						quantity,
						unit,
						is_optional: optionalInput.checked,
						notes: notesInput.value.trim() || null,
					});
				} else {
					await createRecipeIngredient({
						recipe_id: recipeId,
						name,
						ingredient_id: ingredient.id,
						product_id: null,
						quantity,
						unit,
						is_optional: optionalInput.checked,
						notes: notesInput.value.trim() || null,
					});
				}
				closeIngredientModal();
				resetIngredientModal();
				const updated = await refreshRecipeDetail();
				setStatus(
					"recipe-ingredient-status",
					ingredientId
						? `Saved ${name} in ${updated.name}.`
						: `Added ${name} to ${updated.name}.`,
				);
			} catch (error) {
				setStatus(
					"recipe-ingredient-modal-status",
					error instanceof Error
						? error.message
						: ingredientId
							? "Failed to save recipe ingredient"
							: "Failed to add recipe ingredient",
					true,
				);
			}
		});

	document
		.getElementById("recipe-picture-form")
		?.addEventListener("submit", async (event) => {
			event.preventDefault();

			const pictureInput = document.getElementById("recipe-picture-input");
			if (!(pictureInput instanceof HTMLInputElement)) {
				return;
			}

			const pictures = pictureInput.files
				? Array.from(pictureInput.files)
				: [];
			if (!pictures.length) {
				setStatus(
					"recipe-picture-status",
					"Choose one or more images before uploading.",
					true,
				);
				return;
			}

			try {
				await uploadRecipePictures(recipeId, pictures);
				const updated = await refreshRecipeDetail();
				setStatus(
					"recipe-picture-status",
					pictures.length === 1
						? `Uploaded 1 image for ${updated.name}.`
						: `Uploaded ${pictures.length} images for ${updated.name}.`,
				);
			} catch (error) {
				setStatus(
					"recipe-picture-status",
					error instanceof Error
						? error.message
						: "Failed to upload recipe images",
					true,
				);
			}
		});

	document
		.getElementById("recipe-detail-page")
		?.addEventListener("click", async (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) {
				return;
			}

			const deleteButton = target.closest<HTMLElement>(
				"[data-delete-recipe-image-id]",
			);
			if (deleteButton) {
				const imageId = Number.parseInt(
					deleteButton.dataset.deleteRecipeImageId ?? "",
					10,
				);
				if (!Number.isInteger(imageId)) {
					return;
				}

				try {
					await deleteRecipeImage(recipeId, imageId);
					await refreshRecipeDetail();
					setStatus("recipe-picture-status", "Removed recipe image.");
				} catch (error) {
					setStatus(
						"recipe-picture-status",
						error instanceof Error
							? error.message
							: "Failed to delete recipe image",
						true,
					);
				}
				return;
			}

			const editIngredientButton = target.closest<HTMLElement>(
				"[data-edit-recipe-ingredient-id]",
			);
			if (editIngredientButton) {
				openIngredientEditModal(editIngredientButton);
				return;
			}

			const deleteIngredientButton = target.closest<HTMLElement>(
				"[data-delete-recipe-ingredient-id]",
			);
			if (!deleteIngredientButton) {
				return;
			}

			const ingredientId = Number.parseInt(
				deleteIngredientButton.dataset.deleteRecipeIngredientId ?? "",
				10,
			);
			if (!Number.isInteger(ingredientId)) {
				return;
			}

			try {
				await deleteRecipeIngredient(ingredientId);
				const updated = await refreshRecipeDetail();
				setStatus(
					"recipe-ingredient-status",
					`Removed an ingredient from ${updated.name}.`,
				);
			} catch (error) {
				setStatus(
					"recipe-ingredient-status",
					error instanceof Error
						? error.message
						: "Failed to delete recipe ingredient",
					true,
				);
			}
		});

	document
		.getElementById("recipe-detail-form")
		?.addEventListener("submit", async (event) => {
			event.preventDefault();

			const nameInput = document.getElementById("recipe-detail-name");
			const servingsInput = document.getElementById("recipe-detail-servings");
			const descriptionInput = document.getElementById(
				"recipe-detail-description",
			);
			const instructionsInput = document.getElementById(
				"recipe-detail-instructions",
			);
			const isActiveInput = document.getElementById("recipe-detail-is-active");

			if (
				!(nameInput instanceof HTMLInputElement) ||
				!(servingsInput instanceof HTMLInputElement) ||
				!(descriptionInput instanceof HTMLTextAreaElement) ||
				!(instructionsInput instanceof HTMLTextAreaElement) ||
				!(isActiveInput instanceof HTMLInputElement)
			) {
				return;
			}

			const name = nameInput.value.trim();
			if (!name) {
				setStatus("recipe-detail-status", "Recipe name is required", true);
				return;
			}

			const servings = servingsInput.value.trim();
			const parsedServings = servings
				? Number.parseInt(servings, 10)
				: null;
			if (
				parsedServings !== null &&
				(!Number.isInteger(parsedServings) || parsedServings < 1)
			) {
				setStatus(
					"recipe-detail-status",
					"Servings must be a whole number greater than zero",
					true,
				);
				return;
			}

			try {
				const updated = await updateRecipe(recipeId, {
					name,
					description: descriptionInput.value.trim() || null,
					instructions: instructionsInput.value.trim() || null,
					servings: parsedServings,
					is_active: isActiveInput.checked,
				});
				renderRecipeDetail(updated);
				setStatus("recipe-detail-status", `Saved ${updated.name}.`);
			} catch (error) {
				setStatus(
					"recipe-detail-status",
					error instanceof Error
						? error.message
						: "Failed to update recipe",
					true,
				);
			}
		});
};

export const loadReceipts = async (statusMessage?: string) => {
	try {
		const groupFilter = getReceiptGroupFilter();
		const [groups, receipts] = await Promise.all([
			fetchGroups(),
			fetchReceipts(groupFilter),
		]);
		renderReceiptGroupControls(groups, groupFilter);
		const activeGroupFilter = getReceiptGroupFilter();
		receiptBoardState = { groups, receipts };
		const viewMode = getReceiptViewMode();
		renderReceipts(receipts, groups, activeGroupFilter, viewMode);
		setStatus(
			"receipt-status",
			statusMessage ??
				`Loaded ${receipts.length} receipt(s) and ${groups.length} group(s) in ${viewMode === "chronological" ? "chronological" : "board"} view.`,
		);
	} catch (error) {
		receiptBoardState = { groups: [], receipts: [] };
		renderReceiptGroupControls([], "all");
		renderReceipts([], [], "all", getReceiptViewMode());
		setStatus(
			"receipt-status",
			error instanceof Error ? error.message : "Failed to load receipts",
			true,
		);
	}
};

export const attachReceiptsPageEvents = () => {
	const form = document.getElementById("receipt-form");
	const modal = document.getElementById("receipt-create-modal");
	const openModalButton = document.getElementById("open-receipt-modal-button");
	const groupModal = document.getElementById("group-create-modal");
	const groupForm = document.getElementById("group-create-form");
	const openGroupModalButton = document.getElementById(
		"open-group-modal-button",
	);
	const refreshButton = document.getElementById("receipt-refresh-button");
	const groupFilter = document.getElementById("receipt-group-filter");
	const viewToggle = document.getElementById("receipt-chronological-view");
	const results = document.getElementById("receipt-results");

	let activeDropTarget: HTMLElement | null = null;

	const clearDropTarget = () => {
		activeDropTarget?.classList.remove("receipt-drop-target--active");
		activeDropTarget = null;
	};

	const closeCreateModal = () => {
		if (!modal) {
			return;
		}

		modal.hidden = true;
		document.body.classList.remove("modal-open");
		if (form instanceof HTMLFormElement) {
			form.reset();
		}
		setStatus("receipt-create-status", "");
	};

	const closeGroupModal = () => {
		if (!groupModal) {
			return;
		}

		groupModal.hidden = true;
		document.body.classList.remove("modal-open");
		if (groupForm instanceof HTMLFormElement) {
			groupForm.reset();
			const submitButton = groupForm.querySelector<HTMLButtonElement>(
				'button[type="submit"]',
			);
			if (submitButton) {
				submitButton.disabled = false;
			}
		}
		setStatus("group-create-status", "");
	};

	const openGroupModal = () => {
		if (!groupModal) {
			return;
		}

		groupModal.hidden = false;
		document.body.classList.add("modal-open");
		setStatus("group-create-status", "");
		const groupNameInput = document.getElementById("group-create-name");
		if (groupNameInput instanceof HTMLInputElement) {
			groupNameInput.focus();
		}
	};

	const openCreateModal = () => {
		if (!modal) {
			return;
		}

		modal.hidden = false;
		document.body.classList.add("modal-open");
		setStatus("receipt-create-status", "");
		const storeNameInput = document.getElementById("receipt-store-name");
		if (storeNameInput instanceof HTMLInputElement) {
			storeNameInput.focus();
		}
	};

	form?.addEventListener("submit", async (event) => {
		event.preventDefault();

		const storeNameInput = document.getElementById("receipt-store-name");
		const purchasedAtInput = document.getElementById(
			"receipt-purchased-at",
		);
		const currencyInput = document.getElementById("receipt-currency");
		const totalAmountInput = document.getElementById(
			"receipt-total-amount",
		);
		const groupNameInput = document.getElementById("receipt-group-name");
		const pictureInput = document.getElementById("receipt-picture");

		if (
			!(storeNameInput instanceof HTMLInputElement) ||
			!(purchasedAtInput instanceof HTMLInputElement) ||
			!(currencyInput instanceof HTMLInputElement) ||
			!(totalAmountInput instanceof HTMLInputElement) ||
			!(groupNameInput instanceof HTMLInputElement) ||
			!(pictureInput instanceof HTMLInputElement)
		) {
			return;
		}

		const groupName = groupNameInput.value.trim();

		const payload = {
			group_id: null as number | null,
			store_name: storeNameInput.value.trim(),
			purchased_at: new Date(purchasedAtInput.value).toISOString(),
			currency: currencyInput.value.trim().toUpperCase(),
			total_amount: totalAmountInput.value
				? Number(totalAmountInput.value)
				: null,
		};

		try {
			if (groupName) {
				const group = await findOrCreateGroup(groupName, await fetchGroups());
				payload.group_id = group.id;
			}

			const response = await fetch("/api/receipts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const body = (await response.json()) as
				| PurchaseReceipt
				| { error?: string };

			if (!response.ok) {
				throw new Error(
					"error" in body
						? (body.error ?? "Failed to create receipt")
						: "Failed to create receipt",
				);
			}

			const picture = pictureInput.files?.[0];
			if (picture) {
				await uploadReceiptPicture(
					(body as PurchaseReceipt).id,
					picture,
				);
			}

			closeCreateModal();
			await loadReceipts(
				picture
					? `Created receipt #${(body as PurchaseReceipt).id} and uploaded picture`
					: `Created receipt #${(body as PurchaseReceipt).id}`,
			);
		} catch (error) {
			setStatus(
				"receipt-create-status",
				error instanceof Error
					? error.message
					: "Failed to create receipt",
				true,
			);
		}
	});

	openModalButton?.addEventListener("click", openCreateModal);
	openGroupModalButton?.addEventListener("click", openGroupModal);

	if (groupForm instanceof HTMLFormElement) {
		groupForm.addEventListener("submit", async (event) => {
			event.preventDefault();

			const groupNameInput = document.getElementById("group-create-name");
			if (!(groupNameInput instanceof HTMLInputElement)) {
				return;
			}

			const name = groupNameInput.value.trim();
			if (!name) {
				setStatus("group-create-status", "Group name is required.", true);
				return;
			}

			const submitButton = groupForm.querySelector<HTMLButtonElement>(
				'button[type="submit"]',
			);
			if (submitButton) {
				submitButton.disabled = true;
			}
			setStatus("group-create-status", "Creating group...");

			try {
				const group = await createGroup(name);
				closeGroupModal();
				await loadReceipts(`Created group ${group.name}.`);
			} catch (error) {
				if (submitButton) {
					submitButton.disabled = false;
				}
				setStatus(
					"group-create-status",
					error instanceof Error ? error.message : "Failed to create group",
					true,
				);
			}
		});
	}

	modal?.addEventListener("click", (event) => {
		const target = event.target;
		if (!(target instanceof HTMLElement)) {
			return;
		}

		if (target.dataset.receiptCreateModalClose !== undefined) {
			closeCreateModal();
		}
	});

	groupModal?.addEventListener("click", (event) => {
		const target = event.target;
		if (!(target instanceof HTMLElement)) {
			return;
		}

		if (target.dataset.groupCreateModalClose !== undefined) {
			closeGroupModal();
		}
	});

	window.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && modal && !modal.hidden) {
			closeCreateModal();
			return;
		}
		if (event.key === "Escape" && groupModal && !groupModal.hidden) {
			closeGroupModal();
		}
	});

	refreshButton?.addEventListener("click", () => {
		void loadReceipts();
	});

	groupFilter?.addEventListener("change", () => {
		void loadReceipts();
	});

	viewToggle?.addEventListener("change", () => {
		receiptViewModeOverride =
			viewToggle instanceof HTMLInputElement && viewToggle.checked
				? "chronological"
				: "board";
		if (!receiptBoardState) {
			void loadReceipts();
			return;
		}

		const activeGroupFilter = getReceiptGroupFilter();
		renderReceipts(
			receiptBoardState.receipts,
			receiptBoardState.groups,
			activeGroupFilter,
			getReceiptViewMode(),
		);
	});

	results?.addEventListener("dragstart", (event) => {
		const target = event.target;
		if (!(target instanceof HTMLElement) || !event.dataTransfer) {
			return;
		}

		const draggable = target.closest<HTMLElement>("[data-receipt-drag-id]");
		if (!draggable) {
			return;
		}

		const id = Number(draggable.dataset.receiptDragId);
		if (!Number.isInteger(id)) {
			return;
		}

		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.setData(
			"text/plain",
			JSON.stringify({ kind: "receipt", id }),
		);
		draggable.classList.add("receipt-card--dragging");
	});

	results?.addEventListener("dragend", (event) => {
		const target = event.target;
		if (target instanceof HTMLElement) {
			target
				.closest("[data-receipt-drag-id]")
				?.classList.remove("receipt-card--dragging");
		}
		clearDropTarget();
	});

	results?.addEventListener("dragover", (event) => {
		const target = event.target;
		if (!(target instanceof HTMLElement) || !event.dataTransfer) {
			return;
		}

		const dropTarget = target.closest<HTMLElement>(
			"[data-receipt-drop-group-id]",
		);
		if (!dropTarget) {
			clearDropTarget();
			return;
		}

		event.preventDefault();
		event.dataTransfer.dropEffect = "move";
		if (activeDropTarget !== dropTarget) {
			clearDropTarget();
			activeDropTarget = dropTarget;
			activeDropTarget.classList.add("receipt-drop-target--active");
		}
	});

	results?.addEventListener("drop", async (event) => {
		const target = event.target;
		if (!(target instanceof HTMLElement) || !event.dataTransfer) {
			return;
		}

		const dropTarget = target.closest<HTMLElement>(
			"[data-receipt-drop-group-id]",
		);
		clearDropTarget();
		if (!dropTarget) {
			return;
		}

		event.preventDefault();

		const rawPayload = event.dataTransfer.getData("text/plain");
		if (!rawPayload) {
			return;
		}

		let payload: { kind?: string; id?: number };
		try {
			payload = JSON.parse(rawPayload) as { kind?: string; id?: number };
		} catch {
			return;
		}

		if (
			payload.kind !== "receipt" ||
			typeof payload.id !== "number" ||
			!Number.isInteger(payload.id)
		) {
			return;
		}
		const receiptId = payload.id;

		const rawGroupId = dropTarget.dataset.receiptDropGroupId ?? "";
		const targetGroupId =
			rawGroupId === "" ? null : Number.parseInt(rawGroupId, 10);
		if (targetGroupId !== null && !Number.isInteger(targetGroupId)) {
			return;
		}

		const receipt = receiptBoardState?.receipts.find(
			(candidate) => candidate.id === receiptId,
		);
		const currentGroupId = receipt?.group_id ?? null;
		if (currentGroupId === targetGroupId) {
			return;
		}

		const targetGroupName =
			targetGroupId === null
				? "Ungrouped"
				: (receiptBoardState?.groups.find(
						(group) => group.id === targetGroupId,
					)?.name ?? "selected group");

		try {
			await updateReceiptGroup(receiptId, targetGroupId);
			await loadReceipts(`Moved receipt to ${targetGroupName}.`);
		} catch (error) {
			setStatus(
				"receipt-status",
				error instanceof Error
					? error.message
					: "Failed to move receipt",
				true,
			);
		}
	});
};

export const attachInventoryPageEvents = () => {
	const treeRoot = document.getElementById("inventory-tree-root");
	const modal = document.getElementById("inventory-container-modal");
	const modalForm = document.getElementById("inventory-container-modal-form");
	const consumeModal = document.getElementById("inventory-consume-modal");
	const consumeForm = document.getElementById("inventory-consume-form");
	const consumeItemName = document.getElementById("inventory-consume-item-name");
	const consumeDateInput = document.getElementById("inventory-consume-date");
	if (
		!treeRoot ||
		!modal ||
		!(modalForm instanceof HTMLFormElement) ||
		!consumeModal ||
		!(consumeForm instanceof HTMLFormElement) ||
		!consumeItemName ||
		!(consumeDateInput instanceof HTMLInputElement)
	) {
		return;
	}

	let activeDropTarget: HTMLElement | null = null;
	let pendingConsumeItem: InventoryItem | null = null;

	const clearDropTarget = () => {
		activeDropTarget?.classList.remove("inventory-drop-target--active");
		activeDropTarget = null;
	};

	const closeModal = () => {
		modal.hidden = true;
		document.body.classList.remove("modal-open");
		modalForm.reset();
	};

	const openModal = () => {
		modal.hidden = false;
		document.body.classList.add("modal-open");
		const nameInput = document.getElementById("inventory-container-name");
		if (nameInput instanceof HTMLInputElement) {
			nameInput.focus();
		}
	};

	const closeConsumeModal = () => {
		consumeModal.hidden = true;
		document.body.classList.remove("modal-open");
		pendingConsumeItem = null;
		consumeForm.reset();
		const submitButton = consumeForm.querySelector<HTMLButtonElement>(
			'button[type="submit"]',
		);
		if (submitButton) {
			submitButton.disabled = false;
		}
		setStatus("inventory-consume-status", "");
	};

	const openConsumeModal = (item: InventoryItem) => {
		pendingConsumeItem = item;
		consumeItemName.textContent = item.name;
		consumeDateInput.value = formatDateTimeLocalInput();
		const submitButton = consumeForm.querySelector<HTMLButtonElement>(
			'button[type="submit"]',
		);
		if (submitButton) {
			submitButton.disabled = false;
		}
		consumeModal.hidden = false;
		document.body.classList.add("modal-open");
		consumeDateInput.focus();
	};

	const rerenderTreeFromState = () => {
		if (!inventoryTreeState) {
			return;
		}
		renderInventoryTree(inventoryTreeState.containers, inventoryTreeState.items);
	};

	const isContainerDropInvalid = (
		containerId: number,
		targetParentId: number | null,
	) => {
		if (targetParentId === null) {
			return false;
		}
		if (targetParentId === containerId) {
			return true;
		}
		if (!inventoryTreeState) {
			return false;
		}

		const containersById = new Map(
			inventoryTreeState.containers.map((container) => [
				container.id,
				container,
			]),
		);
		let currentId = targetParentId;

		while (currentId !== null) {
			if (currentId === containerId) {
				return true;
			}
			currentId =
				containersById.get(currentId)?.parent_container_id ?? null;
		}

		return false;
	};

	treeRoot.addEventListener("click", async (event) => {
		const target = event.target;
		if (!(target instanceof HTMLElement)) {
			return;
		}

		const toggleButton = target.closest<HTMLElement>(
			"[data-toggle-inventory-container-id]",
		);
		if (toggleButton) {
			const containerId = Number(
				toggleButton.dataset.toggleInventoryContainerId,
			);
			if (Number.isInteger(containerId)) {
				if (collapsedInventoryContainerIds.has(containerId)) {
					collapsedInventoryContainerIds.delete(containerId);
				} else {
					collapsedInventoryContainerIds.add(containerId);
				}
				rerenderTreeFromState();
			}
			return;
		}

		const openButton = target.closest<HTMLElement>(
			"[data-open-inventory-container-modal]",
		);
		if (openButton) {
			openModal();
			return;
		}

		const consumeButton = target.closest<HTMLElement>(
			"[data-consume-inventory-item-id]",
		);
		if (consumeButton) {
			const itemId = Number(
				consumeButton.dataset.consumeInventoryItemId,
			);
			if (!Number.isInteger(itemId)) {
				return;
			}

			const item = inventoryTreeState?.items.find(
				(candidate) => candidate.id === itemId,
			);
			if (!item) {
				setStatus("inventory-status", "Inventory item was not found.", true);
				return;
			}

			openConsumeModal(item);
			return;
		}

		if (target.closest("[data-close-inventory-container-modal]")) {
			closeModal();
			return;
		}

		const deleteButton = target.closest<HTMLElement>(
			"[data-delete-inventory-container-id]",
		);
		if (!deleteButton) {
			return;
		}

		const containerId = Number(
			deleteButton.dataset.deleteInventoryContainerId,
		);
		if (!Number.isInteger(containerId)) {
			return;
		}

		const containerName =
			deleteButton.dataset.deleteInventoryContainerName ??
			"this container";
		const confirmed = window.confirm(
			`Delete ${containerName}? Child containers and inventory items will be unassigned.`,
		);
		if (!confirmed) {
			return;
		}

		try {
			await deleteInventoryContainer(containerId);
			await loadInventoryPageData(
				`Deleted container ${containerName}. Child containers and items are now unassigned.`,
			);
		} catch (error) {
			setStatus(
				"inventory-status",
				error instanceof Error
					? error.message
					: "Failed to delete inventory container",
				true,
			);
		}
	});

	treeRoot.addEventListener("change", (event) => {
		const target = event.target;
		if (!(target instanceof HTMLSelectElement) || target.id !== "inventory-item-mode") {
			return;
		}

		if (
			target.value !== "active" &&
			target.value !== "consumed" &&
			target.value !== "all"
		) {
			return;
		}

		inventoryItemMode = target.value;
		void loadInventoryPageData();
	});

	modalForm.addEventListener("submit", async (event) => {
		event.preventDefault();

		const nameInput = modalForm.elements.namedItem("name");
		const notesInput = modalForm.elements.namedItem("notes");
		if (
			!(nameInput instanceof HTMLInputElement) ||
			!(notesInput instanceof HTMLInputElement)
		) {
			return;
		}

		const name = nameInput.value.trim();
		if (!name) {
			setStatus("inventory-status", "Container name is required.", true);
			return;
		}

		try {
			const created = await createInventoryContainer({
				name,
				parent_container_id: null,
				notes: notesInput.value.trim() || null,
			});
			closeModal();
			await loadInventoryPageData(`Created container ${created.name}.`);
		} catch (error) {
			setStatus(
				"inventory-status",
				error instanceof Error
					? error.message
					: "Failed to create inventory container",
				true,
			);
		}
	});

	modal.addEventListener("click", (event) => {
		const target = event.target;
		if (!(target instanceof HTMLElement)) {
			return;
		}
		if (target.dataset.closeInventoryContainerModal !== undefined) {
			closeModal();
		}
	});

	consumeForm.addEventListener("submit", async (event) => {
		event.preventDefault();

		if (!pendingConsumeItem) {
			setStatus("inventory-consume-status", "Inventory item was not found.", true);
			return;
		}

		const rawConsumedAt = consumeDateInput.value.trim();
		const consumedAtDate = rawConsumedAt
			? new Date(rawConsumedAt)
			: new Date();
		if (Number.isNaN(consumedAtDate.getTime())) {
			setStatus("inventory-consume-status", "Consumed date is invalid.", true);
			return;
		}
		const consumedAt = consumedAtDate.toISOString();

		const submitButton = consumeForm.querySelector<HTMLButtonElement>(
			'button[type="submit"]',
		);
		if (submitButton) {
			submitButton.disabled = true;
		}

		const itemName = pendingConsumeItem.name;
		try {
			await updateInventoryItem(pendingConsumeItem.id, {
				consumed_at: consumedAt,
			});
			closeConsumeModal();
			await loadInventoryPageData(`Consumed ${itemName}.`);
		} catch (error) {
			setStatus(
				"inventory-consume-status",
				error instanceof Error
					? error.message
					: "Failed to consume inventory item",
				true,
			);
			if (submitButton) {
				submitButton.disabled = false;
			}
		}
	});

	consumeModal.addEventListener("click", (event) => {
		const target = event.target;
		if (!(target instanceof HTMLElement)) {
			return;
		}
		if (target.dataset.closeInventoryConsumeModal !== undefined) {
			closeConsumeModal();
		}
	});

	window.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && !modal.hidden) {
			closeModal();
		}
		if (event.key === "Escape" && !consumeModal.hidden) {
			closeConsumeModal();
		}
	});

	treeRoot.addEventListener("dragstart", (event) => {
		const target = event.target;
		if (!(target instanceof HTMLElement) || !event.dataTransfer) {
			return;
		}

		const draggable = target.closest<HTMLElement>("[data-drag-kind]");
		if (!draggable) {
			return;
		}

		const kind = draggable.dataset.dragKind;
		const id = Number(draggable.dataset.dragId);
		if (!kind || !Number.isInteger(id)) {
			return;
		}

		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.setData("text/plain", JSON.stringify({ kind, id }));
		draggable.classList.add("inventory-node--dragging");
	});

	treeRoot.addEventListener("dragend", (event) => {
		const target = event.target;
		if (target instanceof HTMLElement) {
			target
				.closest("[data-drag-kind]")
				?.classList.remove("inventory-node--dragging");
		}
		clearDropTarget();
	});

	treeRoot.addEventListener("dragover", (event) => {
		const target = event.target;
		if (!(target instanceof HTMLElement) || !event.dataTransfer) {
			return;
		}

		const dropTarget = target.closest<HTMLElement>("[data-drop-kind]");
		if (!dropTarget) {
			clearDropTarget();
			return;
		}

		event.preventDefault();
		event.dataTransfer.dropEffect = "move";
		if (activeDropTarget !== dropTarget) {
			clearDropTarget();
			activeDropTarget = dropTarget;
			activeDropTarget.classList.add("inventory-drop-target--active");
		}
	});

	treeRoot.addEventListener("drop", async (event) => {
		const target = event.target;
		if (!(target instanceof HTMLElement) || !event.dataTransfer) {
			return;
		}

		const dropTarget = target.closest<HTMLElement>("[data-drop-kind]");
		clearDropTarget();
		if (!dropTarget) {
			return;
		}

		event.preventDefault();

		const rawPayload = event.dataTransfer.getData("text/plain");
		if (!rawPayload) {
			return;
		}

		let payload: { kind?: string; id?: number };
		try {
			payload = JSON.parse(rawPayload) as { kind?: string; id?: number };
		} catch {
			return;
		}

		if (
			(payload.kind !== "item" && payload.kind !== "container") ||
			!Number.isInteger(payload.id)
		) {
			return;
		}

		const dropKind = dropTarget.dataset.dropKind;
		const targetContainerId =
			dropKind === "root"
				? null
				: Number.parseInt(dropTarget.dataset.dropId ?? "", 10);
		if (dropKind === "container" && !Number.isInteger(targetContainerId)) {
			return;
		}

		try {
			if (payload.kind === "item") {
				const normalizedSource =
					inventoryTreeState?.items.find(
						(item) => item.id === payload.id,
					)?.container_id ?? null;
				if (normalizedSource === targetContainerId) {
					return;
				}

				await updateInventoryItemContainer(
					payload.id,
					targetContainerId,
				);
				await loadInventoryPageData("Inventory location updated.");
				return;
			}

			if (isContainerDropInvalid(payload.id, targetContainerId)) {
				setStatus(
					"inventory-status",
					"Container cannot be dropped into itself or one of its descendants.",
					true,
				);
				return;
			}

			const currentContainer = inventoryTreeState?.containers.find(
				(container) => container.id === payload.id,
			);
			if (
				currentContainer &&
				(currentContainer.parent_container_id ?? null) ===
					targetContainerId
			) {
				return;
			}

			await updateInventoryContainerParent(payload.id, targetContainerId);
			await loadInventoryPageData("Container location updated.");
		} catch (error) {
			setStatus(
				"inventory-status",
				error instanceof Error
					? error.message
					: "Failed to update inventory tree",
				true,
			);
		}
	});
};

const renderInventoryDetailRow = (label: string, value: string) => `
	<div>
		<dt>${escapeHtml(label)}</dt>
		<dd>${value}</dd>
	</div>
`;

const renderNullableInventoryDate = (value: string | null) =>
	value ? escapeHtml(formatReceiptDateTime(value)) : "-";

const renderInventoryLinkValue = (href: string, label: string) => `
	<a class="metadata-link" href="${href}" data-link>${escapeHtml(label)}</a>
`;

const renderSelectOption = (
	value: string,
	label: string,
	selectedValue: string,
) => `
	<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>
		${escapeHtml(label)}
	</option>
`;

const getReceiptRowLabel = (
	receiptItem: PurchaseReceiptItem,
	receiptsById: Map<number, PurchaseReceipt>,
	productsById: Map<number, Product>,
) => {
	const receipt = receiptsById.get(receiptItem.receipt_id);
	const product = productsById.get(receiptItem.product_id);
	const receiptLabel = receipt
		? `${receipt.store_name}, ${formatReceiptDateTime(receipt.purchased_at)}`
		: `Receipt #${receiptItem.receipt_id}`;
	const productLabel = product?.name ?? `Product #${receiptItem.product_id}`;
	const totalLabel =
		receipt && receiptItem.line_total !== null
			? `, ${formatMoney(receiptItem.line_total, receipt.currency)}`
			: "";

	return `#${receiptItem.id} - ${receiptLabel} - ${productLabel} - ${receiptItem.quantity} ${receiptItem.unit}${totalLabel}`;
};

const renderInventoryProductOptions = (
	item: InventoryItem,
	products: Product[],
) => {
	const selectedValue = item.product_id === null ? "" : String(item.product_id);
	if (!products.length && item.product_id === null) {
		return renderSelectOption("", "No products in Pupler yet", selectedValue);
	}

	const hasSelectedProduct =
		item.product_id === null ||
		products.some((product) => product.id === item.product_id);
	const fallbackSelectedProduct =
		!hasSelectedProduct && item.product_id !== null
			? renderSelectOption(
					String(item.product_id),
					item.product?.name ?? `Product #${item.product_id}`,
					selectedValue,
				)
			: "";

	return `
		${renderSelectOption("", "No product link", selectedValue)}
		${fallbackSelectedProduct}
		${products
			.map((product) => {
				const label = product.barcode
					? `${product.name} (${product.barcode})`
					: product.name;
				return renderSelectOption(String(product.id), label, selectedValue);
			})
			.join("")}
	`;
};

const renderInventoryReceiptRowOptions = (
	item: InventoryItem,
	receiptItems: PurchaseReceiptItem[],
	receipts: PurchaseReceipt[],
	products: Product[],
) => {
	const selectedValue =
		item.receipt_item_id === null ? "" : String(item.receipt_item_id);
	if (!receiptItems.length && item.receipt_item_id === null) {
		return renderSelectOption(
			"",
			"No receipt rows in Pupler yet",
			selectedValue,
		);
	}

	const receiptsById = new Map(receipts.map((receipt) => [receipt.id, receipt]));
	const productsById = new Map(products.map((product) => [product.id, product]));
	const hasSelectedReceiptRow =
		item.receipt_item_id === null ||
		receiptItems.some((receiptItem) => receiptItem.id === item.receipt_item_id);
	const fallbackSelectedReceiptRow =
		!hasSelectedReceiptRow && item.receipt_item_id !== null
			? renderSelectOption(
					String(item.receipt_item_id),
					`Receipt row #${item.receipt_item_id}`,
					selectedValue,
				)
			: "";

	return `
		${renderSelectOption("", "No receipt row link", selectedValue)}
		${fallbackSelectedReceiptRow}
		${receiptItems
			.map((receiptItem) =>
				renderSelectOption(
					String(receiptItem.id),
					getReceiptRowLabel(receiptItem, receiptsById, productsById),
					selectedValue,
				),
			)
			.join("")}
	`;
};

export const renderInventoryItemDetail = (
	item: InventoryItem,
	container: InventoryContainer | null,
	products: Product[],
	receiptItems: PurchaseReceiptItem[],
	receipts: PurchaseReceipt[],
) => {
	const page = document.getElementById("inventory-item-detail-page");
	if (!page) {
		return;
	}

	const expirationTag = getExpirationTag(item);
	const statusTag = item.consumed_at
		? '<span class="tag tag--neutral">Consumed</span>'
		: '<span class="tag">Active</span>';
	const containerValue =
		item.container_id === null
			? "Top level"
			: container
				? renderInventoryLinkValue(
						`/inventory/containers/${container.id}`,
						container.name,
					)
				: `Container #${item.container_id}`;
	const productValue =
		item.product_id === null
			? "-"
			: item.product
				? renderInventoryLinkValue(
						`/products/${item.product.id}`,
						item.product.name,
					)
				: `Product #${item.product_id}`;
	const ingredientValue =
		item.ingredient_id === null
			? "-"
			: item.ingredient
				? escapeHtml(item.ingredient.name)
				: `Ingredient #${item.ingredient_id}`;
	const itemImages = item.inventory_item_images ?? [];

	page.innerHTML = `
		<section class="page-heading page-heading--compact">
			<div>
				<span class="eyebrow">Inventory Item</span>
				<h1 class="page-title">${escapeHtml(item.name)}</h1>
			</div>
			<a class="secondary action-link" href="/inventory" data-link>Back To Inventory</a>
		</section>

		<section class="workspace inventory-item-detail-grid">
			<div class="card panel">
				<div class="section-header">
					<h2>Properties</h2>
					${statusTag}
				</div>
				<dl class="receipt-metadata">
					${renderInventoryDetailRow("Name", escapeHtml(item.name))}
					${renderInventoryDetailRow("Quantity", `${item.quantity}`)}
					${renderInventoryDetailRow("Unit", escapeHtml(item.unit))}
					${renderInventoryDetailRow("Purchased", renderNullableInventoryDate(item.purchased_at))}
					${renderInventoryDetailRow("Expires", renderNullableInventoryDate(item.expires_at))}
					${renderInventoryDetailRow("Consumed", renderNullableInventoryDate(item.consumed_at))}
					${renderInventoryDetailRow("Notes", item.notes ? escapeHtml(item.notes) : "-")}
					${renderInventoryDetailRow("Created", escapeHtml(formatReceiptDateTime(item.created_at)))}
					${renderInventoryDetailRow("Updated", escapeHtml(formatReceiptDateTime(item.updated_at)))}
				</dl>
			</div>

			<div class="card panel">
				<div class="section-header">
					<h2>Links & IDs</h2>
					<span class="${expirationTag.className}">${escapeHtml(expirationTag.label)}</span>
				</div>
				<form id="inventory-item-links-form" class="inventory-link-form">
					<label>
						Product
						<select id="inventory-item-product-id" name="product_id">
							${renderInventoryProductOptions(item, products)}
						</select>
					</label>
					<label>
						Receipt Row
						<select id="inventory-item-receipt-item-id" name="receipt_item_id">
							${renderInventoryReceiptRowOptions(item, receiptItems, receipts, products)}
						</select>
					</label>
					<div class="actions">
						<button class="primary" type="submit">Save Links</button>
					</div>
				</form>
				<div id="inventory-item-links-status" class="status"></div>
				<dl class="receipt-metadata">
					${renderInventoryDetailRow("Inventory Item ID", `${item.id}`)}
					${renderInventoryDetailRow("Location", containerValue)}
					${renderInventoryDetailRow("Container ID", item.container_id === null ? "-" : `${item.container_id}`)}
					${renderInventoryDetailRow("Product", productValue)}
					${renderInventoryDetailRow("Product ID", item.product_id === null ? "-" : `${item.product_id}`)}
					${renderInventoryDetailRow("Ingredient", ingredientValue)}
					${renderInventoryDetailRow("Ingredient ID", item.ingredient_id === null ? "-" : `${item.ingredient_id}`)}
					${renderInventoryDetailRow("Receipt Row ID", item.receipt_item_id === null ? "-" : `${item.receipt_item_id}`)}
				</dl>
			</div>

			<div class="card panel inventory-item-images-panel">
				<h2>Images</h2>
				${
					itemImages.length
						? `
							<div class="recipe-image-gallery inventory-item-image-gallery">
								${itemImages
									.map(
										(image) => `
											<article class="recipe-image-card">
												<img
													class="recipe-image-card__image"
													src="/api/inventory-items/${item.id}/pictures/${image.id}?updated=${encodeURIComponent(image.created_at)}"
													alt="${escapeHtml(image.file.filename ?? item.name)}"
												/>
												<div class="recipe-image-card__meta">
													<div>
														<strong>${escapeHtml(image.file.filename ?? `Image #${image.id}`)}</strong>
														<div class="section-copy">${formatReceiptDateTime(image.created_at)}</div>
													</div>
													<button
														class="secondary"
														type="button"
														data-delete-inventory-item-image-id="${image.id}"
													>
														Remove
													</button>
												</div>
											</article>
										`,
									)
									.join("")}
							</div>
						`
						: '<div class="empty">No inventory item images uploaded yet.</div>'
				}
				<form id="inventory-item-picture-form" class="recipe-picture__form inventory-item-picture__form">
					${renderUploadDropzone({
						inputId: "inventory-item-picture-input",
						label: "Images",
						name: "picture",
						multiple: true,
						submitOnDrop: true,
						emptyText: "Choose one or more images or drop them here.",
					})}
					<div class="actions">
						<button class="secondary" type="submit">Upload Images</button>
					</div>
				</form>
				<div id="inventory-item-picture-status" class="status"></div>
			</div>
		</section>
	`;
	attachUploadDropzones(page);
};

export const attachInventoryItemDetailEvents = (
	item: InventoryItem,
	container: InventoryContainer | null,
	products: Product[],
	receiptItems: PurchaseReceiptItem[],
	receipts: PurchaseReceipt[],
) => {
	const rerenderInventoryItemDetail = (
		updated: InventoryItem,
		statusId: string,
		statusMessage: string,
	) => {
		renderInventoryItemDetail(
			updated,
			container,
			products,
			receiptItems,
			receipts,
		);
		attachInventoryItemDetailEvents(
			updated,
			container,
			products,
			receiptItems,
			receipts,
		);
		setStatus(statusId, statusMessage);
	};

	const form = document.getElementById("inventory-item-links-form");
	if (form instanceof HTMLFormElement) {
		form.addEventListener("submit", async (event) => {
			event.preventDefault();

			const productInput = document.getElementById("inventory-item-product-id");
			const receiptItemInput = document.getElementById(
				"inventory-item-receipt-item-id",
			);
			if (
				!(productInput instanceof HTMLSelectElement) ||
				!(receiptItemInput instanceof HTMLSelectElement)
			) {
				return;
			}

			const productId = productInput.value
				? Number.parseInt(productInput.value, 10)
				: null;
			const receiptItemId = receiptItemInput.value
				? Number.parseInt(receiptItemInput.value, 10)
				: null;

			if (
				(productInput.value && !Number.isInteger(productId)) ||
				(receiptItemInput.value && !Number.isInteger(receiptItemId))
			) {
				setStatus("inventory-item-links-status", "Selected link is invalid.", true);
				return;
			}

			const selectedProduct =
				productId === null
					? null
					: products.find((product) => product.id === productId) ??
						(item.product?.id === productId ? item.product : null);
			const payload: {
				ingredient_id?: number | null;
				product_id: number | null;
				receipt_item_id: number | null;
			} = {
				product_id: productId,
				receipt_item_id: receiptItemId,
			};

			if (
				selectedProduct?.ingredient_id !== null &&
				selectedProduct?.ingredient_id !== undefined
			) {
				payload.ingredient_id = selectedProduct.ingredient_id;
			}

			try {
				const updated = await updateInventoryItem(item.id, payload);
				rerenderInventoryItemDetail(
					updated,
					"inventory-item-links-status",
					`Saved links for ${updated.name}.`,
				);
			} catch (error) {
				setStatus(
					"inventory-item-links-status",
					error instanceof Error
						? error.message
						: "Failed to update inventory item links.",
					true,
				);
			}
		});
	}

	const pictureForm = document.getElementById("inventory-item-picture-form");
	if (pictureForm instanceof HTMLFormElement) {
		pictureForm.addEventListener("submit", async (event) => {
			event.preventDefault();

			const pictureInput = document.getElementById(
				"inventory-item-picture-input",
			);
			if (!(pictureInput instanceof HTMLInputElement)) {
				return;
			}

			const pictures = pictureInput.files
				? Array.from(pictureInput.files)
				: [];
			if (!pictures.length) {
				setStatus(
					"inventory-item-picture-status",
					"Choose one or more images before uploading.",
					true,
				);
				return;
			}

			try {
				await uploadInventoryItemPictures(item.id, pictures);
				const updated = await fetchInventoryItem(item.id);
				rerenderInventoryItemDetail(
					updated,
					"inventory-item-picture-status",
					pictures.length === 1
						? `Uploaded 1 image for ${updated.name}.`
						: `Uploaded ${pictures.length} images for ${updated.name}.`,
				);
			} catch (error) {
				setStatus(
					"inventory-item-picture-status",
					error instanceof Error
						? error.message
						: "Failed to upload inventory item images",
					true,
				);
			}
		});
	}

	document
		.getElementById("inventory-item-detail-page")
		?.addEventListener("click", async (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) {
				return;
			}

			const deleteButton = target.closest<HTMLElement>(
				"[data-delete-inventory-item-image-id]",
			);
			if (!deleteButton) {
				return;
			}

			const imageId = Number.parseInt(
				deleteButton.dataset.deleteInventoryItemImageId ?? "",
				10,
			);
			if (!Number.isInteger(imageId)) {
				return;
			}

			try {
				await deleteInventoryItemImage(item.id, imageId);
				const updated = await fetchInventoryItem(item.id);
				rerenderInventoryItemDetail(
					updated,
					"inventory-item-picture-status",
					"Removed inventory item image.",
				);
			} catch (error) {
				setStatus(
					"inventory-item-picture-status",
					error instanceof Error
						? error.message
						: "Failed to delete inventory item image",
					true,
				);
			}
		});
};

export { navigate };
