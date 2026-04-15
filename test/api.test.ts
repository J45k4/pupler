import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";

import {
	closeDatabase,
	inventoryContainerDetailRoute,
	inventoryContainersCollectionRoute,
	inventoryItemDetailRoute,
	inventoryItemsCollectionRoute,
	openDatabase,
	productDetailRoute,
	productLinkDetailRoute,
	productLinksCollectionRoute,
	productPictureRoute,
	productsCollectionRoute,
	receiptItemDetailRoute,
	receiptItemsCollectionRoute,
	receiptDetailRoute,
	receiptPictureRoute,
	receiptsCollectionRoute,
	shoppingListItemDetailRoute,
	shoppingListItemsCollectionRoute,
} from "../src/api";
import { applyTestSchema } from "./support/test-db";

const dbs: ReturnType<typeof openDatabase>[] = [];
const tempDirs: string[] = [];

afterEach(async () => {
	const db = dbs.pop();
	if (db) {
		await closeDatabase(db);
	}

	const tempDir = tempDirs.pop();
	if (tempDir) {
		rmSync(tempDir, { force: true, recursive: true });
	}
});

const createRoutes = () => {
	const tempDir = mkdtempSync(join(tmpdir(), "pupler-api-"));
	const dbPath = join(tempDir, "pupler.sqlite");
	tempDirs.push(tempDir);
	applyTestSchema(dbPath);

	const db = openDatabase(dbPath);
	dbs.push(db);

	return {
		"/api/products": productsCollectionRoute(db),
		"/api/products/:id": productDetailRoute(db),
		"/api/products/:id/picture": productPictureRoute(db),
		"/api/product-links": productLinksCollectionRoute(db),
		"/api/product-links/:id": productLinkDetailRoute(db),
		"/api/receipts": receiptsCollectionRoute(db),
		"/api/receipts/:id": receiptDetailRoute(db),
		"/api/receipts/:id/picture": receiptPictureRoute(db),
		"/api/receipt-items": receiptItemsCollectionRoute(db),
		"/api/receipt-items/:id": receiptItemDetailRoute(db),
		"/api/inventory-containers": inventoryContainersCollectionRoute(db),
		"/api/inventory-containers/:id": inventoryContainerDetailRoute(db),
		"/api/inventory-items": inventoryItemsCollectionRoute(db),
		"/api/inventory-items/:id": inventoryItemDetailRoute(db),
		"/api/shopping-list-items": shoppingListItemsCollectionRoute(db),
		"/api/shopping-list-items/:id": shoppingListItemDetailRoute(db),
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
		: pathname.match(/^\/api\/receipts\/\d+\/picture$/)
			? "/api/receipts/:id/picture"
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

	test("looks up a product by name case-insensitively", async () => {
		const routes = createRoutes();

		const createResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Greek Yogurt",
				category: "food",
				barcode: "741",
				default_unit: "cup",
				is_perishable: true,
			}),
		});

		expect(createResponse.status).toBe(201);
		const created = await createResponse.json();

		const listResponse = await request(
			routes,
			"/api/products?name=greek%20yogurt",
		);
		expect(listResponse.status).toBe(200);
		const listed = await listResponse.json();
		expect(listed).toHaveLength(1);
		expect(listed[0].id).toBe(created.id);
	});

	test("looks up a product by partial name case-insensitively", async () => {
		const routes = createRoutes();

		const createResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Organic Greek Yogurt",
				category: "food",
				barcode: "743",
				default_unit: "cup",
				is_perishable: true,
			}),
		});

		expect(createResponse.status).toBe(201);
		const created = await createResponse.json();

		const listResponse = await request(
			routes,
			"/api/products?name_contains=greek",
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

	test("uploads and fetches a purchase receipt picture", async () => {
		const routes = createRoutes();

		const createResponse = await request(routes, "/api/receipts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				store_name: "Alepa",
				purchased_at: "2026-04-13T10:30:00.000Z",
				currency: "EUR",
				total_amount: 12.4,
			}),
		});
		const created = await createResponse.json();

		const formData = new FormData();
		formData.set(
			"file",
			new File([new Uint8Array([5, 6, 7, 8])], "receipt.png", {
				type: "image/png",
			}),
		);

		const uploadResponse = await request(
			routes,
			`/api/receipts/${created.id}/picture`,
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
			`/api/receipts/${created.id}/picture`,
			{
				method: "GET",
			},
			{ id: String(created.id) },
		);
		expect(pictureResponse.status).toBe(200);
		expect(pictureResponse.headers.get("content-type")).toBe("image/png");
		const bytes = new Uint8Array(await pictureResponse.arrayBuffer());
		expect(Array.from(bytes)).toEqual([5, 6, 7, 8]);
	});

	test("creates and lists receipt items", async () => {
		const routes = createRoutes();

		const productResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Banana",
				category: "food",
				barcode: "444",
				default_unit: "pcs",
				is_perishable: true,
			}),
		});
		const product = await productResponse.json();

		const receiptResponse = await request(routes, "/api/receipts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				store_name: "Prisma",
				purchased_at: "2026-04-13T12:00:00.000Z",
				currency: "EUR",
				total_amount: 5.4,
			}),
		});
		const receipt = await receiptResponse.json();

		const createResponse = await request(routes, "/api/receipt-items", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				receipt_id: receipt.id,
				product_id: product.id,
				quantity: 6,
				unit: "pcs",
				unit_price: 0.9,
				line_total: 5.4,
			}),
		});
		expect(createResponse.status).toBe(201);
		const created = await createResponse.json();
		expect(created.receipt_id).toBe(receipt.id);

		const listResponse = await request(
			routes,
			`/api/receipt-items?receipt_id=${receipt.id}`,
		);
		expect(listResponse.status).toBe(200);
		const listed = await listResponse.json();
		expect(listed).toHaveLength(1);
		expect(listed[0].id).toBe(created.id);
		expect(listed[0].line_total).toBe(5.4);
	});

	test("creates nested inventory containers", async () => {
		const routes = createRoutes();

		const parentResponse = await request(
			routes,
			"/api/inventory-containers",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Room X",
					parent_container_id: null,
					notes: "Kitchen",
				}),
			},
		);
		expect(parentResponse.status).toBe(201);
		const parent = await parentResponse.json();
		expect(parent.name).toBe("Room X");

		const childResponse = await request(
			routes,
			"/api/inventory-containers",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Closet B",
					parent_container_id: parent.id,
					notes: null,
				}),
			},
		);
		expect(childResponse.status).toBe(201);
		const child = await childResponse.json();
		expect(child.parent_container_id).toBe(parent.id);

		const listResponse = await request(
			routes,
			`/api/inventory-containers?parent_container_id=${parent.id}`,
		);
		expect(listResponse.status).toBe(200);
		const listed = await listResponse.json();
		expect(listed).toHaveLength(1);
		expect(listed[0].id).toBe(child.id);
	});

	test("rejects moving a container into its own descendant", async () => {
		const routes = createRoutes();

		const parentResponse = await request(
			routes,
			"/api/inventory-containers",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Room X",
					parent_container_id: null,
					notes: null,
				}),
			},
		);
		const parent = await parentResponse.json();

		const childResponse = await request(
			routes,
			"/api/inventory-containers",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Closet B",
					parent_container_id: parent.id,
					notes: null,
				}),
			},
		);
		const child = await childResponse.json();

		const invalidPatchResponse = await request(
			routes,
			`/api/inventory-containers/${parent.id}`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ parent_container_id: child.id }),
			},
			{ id: String(parent.id) },
		);
		expect(invalidPatchResponse.status).toBe(400);
		const body = await invalidPatchResponse.json();
		expect(body.error).toContain("cycle");
	});

	test("unassigns inventory items and child containers when deleting a container", async () => {
		const routes = createRoutes();

		const productResponse = await request(routes, "/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Pasta",
				category: "food",
				barcode: "666",
				default_unit: "bag",
				is_perishable: false,
			}),
		});
		const product = await productResponse.json();

		const parentResponse = await request(
			routes,
			"/api/inventory-containers",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Pantry",
					parent_container_id: null,
					notes: null,
				}),
			},
		);
		const parent = await parentResponse.json();

		const childResponse = await request(
			routes,
			"/api/inventory-containers",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Shelf A",
					parent_container_id: parent.id,
					notes: null,
				}),
			},
		);
		const child = await childResponse.json();

		const itemResponse = await request(routes, "/api/inventory-items", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				product_id: product.id,
				receipt_item_id: null,
				container_id: parent.id,
				quantity: 2,
				unit: "bag",
				purchased_at: null,
				expires_at: null,
				consumed_at: null,
				notes: "Dry storage",
			}),
		});
		expect(itemResponse.status).toBe(201);
		const item = await itemResponse.json();
		expect(item.container_id).toBe(parent.id);

		const filterResponse = await request(
			routes,
			`/api/inventory-items?container_id=${parent.id}`,
		);
		expect(filterResponse.status).toBe(200);
		const filtered = await filterResponse.json();
		expect(filtered).toHaveLength(1);
		expect(filtered[0].id).toBe(item.id);

		const deleteResponse = await request(
			routes,
			`/api/inventory-containers/${parent.id}`,
			{ method: "DELETE" },
			{ id: String(parent.id) },
		);
		expect(deleteResponse.status).toBe(204);

		const updatedItemResponse = await request(
			routes,
			`/api/inventory-items/${item.id}`,
			{},
			{ id: String(item.id) },
		);
		expect(updatedItemResponse.status).toBe(200);
		const updatedItem = await updatedItemResponse.json();
		expect(updatedItem.container_id).toBeNull();

		const updatedChildResponse = await request(
			routes,
			`/api/inventory-containers/${child.id}`,
			{},
			{ id: String(child.id) },
		);
		expect(updatedChildResponse.status).toBe(200);
		const updatedChild = await updatedChildResponse.json();
		expect(updatedChild.parent_container_id).toBeNull();
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
