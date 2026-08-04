import {
	fetchRecipe,
	renderPage,
	renderRecipeDetail,
} from "../app";
import { createElement, createPageMessage, withQueryRoot } from "../lib/dom";

export const renderRecipeDetailPage = async (params: Record<string, string>) => {
	const recipeId = Number.parseInt(params.id ?? "", 10);
	const page = createElement("div", { id: "recipe-detail-page" });
	if (!Number.isInteger(recipeId)) {
		page.append(createPageMessage("Recipe id is invalid."));
		renderPage(page);
		return;
	}

	try {
		const recipe = await fetchRecipe(recipeId);
		withQueryRoot(page, () => renderRecipeDetail(recipe));
	} catch (error) {
		page.append(
			createPageMessage(
				error instanceof Error ? error.message : "Failed to load recipe.",
			),
		);
	}
	renderPage(page);
};
