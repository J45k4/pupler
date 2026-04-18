import { afterEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { TestServer } from "./support/test-server";

const runningServers: TestServer[] = [];

const startServer = async () => {
	const server = await TestServer.start();
	runningServers.push(server);
	return server;
};

afterEach(async () => {
	const server = runningServers.pop();
	if (!server) {
		return;
	}

	await server.close();
});

describe("Pupler API e2e", () => {
	test("serves the index page from the root route", async () => {
		const server = await startServer();

		const page = await server.call<string>("/");
		expect(page.response.status).toBe(200);
		expect(page.response.headers.get("content-type")).toContain(
			"text/html",
		);
		expect(page.body).toContain("<title>Pupler</title>");
		expect(page.body).toContain("<body></body>");
		expect(page.body).toContain("/_bun/client/");
	});

	test("serves the app shell for known browser pages", async () => {
		const server = await startServer();

		const inventoryPage = await server.call<string>("/inventory");
		expect(inventoryPage.response.status).toBe(200);
		expect(inventoryPage.response.headers.get("content-type")).toContain(
			"text/html",
		);
		expect(inventoryPage.body).toContain("<title>Pupler</title>");

		const page = await server.call<string>("/products");
		expect(page.response.status).toBe(200);
		expect(page.response.headers.get("content-type")).toContain(
			"text/html",
		);
		expect(page.body).toContain("<title>Pupler</title>");
		expect(page.body).toContain("<body></body>");

		const productDetailPage = await server.call<string>("/products/1");
		expect(productDetailPage.response.status).toBe(200);
		expect(
			productDetailPage.response.headers.get("content-type"),
		).toContain("text/html");
		expect(productDetailPage.body).toContain("<title>Pupler</title>");

		const inventoryContainerPage = await server.call<string>(
			"/inventory/containers/1",
		);
		expect(inventoryContainerPage.response.status).toBe(200);
		expect(
			inventoryContainerPage.response.headers.get("content-type"),
		).toContain("text/html");
		expect(inventoryContainerPage.body).toContain("<title>Pupler</title>");
	});

	test("serves the app shell for receipt pages", async () => {
		const server = await startServer();

		const listPage = await server.call<string>("/receipts");
		expect(listPage.response.status).toBe(200);
		expect(listPage.response.headers.get("content-type")).toContain(
			"text/html",
		);
		expect(listPage.body).toContain("<title>Pupler</title>");

		const detailPage = await server.call<string>("/receipts/1");
		expect(detailPage.response.status).toBe(200);
		expect(detailPage.response.headers.get("content-type")).toContain(
			"text/html",
		);
		expect(detailPage.body).toContain("<title>Pupler</title>");
	});

	test("serves the app shell for shopping list pages", async () => {
		const server = await startServer();

		const page = await server.call<string>("/shopping-lists");
		expect(page.response.status).toBe(200);
		expect(page.response.headers.get("content-type")).toContain(
			"text/html",
		);
		expect(page.body).toContain("<title>Pupler</title>");
		expect(page.body).toContain("<body></body>");
	});

	test("serves the app shell for recipe pages", async () => {
		const server = await startServer();

		const listPage = await server.call<string>("/recipes");
		expect(listPage.response.status).toBe(200);
		expect(listPage.response.headers.get("content-type")).toContain(
			"text/html",
		);
		expect(listPage.body).toContain("<title>Pupler</title>");

		const createPage = await server.call<string>("/recipes/new");
		expect(createPage.response.status).toBe(200);
		expect(createPage.response.headers.get("content-type")).toContain(
			"text/html",
		);
		expect(createPage.body).toContain("<title>Pupler</title>");

		const detailPage = await server.call<string>("/recipes/1");
		expect(detailPage.response.status).toBe(200);
		expect(detailPage.response.headers.get("content-type")).toContain(
			"text/html",
		);
		expect(detailPage.body).toContain("<title>Pupler</title>");
	});

	test("serves the 404 page for unknown browser routes", async () => {
		const server = await startServer();

		const page = await server.call<string>("/missing");
		expect(page.response.status).toBe(404);
		expect(page.response.headers.get("content-type")).toContain(
			"text/html",
		);
		expect(page.body).toContain("<title>Pupler | Page Not Found</title>");
		expect(page.body).toContain("Back to dashboard");
	});

	test("keeps JSON 404s for unknown API routes", async () => {
		const server = await startServer();

		const response = await server.call<{ error: string }>("/api/missing");
		expect(response.response.status).toBe(404);
		expect(response.response.headers.get("content-type")).toContain(
			"application/json",
		);
		expect(response.body.error).toBe("Route not found");
	});

	test("starts the server and looks up a product by barcode over HTTP", async () => {
		const server = await startServer();

		const created = await server.call<{ id: number; barcode: string }>(
			"/api/products",
			{
				method: "POST",
				body: {
					name: "Milk",
					category: "food",
					barcode: "6414893400012",
					default_unit: "pcs",
					is_perishable: true,
				},
			},
		);

		expect(created.response.status).toBe(201);
		expect(created.body.barcode).toBe("6414893400012");

		const listed = await server.call<Array<{ id: number }>>(
			"/api/products?barcode=6414893400012",
		);
		expect(listed.response.status).toBe(200);
		expect(listed.body).toHaveLength(1);
		expect(listed.body[0].id).toBe(created.body.id);
	});

	test("looks up a product by name case-insensitively over HTTP", async () => {
		const server = await startServer();

		const created = await server.call<{ id: number; name: string }>(
			"/api/products",
			{
				method: "POST",
				body: {
					name: "Greek Yogurt",
					category: "food",
					barcode: "742",
					default_unit: "cup",
					is_perishable: true,
				},
			},
		);

		expect(created.response.status).toBe(201);
		expect(created.body.name).toBe("Greek Yogurt");

		const listed = await server.call<Array<{ id: number }>>(
			"/api/products?name=greek%20yogurt",
		);
		expect(listed.response.status).toBe(200);
		expect(listed.body).toHaveLength(1);
		expect(listed.body[0].id).toBe(created.body.id);
	});

	test("looks up a product by partial name case-insensitively over HTTP", async () => {
		const server = await startServer();

		const created = await server.call<{ id: number; name: string }>(
			"/api/products",
			{
				method: "POST",
				body: {
					name: "Organic Greek Yogurt",
					category: "food",
					barcode: "744",
					default_unit: "cup",
					is_perishable: true,
				},
			},
		);

		expect(created.response.status).toBe(201);

		const listed = await server.call<Array<{ id: number }>>(
			"/api/products?name_contains=greek",
		);
		expect(listed.response.status).toBe(200);
		expect(listed.body).toHaveLength(1);
		expect(listed.body[0].id).toBe(created.body.id);
	});

	test("rejects deleting a referenced product over HTTP", async () => {
		const server = await startServer();

		const product = await server.call<{ id: number }>("/api/products", {
			method: "POST",
			body: {
				name: "Bread",
				category: "food",
				barcode: "12345",
				default_unit: "pcs",
				is_perishable: true,
			},
		});
		expect(product.response.status).toBe(201);

		const link = await server.call("/api/product-links", {
			method: "POST",
			body: {
				product_id: product.body.id,
				label: "Store",
				url: "https://example.com/bread",
			},
		});
		expect(link.response.status).toBe(201);

		const deleted = await server.call<{ error: string }>(
			`/api/products/${product.body.id}`,
			{
				method: "DELETE",
			},
		);
		expect(deleted.response.status).toBe(409);
		expect(deleted.body.error).toContain("referenced");
	});

	test("patches a product over HTTP", async () => {
		const server = await startServer();

		const created = await server.call<{ id: number }>("/api/products", {
			method: "POST",
			body: {
				name: "Cheese",
				category: "food",
				barcode: "98765",
				default_unit: "pcs",
				is_perishable: true,
			},
		});
		expect(created.response.status).toBe(201);

		const updated = await server.call<{ default_unit: string }>(
			`/api/products/${created.body.id}`,
			{
				method: "PATCH",
				body: {
					default_unit: "g",
				},
			},
		);

		expect(updated.response.status).toBe(200);
		expect(updated.body.default_unit).toBe("g");
	});

	test("uploads and fetches a product picture over HTTP", async () => {
		const server = await startServer();

		const created = await server.call<{ id: number }>("/api/products", {
			method: "POST",
			body: {
				name: "Tomato",
				category: "food",
				barcode: "222",
				default_unit: "pcs",
				is_perishable: true,
			},
		});
		expect(created.response.status).toBe(201);

		const formData = new FormData();
		formData.set(
			"file",
			new File([new Uint8Array([9, 8, 7, 6])], "tomato.png", {
				type: "image/png",
			}),
		);

		const upload = await server.call<{
			content_type: string;
			filename: string | null;
			size: number;
		}>(`/api/products/${created.body.id}/picture`, {
			method: "POST",
			body: formData,
		});
		expect(upload.response.status).toBe(200);
		expect(upload.body.content_type).toBe("image/png");
		expect(upload.body.filename).toBe("tomato.png");
		expect(existsSync(join(server.filesPath, "product-pictures"))).toBe(true);

		const picture = await fetch(
			`${server.baseUrl}/api/products/${created.body.id}/picture`,
		);
		expect(picture.status).toBe(200);
		expect(picture.headers.get("content-type")).toBe("image/png");
		const bytes = new Uint8Array(await picture.arrayBuffer());
		expect(Array.from(bytes)).toEqual([9, 8, 7, 6]);
	});

	test("uploads and fetches a purchase receipt picture over HTTP", async () => {
		const server = await startServer();

		const created = await server.call<{ id: number }>("/api/receipts", {
			method: "POST",
			body: {
				store_name: "Prisma",
				purchased_at: "2026-04-13T12:00:00.000Z",
				currency: "EUR",
				total_amount: 18.5,
			},
		});
		expect(created.response.status).toBe(201);

		const formData = new FormData();
		formData.set(
			"file",
			new File([new Uint8Array([4, 3, 2, 1])], "receipt.png", {
				type: "image/png",
			}),
		);

		const upload = await server.call<{
			content_type: string;
			filename: string | null;
			size: number;
		}>(`/api/receipts/${created.body.id}/picture`, {
			method: "POST",
			body: formData,
		});
		expect(upload.response.status).toBe(200);
		expect(upload.body.content_type).toBe("image/png");
		expect(upload.body.filename).toBe("receipt.png");
		expect(existsSync(join(server.filesPath, "receipt-pictures"))).toBe(true);

		const picture = await fetch(
			`${server.baseUrl}/api/receipts/${created.body.id}/picture`,
		);
		expect(picture.status).toBe(200);
		expect(picture.headers.get("content-type")).toBe("image/png");
		const bytes = new Uint8Array(await picture.arrayBuffer());
		expect(Array.from(bytes)).toEqual([4, 3, 2, 1]);
	});

	test("uploads and fetches multiple recipe images over HTTP", async () => {
		const server = await startServer();

		const created = await server.call<{ id: number }>("/api/recipes", {
			method: "POST",
			body: {
				name: "Tomato soup",
				description: null,
				instructions: null,
				servings: 4,
				is_active: true,
			},
		});
		expect(created.response.status).toBe(201);

		const formData = new FormData();
		formData.append(
			"file",
			new File([new Uint8Array([1, 3, 5, 7])], "recipe.png", {
				type: "image/png",
			}),
		);
		formData.append(
			"file",
			new File([new Uint8Array([2, 4, 6, 8])], "recipe-2.png", {
				type: "image/png",
			}),
		);

		const upload = await server.call<{
			id: number;
			filename: string | null;
		}[]>(`/api/recipes/${created.body.id}/pictures`, {
			method: "POST",
			body: formData,
		});
		expect(upload.response.status).toBe(201);
		expect(upload.body).toHaveLength(2);
		expect(upload.body.map((image) => image.filename)).toEqual([
			"recipe.png",
			"recipe-2.png",
		]);
		expect(existsSync(join(server.filesPath, "recipe-images"))).toBe(true);

		const picture = await fetch(
			`${server.baseUrl}/api/recipes/${created.body.id}/pictures/${upload.body[0]!.id}`,
		);
		expect(picture.status).toBe(200);
		expect(picture.headers.get("content-type")).toBe("image/png");
		const bytes = new Uint8Array(await picture.arrayBuffer());
		expect(Array.from(bytes)).toEqual([1, 3, 5, 7]);
	});

	test("creates receipt items over HTTP", async () => {
		const server = await startServer();

		const product = await server.call<{ id: number }>("/api/products", {
			method: "POST",
			body: {
				name: "Yogurt",
				category: "food",
				barcode: "555",
				default_unit: "cup",
				is_perishable: true,
			},
		});
		expect(product.response.status).toBe(201);

		const receipt = await server.call<{ id: number }>("/api/receipts", {
			method: "POST",
			body: {
				store_name: "K-Citymarket",
				purchased_at: "2026-04-13T12:00:00.000Z",
				currency: "EUR",
				total_amount: 7.8,
			},
		});
		expect(receipt.response.status).toBe(201);

		const created = await server.call<{
			id: number;
			receipt_id: number;
			product_id: number;
		}>("/api/receipt-items", {
			method: "POST",
			body: {
				receipt_id: receipt.body.id,
				product_id: product.body.id,
				quantity: 3,
				unit: "cup",
				unit_price: 2.6,
				line_total: 7.8,
			},
		});
		expect(created.response.status).toBe(201);
		expect(created.body.receipt_id).toBe(receipt.body.id);
		expect(created.body.product_id).toBe(product.body.id);

		const listed = await server.call<
			Array<{ id: number; receipt_id: number }>
		>(`/api/receipt-items?receipt_id=${receipt.body.id}`);
		expect(listed.response.status).toBe(200);
		expect(listed.body).toHaveLength(1);
		expect(listed.body[0].id).toBe(created.body.id);
		expect(listed.body[0].receipt_id).toBe(receipt.body.id);
	});

	test("repairs receipt items over HTTP and unlinks inventory on delete", async () => {
		const server = await startServer();

		const product = await server.call<{ id: number }>("/api/products", {
			method: "POST",
			body: {
				name: "Yogurt",
				category: "food",
				barcode: "556",
				default_unit: "cup",
				is_perishable: true,
			},
		});
		expect(product.response.status).toBe(201);

		const replacementProduct = await server.call<{ id: number }>("/api/products", {
			method: "POST",
			body: {
				name: "Skyr",
				category: "food",
				barcode: "557",
				default_unit: "cup",
				is_perishable: true,
			},
		});
		expect(replacementProduct.response.status).toBe(201);

		const receipt = await server.call<{ id: number }>("/api/receipts", {
			method: "POST",
			body: {
				store_name: "K-Citymarket",
				purchased_at: "2026-04-13T12:00:00.000Z",
				currency: "EUR",
				total_amount: 7.8,
			},
		});
		expect(receipt.response.status).toBe(201);

		const created = await server.call<{
			id: number;
			receipt_id: number;
			product_id: number;
		}>('/api/receipt-items', {
			method: 'POST',
			body: {
				receipt_id: receipt.body.id,
				product_id: product.body.id,
				quantity: 3,
				unit: 'cup',
				unit_price: 2.6,
				line_total: 7.8,
			},
		});
		expect(created.response.status).toBe(201);

		const inventory = await server.call<{ id: number; receipt_item_id: number | null }>(
			'/api/inventory-items',
			{
				method: 'POST',
				body: {
					name: 'Yogurt cup',
					ingredient_id: null,
					product_id: product.body.id,
					receipt_item_id: created.body.id,
					container_id: null,
					quantity: 1,
					unit: 'cup',
					purchased_at: null,
					expires_at: null,
					consumed_at: null,
					notes: null,
				},
			},
		);
		expect(inventory.response.status).toBe(201);

		const updated = await server.call<{ product_id: number; quantity: number; line_total: number | null }>(
			`/api/receipt-items/${created.body.id}`,
			{
				method: 'PATCH',
				body: {
					product_id: replacementProduct.body.id,
					quantity: 2,
					line_total: 5.2,
				},
			},
		);
		expect(updated.response.status).toBe(200);
		expect(updated.body.product_id).toBe(replacementProduct.body.id);
		expect(updated.body.quantity).toBe(2);
		expect(updated.body.line_total).toBe(5.2);

		const invalid = await server.call<{ error: string }>(
			`/api/receipt-items/${created.body.id}`,
			{
				method: 'PATCH',
				body: { product_id: 999999 },
			},
		);
		expect(invalid.response.status).toBe(400);
		expect(invalid.body.error).toContain('missing product');

		const deleted = await server.call(`/api/receipt-items/${created.body.id}`, {
			method: 'DELETE',
		});
		expect(deleted.response.status).toBe(204);

		const refreshedInventory = await server.call<{ receipt_item_id: number | null }>(
			`/api/inventory-items/${inventory.body.id}`,
		);
		expect(refreshedInventory.response.status).toBe(200);
		expect(refreshedInventory.body.receipt_item_id).toBeNull();
	});

	test("deletes receipts over HTTP with linked receipt items", async () => {
		const server = await startServer();

		const product = await server.call<{ id: number }>("/api/products", {
			method: "POST",
			body: {
				name: "Cream",
				category: "food",
				barcode: "558",
				default_unit: "pcs",
				is_perishable: true,
			},
		});
		expect(product.response.status).toBe(201);

		const receipt = await server.call<{ id: number }>("/api/receipts", {
			method: "POST",
			body: {
				store_name: "K-Citymarket",
				purchased_at: "2026-04-13T12:00:00.000Z",
				currency: "EUR",
				total_amount: 3.4,
			},
		});
		expect(receipt.response.status).toBe(201);

		const item = await server.call<{ id: number }>("/api/receipt-items", {
			method: "POST",
			body: {
				receipt_id: receipt.body.id,
				product_id: product.body.id,
				quantity: 1,
				unit: "pcs",
				unit_price: 3.4,
				line_total: 3.4,
			},
		});
		expect(item.response.status).toBe(201);

		const inventory = await server.call<{ id: number }>('/api/inventory-items', {
			method: 'POST',
			body: {
				name: 'Cream carton',
				ingredient_id: null,
				product_id: product.body.id,
				receipt_item_id: item.body.id,
				container_id: null,
				quantity: 1,
				unit: 'pcs',
				purchased_at: null,
				expires_at: null,
				consumed_at: null,
				notes: null,
			},
		});
		expect(inventory.response.status).toBe(201);

		const deleted = await server.call(`/api/receipts/${receipt.body.id}`, {
			method: 'DELETE',
		});
		expect(deleted.response.status).toBe(204);

		const missingReceipt = await server.call<{ error: string }>(`/api/receipts/${receipt.body.id}`);
		expect(missingReceipt.response.status).toBe(404);

		const missingItem = await server.call<{ error: string }>(`/api/receipt-items/${item.body.id}`);
		expect(missingItem.response.status).toBe(404);

		const refreshedInventory = await server.call<{ receipt_item_id: number | null }>(
			`/api/inventory-items/${inventory.body.id}`,
		);
		expect(refreshedInventory.response.status).toBe(200);
		expect(refreshedInventory.body.receipt_item_id).toBeNull();
	});

	test("creates inventory containers and assigns inventory items over HTTP", async () => {
		const server = await startServer();

		const ingredient = await server.call<{ id: number }>("/api/ingredients", {
			method: "POST",
			body: {
				name: "Rice",
				default_unit: "bag",
			},
		});
		expect(ingredient.response.status).toBe(201);

		const product = await server.call<{ id: number }>("/api/products", {
			method: "POST",
			body: {
				ingredient_id: ingredient.body.id,
				name: "Rice",
				category: "food",
				barcode: "777",
				default_unit: "bag",
				is_perishable: false,
			},
		});
		expect(product.response.status).toBe(201);

		const parent = await server.call<{ id: number; name: string }>(
			"/api/inventory-containers",
			{
				method: "POST",
				body: {
					name: "Room X",
					parent_container_id: null,
					notes: "Kitchen",
				},
			},
		);
		expect(parent.response.status).toBe(201);

		const child = await server.call<{
			id: number;
			parent_container_id: number;
		}>("/api/inventory-containers", {
			method: "POST",
			body: {
				name: "Closet B",
				parent_container_id: parent.body.id,
				notes: null,
			},
		});
		expect(child.response.status).toBe(201);
		expect(child.body.parent_container_id).toBe(parent.body.id);

		const item = await server.call<{
			id: number;
			container_id: number | null;
			ingredient_id: number | null;
			name: string;
			product_id: number | null;
		}>("/api/inventory-items", {
			method: "POST",
			body: {
				name: "Rice bag",
				ingredient_id: ingredient.body.id,
				product_id: product.body.id,
				receipt_item_id: null,
				container_id: parent.body.id,
				quantity: 1,
				unit: "bag",
				purchased_at: null,
				expires_at: null,
				consumed_at: null,
				notes: "Cupboard stock",
			},
		});
		expect(item.response.status).toBe(201);
		expect(item.body.container_id).toBe(parent.body.id);
		expect(item.body.name).toBe("Rice bag");
		expect(item.body.ingredient_id).toBe(ingredient.body.id);
		expect(item.body.product_id).toBe(product.body.id);

		const filtered = await server.call<Array<{ id: number }>>(
			`/api/inventory-items?container_id=${parent.body.id}`,
		);
		expect(filtered.response.status).toBe(200);
		expect(filtered.body).toHaveLength(1);
		expect(filtered.body[0].id).toBe(item.body.id);

		const deleted = await server.call(
			`/api/inventory-containers/${parent.body.id}`,
			{
				method: "DELETE",
			},
		);
		expect(deleted.response.status).toBe(204);

		const refreshedChild = await server.call<{
			parent_container_id: number | null;
		}>(`/api/inventory-containers/${child.body.id}`);
		expect(refreshedChild.response.status).toBe(200);
		expect(refreshedChild.body.parent_container_id).toBeNull();

		const refreshedItem = await server.call<{
			container_id: number | null;
		}>(`/api/inventory-items/${item.body.id}`);
		expect(refreshedItem.response.status).toBe(200);
		expect(refreshedItem.body.container_id).toBeNull();
	});

	test("rejects container cycles over HTTP", async () => {
		const server = await startServer();

		const parent = await server.call<{ id: number }>(
			"/api/inventory-containers",
			{
				method: "POST",
				body: {
					name: "Room X",
					parent_container_id: null,
					notes: null,
				},
			},
		);
		expect(parent.response.status).toBe(201);

		const child = await server.call<{ id: number }>(
			"/api/inventory-containers",
			{
				method: "POST",
				body: {
					name: "Closet B",
					parent_container_id: parent.body.id,
					notes: null,
				},
			},
		);
		expect(child.response.status).toBe(201);

		const invalid = await server.call<{ error: string }>(
			`/api/inventory-containers/${parent.body.id}`,
			{
				method: "PATCH",
				body: {
					parent_container_id: child.body.id,
				},
			},
		);
		expect(invalid.response.status).toBe(400);
		expect(invalid.body.error).toContain("cycle");
	});

	test("creates shoppinglist items over HTTP without a parent list", async () => {
		const server = await startServer();

		const createdItem = await server.call<{
			id: number;
			ingredient_id: number | null;
			name: string;
			product_id: number | null;
			done: boolean;
		}>("/api/shopping-list-items", {
			method: "POST",
			body: {
				name: "Light bulb",
				ingredient_id: null,
				product_id: null,
				quantity: 2,
				unit: "pcs",
				done: false,
				source_recipe_id: null,
				notes: "hall closet",
			},
		});
		expect(createdItem.response.status).toBe(201);
		expect(createdItem.body.name).toBe("Light bulb");
		expect(createdItem.body.product_id).toBeNull();
		expect(createdItem.body.ingredient_id).toBeNull();
		expect(createdItem.body.done).toBe(false);

		const listed = await server.call<
			Array<{
				ingredient_id: number | null;
				name: string;
				product_id: number | null;
				notes: string | null;
			}>
		>("/api/shopping-list-items");
		expect(listed.response.status).toBe(200);
		expect(listed.body).toHaveLength(1);
		expect(listed.body[0].name).toBe("Light bulb");
		expect(listed.body[0].product_id).toBeNull();
		expect(listed.body[0].ingredient_id).toBeNull();
		expect(listed.body[0].notes).toBe("hall closet");
	});
});
