import {
	renderPage,
	setStatus,
} from "../app";
import type { Recipe } from "../app";

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

export const renderRecipesPage = () => {
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
