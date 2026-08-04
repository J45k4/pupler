import { InfiniteScroll } from "./infinite-scroll";
import {
	getCurrentUser,
	logout,
} from "./auth";
import { attachNavigationMenu, renderNavbar } from "./navbar";
import {
	navigate,
} from "./router";
import {
	createProductCategoryInput,
	createUnitSelect,
	setUnitSelectValue,
} from "./ui/form-fields";
import {
	attachUploadDropzones,
	createUploadDropzone,
} from "./ui/upload-dropzone";
import { displayCurrency, displayMoneyAmount } from "../currency";
import {
	createElement,
	createEmptyState,
	getElementById,
	querySelector,
	querySelectorAll,
} from "./lib/dom";

export {
	createProductCategoryInput,
	createUnitSelect,
} from "./ui/form-fields";
export {
	attachUploadDropzones,
	createUploadDropzone,
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
	weekly_average_totals: SpendingAverageTotal[];
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
let navbarAbortController: AbortController | null = null;
let currentTimeProjectChoices: TimeProjectChoice[] = [];
let receiptBoardState: {
	groups: Group[];
	receipts: PurchaseReceipt[];
} | null = null;
let receiptKanbanScrollCleanup: (() => void) | null = null;
export let receiptViewModeOverride: ReceiptViewMode | null = null;
let inventoryTreeState: {
	containers: InventoryContainer[];
	items: InventoryItem[];
} | null = null;
let collapsedInventoryContainerIds = new Set<number>();
let inventoryItemMode: InventoryItemMode = "active";

const resetPage = () => {
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
	navbarAbortController?.abort();
	navbarAbortController = null;
	document.documentElement.classList.remove("nav-open");
	document.body.classList.remove("modal-open", "nav-open");
	document.body.replaceChildren();
};

export const renderAppShell = (shellClassName = "") => {
	const shellClasses = [
		...new Set(["page-shell", "page-shell--wide", shellClassName].filter(Boolean)),
	].join(" ");
	resetPage();
	const main = createElement("main", { className: shellClasses });
	const navbar = renderNavbar(window.location.pathname, getCurrentUser());
	navbarAbortController = new AbortController();
	attachNavigationMenu(navbar, navbarAbortController.signal);
	navbar
		.querySelector(".account-menu__logout")
		?.addEventListener("click", async () => {
			try {
				await logout();
				navigate("/login");
			} catch (error) {
				console.error(error);
			}
		});
	document.body.append(navbar, main);
	return main;
};

export const renderPage = (content: Node, shellClassName = "") => {
	const main = renderAppShell(shellClassName);
	main.replaceChildren(content);
	return main;
};

export const setStatus = (elementId: string, message: string, isError = false) => {
	const status = getElementById(elementId);
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
	const results = getElementById("expiration-results");
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

const createRecipeIngredientList = (ingredients: RecipeIngredient[]) => {
	if (!ingredients.length) return createEmptyState("No ingredients added yet.");
	return createElement("div", { className: "recipe-ingredient-list" }, ...ingredients.map((ingredient) => {
		const select = createElement("button", { className: "recipe-ingredient-item__select", properties: { type: "button" } });
		select.dataset.editRecipeIngredientId = String(ingredient.id);
		select.dataset.recipeIngredientName = encodeURIComponent(ingredient.name);
		select.dataset.recipeIngredientQuantity = String(ingredient.quantity);
		select.dataset.recipeIngredientUnit = encodeURIComponent(ingredient.unit);
		select.dataset.recipeIngredientOptional = String(ingredient.is_optional);
		select.dataset.recipeIngredientNotes = encodeURIComponent(ingredient.notes ?? "");
		const defaultUnit = ingredient.ingredient?.default_unit ?? ingredient.product?.default_unit;
		const header = createElement("div", { className: "recipe-ingredient-item__header" }, createElement("strong", {}, ingredient.name), ingredient.is_optional ? createElement("span", { className: "tag tag--neutral" }, "Optional") : null);
		const meta = createElement("div", { className: "recipe-ingredient-item__meta" }, createElement("span", {}, `${ingredient.quantity} ${ingredient.unit}`), defaultUnit && defaultUnit !== ingredient.unit ? createElement("span", {}, `Default unit: ${defaultUnit}`) : null);
		select.append(createElement("div", { className: "recipe-ingredient-item__main" }, header, meta, ingredient.product ? createElement("div", { className: "section-copy" }, `Product link: ${ingredient.product.name}`) : null, ingredient.notes ? createElement("div", { className: "section-copy" }, ingredient.notes) : null));
		const remove = createElement("button", { className: "secondary", properties: { type: "button" } }, "Remove");
		remove.dataset.deleteRecipeIngredientId = String(ingredient.id);
		return createElement("article", { className: "recipe-ingredient-item" }, select, remove);
	}));
};

export const renderRecipeDetail = (recipe: Recipe) => {
	const page = getElementById("recipe-detail-page");
	if (!page) return;
	const ingredients = recipe.ingredients ?? [];
	const images = recipe.recipe_images ?? [];
	const back = createElement("a", { className: "secondary action-link", properties: { href: "/recipes" }, attributes: { "data-link": "" } }, "Back To Recipes");
	const gallery = images.length ? createElement("div", { className: "recipe-image-gallery" }, ...images.map((image) => {
		const remove = createElement("button", { className: "secondary", properties: { type: "button" } }, "Remove");
		remove.dataset.deleteRecipeImageId = String(image.id);
		return createElement("article", { className: "recipe-image-card" },
			createElement("img", { className: "recipe-image-card__image", properties: { src: `/api/recipes/${recipe.id}/pictures/${image.id}?updated=${encodeURIComponent(image.created_at)}`, alt: image.file.filename ?? recipe.name } }),
			createElement("div", { className: "recipe-image-card__meta" }, createElement("div", {}, createElement("strong", {}, image.file.filename ?? `Image #${image.id}`), createElement("div", { className: "section-copy" }, formatReceiptDateTime(image.created_at))), remove),
		);
	})) : createEmptyState("No recipe images uploaded yet.");
	const pictureForm = createElement("form", { id: "recipe-picture-form", className: "recipe-picture__form" }, createUploadDropzone({ inputId: "recipe-picture-input", label: "Images", name: "picture", multiple: true, submitOnDrop: true, emptyText: "Choose one or more images or drop them here." }), createElement("div", { className: "actions" }, createElement("button", { className: "secondary", properties: { type: "submit" } }, "Upload Images")));
	const summary = createElement("dl", { className: "receipt-metadata" }, ...[
		["Status", recipe.is_active ? "Active" : "Inactive"],
		["Servings", recipe.servings === null ? "-" : recipe.servings === 1 ? "1 serving" : `${recipe.servings} servings`],
		["Created", formatReceiptDateTime(recipe.created_at)],
		["Updated", formatReceiptDateTime(recipe.updated_at)],
	].map(([label, value]) => createElement("div", {}, createElement("dt", {}, label), createElement("dd", {}, value))));
	const active = createElement("input", { id: "recipe-detail-is-active", properties: { name: "is_active", type: "checkbox", checked: recipe.is_active } });
	const detailForm = createElement("form", { id: "recipe-detail-form" },
		createElement("label", { properties: { htmlFor: "recipe-detail-name" } }, "Name", createElement("input", { id: "recipe-detail-name", properties: { name: "name", value: recipe.name, required: true } })),
		createElement("div", { className: "row" }, createElement("label", { properties: { htmlFor: "recipe-detail-servings" } }, "Servings", createElement("input", { id: "recipe-detail-servings", properties: { name: "servings", type: "number", inputMode: "numeric", min: "1", step: "1", value: recipe.servings === null ? "" : String(recipe.servings), placeholder: "4" } })), createElement("label", { className: "checkbox-toggle recipe-form__toggle", properties: { htmlFor: "recipe-detail-is-active" } }, active, createElement("span", {}, "Active recipe"))),
		createElement("label", { properties: { htmlFor: "recipe-detail-description" } }, "Description", createElement("textarea", { id: "recipe-detail-description", properties: { name: "description", rows: 4, value: recipe.description ?? "", placeholder: "Short summary of the recipe" } })),
		createElement("label", { properties: { htmlFor: "recipe-detail-instructions" } }, "Instructions", createElement("textarea", { id: "recipe-detail-instructions", properties: { name: "instructions", rows: 10, value: recipe.instructions ?? "", placeholder: "Describe the cooking steps" } })),
		createElement("div", { className: "actions" }, createElement("button", { className: "primary", properties: { type: "submit" } }, "Save Recipe")),
	);
	const ingredientHeader = createElement("div", { className: "section-header recipe-detail-section__header" }, createElement("div", { className: "recipe-ingredient-summary" }, createElement("h2", {}, "Ingredients"), createElement("span", { className: "tag tag--neutral" }, `${ingredients.length} ${ingredients.length === 1 ? "item" : "items"}`)), createElement("button", { id: "open-recipe-ingredient-modal-button", className: "primary", properties: { type: "button" } }, "Add Ingredient"));
	const optional = createElement("input", { id: "recipe-ingredient-optional", properties: { name: "is_optional", type: "checkbox" } });
	const ingredientForm = createElement("form", { id: "recipe-ingredient-modal-form", className: "recipe-ingredient-form" },
		createElement("input", { id: "recipe-ingredient-id", properties: { name: "ingredient_id", type: "hidden" } }),
		createElement("label", { properties: { htmlFor: "recipe-ingredient-name" } }, "Ingredient", createElement("input", { id: "recipe-ingredient-name", properties: { name: "name", placeholder: "Tomatoes", required: true } })),
		createElement("div", { className: "recipe-ingredient-form__row" }, createElement("label", { properties: { htmlFor: "recipe-ingredient-quantity" } }, "Quantity", createElement("input", { id: "recipe-ingredient-quantity", properties: { name: "quantity", type: "number", inputMode: "decimal", min: "0.01", step: "0.01", value: "1", required: true } })), createUnitSelect({ id: "recipe-ingredient-unit", name: "unit", label: "Unit", selectedValue: "pcs", required: true }), createElement("label", { className: "checkbox-toggle recipe-ingredient-form__toggle", properties: { htmlFor: "recipe-ingredient-optional" } }, optional, createElement("span", {}, "Optional"))),
		createElement("label", { properties: { htmlFor: "recipe-ingredient-notes" } }, "Notes", createElement("input", { id: "recipe-ingredient-notes", properties: { name: "notes", placeholder: "Finely chopped or room temperature" } })),
		createElement("div", { className: "actions" }, createElement("button", { id: "recipe-ingredient-modal-submit", className: "primary", properties: { type: "submit" } }, "Add Ingredient")),
	);
	const close = createElement("button", { className: "secondary", properties: { type: "button" }, attributes: { "aria-label": "Close add ingredient modal", "data-recipe-ingredient-modal-close": "" } }, "Close");
	const backdrop = createElement("div", { className: "recipe-ingredient-modal__backdrop", attributes: { "data-recipe-ingredient-modal-close": "" } });
	const modal = createElement("div", { id: "recipe-ingredient-modal", className: "recipe-ingredient-modal", properties: { hidden: true } }, backdrop, createElement("div", { className: "recipe-ingredient-modal__dialog card panel", attributes: { role: "dialog", "aria-modal": "true", "aria-labelledby": "recipe-ingredient-modal-title" } }, createElement("div", { className: "section-header section-header--end" }, createElement("h2", { id: "recipe-ingredient-modal-title" }, "Add Ingredient"), close), ingredientForm, createElement("div", { id: "recipe-ingredient-modal-status", className: "status" })));
	page.replaceChildren(
		createElement("section", { className: "page-heading page-heading--compact" }, back),
		createElement("section", { className: "workspace recipe-detail-grid" },
			createElement("div", { className: "card panel" }, createElement("h2", {}, "Images"), gallery, pictureForm, createElement("h2", {}, "Summary"), summary, createElement("div", { id: "recipe-picture-status", className: "status" })),
			createElement("div", { className: "recipe-detail-stack" }, createElement("div", { className: "card panel" }, createElement("section", { className: "recipe-detail-section" }, createElement("h2", {}, "Recipe Details"), detailForm, createElement("div", { id: "recipe-detail-status", className: "status" }))), createElement("div", { className: "card panel" }, createElement("section", { className: "recipe-detail-section" }, ingredientHeader, createRecipeIngredientList(ingredients), createElement("div", { id: "recipe-ingredient-status", className: "status" })))),
		),
		modal,
	);
	attachUploadDropzones(page);
	attachRecipeDetailEvents(recipe.id);
};

const createProductCard = (product: Product) => {
	const link = createElement("a", { className: "product" });
	link.href = `/products/${product.id}`;
	link.dataset.link = "";

	const media = createElement("div", { className: "product__media" });
	const image = createElement("img", { className: "product__image" });
	image.src = `/api/products/${product.id}/picture`;
	image.alt = product.name;
	image.loading = "lazy";
	image.addEventListener("error", () => media.remove());
	media.append(image);

	const header = document.createElement("header");
	header.append(createElement("h3", { text: product.name }));
	if (product.is_perishable) {
		header.append(createElement("span", { className: "tag", text: "Perishable" }));
	}

	const details = document.createElement("dl");
	for (const [label, value] of [
		["Category", product.category ?? "-"],
		["Barcode", product.barcode ?? "-"],
		["Unit", product.default_unit ?? "-"],
	] as const) {
		details.append(
			createElement(
				"div",
				{},
				createElement("dt", { text: label }),
				createElement("dd", { text: value }),
			),
		);
	}

	link.append(media, header, details);
	return link;
};

const renderProducts = (products: Product[]) => {
	const results = getElementById("results");
	if (!results) {
		return;
	}

	productInfiniteScroll?.destroy();
	productInfiniteScroll = new InfiniteScroll(
		{
			batchSize: 12,
			empty: () => createEmptyState("No products found."),
			renderItem: createProductCard,
			root: results,
		},
		products,
	);
	productInfiniteScroll.render();
};

export const renderProductDetail = (product: Product) => {
	const page = getElementById("product-detail-page");
	if (!page) return;
	const pictureUrl = product.picture_file?.created_at ? `/api/products/${product.id}/picture?updated=${encodeURIComponent(product.picture_file.created_at)}` : `/api/products/${product.id}/picture`;
	const back = createElement("a", { className: "secondary action-link", properties: { href: "/products" }, attributes: { "data-link": "" } }, "Back To Products");
	const picture = createElement("img", { className: "receipt-picture__image", properties: { src: pictureUrl, alt: product.name, loading: "lazy" } });
	const pictureRoot = createElement("div", { className: "receipt-picture" }, picture);
	picture.addEventListener("error", () => pictureRoot.replaceChildren(createEmptyState("No product picture uploaded.")));
	const pictureActions = createElement("div", { className: "actions" }, createElement("button", { className: "secondary", properties: { type: "submit" } }, "Upload Picture"));
	if (product.picture_file) pictureActions.append(createElement("button", { id: "product-picture-delete", className: "secondary", properties: { type: "button" } }, "Remove Picture"));
	const pictureForm = createElement("form", { id: "product-picture-form", className: "product-picture__form" }, createUploadDropzone({ inputId: "product-picture-input", label: "Picture", name: "picture", submitOnDrop: true, emptyText: "Choose a product image or drop one here." }), pictureActions);
	const perishable = createElement("select", { id: "product-detail-is-perishable" }, createElement("option", { properties: { value: "true", selected: product.is_perishable } }, "true"), createElement("option", { properties: { value: "false", selected: !product.is_perishable } }, "false"));
	const detailForm = createElement("form", { id: "product-detail-form" },
		createElement("label", {}, "Name", createElement("input", { id: "product-detail-name", properties: { value: product.name, required: true } })),
		createElement("div", { className: "row" }, createProductCategoryInput({ id: "product-detail-category", label: "Category", value: product.category, required: true }), createUnitSelect({ id: "product-detail-default-unit", name: "default_unit", label: "Unit", selectedValue: product.default_unit, placeholderLabel: "No default unit" })),
		createElement("label", {}, "Ingredient", createElement("input", { id: "product-detail-ingredient-name", properties: { value: product.ingredient?.name ?? "", placeholder: "Sausage" } })),
		createElement("label", {}, "Barcode", createElement("input", { id: "product-detail-barcode", properties: { value: product.barcode ?? "", placeholder: "6414893400012" } })),
		createElement("label", {}, "Perishable", perishable),
		createElement("div", { className: "actions" }, createElement("button", { className: "primary", properties: { type: "submit" } }, "Save Product")),
	);
	const metadata = createElement("dl", { className: "receipt-metadata" }, ...[
		["Ingredient Link", product.ingredient?.name ?? "-"],
		["Created", formatReceiptDateTime(product.created_at)],
		["Updated", formatReceiptDateTime(product.updated_at)],
	].map(([label, value]) => createElement("div", {}, createElement("dt", {}, label), createElement("dd", {}, value))));
	page.replaceChildren(
		createElement("section", { className: "page-heading page-heading--compact" }, createElement("div", {}, createElement("span", { className: "eyebrow" }, "Product")), back),
		createElement("section", { className: "workspace product-detail-grid" },
			createElement("div", { className: "card panel" }, createElement("h2", {}, "Picture"), pictureRoot, pictureForm, createElement("div", { id: "product-picture-status", className: "status" })),
			createElement("div", { className: "card panel" }, createElement("div", { className: "section-header" }, createElement("h2", {}, "Details"), createElement("span", { className: product.is_perishable ? "tag" : "tag tag--neutral" }, product.is_perishable ? "Perishable" : "Shelf stable")), detailForm, metadata, createElement("div", { id: "product-detail-status", className: "status" })),
		),
	);
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
			typeof body === "object" && body !== null && "error" in body
				? (body.error ?? "Time tracking request failed")
				: "Time tracking request failed",
		);
	}

	return body as T;
};

