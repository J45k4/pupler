import { InfiniteScroll } from "./infinite-scroll";
import { renderNavbar } from "./navbar";
import { installLinkInterceptor, navigate, routes } from "./router";

type Product = {
	id: number;
	name: string;
	category: string;
	barcode: string | null;
	default_unit: string | null;
	is_perishable: boolean;
};

type PurchaseReceipt = {
	id: number;
	store_name: string;
	purchased_at: string;
	currency: string;
	total_amount: number | null;
	created_at: string;
	updated_at: string;
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

type InventoryItem = {
	id: number;
	product_id: number;
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
};

type InventoryContainer = {
	id: number;
	name: string;
	parent_container_id: number | null;
	notes: string | null;
	created_at: string;
	updated_at: string;
};

type ShoppingListItem = {
	id: number;
	product_id: number;
	quantity: number;
	unit: string;
	done: boolean;
	source_recipe_id: number | null;
	notes: string | null;
	created_at: string;
	updated_at: string;
};

type RecipeIngredientProduct = {
	id: number;
	name: string;
	default_unit: string | null;
};

type RecipeIngredient = {
	id: number;
	recipe_id: number;
	product_id: number;
	quantity: number;
	unit: string;
	is_optional: boolean;
	notes: string | null;
	created_at: string;
	product?: RecipeIngredientProduct;
};

type Recipe = {
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
	content_type: string;
	filename: string | null;
	created_at: string;
};

let receiptDetailAbortController: AbortController | null = null;
let productPageAbortController: AbortController | null = null;
let productInfiniteScroll: InfiniteScroll<Product> | null = null;
let inventoryTreeState: {
	containers: InventoryContainer[];
	items: InventoryItem[];
	products: Product[];
} | null = null;
let collapsedInventoryContainerIds = new Set<number>();

const render = (html: string) => {
	productInfiniteScroll?.destroy();
	productInfiniteScroll = null;
	document.body.classList.remove("modal-open");
	document.body.innerHTML = html;
};

const renderPage = (content: string) => {
	render(`
		${renderNavbar(window.location.pathname)}
		<main class="page-shell">
			${content}
		</main>
	`);
};

const setStatus = (elementId: string, message: string, isError = false) => {
	const status = document.getElementById(elementId);
	if (!status) {
		return;
	}
	status.textContent = message;
	status.className = isError ? "status error" : "status";
};

const escapeHtml = (value: string) =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");

const UNIT_GROUPS = [
	{
		label: "Count",
		options: [
			["pcs", "Pieces (pcs)"],
			["item", "Item"],
			["pair", "Pair"],
			["dozen", "Dozen"],
			["pack", "Pack"],
			["bag", "Bag"],
			["box", "Box"],
			["bottle", "Bottle"],
			["can", "Can"],
			["jar", "Jar"],
			["bunch", "Bunch"],
			["slice", "Slice"],
		],
	},
	{
		label: "Weight",
		options: [
			["mg", "Milligrams (mg)"],
			["g", "Grams (g)"],
			["kg", "Kilograms (kg)"],
			["oz", "Ounces (oz)"],
			["lb", "Pounds (lb)"],
		],
	},
	{
		label: "Volume",
		options: [
			["ml", "Milliliters (ml)"],
			["cl", "Centiliters (cl)"],
			["dl", "Deciliters (dl)"],
			["l", "Liters (l)"],
			["fl oz", "Fluid ounces (fl oz)"],
			["cup", "Cup"],
			["pt", "Pint (pt)"],
			["qt", "Quart (qt)"],
			["gal", "Gallon (gal)"],
		],
	},
	{
		label: "Cooking",
		options: [
			["tsp", "Teaspoon (tsp)"],
			["tbsp", "Tablespoon (tbsp)"],
			["pinch", "Pinch"],
			["dash", "Dash"],
		],
	},
	{
		label: "Length",
		options: [
			["mm", "Millimeters (mm)"],
			["cm", "Centimeters (cm)"],
			["m", "Meters (m)"],
			["in", "Inches (in)"],
			["ft", "Feet (ft)"],
		],
	},
] as const;

const KNOWN_UNIT_VALUES = new Set(
	UNIT_GROUPS.flatMap((group) => group.options.map(([value]) => value)),
);

const renderUnitSelectOptions = (
	selectedValue: string | null,
	placeholderLabel?: string,
) => {
	const trimmedSelected = selectedValue?.trim() ?? "";
	const hasSelectedValue = trimmedSelected.length > 0;
	const hasKnownSelectedValue = KNOWN_UNIT_VALUES.has(trimmedSelected);

	return `
		${
			placeholderLabel
				? `<option value="" ${hasSelectedValue ? "" : "selected"}>${escapeHtml(placeholderLabel)}</option>`
				: ""
		}
		${
			hasSelectedValue && !hasKnownSelectedValue
				? `<option value="${escapeHtml(trimmedSelected)}" selected data-unit-custom="true">${escapeHtml(trimmedSelected)} (Custom)</option>`
				: ""
		}
		${UNIT_GROUPS.map(
			(group) => `
				<optgroup label="${escapeHtml(group.label)}">
					${group.options
						.map(
							([value, label]) => `
								<option value="${escapeHtml(value)}" ${
									value === trimmedSelected ? "selected" : ""
								}>
									${escapeHtml(label)}
								</option>
							`,
						)
						.join("")}
				</optgroup>
			`,
		).join("")}
	`;
};

const renderUnitSelect = (options: {
	id: string;
	name: string;
	label: string;
	selectedValue: string | null;
	placeholderLabel?: string;
	required?: boolean;
}) => `
	<label for="${options.id}">
		${options.label}
		<select
			id="${options.id}"
			name="${options.name}"
			${options.required ? "required" : ""}
		>
			${renderUnitSelectOptions(
				options.selectedValue,
				options.placeholderLabel,
			)}
		</select>
	</label>
`;

const setUnitSelectValue = (
	select: HTMLSelectElement,
	value: string | null,
	fallbackValue = "",
) => {
	for (const option of select.querySelectorAll<HTMLOptionElement>(
		"option[data-unit-custom]",
	)) {
		option.remove();
	}

	const trimmedValue = value?.trim() ?? "";
	if (!trimmedValue) {
		select.value = fallbackValue;
		return;
	}

	if (!KNOWN_UNIT_VALUES.has(trimmedValue)) {
		const customOption = document.createElement("option");
		customOption.value = trimmedValue;
		customOption.textContent = `${trimmedValue} (Custom)`;
		customOption.dataset.unitCustom = "true";
		select.insertBefore(customOption, select.firstChild);
	}

	select.value = trimmedValue;
};

const formatFileSize = (bytes: number) => {
	if (bytes >= 1024 * 1024) {
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
	if (bytes >= 1024) {
		return `${Math.round(bytes / 1024)} KB`;
	}
	return `${bytes} B`;
};

const renderUploadDropzone = (options: {
	inputId: string;
	label: string;
	emptyText: string;
	name?: string;
	multiple?: boolean;
	submitOnDrop?: boolean;
}) => `
	<label
		class="upload-dropzone"
		for="${options.inputId}"
		data-upload-dropzone
		data-upload-dropzone-empty="${escapeHtml(options.emptyText)}"
		${options.submitOnDrop ? 'data-upload-dropzone-submit-on-drop="true"' : ""}
	>
		<span class="upload-dropzone__label">${options.label}</span>
		<span class="upload-dropzone__surface">
			<span class="upload-dropzone__title">${
				options.multiple ? "Drop image files here" : "Drop an image here"
			}</span>
			<span class="upload-dropzone__meta" data-upload-dropzone-meta>${options.emptyText}</span>
		</span>
		<input
			id="${options.inputId}"
			name="${options.name ?? options.inputId}"
			class="upload-dropzone__input"
			type="file"
			accept="image/*"
			${options.multiple ? "multiple" : ""}
		/>
	</label>
`;

const attachUploadDropzones = (root: ParentNode = document) => {
	for (const dropzone of root.querySelectorAll<HTMLElement>(
		"[data-upload-dropzone]",
	)) {
		const input = dropzone.querySelector<HTMLInputElement>(
			'input[type="file"]',
		);
		const meta = dropzone.querySelector<HTMLElement>(
			"[data-upload-dropzone-meta]",
		);
		const emptyText = dropzone.dataset.uploadDropzoneEmpty ?? "No file selected";
		const submitOnDrop =
			dropzone.dataset.uploadDropzoneSubmitOnDrop === "true";
		if (!input || !meta) {
			continue;
		}

		const sync = () => {
			const files = input.files ? Array.from(input.files) : [];
			meta.textContent = files.length
				? files.length === 1
					? `${files[0]!.name} • ${formatFileSize(files[0]!.size)}`
					: `${files.length} images selected`
				: emptyText;
			dropzone.classList.toggle("upload-dropzone--has-file", files.length > 0);
		};

		const activate = (event: DragEvent) => {
			event.preventDefault();
			dropzone.classList.add("upload-dropzone--active");
		};

		const deactivate = (event?: DragEvent) => {
			event?.preventDefault();
			dropzone.classList.remove("upload-dropzone--active");
		};

		input.addEventListener("change", sync);
		input.form?.addEventListener("reset", () => {
			queueMicrotask(sync);
		});
		dropzone.addEventListener("dragenter", activate);
		dropzone.addEventListener("dragover", activate);
		dropzone.addEventListener("dragleave", deactivate);
		dropzone.addEventListener("dragend", deactivate);
		dropzone.addEventListener("drop", (event) => {
			event.preventDefault();
			dropzone.classList.remove("upload-dropzone--active");
			const files = event.dataTransfer?.files;
			if (!files?.length) {
				return;
			}

			const transfer = new DataTransfer();
			for (const file of files) {
				if (file.type.startsWith("image/")) {
					transfer.items.add(file);
					if (!input.multiple) {
						break;
					}
				}
			}
			if (!transfer.files.length) {
				return;
			}

			input.files = transfer.files;
			input.dispatchEvent(new Event("change", { bubbles: true }));
			if (submitOnDrop) {
				queueMicrotask(() => input.form?.requestSubmit());
			}
		});
		sync();
	}
};

const formatShoppingDate = (value: string) =>
	new Intl.DateTimeFormat(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	}).format(new Date(value));

const formatReceiptDateTime = (value: string) =>
	new Intl.DateTimeFormat(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(value));

const formatMoney = (value: number | null, currency: string) => {
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

const getShoppingListMode = () => {
	const toggle = document.getElementById("shoppinglist-show-done");
	if (!(toggle instanceof HTMLInputElement)) {
		return "active";
	}

	return toggle.checked ? "all" : "active";
};

const renderOverviewPage = () => {
	renderPage("");
};

const renderRecipesPage = () => {
	renderPage(
		`
			<section class="card panel page-panel">
				<div class="page-heading">
					<div>
						<p class="page-copy">
							Build recipe basics, ingredient lists, and photos in one place.
						</p>
					</div>
					<a class="primary action-link" href="/recipes/new" data-link>Add Recipe</a>
				</div>
				<div id="recipe-list-status" class="status"></div>
				<div id="recipe-results" class="recipe-results"></div>
			</section>
		`,
	);

	void loadRecipes();
};

const renderRecipeDetailPage = (params: Record<string, string>) => {
	renderPage('<div id="recipe-detail-page"></div>');

	void (async () => {
		const rawId = params.id ?? "";
		const recipeId = Number.parseInt(rawId, 10);
		if (!Number.isInteger(recipeId)) {
			const page = document.getElementById("recipe-detail-page");
			if (page) {
				page.innerHTML =
					'<div class="card panel page-panel"><p class="page-copy">Recipe id is invalid.</p></div>';
			}
			return;
		}

		try {
			const recipe = await fetchRecipe(recipeId);
			renderRecipeDetail(recipe);
		} catch (error) {
			const page = document.getElementById("recipe-detail-page");
			if (page) {
				page.innerHTML = `
					<div class="card panel page-panel">
						<p class="page-copy">${error instanceof Error ? error.message : "Failed to load recipe."}</p>
					</div>
				`;
			}
		}
	})();
};

const renderRecipeCreatePage = () => {
	renderPage(
		`
			<section class="page-heading page-heading--compact">
				<div>
					<span class="eyebrow">Recipes</span>
					<h1 class="page-title">Add recipe</h1>
					<p class="page-copy">
						Create the recipe shell first. Ingredients can be added on the detail page after this.
					</p>
				</div>
				<a class="secondary action-link" href="/recipes" data-link>Back To Recipes</a>
			</section>

			<section class="workspace workspace--single">
				<div class="card panel">
					<form id="recipe-create-form">
						<label for="recipe-name">
							Name
							<input
								id="recipe-name"
								name="name"
								placeholder="Creamy tomato pasta"
								autocomplete="off"
								required
							/>
						</label>

						<div class="row">
							<label for="recipe-servings">
								Servings
								<input
									id="recipe-servings"
									name="servings"
									type="number"
									inputmode="numeric"
									min="1"
									step="1"
									placeholder="4"
								/>
							</label>

							<label class="checkbox-toggle recipe-form__toggle" for="recipe-is-active">
								<input
									id="recipe-is-active"
									name="is_active"
									type="checkbox"
									checked
								/>
								<span>Active recipe</span>
							</label>
						</div>

						<label for="recipe-description">
							Description
							<textarea
								id="recipe-description"
								name="description"
								rows="3"
								placeholder="A quick weeknight pasta with pantry ingredients."
							></textarea>
						</label>

						<label for="recipe-instructions">
							Instructions
							<textarea
								id="recipe-instructions"
								name="instructions"
								rows="8"
								placeholder="1. Boil the pasta.&#10;2. Simmer the sauce.&#10;3. Toss together and serve."
							></textarea>
						</label>

						<div class="actions">
							<button class="primary" type="submit">Create Recipe</button>
							<a class="secondary action-link" href="/recipes" data-link>Cancel</a>
						</div>
					</form>
					<div id="recipe-create-status" class="status"></div>
				</div>
			</section>
		`,
	);

	attachRecipeCreatePageEvents();
};

const renderRecipeIngredientList = (ingredients: RecipeIngredient[]) => {
	if (!ingredients.length) {
		return '<div class="empty">No ingredients added yet.</div>';
	}

	return `
		<div class="recipe-ingredient-list">
			${ingredients
				.map((ingredient) => {
					const productName =
						ingredient.product?.name ??
						`Product #${ingredient.product_id}`;
					return `
						<article class="recipe-ingredient-item">
							<button
								class="recipe-ingredient-item__select"
								type="button"
								data-edit-recipe-ingredient-id="${ingredient.id}"
								data-recipe-ingredient-product-id="${ingredient.product_id}"
								data-recipe-ingredient-name="${encodeURIComponent(productName)}"
								data-recipe-ingredient-quantity="${ingredient.quantity}"
								data-recipe-ingredient-unit="${encodeURIComponent(ingredient.unit)}"
								data-recipe-ingredient-optional="${ingredient.is_optional ? "true" : "false"}"
								data-recipe-ingredient-notes="${encodeURIComponent(ingredient.notes ?? "")}"
							>
								<div class="recipe-ingredient-item__main">
									<div class="recipe-ingredient-item__header">
										<strong>${escapeHtml(productName)}</strong>
										${ingredient.is_optional ? '<span class="tag tag--neutral">Optional</span>' : ""}
									</div>
									<div class="recipe-ingredient-item__meta">
										<span>${escapeHtml(String(ingredient.quantity))} ${escapeHtml(ingredient.unit)}</span>
										${
											ingredient.product?.default_unit &&
											ingredient.product.default_unit !== ingredient.unit
												? `<span>Default unit: ${escapeHtml(ingredient.product.default_unit)}</span>`
												: ""
										}
									</div>
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

const renderRecipeDetail = (recipe: Recipe) => {
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
													alt="${escapeHtml(image.filename ?? recipe.name)}"
												/>
												<div class="recipe-image-card__meta">
													<div>
														<strong>${escapeHtml(image.filename ?? `Image #${image.id}`)}</strong>
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

const renderRecipes = (recipes: Recipe[]) => {
	const results = document.getElementById("recipe-results");
	if (!results) {
		return;
	}

	if (!recipes.length) {
		results.innerHTML =
			'<div class="empty">No recipes yet. Add the first one to start building your meal library.</div>';
		return;
	}

	results.innerHTML = recipes
		.map((recipe) => {
			const metaParts = [
				recipe.servings === null
					? null
					: recipe.servings === 1
						? "1 serving"
						: `${recipe.servings} servings`,
				recipe.is_active ? "Active" : "Inactive",
			].filter((value): value is string => value !== null);

			return `
				<a class="recipe-card" href="/recipes/${recipe.id}" data-link>
					<div class="recipe-card__header">
						<h2>${recipe.name}</h2>
						<span class="tag tag--neutral">${recipe.is_active ? "Active" : "Inactive"}</span>
					</div>
					${
						recipe.description
							? `<p class="recipe-card__description">${recipe.description}</p>`
							: ""
					}
					<div class="recipe-card__meta">${metaParts.join(" • ")}</div>
				</a>
			`;
		})
		.join("");
};

const renderProductCard = (product: Product) => {
	const badge = product.is_perishable
		? '<span class="tag">Perishable</span>'
		: "";
	return `
		<article class="product">
			<div class="product__media">
				<img class="product__image" src="/api/products/${product.id}/picture" alt="${product.name}" loading="lazy" onerror="this.parentElement.remove()" />
			</div>
			<header>
				<h3>${product.name}</h3>
				${badge}
			</header>
			<dl>
				<div>
					<dt>Category</dt>
					<dd>${product.category ?? "-"}</dd>
				</div>
				<div>
					<dt>Barcode</dt>
					<dd>${product.barcode ?? "-"}</dd>
				</div>
				<div>
					<dt>Unit</dt>
					<dd>${product.default_unit ?? "-"}</dd>
				</div>
			</dl>
		</article>
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

const renderShoppingListItems = (
	items: ShoppingListItem[],
	products: Product[],
) => {
	const results = document.getElementById("shopping-list-item-results");
	if (!results) {
		return;
	}

	const productsById = new Map(
		products.map((product) => [product.id, product]),
	);

	if (!items.length) {
		results.innerHTML =
			'<div class="empty">No items in the shoppinglist yet.</div>';
		return;
	}

	results.innerHTML = `
		<table class="shoppinglist-table">
			<thead>
				<tr>
					<th>Name</th>
					<th>Date</th>
					<th>Done</th>
				</tr>
			</thead>
			<tbody>
				${items
					.map((item) => {
						const product = productsById.get(item.product_id);
						const checked = item.done ? " checked" : "";
						const rowClass = item.done
							? "shoppinglist-table__row shoppinglist-table__row--done"
							: "shoppinglist-table__row";
						const dateLabel = item.done ? "Done" : "Added";
						const dateValue = item.done
							? formatShoppingDate(item.updated_at)
							: formatShoppingDate(item.created_at);

						return `
							<tr class="${rowClass}">
								<td>${product?.name ?? `Product #${item.product_id}`}</td>
								<td class="shoppinglist-table__date">
									<span class="shoppinglist-table__date-label">${dateLabel}</span>
									${dateValue}
								</td>
								<td class="shoppinglist-table__check">
									<input
										type="checkbox"
										data-shopping-item-id="${item.id}"
										aria-label="Mark ${product?.name ?? `product ${item.product_id}`} done"
										${checked}
									/>
								</td>
							</tr>
						`;
					})
					.join("")}
			</tbody>
		</table>
	`;
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

	if (item.purchased_at) {
		parts.push(`Bought ${formatReceiptDateTime(item.purchased_at)}`);
	}
	if (item.expires_at) {
		parts.push(`Expires ${formatReceiptDateTime(item.expires_at)}`);
	}
	if (item.notes) {
		parts.push(item.notes);
	}

	return parts.join(" • ");
};

const renderInventoryTree = (
	containers: InventoryContainer[],
	items: InventoryItem[],
	products: Product[],
) => {
	const root = document.getElementById("inventory-tree-root");
	if (!root) {
		return;
	}

	const productsById = new Map(
		products.map((product) => [product.id, product]),
	);
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
		const productName =
			productsById.get(item.product_id)?.name ??
			`Product #${item.product_id}`;
		const meta = getInventoryItemMeta(item);

		return `
			<li class="inventory-tree__leaf">
				<div
					class="inventory-node inventory-node--item"
					draggable="true"
					data-drag-kind="item"
					data-drag-id="${item.id}"
					data-source-container-id="${item.container_id ?? ""}"
				>
					<div class="inventory-node__main">
						<strong>${productName}</strong>
						<div class="inventory-node__meta">
							<span>${item.quantity} ${item.unit}</span>
							${meta ? `<span>${meta}</span>` : ""}
						</div>
					</div>
				</div>
			</li>
		`;
	};

	const renderInventoryItemsList = (containerId: number | null) => {
		const bucket = containerItems.get(containerId) ?? [];
		if (!bucket.length) {
			return "";
		}

		const sortedItems = [...bucket].sort((left, right) => {
			const leftName =
				productsById.get(left.product_id)?.name ??
				`Product #${left.product_id}`;
			const rightName =
				productsById.get(right.product_id)?.name ??
				`Product #${right.product_id}`;
			return leftName.localeCompare(rightName);
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
				<button
					class="primary inventory-node__button"
					type="button"
					data-open-inventory-container-modal
				>
					Add Container
				</button>
			</div>
			<div class="inventory-tree__root-content">
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
					hasRootContent
						? ""
						: '<div class="inventory-tree__empty">Add a room, closet, shelf, or box. Drag into the open area to keep things at the top level.</div>'
				}
			</div>
		</div>
	`;
};

const renderReceipts = (receipts: PurchaseReceipt[]) => {
	const results = document.getElementById("receipt-results");
	if (!results) {
		return;
	}

	if (!receipts.length) {
		results.innerHTML = '<div class="empty">No receipts yet.</div>';
		return;
	}

	results.innerHTML = receipts
		.map(
			(receipt) => `
				<a class="receipt-card" href="/receipts/${receipt.id}" data-link>
					<div class="receipt-card__header">
						<h3>${receipt.store_name}</h3>
						<span class="tag tag--neutral">${receipt.currency}</span>
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
			`,
		)
		.join("");
};

const renderReceiptDetail = (
	receipt: PurchaseReceipt,
	items: PurchaseReceiptItem[],
	products: Product[],
) => {
	const page = document.getElementById("receipt-detail-page");
	if (!page) {
		return;
	}

	const productsById = new Map(
		products.map((product) => [product.id, product]),
	);

	page.innerHTML = `
		<section class="page-heading page-heading--compact">
			<div>
				<span class="eyebrow">Receipt</span>
				<h1 class="page-title">${receipt.store_name}</h1>
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
							src="/api/receipts/${receipt.id}/picture"
							alt="${receipt.store_name}"
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
						<dd>${receipt.store_name}</dd>
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
						alt="${receipt.store_name}"
						draggable="false"
					/>
				</div>
			</div>
		</div>
	`;
};

const attachReceiptDetailEvents = () => {
	receiptDetailAbortController?.abort();
	receiptDetailAbortController = new AbortController();

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

const fetchAllProducts = async () => {
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

const fetchRecipes = async () => {
	const response = await fetch("/api/recipes?sort=name&order=asc");
	const body = (await response.json()) as Recipe[] | { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to load recipes")
				: "Failed to load recipes",
		);
	}

	return body as Recipe[];
};

const fetchRecipe = async (recipeId: number) => {
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
	product_id: number;
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
		product_id?: number;
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

const fetchReceipts = async () => {
	const response = await fetch("/api/receipts?sort=purchased_at&order=desc");
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

const fetchReceipt = async (receiptId: number) => {
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

const fetchReceiptItems = async (receiptId: number) => {
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

const fetchInventoryItems = async () => {
	const response = await fetch(
		"/api/inventory-items?consumed_at=null&sort=expires_at&order=asc",
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

const fetchInventoryContainers = async () => {
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

const fetchInventoryContainer = async (containerId: number) => {
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

const updateInventoryContainer = async (
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

const deleteInventoryContainer = async (containerId: number) => {
	const response = await fetch(`/api/inventory-containers/${containerId}`, {
		method: "DELETE",
	});

	if (response.status !== 204) {
		const body = (await response.json()) as { error?: string };
		throw new Error(body.error ?? "Failed to delete inventory container");
	}
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

const fetchInventoryItemsByContainer = async (containerId: number) => {
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

const loadInventoryPageData = async (statusMessage?: string) => {
	try {
		const [items, products, containers] = await Promise.all([
			fetchInventoryItems(),
			fetchAllProducts(),
			fetchInventoryContainers(),
		]);
		inventoryTreeState = { containers, items, products };
		renderInventoryTree(containers, items, products);
		setStatus(
			"inventory-status",
			statusMessage ??
				`Loaded ${items.length} active item(s) across ${containers.length} container(s).`,
		);
	} catch (error) {
		inventoryTreeState = { containers: [], items: [], products: [] };
		renderInventoryTree([], [], []);
		setStatus(
			"inventory-status",
			error instanceof Error
				? error.message
				: "Failed to load inventory.",
			true,
		);
	}
};

const loadRecipes = async () => {
	try {
		const recipes = await fetchRecipes();
		renderRecipes(recipes);
		setStatus(
			"recipe-list-status",
			recipes.length
				? `Loaded ${recipes.length} recipe(s).`
				: "No recipes yet.",
		);
	} catch (error) {
		renderRecipes([]);
		setStatus(
			"recipe-list-status",
			error instanceof Error ? error.message : "Failed to load recipes.",
			true,
		);
	}
};

const loadProducts = async () => {
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

const loadShoppingListItems = async (products?: Product[]) => {
	try {
		const mode = getShoppingListMode();
		const query =
			mode === "active"
				? "?done=false"
				: mode === "done"
					? "?done=true"
					: "";
		const [itemsResponse, productList] = await Promise.all([
			fetch(`/api/shopping-list-items${query}`),
			products ? Promise.resolve(products) : fetchAllProducts(),
		]);
		const body = (await itemsResponse.json()) as
			| ShoppingListItem[]
			| { error?: string };

		if (!itemsResponse.ok) {
			throw new Error(
				"error" in body
					? (body.error ?? "Failed to load shoppinglist items")
					: "Failed to load shoppinglist items",
			);
		}

		const items = body as ShoppingListItem[];
		renderShoppingListItems(items, productList);
		setStatus(
			"shopping-list-item-status",
			mode === "active"
				? `Loaded ${items.length} active shoppinglist item(s).`
				: `Loaded ${items.length} shoppinglist item(s).`,
		);
	} catch (error) {
		renderShoppingListItems([], products ?? []);
		setStatus(
			"shopping-list-item-status",
			error instanceof Error
				? error.message
				: "Failed to load shoppinglist items",
			true,
		);
	}
};

const findOrCreateProductByName = async (
	name: string,
	defaults: {
		category: string;
		default_unit: string;
		is_perishable: boolean;
	} = {
		category: "shopping",
		default_unit: "pcs",
		is_perishable: false,
	},
) => {
	const lookupResponse = await fetch(
		`/api/products?name=${encodeURIComponent(name)}`,
	);
	const lookupBody = (await lookupResponse.json()) as
		| Product[]
		| { error?: string };

	if (!lookupResponse.ok) {
		throw new Error(
			"error" in lookupBody
				? (lookupBody.error ?? "Failed to look up product")
				: "Failed to look up product",
		);
	}

	const matches = lookupBody as Product[];
	if (matches.length > 0) {
		return matches[0]!;
	}

	const createResponse = await fetch("/api/products", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			name,
			category: defaults.category,
			barcode: null,
			default_unit: defaults.default_unit,
			is_perishable: defaults.is_perishable,
		}),
	});
	const createBody = (await createResponse.json()) as
		| Product
		| { error?: string };

	if (!createResponse.ok) {
		throw new Error(
			"error" in createBody
				? (createBody.error ?? "Failed to create product")
				: "Failed to create product",
		);
	}

	return createBody as Product;
};

const setShoppingListItemDone = async (itemId: number, done: boolean) => {
	const response = await fetch(`/api/shopping-list-items/${itemId}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ done }),
	});
	const body = (await response.json()) as
		| ShoppingListItem
		| { error?: string };

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to update shoppinglist item")
				: "Failed to update shoppinglist item",
		);
	}
};

const attachProductPageEvents = () => {
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
		const barcodeInput = document.getElementById("barcode");
		const defaultUnitInput = document.getElementById("default_unit");
		const isPerishableInput = document.getElementById("is_perishable");
		const pictureInput = document.getElementById("picture");

			if (
				!(nameInput instanceof HTMLInputElement) ||
				!(categoryInput instanceof HTMLInputElement) ||
				!(barcodeInput instanceof HTMLInputElement) ||
				!(defaultUnitInput instanceof HTMLSelectElement) ||
				!(isPerishableInput instanceof HTMLSelectElement) ||
				!(pictureInput instanceof HTMLInputElement)
			) {
			return;
		}

		const payload = {
			name: nameInput.value.trim(),
			category: categoryInput.value.trim(),
			barcode: barcodeInput.value.trim() || null,
			default_unit: defaultUnitInput.value.trim() || null,
			is_perishable: isPerishableInput.value === "true",
		};

		try {
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

const attachShoppingListPageEvents = () => {
	document
		.getElementById("shopping-list-item-form")
		?.addEventListener("submit", async (event) => {
			event.preventDefault();

			const nameInput = document.getElementById("shopping-thing-name");

			if (!(nameInput instanceof HTMLInputElement)) {
				return;
			}

			const name = nameInput.value.trim();
			if (!name) {
				setStatus(
					"shopping-list-item-status",
					"Thing name is required",
					true,
				);
				return;
			}

			try {
				const product = await findOrCreateProductByName(name);
				const response = await fetch("/api/shopping-list-items", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						product_id: product.id,
						quantity: 1,
						unit: "pcs",
						done: false,
						source_recipe_id: null,
						notes: null,
					}),
				});
				const body = (await response.json()) as
					| ShoppingListItem
					| { error?: string };

				if (!response.ok) {
					throw new Error(
						"error" in body
							? (body.error ??
									"Failed to add thing to shoppinglist")
							: "Failed to add thing to shoppinglist",
					);
				}

				setStatus(
					"shopping-list-item-status",
					`Added ${product.name} to shoppinglist.`,
				);
				nameInput.value = "";
				await loadShoppingListItems();
			} catch (error) {
				setStatus(
					"shopping-list-item-status",
					error instanceof Error
						? error.message
						: "Failed to add thing to shoppinglist",
					true,
				);
			}
		});

	document
		.getElementById("shopping-list-item-results")
		?.addEventListener("change", async (event) => {
			const target = event.target;
			if (!(target instanceof HTMLInputElement)) {
				return;
			}
			if (
				target.type !== "checkbox" ||
				!target.matches("[data-shopping-item-id]")
			) {
				return;
			}

			const itemId = Number(target.dataset.shoppingItemId);
			if (!Number.isInteger(itemId)) {
				return;
			}

			try {
				await setShoppingListItemDone(itemId, target.checked);
				setStatus("shopping-list-item-status", "Shoppinglist updated.");
				await loadShoppingListItems();
			} catch (error) {
				target.checked = !target.checked;
				setStatus(
					"shopping-list-item-status",
					error instanceof Error
						? error.message
						: "Failed to update shoppinglist item",
					true,
				);
			}
		});

	document
		.getElementById("shoppinglist-show-done")
		?.addEventListener("change", () => {
			void loadShoppingListItems();
		});
};

