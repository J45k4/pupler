import { renderPage, setStatus } from "../app"
import type { Recipe } from "../app"
import { createElement, createEmptyState } from "../lib/dom"

const renderRecipes = (recipes: Recipe[]) => {
	const results = document.getElementById("recipe-results")
	if (!results) {
		return
	}

	if (!recipes.length) {
		results.replaceChildren(
			createEmptyState(
				"No recipes yet. Add the first one to start building your meal library.",
			),
		)
		return
	}

	results.replaceChildren(...recipes.map(createRecipeCard))
}

const createRecipeCard = (recipe: Recipe) => {
	const status = recipe.is_active ? "Active" : "Inactive"
	const metaParts = [
		recipe.servings === null
			? null
			: recipe.servings === 1
				? "1 serving"
				: `${recipe.servings} servings`,
		status,
	].filter((value): value is string => value !== null)
	const card = createElement(
		"a",
		{ className: "recipe-card" },
		createElement(
			"div",
			{ className: "recipe-card__header" },
			createElement("h2", { text: recipe.name }),
			createElement("span", {
				className: "tag tag--neutral",
				text: status,
			}),
		),
	)
	card.href = `/recipes/${recipe.id}`
	card.dataset.link = ""
	if (recipe.description) {
		card.append(
			createElement("p", {
				className: "recipe-card__description",
				text: recipe.description,
			}),
		)
	}
	card.append(
		createElement("div", {
			className: "recipe-card__meta",
			text: metaParts.join(" • "),
		}),
	)
	return card
}

const fetchRecipes = async () => {
	const response = await fetch("/api/recipes?sort=name&order=asc")
	const body = (await response.json()) as Recipe[] | { error?: string }

	if (!response.ok) {
		throw new Error(
			"error" in body
				? (body.error ?? "Failed to load recipes")
				: "Failed to load recipes",
		)
	}

	return body as Recipe[]
}

const loadRecipes = async () => {
	try {
		const recipes = await fetchRecipes()
		renderRecipes(recipes)
		setStatus(
			"recipe-list-status",
			recipes.length
				? `Loaded ${recipes.length} recipe(s).`
				: "No recipes yet.",
		)
	} catch (error) {
		renderRecipes([])
		setStatus(
			"recipe-list-status",
			error instanceof Error ? error.message : "Failed to load recipes.",
			true,
		)
	}
}

export const renderRecipesPage = () => {
	const addLink = createElement(
		"a",
		{
			className: "primary action-link",
			properties: { href: "/recipes/new" },
			attributes: { "data-link": "" },
		},
		"Add Recipe",
	)
	renderPage(
		createElement(
			"section",
			{ className: "card panel page-panel" },
			createElement(
				"div",
				{ className: "page-heading" },
				createElement(
					"div",
					{},
					createElement(
						"p",
						{ className: "page-copy" },
						"Build recipe basics, ingredient lists, and photos in one place.",
					),
				),
				addLink,
			),
			createElement("div", {
				id: "recipe-list-status",
				className: "status",
			}),
			createElement("div", {
				id: "recipe-results",
				className: "recipe-results",
			}),
		),
	)

	void loadRecipes()
}
