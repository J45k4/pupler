import { HttpError, type Database } from "./core";

export const ingredientSummarySelect = {
	id: true,
	name: true,
	default_unit: true,
} as const;

export const productSummarySelect = {
	id: true,
	name: true,
	default_unit: true,
	ingredient_id: true,
} as const;

export const productDetailSelect = {
	id: true,
	ingredient_id: true,
	name: true,
	category: true,
	barcode: true,
	default_unit: true,
	is_perishable: true,
	created_at: true,
	updated_at: true,
	ingredient: {
		select: ingredientSummarySelect,
	},
} as const;

export const inventoryItemDetailSelect = {
	id: true,
	name: true,
	ingredient_id: true,
	product_id: true,
	receipt_item_id: true,
	container_id: true,
	quantity: true,
	unit: true,
	purchased_at: true,
	expires_at: true,
	consumed_at: true,
	notes: true,
	created_at: true,
	updated_at: true,
	ingredient: {
		select: ingredientSummarySelect,
	},
	product: {
		select: productSummarySelect,
	},
} as const;

export const recipeIngredientDetailSelect = {
	id: true,
	recipe_id: true,
	ingredient_id: true,
	product_id: true,
	name: true,
	quantity: true,
	unit: true,
	is_optional: true,
	notes: true,
	created_at: true,
	ingredient: {
		select: ingredientSummarySelect,
	},
	product: {
		select: productSummarySelect,
	},
} as const;

export const shoppingListItemDetailSelect = {
	id: true,
	name: true,
	ingredient_id: true,
	product_id: true,
	quantity: true,
	unit: true,
	done: true,
	source_recipe_id: true,
	notes: true,
	created_at: true,
	updated_at: true,
	ingredient: {
		select: ingredientSummarySelect,
	},
	product: {
		select: productSummarySelect,
	},
} as const;

const fetchIngredient = (db: Database, id: number) =>
	db.client.ingredient.findUnique({ where: { id } });

const fetchProduct = (db: Database, id: number) =>
	db.client.product.findUnique({
		where: { id },
		select: {
			id: true,
			ingredient_id: true,
		},
	});

const fetchReceipt = (db: Database, id: number) =>
	db.client.receipt.findUnique({
		where: { id },
		select: {
			id: true,
		},
	});

export const ensureIngredientExists = async (
	db: Database,
	ingredientId: number | null | undefined,
	field = "ingredient_id",
) => {
	if (ingredientId === undefined || ingredientId === null) {
		return null;
	}

	const ingredient = await fetchIngredient(db, ingredientId);
	if (!ingredient) {
		throw new HttpError(
			400,
			`Field \`${field}\` references a missing ingredient`,
		);
	}

	return ingredient;
};

export const ensureProductExists = async (
	db: Database,
	productId: number | null | undefined,
	field = "product_id",
) => {
	if (productId === undefined || productId === null) {
		return null;
	}

	const product = await fetchProduct(db, productId);
	if (!product) {
		throw new HttpError(
			400,
			`Field \`${field}\` references a missing product`,
		);
	}

	return product;
};

export const ensureReceiptExists = async (
	db: Database,
	receiptId: number | null | undefined,
	field = "receipt_id",
) => {
	if (receiptId === undefined || receiptId === null) {
		return null;
	}

	const receipt = await fetchReceipt(db, receiptId);
	if (!receipt) {
		throw new HttpError(
			400,
			`Field \`${field}\` references a missing receipt`,
		);
	}

	return receipt;
};

export const validateIngredientProductRefs = async (
	db: Database,
	values: {
		ingredient_id?: number | null;
		product_id?: number | null;
	},
) => {
	await ensureIngredientExists(db, values.ingredient_id);
	const product = await ensureProductExists(db, values.product_id);

	if (
		values.ingredient_id !== undefined &&
		values.ingredient_id !== null &&
		product?.ingredient_id !== null &&
		product?.ingredient_id !== undefined &&
		product.ingredient_id !== values.ingredient_id
	) {
		throw new HttpError(
			400,
			"Linked product belongs to a different ingredient",
		);
	}
};