const attachRecipeCreatePageEvents = () => {
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
				setStatus(
					"recipe-create-status",
					`Created recipe #${recipe.id}: ${recipe.name}`,
				);
				navigate("/recipes");
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
				const product = await findOrCreateProductByName(name, {
					category: "ingredient",
					default_unit: "pcs",
					is_perishable: false,
				});
				if (ingredientId) {
					const parsedIngredientId = Number.parseInt(ingredientId, 10);
					if (!Number.isInteger(parsedIngredientId)) {
						throw new Error("Ingredient id is invalid");
					}
					await updateRecipeIngredient(parsedIngredientId, {
						product_id: product.id,
						quantity,
						unit: unitInput.value.trim() || product.default_unit || "pcs",
						is_optional: optionalInput.checked,
						notes: notesInput.value.trim() || null,
					});
				} else {
					await createRecipeIngredient({
						recipe_id: recipeId,
						product_id: product.id,
						quantity,
						unit: unitInput.value.trim() || product.default_unit || "pcs",
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
						? `Saved ${product.name} in ${updated.name}.`
						: `Added ${product.name} to ${updated.name}.`,
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

const loadReceipts = async () => {
	try {
		const receipts = await fetchReceipts();
		renderReceipts(receipts);
		setStatus("receipt-status", `Loaded ${receipts.length} receipt(s).`);
	} catch (error) {
		renderReceipts([]);
		setStatus(
			"receipt-status",
			error instanceof Error ? error.message : "Failed to load receipts",
			true,
		);
	}
};

const attachReceiptsPageEvents = () => {
	const form = document.getElementById("receipt-form");
	const refreshButton = document.getElementById("receipt-refresh-button");

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
		const pictureInput = document.getElementById("receipt-picture");

		if (
			!(storeNameInput instanceof HTMLInputElement) ||
			!(purchasedAtInput instanceof HTMLInputElement) ||
			!(currencyInput instanceof HTMLInputElement) ||
			!(totalAmountInput instanceof HTMLInputElement) ||
			!(pictureInput instanceof HTMLInputElement)
		) {
			return;
		}

		const payload = {
			store_name: storeNameInput.value.trim(),
			purchased_at: new Date(purchasedAtInput.value).toISOString(),
			currency: currencyInput.value.trim().toUpperCase(),
			total_amount: totalAmountInput.value
				? Number(totalAmountInput.value)
				: null,
		};

		try {
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

			if (form instanceof HTMLFormElement) {
				form.reset();
			}

			setStatus(
				"receipt-status",
				picture
					? `Created receipt #${(body as PurchaseReceipt).id} and uploaded picture`
					: `Created receipt #${(body as PurchaseReceipt).id}`,
			);
			await loadReceipts();
		} catch (error) {
			setStatus(
				"receipt-status",
				error instanceof Error
					? error.message
					: "Failed to create receipt",
				true,
			);
		}
	});

	refreshButton?.addEventListener("click", () => {
		void loadReceipts();
	});
};

const renderProductsPage = () => {
	renderPage(
		`
			<section class="workspace workspace--single">
				<div class="card panel">
					<h2>Product Lookup</h2>
					<div class="toolbar">
						<select
							id="product-search-type"
							class="toolbar__select"
							aria-label="Product search type"
						>
							<option value="auto">Auto</option>
							<option value="barcode">Barcode</option>
							<option value="name">Name</option>
							<option value="includes">Includes</option>
						</select>
						<input id="barcode-filter" placeholder="Scan barcode or type product name" />
						<button class="secondary" id="filter-button" type="button">Find</button>
						<button class="primary" id="open-product-modal-button" type="button">Add</button>
					</div>
					<div id="status" class="status"></div>
					<div id="results" class="results"></div>
				</div>
			</section>

			<div class="product-create-modal" id="product-create-modal" hidden>
				<div class="product-create-modal__backdrop" data-product-modal-close></div>
				<div
					class="product-create-modal__dialog card panel"
					role="dialog"
					aria-modal="true"
					aria-label="Create product"
				>
					<div class="section-header section-header--end">
						<h2>Create Product</h2>
						<button
							class="secondary"
							type="button"
							aria-label="Close create product modal"
							data-product-modal-close
						>
							Close
						</button>
					</div>
					<form id="product-form">
						<label>
							Name
							<input id="name" name="name" placeholder="Milk" required />
						</label>

						<div class="row">
							<label>
								Category
								<input id="category" name="category" placeholder="food" required />
							</label>

							${renderUnitSelect({
								id: "default_unit",
								name: "default_unit",
								label: "Unit",
								selectedValue: null,
								placeholderLabel: "No default unit",
							})}
						</div>

						<label>
							Barcode
							<input id="barcode" name="barcode" placeholder="6414893400012" />
						</label>

						${renderUploadDropzone({
							inputId: "picture",
							label: "Picture",
							name: "picture",
							emptyText: "Choose a product image or drop one here.",
						})}

						<label>
							Perishable
							<select id="is_perishable" name="is_perishable">
								<option value="true">true</option>
								<option value="false">false</option>
							</select>
						</label>

						<div class="actions">
							<button class="primary" type="submit">Create Product</button>
						</div>
					</form>
					<div id="product-modal-status" class="status"></div>
				</div>
			</div>
		`,
	);

	attachUploadDropzones(document.body);
	attachProductPageEvents();
	void loadProducts();
};

const attachInventoryPageEvents = () => {
	const treeRoot = document.getElementById("inventory-tree-root");
	const modal = document.getElementById("inventory-container-modal");
	const modalForm = document.getElementById("inventory-container-modal-form");
	if (!treeRoot || !modal || !(modalForm instanceof HTMLFormElement)) {
		return;
	}

	let activeDropTarget: HTMLElement | null = null;

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

	const rerenderTreeFromState = () => {
		if (!inventoryTreeState) {
			return;
		}
		renderInventoryTree(
			inventoryTreeState.containers,
			inventoryTreeState.items,
			inventoryTreeState.products,
		);
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

	window.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && !modal.hidden) {
			closeModal();
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

const renderInventoryPage = () => {
	renderPage(
		`
			<section class="workspace workspace--single">
				<div class="card panel inventory-tree-panel">
					<div class="section-header section-header--end">
						<div id="inventory-status" class="status"></div>
					</div>
					<div id="inventory-tree-root"></div>
				</div>
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
		`,
	);

	attachInventoryPageEvents();
	void loadInventoryPageData();
};

const renderInventoryContainerDetailPage = (params: Record<string, string>) => {
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
			const [container, containers, items, products] = await Promise.all([
				fetchInventoryContainer(containerId),
				fetchInventoryContainers(),
				fetchInventoryItemsByContainer(containerId),
				fetchAllProducts(),
			]);

			const productNames = new Map(
				products.map((product) => [product.id, product.name]),
			);
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
					<div>
						<h1 class="page-title">${container.name}</h1>
					</div>
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
													const productName =
														productNames.get(
															item.product_id,
														) ??
														`Product #${item.product_id}`;
													return `
														<div class="inventory-node inventory-node--item">
															<div class="inventory-node__main">
																<strong>${productName}</strong>
																<div class="inventory-node__meta">
																	<span>${item.quantity} ${item.unit}</span>
																	${getInventoryItemMeta(item) ? `<span>${getInventoryItemMeta(item)}</span>` : ""}
																</div>
															</div>
														</div>
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
					window.history.pushState({}, "", "/inventory");
					renderInventoryPage();
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

const renderReceiptsPage = () => {
	const defaultPurchasedAt = new Date(
		Date.now() - new Date().getTimezoneOffset() * 60000,
	)
		.toISOString()
		.slice(0, 16);

	renderPage(
		`
			<section class="page-heading page-heading--compact">
				<div>
					<span class="eyebrow">Receipts</span>
					<h1 class="page-title">Manage receipts</h1>
				</div>
				<p class="page-copy">
					Create receipts, upload the original picture, and open a receipt to inspect the extracted metadata.
				</p>
			</section>

			<section class="workspace">
				<div class="card panel">
					<h2>Create Receipt</h2>
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

						${renderUploadDropzone({
							inputId: "receipt-picture",
							label: "Receipt Picture",
							emptyText: "Choose a receipt image or drop one here.",
						})}

						<div class="actions">
							<button class="primary" type="submit">Create Receipt</button>
							<button class="secondary" type="button" id="receipt-refresh-button">Refresh Receipts</button>
						</div>
					</form>
					<div id="receipt-status" class="status"></div>
				</div>

				<div class="card panel">
					<h2>Receipts</h2>
					<div id="receipt-results" class="results"></div>
				</div>
			</section>
		`,
	);

	attachUploadDropzones(document.body);
	attachReceiptsPageEvents();
	void loadReceipts();
};

const renderShoppingListsPage = () => {
	renderPage(
		`
			<section class="workspace workspace--single">
				<div class="card panel">
					<form id="shopping-list-item-form">
						<div class="shoppinglist-input">
							<input
								id="shopping-thing-name"
								name="shopping-thing-name"
								placeholder="Milk"
								autocomplete="off"
								required
							/>
							<button class="primary" type="submit">Add</button>
						</div>
					</form>
					<div id="shopping-list-item-status" class="status"></div>
				</div>

				<div class="card panel">
					<div class="section-header section-header--end">
						<label class="checkbox-toggle" for="shoppinglist-show-done">
							<input
								id="shoppinglist-show-done"
								type="checkbox"
								aria-label="Show done shoppinglist items"
							/>
							<span>Show done</span>
						</label>
					</div>
					<div id="shopping-list-item-results" class="results"></div>
				</div>
			</section>
		`,
	);

	void (async () => {
		try {
			await loadShoppingListItems();
		} catch (error) {
			renderShoppingListItems([], []);
			setStatus(
				"shopping-list-item-status",
				error instanceof Error
					? error.message
					: "Failed to initialize shoppinglist",
				true,
			);
		}
	})();

	attachShoppingListPageEvents();
};

const renderReceiptDetailPage = (params: Record<string, string>) => {
	renderPage('<div id="receipt-detail-page"></div>');

	void (async () => {
		const rawId = params.id ?? "";
		const receiptId = Number.parseInt(rawId, 10);
		if (!Number.isInteger(receiptId)) {
			const page = document.getElementById("receipt-detail-page");
			if (page) {
				page.innerHTML =
					'<div class="card panel page-panel"><p class="page-copy">Receipt id is invalid.</p></div>';
			}
			return;
		}

		try {
			const [receipt, items, products] = await Promise.all([
				fetchReceipt(receiptId),
				fetchReceiptItems(receiptId),
				fetchAllProducts(),
			]);
			renderReceiptDetail(receipt, items, products);
			attachReceiptDetailEvents();
		} catch (error) {
			const page = document.getElementById("receipt-detail-page");
			if (page) {
				page.innerHTML = `
					<div class="card panel page-panel">
						<p class="page-copy">${error instanceof Error ? error.message : "Failed to load receipt."}</p>
					</div>
				`;
			}
		}
	})();
};

const renderNotFoundPage = () => {
	renderPage(
		`
			<section class="card panel page-panel">
				<div class="page-heading">
					<div>
						<span class="eyebrow">Not Found</span>
						<h1 class="page-title">That frontend route is not registered.</h1>
					</div>
				</div>
				<p class="page-copy">
					Use the navbar to return to a known page.
				</p>
			</section>
		`,
	);
};

window.onload = () => {
	installLinkInterceptor(document.body);

	routes({
		"/": renderOverviewPage,
		"/inventory": renderInventoryPage,
		"/inventory/containers/:id": renderInventoryContainerDetailPage,
		"/products": renderProductsPage,
		"/receipts": renderReceiptsPage,
		"/receipts/:id": renderReceiptDetailPage,
		"/shopping-lists": renderShoppingListsPage,
		"/recipes/new": renderRecipeCreatePage,
		"/recipes/:id": renderRecipeDetailPage,
		"/recipes": renderRecipesPage,
		"/*": renderNotFoundPage,
	});
};
