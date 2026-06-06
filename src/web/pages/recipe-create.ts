import {
	attachRecipeCreatePageEvents,
	renderPage,
	renderUnitSelect,
} from "../app";

export const renderRecipeCreatePage = () => {
	renderPage(
		`
			<section class="page-heading page-heading--compact">
				<div>
					<span class="eyebrow">Recipes</span>
					<h1 class="page-title">Add recipe</h1>
					<p class="page-copy">
						Add the recipe basics, ingredients, and cooking steps in one place.
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

						<section class="recipe-create-ingredients">
							<div class="recipe-create-ingredient-form">
								<label for="recipe-ingredient-draft-name">
									Ingredient
									<input
										id="recipe-ingredient-draft-name"
										placeholder="Salt"
										autocomplete="off"
									/>
								</label>

								<label for="recipe-ingredient-draft-quantity">
									Quantity
									<input
										id="recipe-ingredient-draft-quantity"
										type="number"
										inputmode="decimal"
										min="0.001"
										step="0.001"
										placeholder="2"
									/>
								</label>

								${renderUnitSelect({
									id: "recipe-ingredient-draft-unit",
									name: "ingredient_unit",
									label: "Unit",
									selectedValue: "tsp",
									placeholderLabel: "Choose unit",
								})}

								<button
									id="add-recipe-ingredient-draft-button"
									class="secondary"
									type="button"
								>Add</button>
							</div>
							<div
								id="recipe-ingredient-preview"
								class="recipe-create-ingredient-preview empty"
							>No ingredients added yet.</div>
						</section>

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