const fetchTimeEntries = () =>
	timeApiJson<TimeEntry[]>("/api/time-entries?sort=started_at&order=desc");

const stopTimeEntry = (id: number) =>
	timeApiJson<TimeEntry>(`/api/time-entries/${id}/stop`, {
		method: "POST",
		body: JSON.stringify({}),
	});

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

	const link = createElement("a", {
		className: "inventory-expiration-item__main",
	});
	link.href = `/inventory/items/${item.id}`;
	link.dataset.link = "";
	link.append(createElement("strong", { text: item.name }));
	link.append(
		createElement(
			"div",
			{ className: "inventory-node__meta" },
			createElement("span", { text: `${item.quantity} ${item.unit}` }),
			createElement("span", { text: location }),
			createElement("span", {
				text: item.expires_at
					? `Expires ${formatReceiptDateTime(item.expires_at)}`
					: "No expiration date",
			}),
		),
	);

	const actions = createElement("div", {
		className: "inventory-expiration-item__actions",
	});
	actions.append(
		createElement("span", { className: tag.className, text: tag.label }),
	);
	if (options.showConsumeAction) {
		const consume = createElement("button", {
			className: "secondary inventory-node__button",
			text: "Consume",
		});
		consume.type = "button";
		consume.dataset.consumeExpirationItemId = String(item.id);
		consume.dataset.consumeExpirationItemName = item.name;
		actions.append(consume);
	}

	return createElement(
		"div",
		{ className: "inventory-expiration-item" },
		link,
		actions,
	);
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
	const root = getElementById("dashboard-expiration-list");
	if (!root) {
		return;
	}

	if (!items.length) {
		root.replaceChildren(createEmptyState("No active inventory items."));
		return;
	}

	const containersById = createContainerNameMap(containers);
	const sortedItems = sortInventoryItemsByExpiration(items).slice(0, 5);

	root.replaceChildren(
		createElement(
			"div",
			{ className: "inventory-expiration-list" },
			sortedItems.map((item) => renderExpirationItem(item, containersById)),
		),
	);
};

