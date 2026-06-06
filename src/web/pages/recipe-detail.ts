import {
	fetchRecipe,
	renderPage,
	renderRecipeDetail,
} from "../app";

export const renderRecipeDetailPage = (params: Record<string, string>) => {
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
