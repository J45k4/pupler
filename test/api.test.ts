import { afterEach, describe, expect, test } from "bun:test";

import {
	closeDatabase,
	createCollectionRoute,
	createDetailRoute,
	createProductPictureRoute,
	openDatabase,
} from "../src/api";

const dbs: ReturnType<typeof openDatabase>[] = [];

afterEach(() => {
	const db = dbs.pop();
	if (db) {
		closeDatabase(db);
	}
});

const createRoutes = () => {
	const db = openDatabase(":memory:");
	dbs.push(db);

	return {
		"/api/products": createCollectionRoute(db, "products"),
		"/api/products/:id": createDetailRoute(db, "products"),
		"/api/products/:id/picture": createProductPictureRoute(db),
		"/api/product-links": createCollectionRoute(db, "product-links"),
		"/api/product-links/:id": createDetailRoute(db, "product-links"),
		"/api/shopping-list-items": createCollectionRoute(
			db,
			"shopping-list-items",
		),
		"/api/shopping-list-items/:id": createDetailRoute(
			db,
			"shopping-list-items",
		),
	};
};

const request = async (
	routes: ReturnType<typeof createRoutes>,
	path: string,
	options: RequestInit = {},
	params: Record<string, string> = {},
) => {
	const url = new URL(`http://localhost${path}`);
	const pathname = url.pathname;
	const routeKey = pathname.match(/^\/api\/products\/\d+\/picture$/)
		? "/api/products/:id/picture"
		: pathname.split("/").filter(Boolean).length === 3
			? pathname.replace(/\/[^/]+$/, "/:id")
			: pathname;
	const handler = routes[routeKey as keyof typeof routes];
	const req = new Request(`http://localhost${path}`, {
		method: options.method ?? "GET",
		headers: options.headers,
		body: options.body,
	}) as Request & { params?: Record<string, string> };
	req.params = params;
	return handler(req);
};

describe("Pupler API", () => {
	test("creates and looks up a product by barcode", async () => {
		const routes = createRoutes();

		const createResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Milk",
				category: "food",
				barcode: "6414893400012",
				default_unit: "pcs",
				is_perishable: true,
			}),
		});

		expect(createResponse.status).toBe(201);
		const created = await createResponse.json();
		expect(created.barcode).toBe("6414893400012");
		expect(created.is_perishable).toBe(true);

		const listResponse = await request(
			routes,
			"/api/products?barcode=6414893400012",
		);
		expect(listResponse.status).toBe(200);
		const listed = await listResponse.json();
		expect(listed).toHaveLength(1);
		expect(listed[0].id).toBe(created.id);
	});

	test("rejects deleting a referenced product", async () => {
		const routes = createRoutes();

		const productResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Bread",
				category: "food",
				barcode: "12345",
				default_unit: "pcs",
				is_perishable: true,
			}),
		});
		const product = await productResponse.json();

		const linkResponse = await request(routes, "/api/product-links", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				product_id: product.id,
				label: "Store",
				url: "https://example.com/bread",
			}),
		});
		expect(linkResponse.status).toBe(201);

		const deleteResponse = await request(
			routes,
			`/api/products/${product.id}`,
			{ method: "DELETE" },
			{ id: String(product.id) },
		);
		expect(deleteResponse.status).toBe(409);
		const body = await deleteResponse.json();
		expect(body.error).toContain("referenced");
	});

	test("patches a product field", async () => {
		const routes = createRoutes();

		const createResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Cheese",
				category: "food",
				barcode: "98765",
				default_unit: "pcs",
				is_perishable: true,
			}),
		});
		const created = await createResponse.json();

		const patchResponse = await request(
			routes,
			`/api/products/${created.id}`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ default_unit: "g" }),
			},
			{ id: String(created.id) },
		);

		expect(patchResponse.status).toBe(200);
		const updated = await patchResponse.json();
		expect(updated.default_unit).toBe("g");
	});

	test("uploads and fetches a product picture", async () => {
		const routes = createRoutes();

		const createResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Apple",
				category: "food",
				barcode: "111",
				default_unit: "pcs",
				is_perishable: true,
			}),
		});
		const created = await createResponse.json();

		const formData = new FormData();
		formData.set(
			"file",
			new File([new Uint8Array([1, 2, 3, 4])], "apple.png", {
				type: "image/png",
			}),
		);

		const uploadResponse = await request(
			routes,
			`/api/products/${created.id}/picture`,
			{
				method: "POST",
				body: formData,
			},
			{ id: String(created.id) },
		);
		expect(uploadResponse.status).toBe(200);
		const uploadBody = await uploadResponse.json();
		expect(uploadBody.content_type).toBe("image/png");

		const pictureResponse = await request(
			routes,
			`/api/products/${created.id}/picture`,
			{
				method: "GET",
			},
			{ id: String(created.id) },
		);
		expect(pictureResponse.status).toBe(200);
		expect(pictureResponse.headers.get("content-type")).toBe("image/png");
		const bytes = new Uint8Array(await pictureResponse.arrayBuffer());
		expect(Array.from(bytes)).toEqual([1, 2, 3, 4]);
	});

	test("creates shoppinglist items without a parent shopping list", async () => {
		const routes = createRoutes();

		const productResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Banana",
				category: "food",
				barcode: "555",
				default_unit: "pcs",
				is_perishable: true,
			}),
		});
		const product = await productResponse.json();

		const createItemResponse = await request(
			routes,
			"/api/shopping-list-items",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					product_id: product.id,
					quantity: 6,
					unit: "pcs",
					done: false,
					source_recipe_id: null,
					notes: "for breakfast",
				}),
			},
		);

		expect(createItemResponse.status).toBe(201);
		const createdItem = await createItemResponse.json();
		expect(createdItem.product_id).toBe(product.id);
		expect(createdItem.done).toBe(false);

		const listResponse = await request(routes, "/api/shopping-list-items");
		expect(listResponse.status).toBe(200);
		const items = await listResponse.json();
		expect(items).toHaveLength(1);
		expect(items[0].notes).toBe("for breakfast");
	});
});