const renderExpirationResults = (
	containers: InventoryContainer[],
	items: InventoryItem[],
) => {
	const root = getElementById("expiration-results");
	if (!root) {
		return;
	}

	const containersById = createContainerNameMap(containers);
	expirationInfiniteScroll?.destroy();
	expirationInfiniteScroll = new InfiniteScroll(
		{
			batchSize: 20,
			empty: () => createEmptyState("No active inventory items."),
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
		const currency = displayCurrency(receipt.currency);
		totals.set(
			currency,
			(totals.get(currency) ?? 0) +
				displayMoneyAmount(receipt.total_amount, receipt.currency),
		);
	}

	return [...totals.entries()].sort(([leftCurrency], [rightCurrency]) =>
		leftCurrency.localeCompare(rightCurrency),
	);
};

const createSpendingTotalValues = (totals: Array<[string, number]>) =>
	createElement("div", { className: "dashboard-spending-total__values" }, ...(totals.length ? totals.map(([currency, total]) => createElement("strong", {}, formatMoney(total, currency))) : [createElement("strong", {}, "-")]));

const renderSpendingSummary = (
	receipts: PurchaseReceipt[],
	spendingBreakdown?: SpendingBreakdown,
) => {
	const root = getElementById("dashboard-spending-summary");
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
	const averageWeekTotals =
		spendingBreakdown?.weekly_average_totals.map(
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
		root.replaceChildren(createEmptyState("No receipts recorded yet."));
		return;
	}

	const total = (label: string, values: Array<[string, number]>) => createElement("div", { className: "dashboard-spending-total" }, createElement("span", {}, label), createSpendingTotalValues(values));
	root.replaceChildren(createElement("div", { className: "dashboard-spending-summary" }, total("Last 30 Days", last30DayTotals), total("Average Month Spending", averageMonthTotals), total("Average Weekly Spending", averageWeekTotals), total("Average Daily Spending", averageDayTotals), total("This Month Spending", currentMonthTotals), total("Year To Date Spending", yearToDateTotals), missingTotalCount ? createElement("div", { className: "section-copy" }, `${missingTotalCount} year-to-date receipt(s) have no total amount.`) : null));
};

const renderDashboardTimer = (runningEntry: TimeEntry | null) => {
	const root = getElementById("dashboard-timer");
	if (!root) {
		return;
	}

	if (dashboardTimerInterval !== null) {
		window.clearInterval(dashboardTimerInterval);
		dashboardTimerInterval = null;
	}

	if (!runningEntry) {
		root.replaceChildren(createElement("div", { className: "dashboard-timer-empty" }, createEmptyState("No timer running."), createElement("a", { className: "primary action-link", properties: { href: "/time" }, attributes: { "data-link": "" } }, "Start Timer")));
		return;
	}

	const color = createElement("span", { className: "time-color" });
	color.style.setProperty("--time-color", runningEntry.project?.color ?? "#2d7c6f");
	const edit = createElement("a", { className: "secondary action-link", properties: { href: "/time" }, attributes: { "data-link": "" } }, "Edit");
	const stop = createElement("button", { className: "primary", properties: { type: "button" } }, "Stop");
	stop.dataset.dashboardStopTimeEntryId = String(runningEntry.id);
	root.replaceChildren(createElement("div", { className: "time-running dashboard-timer-running" }, createElement("div", { className: "time-running__project" }, color, createElement("strong", {}, runningEntry.project?.name ?? "No project")), createElement("div", { id: "dashboard-running-timer-duration", className: "time-running__duration" }, formatDuration(timeEntryDurationSeconds(runningEntry))), runningEntry.description ? createElement("p", { className: "section-copy" }, runningEntry.description) : null, createElement("div", { className: "time-running__actions" }, edit, stop)));

	dashboardTimerInterval = window.setInterval(() => {
		if (!root.isConnected) {
			window.clearInterval(dashboardTimerInterval ?? undefined);
			dashboardTimerInterval = null;
			return;
		}
		const duration = getElementById("dashboard-running-timer-duration");
		if (duration) {
			duration.textContent = formatDuration(timeEntryDurationSeconds(runningEntry));
		}
	}, 1000);
};

const renderDashboardShoppingList = (items: ShoppingListItem[]) => {
	const root = getElementById("dashboard-shopping-list");
	if (!root) {
		return;
	}

	const activeItems = items.slice(0, 8);
	if (!activeItems.length) {
		root.replaceChildren(createEmptyState("No active shoppinglist items."));
		return;
	}

	root.replaceChildren(createElement("div", { className: "dashboard-shopping-list" }, ...activeItems.map((item) => {
		const href = createElement("a", { className: "dashboard-shopping-item", properties: { href: "/shoppinglist" }, attributes: { "data-link": "" } });
		const pictureUrl = item.product?.picture_file_id ? `/api/products/${item.product.id}/picture?updated=${encodeURIComponent(item.product.picture_file?.created_at ?? item.updated_at)}` : null;
		if (pictureUrl) {
			const image = createElement("img", { className: "dashboard-shopping-item__image", properties: { src: pictureUrl, alt: item.product?.name ?? item.name, loading: "lazy" } });
			image.addEventListener("error", () => image.remove());
			href.append(image);
		} else href.append(createElement("span", { className: "dashboard-shopping-item__image dashboard-shopping-item__image--placeholder" }));
		href.append(createElement("div", { className: "dashboard-shopping-item__main" }, createElement("strong", {}, item.name), createElement("span", {}, `${item.quantity} ${item.unit}`.trim())));
		return href;
	})));
};

const renderInventoryTree = (
	containers: InventoryContainer[],
	items: InventoryItem[],
) => {
	const root = getElementById("inventory-tree-root");
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
		return createElement("li", { className: "inventory-tree__leaf" }, createInventoryItemNodeLink(item, { draggable: !isConsumed, showConsumeAction: !isConsumed }));
	};

	const renderInventoryItemsList = (containerId: number | null) => {
		const bucket = containerItems.get(containerId) ?? [];
		if (!bucket.length) return null;

		const sortedItems = [...bucket].sort((left, right) => {
			return left.name.localeCompare(right.name);
		});

		return createElement("ul", { className: "inventory-tree__items" }, ...sortedItems.map(renderInventoryItemNode));
	};

	const createContainerNode = (container: InventoryContainer): HTMLLIElement => {
		const childContainers = containerChildren.get(container.id) ?? [];
		const hasChildren =
			childContainers.length > 0 ||
			(containerItems.get(container.id)?.length ?? 0) > 0;
		const itemCount = countNestedItems(container.id);
		const isCollapsed =
			hasChildren && collapsedInventoryContainerIds.has(container.id);

		const toggle = hasChildren ? createElement("button", { className: "inventory-node__toggle", properties: { type: "button" }, attributes: { "aria-label": `${isCollapsed ? "Expand" : "Collapse"} ${container.name}`, "aria-expanded": String(!isCollapsed) } }, isCollapsed ? "▸" : "▾") : createElement("span", { className: "inventory-node__toggle-placeholder" });
		if (toggle instanceof HTMLButtonElement) toggle.dataset.toggleInventoryContainerId = String(container.id);
		const main = createElement("div", { className: "inventory-node__main" }, createElement("div", { className: "inventory-node__title-row" }, toggle, createElement("strong", {}, container.name)), createElement("div", { className: "inventory-node__meta" }, createElement("span", {}, itemCount === 1 ? "1 item" : `${itemCount} items`), container.notes ? createElement("span", {}, container.notes) : null));
		const open = createElement("a", { className: "secondary action-link inventory-node__button", properties: { href: `/inventory/containers/${container.id}` }, attributes: { "data-link": "" } }, "Open");
		const remove = createElement("button", { className: "secondary inventory-node__button", properties: { type: "button" } }, "Delete");
		remove.dataset.deleteInventoryContainerId = String(container.id);
		remove.dataset.deleteInventoryContainerName = container.name;
		const node = createElement("div", { className: "inventory-node inventory-node--container inventory-drop-target", properties: { draggable: true } }, main, createElement("div", { className: "inventory-node__actions" }, open, remove));
		Object.assign(node.dataset, { dragKind: "container", dragId: String(container.id), dropKind: "container", dropId: String(container.id) });
		const branch = createElement("li", { className: "inventory-tree__branch" }, node);
		if (!isCollapsed) branch.append(createElement("div", { className: "inventory-tree__children" }, renderInventoryItemsList(container.id), childContainers.length ? createElement("ul", { className: "inventory-tree__containers" }, ...childContainers.map(createContainerNode)) : null));
		return branch;
	};

	const topLevelContainers = containerChildren.get(null) ?? [];
	const unplacedItems = containerItems.get(null) ?? [];
	const hasRootContent =
		unplacedItems.length > 0 || topLevelContainers.length > 0;

	const mode = createElement("select", { id: "inventory-item-mode", className: "inventory-tree__filter", attributes: { "aria-label": "Inventory view" } }, ...([ ["active", "Active"], ["consumed", "Consumed"], ["all", "All"] ] as const).map(([value, label]) => createElement("option", { properties: { value, selected: inventoryItemMode === value } }, label)));
	const add = createElement("button", { className: "primary inventory-node__button", properties: { type: "button" }, attributes: { "data-open-inventory-container-modal": "" } }, "Add Container");
	const content = createElement("div", { className: "inventory-tree__root-content" }, !items.length ? createElement("div", { className: "inventory-tree__empty" }, getInventoryEmptyMessage(inventoryItemMode)) : null, unplacedItems.length ? renderInventoryItemsList(null) : null, topLevelContainers.length ? createElement("ul", { className: "inventory-tree__containers inventory-tree__containers--root" }, ...topLevelContainers.map(createContainerNode)) : null, !hasRootContent && items.length ? createElement("div", { className: "inventory-tree__empty" }, getInventoryEmptyMessage(inventoryItemMode)) : null);
	const inventoryRoot = createElement("div", { className: "inventory-root inventory-drop-target" }, createElement("div", { className: "inventory-tree__toolbar" }, createElement("div", { id: "inventory-status", className: "status" }), mode, add), content);
	Object.assign(inventoryRoot.dataset, { dropKind: "root", dropId: "" });
	root.replaceChildren(inventoryRoot);
};

