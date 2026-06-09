import { escapeHtml } from "../lib/html";

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

const KNOWN_UNIT_VALUES: ReadonlySet<string> = new Set(
	UNIT_GROUPS.flatMap((group) => group.options.map(([value]) => value)),
);

const PRODUCT_CATEGORY_OPTIONS = [
	["food", "Food"],
	["drink", "Drink"],
	["household", "Household"],
	["cleaning", "Cleaning"],
	["personal care", "Personal Care"],
	["health", "Health"],
	["pet", "Pet"],
	["other", "Other"],
] as const;

export const renderProductCategoryInput = (options: {
	id: string;
	name?: string;
	label: string;
	value?: string | null;
	placeholder?: string;
	required?: boolean;
}) => {
	const listId = `${options.id}-options`;

	return `
		<label for="${options.id}">
			${options.label}
			<input
				id="${options.id}"
				${options.name ? `name="${options.name}"` : ""}
				list="${listId}"
				value="${escapeHtml(options.value ?? "")}"
				placeholder="${escapeHtml(options.placeholder ?? "food")}"
				${options.required ? "required" : ""}
			/>
			<datalist id="${listId}">
				${PRODUCT_CATEGORY_OPTIONS.map(
					([value, label]) => `
						<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>
					`,
				).join("")}
			</datalist>
		</label>
	`;
};

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

export const renderUnitSelect = (options: {
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

export const setUnitSelectValue = (
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
