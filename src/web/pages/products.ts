import {
	attachProductPageEvents,
	attachUploadDropzones,
	loadProducts,
	renderPage,
	renderProductCategoryInput,
	renderUnitSelect,
	renderUploadDropzone,
} from "../app";

export const renderProductsPage = () => {
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
							${renderProductCategoryInput({
								id: "category",
								name: "category",
								label: "Category",
								required: true,
							})}

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

						<label>
							Ingredient
							<input id="ingredient_name" name="ingredient_name" placeholder="Sausage" />
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