export const createInventoryItemNodeLink = (
	item: InventoryItem,
	options: { draggable?: boolean; showConsumeAction?: boolean } = {},
) => {
	const isConsumed = item.consumed_at !== null;
	const root = createElement("div", {
		className: `inventory-node inventory-node--item${isConsumed ? " inventory-node--consumed" : ""}`,
	});
	if (options.draggable) {
		root.draggable = true;
		root.dataset.dragKind = "item";
		root.dataset.dragId = String(item.id);
		root.dataset.sourceContainerId = String(item.container_id ?? "");
	}
	const link = createElement("a", {
		className: "inventory-node__main inventory-node__link",
	});
	link.href = `/inventory/items/${item.id}`;
	link.dataset.link = "";
	const metadata = createElement(
		"div",
		{ className: "inventory-node__meta" },
		createElement("span", { text: `${item.quantity} ${item.unit}` }),
	);
	const meta = getInventoryItemMeta(item);
	if (meta) metadata.append(createElement("span", { text: meta }));
	link.append(createElement("strong", { text: item.name }), metadata);
	root.append(link);
	if (options.showConsumeAction) {
		const consume = createElement("button", {
			className: "secondary inventory-node__button",
			text: "Consume",
		});
		consume.type = "button";
		consume.dataset.consumeInventoryItemId = String(item.id);
		root.append(
			createElement("div", { className: "inventory-node__actions" }, consume),
		);
	}
	return root;
};

