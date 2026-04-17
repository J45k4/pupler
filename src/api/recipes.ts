import type { BunRequest } from "bun";

import {
	assertKnownFields,
	empty,
	expectBoolean,
	expectNullableInteger,
	expectNullableString,
	expectString,
	HttpError,
	json,
	parseBooleanQuery,
	parseIdParam,
	parseIntegerQuery,
	parseSortOrder,
	readJsonObject,
	readOptionalBodyField,
	requireBodyField,
	utcNow,
	withErrorHandling,
	type Database,
	type JsonObject,
} from "./core";

const MAX_RECIPE_IMAGE_BYTES = 10 * 1024 * 1024;
const SORT_FIELDS = new Set([
	"id",
	"name",
	"description",
	"instructions",
	"servings",
	"is_active",
	"created_at",
	"updated_at",
]);
const WRITABLE_FIELDS = [
	"name",
	"description",
	"instructions",
	"servings",
	"is_active",
];

const fetchRecipe = (db: Database, id: number) =>
	db.client.recipe.findUnique({ where: { id } });

const fetchRecipeDetail = (db: Database, id: number) =>
	db.client.recipe.findUnique({
		where: { id },
		include: {
			ingredients: {
				include: {
					product: {
						select: {
							id: true,
							name: true,
							default_unit: true,
						},
					},
				},
				orderBy: [{ created_at: "asc" }, { id: "asc" }],
			},
			recipe_images: {
				select: {
					id: true,
					recipe_id: true,
					content_type: true,
					filename: true,
					created_at: true,
				},
				orderBy: [{ created_at: "desc" }, { id: "desc" }],
			},
		},
	});

const fetchRecipeImage = (
	db: Database,
	recipeId: number,
	pictureId: number,
) =>
	db.client.recipeImage.findFirst({
		where: { id: pictureId, recipe_id: recipeId },
	});

const fetchRecipeImages = (db: Database, recipeId: number) =>
	db.client.recipeImage.findMany({
		where: { recipe_id: recipeId },
		select: {
			id: true,
			recipe_id: true,
			content_type: true,
			filename: true,
			created_at: true,
		},
		orderBy: [{ created_at: "desc" }, { id: "desc" }],
	});

const ensureRecipeExists = async (db: Database, recipeId: number) => {
	const recipe = await fetchRecipe(db, recipeId);
	if (!recipe) {
		throw new HttpError(404, "Resource not found");
	}
	return recipe;
};

const parseUploadedRecipeImages = (files: Array<File | string>) =>
	files.map((entry) => {
		if (!(entry instanceof File)) {
			throw new HttpError(400, "Multipart form-data must include one or more `file` fields");
		}
		if (!entry.type.startsWith("image/")) {
			throw new HttpError(400, "Uploaded file must be an image");
		}
		if (entry.size === 0) {
			throw new HttpError(400, "Uploaded file may not be empty");
		}
		if (entry.size > MAX_RECIPE_IMAGE_BYTES) {
			throw new HttpError(413, "Uploaded file exceeds the 10 MB limit");
		}
		return entry;
	});

const createRecipeImages = async (
	db: Database,
	recipeId: number,
	files: File[],
) =>
	Promise.all(
		files.map(async (file) =>
			db.client.recipeImage.create({
				data: {
					recipe_id: recipeId,
					blob: new Uint8Array(await file.arrayBuffer()),
					content_type: file.type,
					filename: file.name || null,
					created_at: utcNow(),
				},
				select: {
					id: true,
					recipe_id: true,
					content_type: true,
					filename: true,
					created_at: true,
				},
			}),
		),
	);

const parseSort = (url: URL) => {
	const sort = url.searchParams.get("sort");
	if (!sort) return [{ id: "asc" }] as const;
	if (!SORT_FIELDS.has(sort)) {
		throw new HttpError(400, `Unknown sort field \`${sort}\``);
	}
	return [{ [sort]: parseSortOrder(url) }];
};

const parseFilters = (url: URL) => {
	const where: Record<string, unknown> = {};
	for (const [key, value] of url.searchParams.entries()) {
		if (key === "sort" || key === "order") continue;
		switch (key) {
			case "id":
			case "servings":
				where[key] = value === "null" ? null : parseIntegerQuery(key, value);
				break;
			case "name":
			case "description":
			case "instructions":
			case "created_at":
			case "updated_at":
				where[key] = value === "null" ? null : value;
				break;
			case "is_active":
				where.is_active = parseBooleanQuery(key, value);
				break;
			default:
				throw new HttpError(400, `Unknown query parameter \`${key}\``);
		}
	}
	return where;
};

const parseCreateValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const now = utcNow();
	return {
		name: requireBodyField(body, "name", expectString),
		description:
			readOptionalBodyField(body, "description", expectNullableString) ?? null,
		instructions:
			readOptionalBodyField(body, "instructions", expectNullableString) ?? null,
		servings:
			readOptionalBodyField(body, "servings", expectNullableInteger) ?? null,
		is_active: requireBodyField(body, "is_active", expectBoolean),
		created_at: now,
		updated_at: now,
	};
};

const parseReplaceValues = (
	body: JsonObject,
	existingRow: Awaited<ReturnType<typeof fetchRecipe>>,
) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	return {
		name: requireBodyField(body, "name", expectString),
		description:
			readOptionalBodyField(body, "description", expectNullableString) ?? null,
		instructions:
			readOptionalBodyField(body, "instructions", expectNullableString) ?? null,
		servings:
			readOptionalBodyField(body, "servings", expectNullableInteger) ?? null,
		is_active: requireBodyField(body, "is_active", expectBoolean),
		created_at: existingRow?.created_at ?? utcNow(),
		updated_at: utcNow(),
	};
};

const parsePatchValues = (body: JsonObject) => {
	assertKnownFields(body, WRITABLE_FIELDS);
	const values: Record<string, unknown> = {};

	const name = readOptionalBodyField(body, "name", expectString);
	const description = readOptionalBodyField(
		body,
		"description",
		expectNullableString,
	);
	const instructions = readOptionalBodyField(
		body,
		"instructions",
		expectNullableString,
	);
	const servings = readOptionalBodyField(
		body,
		"servings",
		expectNullableInteger,
	);
	const isActive = readOptionalBodyField(body, "is_active", expectBoolean);

	if (name !== undefined) values.name = name;
	if (description !== undefined) values.description = description;
	if (instructions !== undefined) values.instructions = instructions;
	if (servings !== undefined) values.servings = servings;
	if (isActive !== undefined) values.is_active = isActive;

	if (Object.keys(values).length === 0) {
		throw new HttpError(400, "PATCH request must contain at least one writable field");
	}

	values.updated_at = utcNow();
	return values;
};

export const recipesCollectionRoute = (db: Database) =>
	withErrorHandling(async (req: Request) => {
		if (req.method === "GET") {
			const url = new URL(req.url);
			return json(
				200,
				await db.client.recipe.findMany({
					where: parseFilters(url),
					orderBy: parseSort(url),
				}),
			);
		}
		if (req.method === "POST") {
			return json(
				201,
				await db.client.recipe.create({
					data: parseCreateValues(await readJsonObject(req)),
				}),
			);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});

export const recipeDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const id = parseIdParam(req.params.id);
		const existingRow = await fetchRecipe(db, id);
		if (!existingRow) throw new HttpError(404, "Resource not found");

		if (req.method === "GET") {
			return json(200, await fetchRecipeDetail(db, id));
		}
		if (req.method === "PUT") {
			await db.client.recipe.update({
				where: { id },
				data: parseReplaceValues(await readJsonObject(req), existingRow),
			});
			return json(200, await fetchRecipeDetail(db, id));
		}
		if (req.method === "PATCH") {
			await db.client.recipe.update({
				where: { id },
				data: parsePatchValues(await readJsonObject(req)),
			});
			return json(200, await fetchRecipeDetail(db, id));
		}
		if (req.method === "DELETE") {
			await db.client.recipe.delete({ where: { id } });
			return empty(204);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});

export const recipeImagesCollectionRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const recipeId = parseIdParam(req.params.id);
		await ensureRecipeExists(db, recipeId);

		if (req.method === "GET") {
			return json(200, await fetchRecipeImages(db, recipeId));
		}

		if (req.method === "POST") {
			const formData = await req.formData();
			const uploaded = parseUploadedRecipeImages(formData.getAll("file"));
			if (uploaded.length === 0) {
				throw new HttpError(400, "Multipart form-data must include one or more `file` fields");
			}

			return json(201, await createRecipeImages(db, recipeId, uploaded));
		}

		throw new HttpError(405, "Method not allowed for this route");
	});

export const recipeImageDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const recipeId = parseIdParam(req.params.id);
		const pictureId = parseIdParam(req.params.pictureId);
		await ensureRecipeExists(db, recipeId);
		const image = await fetchRecipeImage(db, recipeId, pictureId);
		if (!image) {
			throw new HttpError(404, "Recipe image not found");
		}

		if (req.method === "GET") {
			return new Response(image.blob, {
				status: 200,
				headers: {
					"Content-Type": image.content_type,
					"Cache-Control": "no-store",
					...(image.filename
						? {
								"Content-Disposition": `inline; filename="${image.filename}"`,
							}
						: {}),
				},
			});
		}

		if (req.method === "DELETE") {
			await db.client.recipeImage.delete({
				where: { id: pictureId },
			});
			return empty(204);
		}

		throw new HttpError(405, "Method not allowed for this route");
	});
