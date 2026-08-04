import {
	attachRecipeCreatePageEvents,
	createUnitSelect,
	renderPage,
} from "../app"
import { createElement, withQueryRoot } from "../lib/dom"

export const renderRecipeCreatePage = () => {
	const link = (className: string, text: string) =>
		createElement(
			"a",
			{
				className,
				properties: { href: "/recipes" },
				attributes: { "data-link": "" },
			},
			text,
		)
	const active = createElement("input", {
		id: "recipe-is-active",
		properties: { name: "is_active", type: "checkbox", checked: true },
	})
	const ingredientForm = createElement(
		"div",
		{ className: "recipe-create-ingredient-form" },
		createElement(
			"label",
			{ properties: { htmlFor: "recipe-ingredient-draft-name" } },
			"Ingredient",
			createElement("input", {
				id: "recipe-ingredient-draft-name",
				properties: { placeholder: "Salt", autocomplete: "off" },
			}),
		),
		createElement(
			"label",
			{ properties: { htmlFor: "recipe-ingredient-draft-quantity" } },
			"Quantity",
			createElement("input", {
				id: "recipe-ingredient-draft-quantity",
				properties: {
					type: "number",
					inputMode: "decimal",
					min: "0.001",
					step: "0.001",
					placeholder: "2",
				},
			}),
		),
		createUnitSelect({
			id: "recipe-ingredient-draft-unit",
			name: "ingredient_unit",
			label: "Unit",
			selectedValue: "tsp",
			placeholderLabel: "Choose unit",
		}),
		createElement(
			"button",
			{
				id: "add-recipe-ingredient-draft-button",
				className: "secondary",
				properties: { type: "button" },
			},
			"Add",
		),
	)
	const form = createElement(
		"form",
		{ id: "recipe-create-form" },
		createElement(
			"label",
			{ properties: { htmlFor: "recipe-name" } },
			"Name",
			createElement("input", {
				id: "recipe-name",
				properties: {
					name: "name",
					placeholder: "Creamy tomato pasta",
					autocomplete: "off",
					required: true,
				},
			}),
		),
		createElement(
			"div",
			{ className: "row" },
			createElement(
				"label",
				{ properties: { htmlFor: "recipe-servings" } },
				"Servings",
				createElement("input", {
					id: "recipe-servings",
					properties: {
						name: "servings",
						type: "number",
						inputMode: "numeric",
						min: "1",
						step: "1",
						placeholder: "4",
					},
				}),
			),
			createElement(
				"label",
				{
					className: "checkbox-toggle recipe-form__toggle",
					properties: { htmlFor: "recipe-is-active" },
				},
				active,
				createElement("span", {}, "Active recipe"),
			),
		),
		createElement(
			"label",
			{ properties: { htmlFor: "recipe-description" } },
			"Description",
			createElement("textarea", {
				id: "recipe-description",
				properties: {
					name: "description",
					rows: 3,
					placeholder:
						"A quick weeknight pasta with pantry ingredients.",
				},
			}),
		),
		createElement(
			"section",
			{ className: "recipe-create-ingredients" },
			ingredientForm,
			createElement(
				"div",
				{
					id: "recipe-ingredient-preview",
					className: "recipe-create-ingredient-preview empty",
				},
				"No ingredients added yet.",
			),
		),
		createElement(
			"label",
			{ properties: { htmlFor: "recipe-instructions" } },
			"Instructions",
			createElement("textarea", {
				id: "recipe-instructions",
				properties: {
					name: "instructions",
					rows: 8,
					placeholder:
						"1. Boil the pasta.\n2. Simmer the sauce.\n3. Toss together and serve.",
				},
			}),
		),
		createElement(
			"div",
			{ className: "actions" },
			createElement(
				"button",
				{ className: "primary", properties: { type: "submit" } },
				"Create Recipe",
			),
			link("secondary action-link", "Cancel"),
		),
	)
	const page = document.createDocumentFragment()
	page.append(
		createElement(
			"section",
			{ className: "page-heading page-heading--compact" },
			createElement(
				"div",
				{},
				createElement("span", { className: "eyebrow" }, "Recipes"),
				createElement(
					"p",
					{ className: "page-copy" },
					"Add the recipe basics, ingredients, and cooking steps in one place.",
				),
			),
			link("secondary action-link", "Back To Recipes"),
		),
		createElement(
			"section",
			{ className: "workspace workspace--single" },
			createElement(
				"div",
				{ className: "card panel" },
				form,
				createElement("div", {
					id: "recipe-create-status",
					className: "status",
				}),
			),
		),
	)
	withQueryRoot(page, attachRecipeCreatePageEvents)
	renderPage(page)
}