export const createReceiptCard = (
	receipt: PurchaseReceipt,
	options: { className?: string; draggable?: boolean } = {},
) => {
	const card = createElement("a", {
		className: `receipt-card${options.className ? ` ${options.className}` : ""}`,
	});
	card.href = `/receipts/${receipt.id}`;
	card.dataset.link = "";
	if (options.draggable !== false) {
		card.draggable = true;
		card.dataset.receiptDragId = String(receipt.id);
	}

	const tags = createElement("div", { className: "receipt-card__tags" });
	tags.append(
		createElement("span", {
			className: receipt.group ? "tag" : "tag tag--neutral",
			text: receipt.group?.name ?? "Ungrouped",
		}),
		createElement("span", {
			className: "tag tag--neutral",
			text: receipt.currency,
		}),
	);
	const header = createElement(
		"div",
		{ className: "receipt-card__header" },
		createElement("h3", { text: receipt.store_name }),
		tags,
	);
	const metadata = createElement("dl", { className: "receipt-card__meta" });
	for (const [label, value] of [
		["Purchased", formatReceiptDateTime(receipt.purchased_at)],
		["Total", formatMoney(receipt.total_amount, receipt.currency)],
	] as const) {
		metadata.append(
			createElement(
				"div",
				{},
				createElement("dt", { text: label }),
				createElement("dd", { text: value }),
			),
		);
	}
	card.append(header, metadata);
	return card;
};

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

const createReceiptCutoffMarker = () => {
	const marker = createElement(
		"div",
		{ className: "receipt-timeline__cutoff" },
		createElement("span", { className: "receipt-timeline__cutoff-line" }),
		createElement("span", {
			className: "tag",
			text: "30-day spending counter cutoff",
		}),
		createElement("span", { className: "receipt-timeline__cutoff-line" }),
	);
	marker.role = "note";
	return marker;
};

const renderReceiptTimelineEntry = (entry: ReceiptTimelineEntry) =>
	entry.kind === "cutoff"
		? createReceiptCutoffMarker()
		: createReceiptCard(entry.receipt, {
				className: "receipt-card--timeline",
				draggable: false,
			});

const renderReceiptTimeline = (receipts: PurchaseReceipt[]) => {
	const results = getElementById("receipt-results");
	if (!results) {
		return;
	}

	receiptKanbanScrollCleanup?.();
	receiptKanbanScrollCleanup = null;
	receiptInfiniteScroll?.destroy();
	receiptInfiniteScroll = new InfiniteScroll(
		{
			batchSize: 20,
			empty: () => createEmptyState("No receipts yet."),
			renderItem: renderReceiptTimelineEntry,
			root: results,
		},
		createReceiptTimelineEntries(receipts),
	);
	receiptInfiniteScroll.render();
};

const attachReceiptKanbanScrollSync = () => {
	receiptKanbanScrollCleanup?.();
	receiptKanbanScrollCleanup = null;

	const scrollbar = querySelector<HTMLElement>(
		"[data-receipt-kanban-scrollbar]",
	);
	const scrollbarInner = querySelector<HTMLElement>(
		"[data-receipt-kanban-scrollbar-inner]",
	);
	const board = querySelector<HTMLElement>("[data-receipt-kanban]");
	if (!scrollbar || !scrollbarInner || !board) {
		return;
	}

	const syncScrollbarWidth = () => {
		scrollbarInner.style.width = `${board.scrollWidth}px`;
		scrollbar.hidden = board.scrollWidth <= board.clientWidth;
	};
	const syncFromScrollbar = () => {
		board.scrollLeft = scrollbar.scrollLeft;
	};
	const syncFromBoard = () => {
		scrollbar.scrollLeft = board.scrollLeft;
	};

	syncScrollbarWidth();
	scrollbar.addEventListener("scroll", syncFromScrollbar, { passive: true });
	board.addEventListener("scroll", syncFromBoard, { passive: true });
	window.addEventListener("resize", syncScrollbarWidth);

	receiptKanbanScrollCleanup = () => {
		scrollbar.removeEventListener("scroll", syncFromScrollbar);
		board.removeEventListener("scroll", syncFromBoard);
		window.removeEventListener("resize", syncScrollbarWidth);
	};
};

