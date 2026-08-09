import { createElement } from "../lib/dom"

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
] as const

const KNOWN_UNIT_VALUES: ReadonlySet<string> = new Set(
	UNIT_GROUPS.flatMap((group) => group.options.map(([value]) => value)),
)

const PRODUCT_CATEGORY_OPTIONS = [
	["food", "Food"],
	["drink", "Drink"],
	["household", "Household"],
	["cleaning", "Cleaning"],
	["personal care", "Personal Care"],
	["health", "Health"],
	["pet", "Pet"],
	["other", "Other"],
] as const

export const createProductCategoryInput = (options: {
	id: string
	name?: string
	label: string
	value?: string | null
	placeholder?: string
	required?: boolean
}) => {
	const listId = `${options.id}-options`
	const input = createElement("input", {
		id: options.id,
		properties: {
			name: options.name ?? "",
			value: options.value ?? "",
			placeholder: options.placeholder ?? "food",
			required: options.required ?? false,
		},
		attributes: { list: listId },
	})
	const list = createElement("datalist", { id: listId })
	for (const [value, label] of PRODUCT_CATEGORY_OPTIONS) {
		list.append(
			createElement("option", { text: label, properties: { value } }),
		)
	}
	return createElement(
		"label",
		{ attributes: { for: options.id } },
		options.label,
		input,
		list,
	)
}

export const createUnitSelect = (options: {
	id: string
	name: string
	label: string
	selectedValue: string | null
	placeholderLabel?: string
	required?: boolean
}) => {
	const select = createElement("select", {
		id: options.id,
		properties: { name: options.name, required: options.required ?? false },
	})
	const selected = options.selectedValue?.trim() ?? ""
	if (options.placeholderLabel) {
		select.append(
			createElement("option", {
				text: options.placeholderLabel,
				properties: { value: "", selected: !selected },
			}),
		)
	}
	if (selected && !KNOWN_UNIT_VALUES.has(selected)) {
		const custom = createElement("option", {
			text: `${selected} (Custom)`,
			properties: { value: selected, selected: true },
		})
		custom.dataset.unitCustom = "true"
		select.append(custom)
	}
	for (const group of UNIT_GROUPS) {
		const optionGroup = createElement("optgroup", {
			properties: { label: group.label },
		})
		for (const [value, label] of group.options) {
			optionGroup.append(
				createElement("option", {
					text: label,
					properties: { value, selected: value === selected },
				}),
			)
		}
		select.append(optionGroup)
	}
	return createElement(
		"label",
		{ attributes: { for: options.id } },
		options.label,
		select,
	)
}

export const setUnitSelectValue = (
	select: HTMLSelectElement,
	value: string | null,
	fallbackValue = "",
) => {
	for (const option of select.querySelectorAll<HTMLOptionElement>(
		"option[data-unit-custom]",
	)) {
		option.remove()
	}

	const trimmedValue = value?.trim() ?? ""
	if (!trimmedValue) {
		select.value = fallbackValue
		return
	}

	if (!KNOWN_UNIT_VALUES.has(trimmedValue)) {
		const customOption = document.createElement("option")
		customOption.value = trimmedValue
		customOption.textContent = `${trimmedValue} (Custom)`
		customOption.dataset.unitCustom = "true"
		select.insertBefore(customOption, select.firstChild)
	}

	select.value = trimmedValue
}