const renderReceiptBoard = (
	receipts: PurchaseReceipt[],
	groups: Group[] = [],
	selectedFilter = "all",
) => {
	const results = getElementById("receipt-results");
	if (!results) {
		return;
	}

	if (!receipts.length && !groups.length) {
		results.replaceChildren(createEmptyState("No receipts yet."));
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

	const scrollbar = createElement("div", { className: "receipt-kanban-scrollbar", attributes: { "data-receipt-kanban-scrollbar": "" } }, createElement("div", { className: "receipt-kanban-scrollbar__inner", attributes: { "data-receipt-kanban-scrollbar-inner": "" } }));
	const board = createElement("div", { className: "receipt-kanban", attributes: { "data-receipt-kanban": "" } }, ...columns.map((column) => {
		const columnReceipts = receipts.filter((receipt) => column.id === null ? receipt.group_id === null : receipt.group_id === column.id);
		const title = column.id === null ? column.name : createElement("a", { className: "receipt-kanban__title-link", properties: { href: `/groups/${column.id}` }, attributes: { "data-link": "" } }, column.name);
		const section = createElement("section", { className: "receipt-kanban__column receipt-drop-target" }, createElement("header", { className: "receipt-kanban__header" }, createElement("h3", {}, title), createElement("span", { className: "tag tag--neutral" }, columnReceipts.length)), createElement("div", { className: "receipt-kanban__list" }, ...(columnReceipts.length ? columnReceipts.map((receipt) => createReceiptCard(receipt)) : [createElement("div", { className: "receipt-kanban__empty" }, "No receipts")])));
		section.dataset.receiptDropGroupId = String(column.id ?? "");
		return section;
	}));
	results.replaceChildren(scrollbar, board);
	attachReceiptKanbanScrollSync();
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
	const groupOptions = getElementById("receipt-group-options");
	if (groupOptions instanceof HTMLDataListElement) {
		groupOptions.replaceChildren(
			...groups.map((group) => {
				const option = document.createElement("option");
				option.value = group.name;
				return option;
			}),
		);
	}

	const groupFilter = getElementById("receipt-group-filter");
	if (!(groupFilter instanceof HTMLSelectElement)) {
		return;
	}

	const all = document.createElement("option");
	all.value = "all";
	all.textContent = "All groups";
	const ungrouped = document.createElement("option");
	ungrouped.value = "ungrouped";
	ungrouped.textContent = "Ungrouped";
	groupFilter.replaceChildren(
		all,
		ungrouped,
		...groups.map((group) => {
			const option = document.createElement("option");
			option.value = String(group.id);
			option.textContent = group.name;
			return option;
		}),
	);
	groupFilter.value = selectedFilter;
	if (groupFilter.value !== selectedFilter) {
		groupFilter.value = "all";
	}
};

const getReceiptGroupFilter = () => {
	const groupFilter = getElementById("receipt-group-filter");
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
	const viewToggle = getElementById("receipt-chronological-view");
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
	const page = getElementById("receipt-detail-page");
	if (!page) return;
	const productsById = new Map(products.map((product) => [product.id, product]));
	const updated = receipt.picture_file?.created_at;
	const pictureUrl = updated ? `/api/receipts/${receipt.id}/picture?updated=${encodeURIComponent(updated)}` : `/api/receipts/${receipt.id}/picture`;
	const back = createElement("a", { className: "secondary action-link", properties: { href: "/receipts" }, attributes: { "data-link": "" } }, "Back To Receipts");
	const picture = createElement("img", { className: "receipt-picture__image", properties: { src: pictureUrl, alt: receipt.store_name, loading: "lazy" } });
	const pictureRoot = createElement("div", { className: "receipt-picture" }, createElement("button", { className: "receipt-picture__trigger", properties: { type: "button" }, attributes: { "aria-label": "Open receipt picture in fullscreen" } }, picture));
	picture.addEventListener("error", () => pictureRoot.replaceChildren(createEmptyState("No receipt picture uploaded.")));
	const metadataValue = (label: string, value: Node | string) => createElement("div", {}, createElement("dt", {}, label), createElement("dd", {}, value));
	const metadata = createElement("dl", { className: "receipt-metadata" },
		metadataValue("Store", receipt.store_name), metadataValue("Group", receipt.group ? createElement("span", { className: "tag" }, receipt.group.name) : "-"), metadataValue("Purchased", formatReceiptDateTime(receipt.purchased_at)), metadataValue("Currency", receipt.currency), metadataValue("Total", formatMoney(receipt.total_amount, receipt.currency)), metadataValue("Created", formatReceiptDateTime(receipt.created_at)), metadataValue("Updated", formatReceiptDateTime(receipt.updated_at)),
	);
	const groupName = createElement("input", { id: "receipt-detail-group-name", properties: { value: receipt.group?.name ?? "", placeholder: "grocery" }, attributes: { list: "receipt-detail-group-options" } });
	const groupOptions = createElement("datalist", { id: "receipt-detail-group-options" }, ...groups.map((group) => createElement("option", { properties: { value: group.name } })));
	const groupForm = createElement("form", { id: "receipt-detail-group-form", className: "receipt-group-form" }, createElement("label", {}, "Group", groupName, groupOptions), createElement("div", { className: "actions" }, createElement("button", { className: "primary", properties: { type: "submit" } }, "Save Group"), createElement("button", { id: "receipt-detail-clear-group", className: "secondary", properties: { type: "button" } }, "Clear Group")));
	const extractedItems = items.length ? createElement("table", { className: "shoppinglist-table" }, createElement("thead", {}, createElement("tr", {}, ...["Product Name", "Quantity", "Line Total"].map((label) => createElement("th", {}, label)))), createElement("tbody", {}, ...items.map((item) => createElement("tr", {}, createElement("td", {}, productsById.get(item.product_id)?.name ?? `Product #${item.product_id}`), createElement("td", {}, `${item.quantity} ${item.unit}`), createElement("td", {}, item.line_total === null ? "-" : formatMoney(item.line_total, receipt.currency)))))) : createEmptyState("No extracted line items yet.");
	const modalImage = createElement("img", { className: "receipt-modal__image", properties: { src: `/api/receipts/${receipt.id}/picture`, alt: receipt.store_name, draggable: false } });
	const close = createElement("button", { className: "receipt-modal__close", properties: { type: "button" }, attributes: { "aria-label": "Close receipt picture", "data-receipt-modal-close": "" } }, "Close");
	const modal = createElement("div", { id: "receipt-picture-modal", className: "receipt-modal", properties: { hidden: true } }, createElement("div", { className: "receipt-modal__backdrop", attributes: { "data-receipt-modal-close": "" } }), createElement("div", { className: "receipt-modal__dialog", attributes: { role: "dialog", "aria-modal": "true", "aria-label": "Receipt picture" } }, close, createElement("div", { className: "receipt-modal__viewport" }, modalImage)));
	page.replaceChildren(
		createElement("section", { className: "page-heading page-heading--compact" }, createElement("div", {}, createElement("span", { className: "eyebrow" }, "Receipt")), back),
		createElement("section", { className: "workspace receipt-detail-grid" }, createElement("div", { className: "card panel" }, createElement("h2", {}, "Original Picture"), pictureRoot), createElement("div", { className: "card panel" }, createElement("h2", {}, "Extracted Metadata"), metadata, createElement("h2", {}, "Group"), groupForm, createElement("div", { id: "receipt-detail-group-status", className: "status" }), createElement("h2", {}, "Extracted Items"), extractedItems)),
		modal,
	);
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

	const groupForm = getElementById("receipt-detail-group-form");
	const groupNameInput = getElementById("receipt-detail-group-name");
	const clearGroupButton = getElementById("receipt-detail-clear-group");

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

	const trigger = querySelector<HTMLButtonElement>(
		".receipt-picture__trigger",
	);
	const modal = getElementById("receipt-picture-modal");
	const modalViewport = querySelector<HTMLDivElement>(
		".receipt-modal__viewport",
	);
	const modalImage = querySelector<HTMLImageElement>(
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
	const barcodeFilter = getElementById("barcode-filter");
	const searchType = getElementById("product-search-type");
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

	const form = getElementById("product-form");
	const barcodeFilter = getElementById("barcode-filter");
	const filterButton = getElementById("filter-button");
	const addButton = getElementById("open-product-modal-button");
	const modal = getElementById("product-create-modal");
	const modalCloseButtons = querySelectorAll(
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
		const nameInput = getElementById("name");
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

		const nameInput = getElementById("name");
		const categoryInput = getElementById("category");
		const ingredientNameInput = getElementById("ingredient_name");
		const barcodeInput = getElementById("barcode");
		const defaultUnitInput = getElementById("default_unit");
		const isPerishableInput = getElementById("is_perishable");
		const pictureInput = getElementById("picture");

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

			const barcodeFilter = getElementById("barcode-filter");
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

	const pictureForm = getElementById("product-picture-form");
	if (pictureForm instanceof HTMLFormElement) {
		pictureForm.addEventListener(
			"submit",
			async (event) => {
				event.preventDefault();

				const pictureInput = getElementById("product-picture-input");
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

	getElementById("product-picture-delete")?.addEventListener(
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

	const form = getElementById("product-detail-form");
	if (!(form instanceof HTMLFormElement)) {
		return;
	}

	form.addEventListener(
		"submit",
		async (event) => {
			event.preventDefault();

			const nameInput = getElementById("product-detail-name");
			const categoryInput = getElementById("product-detail-category");
			const ingredientNameInput = getElementById(
				"product-detail-ingredient-name",
			);
			const barcodeInput = getElementById("product-detail-barcode");
			const defaultUnitInput = getElementById(
				"product-detail-default-unit",
			);
			const isPerishableInput = getElementById(
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
	const root = getElementById("dashboard-timer");
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

export const attachRecipeCreatePageEvents = () => {
	const draftIngredients: DraftRecipeIngredient[] = [];

	const updateIngredientPreview = () => {
		const preview = getElementById("recipe-ingredient-preview");
		if (!preview) {
			return;
		}

		if (!draftIngredients.length) {
			preview.className = "recipe-create-ingredient-preview empty";
			preview.textContent = "No ingredients added yet.";
			return;
		}

		preview.className = "recipe-create-ingredient-preview";
		preview.replaceChildren(
			...draftIngredients.map((ingredient, index) => {
				const remove = createElement("button", {
					className: "secondary",
					text: "Remove",
				});
				remove.type = "button";
				remove.dataset.removeRecipeIngredientDraft = String(index);
				return createElement(
					"div",
					{ className: "recipe-create-ingredient-preview__item" },
					createElement("span", { text: ingredient.name }),
					createElement(
						"div",
						{ className: "recipe-create-ingredient-preview__meta" },
						createElement("strong", {
							text: `${ingredient.quantity} ${ingredient.unit}`,
						}),
						remove,
					),
				);
			}),
		);
	};

	document
		.getElementById("add-recipe-ingredient-draft-button")
		?.addEventListener("click", () => {
			const nameInput = getElementById("recipe-ingredient-draft-name");
			const quantityInput = getElementById(
				"recipe-ingredient-draft-quantity",
			);
			const unitInput = getElementById("recipe-ingredient-draft-unit");

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

			const nameInput = getElementById("recipe-name");
			const servingsInput = getElementById("recipe-servings");
			const descriptionInput = getElementById("recipe-description");
			const instructionsInput = getElementById("recipe-instructions");
			const isActiveInput = getElementById("recipe-is-active");

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
	const modal = getElementById("recipe-ingredient-modal");
	const ingredientForm = getElementById("recipe-ingredient-modal-form");
	const ingredientIdInput = getElementById("recipe-ingredient-id");
	const ingredientNameInput = getElementById("recipe-ingredient-name");
	const ingredientQuantityInput = getElementById(
		"recipe-ingredient-quantity",
	);
	const ingredientUnitInput = getElementById("recipe-ingredient-unit");
	const ingredientNotesInput = getElementById("recipe-ingredient-notes");
	const ingredientOptionalInput = getElementById(
		"recipe-ingredient-optional",
	);
	const ingredientModalTitle = getElementById(
		"recipe-ingredient-modal-title",
	);
	const ingredientModalSubmitButton = getElementById(
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

	for (const button of querySelectorAll(
		"[data-recipe-ingredient-modal-close]",
	)) {
		button.addEventListener("click", closeIngredientModal);
	}

	document
		.getElementById("recipe-ingredient-modal-form")
		?.addEventListener("submit", async (event) => {
			event.preventDefault();

			const nameInput = getElementById("recipe-ingredient-name");
			const quantityInput = getElementById(
				"recipe-ingredient-quantity",
			);
			const unitInput = getElementById("recipe-ingredient-unit");
			const notesInput = getElementById("recipe-ingredient-notes");
			const optionalInput = getElementById(
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

			const pictureInput = getElementById("recipe-picture-input");
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

			const nameInput = getElementById("recipe-detail-name");
			const servingsInput = getElementById("recipe-detail-servings");
			const descriptionInput = getElementById(
				"recipe-detail-description",
			);
			const instructionsInput = getElementById(
				"recipe-detail-instructions",
			);
			const isActiveInput = getElementById("recipe-detail-is-active");

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
	const form = getElementById("receipt-form");
	const modal = getElementById("receipt-create-modal");
	const openModalButton = getElementById("open-receipt-modal-button");
	const groupModal = getElementById("group-create-modal");
	const groupForm = getElementById("group-create-form");
	const openGroupModalButton = getElementById(
		"open-group-modal-button",
	);
	const refreshButton = getElementById("receipt-refresh-button");
	const groupFilter = getElementById("receipt-group-filter");
	const viewToggle = getElementById("receipt-chronological-view");
	const results = getElementById("receipt-results");

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
		const groupNameInput = getElementById("group-create-name");
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
		const storeNameInput = getElementById("receipt-store-name");
		if (storeNameInput instanceof HTMLInputElement) {
			storeNameInput.focus();
		}
	};

	form?.addEventListener("submit", async (event) => {
		event.preventDefault();

		const storeNameInput = getElementById("receipt-store-name");
		const purchasedAtInput = getElementById(
			"receipt-purchased-at",
		);
		const currencyInput = getElementById("receipt-currency");
		const totalAmountInput = getElementById(
			"receipt-total-amount",
		);
		const groupNameInput = getElementById("receipt-group-name");
		const pictureInput = getElementById("receipt-picture");

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

			const groupNameInput = getElementById("group-create-name");
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
	const treeRoot = getElementById("inventory-tree-root");
	const modal = getElementById("inventory-container-modal");
	const modalForm = getElementById("inventory-container-modal-form");
	const consumeModal = getElementById("inventory-consume-modal");
	const consumeForm = getElementById("inventory-consume-form");
	const consumeItemName = getElementById("inventory-consume-item-name");
	const consumeDateInput = getElementById("inventory-consume-date");
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
		const nameInput = getElementById("inventory-container-name");
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

export const renderInventoryItemDetail = (
	item: InventoryItem,
	container: InventoryContainer | null,
	products: Product[],
	receiptItems: PurchaseReceiptItem[],
	receipts: PurchaseReceipt[],
) => {
	const page = getElementById("inventory-item-detail-page");
	if (!page) return;
	const expiration = getExpirationTag(item);
	const row = (label: string, value: Node | string) => createElement("div", {}, createElement("dt", {}, label), createElement("dd", {}, value));
	const link = (href: string, label: string) => createElement("a", { className: "metadata-link", properties: { href }, attributes: { "data-link": "" } }, label);
	const date = (value: string | null) => value ? formatReceiptDateTime(value) : "-";
	const properties = createElement("dl", { className: "receipt-metadata" }, row("Name", item.name), row("Quantity", String(item.quantity)), row("Unit", item.unit), row("Purchased", date(item.purchased_at)), row("Expires", date(item.expires_at)), row("Consumed", date(item.consumed_at)), row("Notes", item.notes ?? "-"), row("Created", formatReceiptDateTime(item.created_at)), row("Updated", formatReceiptDateTime(item.updated_at)));
	const productSelect = createElement("select", { id: "inventory-item-product-id", properties: { name: "product_id" } });
	const productSelected = item.product_id === null ? "" : String(item.product_id);
	const productOption = (value: string, label: string) => createElement("option", { properties: { value, selected: value === productSelected } }, label);
	if (!products.length && item.product_id === null) productSelect.append(productOption("", "No products in Pupler yet"));
	else {
		productSelect.append(productOption("", "No product link"));
		if (item.product_id !== null && !products.some((product) => product.id === item.product_id)) productSelect.append(productOption(String(item.product_id), item.product?.name ?? `Product #${item.product_id}`));
		productSelect.append(...products.map((product) => productOption(String(product.id), product.barcode ? `${product.name} (${product.barcode})` : product.name)));
	}
	const receiptSelect = createElement("select", { id: "inventory-item-receipt-item-id", properties: { name: "receipt_item_id" } });
	const receiptSelected = item.receipt_item_id === null ? "" : String(item.receipt_item_id);
	const receiptOption = (value: string, label: string) => createElement("option", { properties: { value, selected: value === receiptSelected } }, label);
	if (!receiptItems.length && item.receipt_item_id === null) receiptSelect.append(receiptOption("", "No receipt rows in Pupler yet"));
	else {
		const receiptsById = new Map(receipts.map((receipt) => [receipt.id, receipt]));
		const productsById = new Map(products.map((product) => [product.id, product]));
		receiptSelect.append(receiptOption("", "No receipt row link"));
		if (item.receipt_item_id !== null && !receiptItems.some((receiptItem) => receiptItem.id === item.receipt_item_id)) receiptSelect.append(receiptOption(String(item.receipt_item_id), `Receipt row #${item.receipt_item_id}`));
		receiptSelect.append(...receiptItems.map((receiptItem) => receiptOption(String(receiptItem.id), getReceiptRowLabel(receiptItem, receiptsById, productsById))));
	}
	const linksForm = createElement("form", { id: "inventory-item-links-form", className: "inventory-link-form" }, createElement("label", {}, "Product", productSelect), createElement("label", {}, "Receipt Row", receiptSelect), createElement("div", { className: "actions" }, createElement("button", { className: "primary", properties: { type: "submit" } }, "Save Links")));
	const locationValue = item.container_id === null ? "Top level" : container ? link(`/inventory/containers/${container.id}`, container.name) : `Container #${item.container_id}`;
	const productValue = item.product_id === null ? "-" : item.product ? link(`/products/${item.product.id}`, item.product.name) : `Product #${item.product_id}`;
	const ids = createElement("dl", { className: "receipt-metadata" }, row("Inventory Item ID", String(item.id)), row("Location", locationValue), row("Container ID", item.container_id === null ? "-" : String(item.container_id)), row("Product", productValue), row("Product ID", item.product_id === null ? "-" : String(item.product_id)), row("Ingredient", item.ingredient?.name ?? (item.ingredient_id === null ? "-" : `Ingredient #${item.ingredient_id}`)), row("Ingredient ID", item.ingredient_id === null ? "-" : String(item.ingredient_id)), row("Receipt Row ID", item.receipt_item_id === null ? "-" : String(item.receipt_item_id)));
	const images = item.inventory_item_images ?? [];
	const gallery = images.length ? createElement("div", { className: "recipe-image-gallery inventory-item-image-gallery" }, ...images.map((image) => {
		const remove = createElement("button", { className: "secondary", properties: { type: "button" } }, "Remove");
		remove.dataset.deleteInventoryItemImageId = String(image.id);
		return createElement("article", { className: "recipe-image-card" }, createElement("img", { className: "recipe-image-card__image", properties: { src: `/api/inventory-items/${item.id}/pictures/${image.id}?updated=${encodeURIComponent(image.created_at)}`, alt: image.file.filename ?? item.name } }), createElement("div", { className: "recipe-image-card__meta" }, createElement("div", {}, createElement("strong", {}, image.file.filename ?? `Image #${image.id}`), createElement("div", { className: "section-copy" }, formatReceiptDateTime(image.created_at))), remove));
	})) : createEmptyState("No inventory item images uploaded yet.");
	const pictureForm = createElement("form", { id: "inventory-item-picture-form", className: "recipe-picture__form inventory-item-picture__form" }, createUploadDropzone({ inputId: "inventory-item-picture-input", label: "Images", name: "picture", multiple: true, submitOnDrop: true, emptyText: "Choose one or more images or drop them here." }), createElement("div", { className: "actions" }, createElement("button", { className: "secondary", properties: { type: "submit" } }, "Upload Images")));
	const back = createElement("a", { className: "secondary action-link", properties: { href: "/inventory" }, attributes: { "data-link": "" } }, "Back To Inventory");
	page.replaceChildren(
		createElement("section", { className: "page-heading page-heading--compact" }, createElement("div", {}, createElement("span", { className: "eyebrow" }, "Inventory Item")), back),
		createElement("section", { className: "workspace inventory-item-detail-grid" },
			createElement("div", { className: "card panel" }, createElement("div", { className: "section-header" }, createElement("h2", {}, "Properties"), createElement("span", { className: item.consumed_at ? "tag tag--neutral" : "tag" }, item.consumed_at ? "Consumed" : "Active")), properties),
			createElement("div", { className: "card panel" }, createElement("div", { className: "section-header" }, createElement("h2", {}, "Links & IDs"), createElement("span", { className: expiration.className }, expiration.label)), linksForm, createElement("div", { id: "inventory-item-links-status", className: "status" }), ids),
			createElement("div", { className: "card panel inventory-item-images-panel" }, createElement("h2", {}, "Images"), gallery, pictureForm, createElement("div", { id: "inventory-item-picture-status", className: "status" })),
		),
	);
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

	const form = getElementById("inventory-item-links-form");
	if (form instanceof HTMLFormElement) {
		form.addEventListener("submit", async (event) => {
			event.preventDefault();

			const productInput = getElementById("inventory-item-product-id");
			const receiptItemInput = getElementById(
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

	const pictureForm = getElementById("inventory-item-picture-form");
	if (pictureForm instanceof HTMLFormElement) {
		pictureForm.addEventListener("submit", async (event) => {
			event.preventDefault();

			const pictureInput = getElementById(
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
