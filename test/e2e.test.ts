import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createServer } from "node:net";

type ApiResponse<TBody = unknown> = {
	body: TBody;
	response: Response;
};

type RunningServer = {
	baseUrl: string;
	dbPath: string;
	process: Bun.Subprocess<"ignore", "pipe", "pipe">;
	tempDir: string;
};

type CallOptions = Omit<RequestInit, "body" | "headers"> & {
	body?: BodyInit | Record<string, unknown>;
	headers?: HeadersInit;
};

const runningServers: TestServer[] = [];
const projectRoot = resolve(dirname(import.meta.dir));

afterEach(async () => {
	const server = runningServers.pop();
	if (!server) {
		return;
	}

	await server.close();
});

const getFreePort = () =>
	new Promise<number>((resolvePort, reject) => {
		const probe = createServer();

		probe.once("error", reject);
		probe.listen(0, "127.0.0.1", () => {
			const address = probe.address();
			if (!address || typeof address === "string") {
				probe.close();
				reject(new Error("Failed to allocate a port for e2e tests"));
				return;
			}

			const { port } = address;
			probe.close((error) => {
				if (error) {
					reject(error);
					return;
				}
				resolvePort(port);
			});
		});
	});

const waitForHealth = async (baseUrl: string, timeoutMs = 5000) => {
	const startedAt = Date.now();

	while (Date.now() - startedAt < timeoutMs) {
		try {
			const response = await fetch(`${baseUrl}/health`);
			if (response.ok) {
				return;
			}
		} catch {
			// Server is still starting.
		}

		await Bun.sleep(100);
	}

	throw new Error(`Server did not become healthy within ${timeoutMs}ms`);
};

class TestServer {
	readonly baseUrl: string;
	readonly dbPath: string;
	readonly process: Bun.Subprocess<"ignore", "pipe", "pipe">;
	readonly tempDir: string;

	constructor(server: RunningServer) {
		this.baseUrl = server.baseUrl;
		this.dbPath = server.dbPath;
		this.process = server.process;
		this.tempDir = server.tempDir;
	}

	static async start() {
		const port = await getFreePort();
		const tempDir = mkdtempSync(join(tmpdir(), "pupler-e2e-"));
		const dbPath = join(tempDir, "pupler.sqlite");
		mkdirSync(tempDir, { recursive: true });

		const child = Bun.spawn(["bun", "src/main.ts"], {
			cwd: projectRoot,
			env: {
				...process.env,
				PORT: String(port),
				DB_PATH: dbPath,
			},
			stdout: "pipe",
			stderr: "pipe",
		});

		const server = new TestServer({
			baseUrl: `http://127.0.0.1:${port}`,
			dbPath,
			process: child,
			tempDir,
		});
		runningServers.push(server);

		try {
			await waitForHealth(server.baseUrl);
			return server;
		} catch (error) {
			const stderr = await new Response(child.stderr).text();
			throw new Error(`${String(error)}\n${stderr}`.trim());
		}
	}

	async close() {
		this.process.kill();
		await this.process.exited;
		rmSync(this.tempDir, { force: true, recursive: true });
	}

	async call<TBody = unknown>(
		path: string,
		options: CallOptions = {},
	): Promise<ApiResponse<TBody>> {
		const headers = new Headers(options.headers);
		let body: BodyInit | undefined;

		if (options.body !== undefined) {
			if (
				typeof options.body === "string" ||
				options.body instanceof ArrayBuffer ||
				ArrayBuffer.isView(options.body) ||
				options.body instanceof Blob ||
				options.body instanceof FormData ||
				options.body instanceof URLSearchParams ||
				options.body instanceof ReadableStream
			) {
				body = options.body;
			} else {
				if (!headers.has("Content-Type")) {
					headers.set("Content-Type", "application/json");
				}
				body = JSON.stringify(options.body);
			}
		}

		const response = await fetch(`${this.baseUrl}${path}`, {
			...options,
			headers,
			body,
		});
		const contentType = response.headers.get("content-type") ?? "";
		const parsedBody = contentType.includes("application/json")
			? ((await response.json()) as TBody)
			: ((await response.text()) as TBody);

		return { body: parsedBody, response };
	}
}

describe("Pupler API e2e", () => {
	test("serves the index page from the root route", async () => {
		const server = await TestServer.start();

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
		const server = await TestServer.start();

		const page = await server.call<string>("/products");
		expect(page.response.status).toBe(200);
		expect(page.response.headers.get("content-type")).toContain(
			"text/html",
		);
		expect(page.body).toContain("<title>Pupler</title>");
		expect(page.body).toContain("<body></body>");
	});

	test("serves the app shell for shopping list pages", async () => {
		const server = await TestServer.start();

		const page = await server.call<string>("/shopping-lists");
		expect(page.response.status).toBe(200);
		expect(page.response.headers.get("content-type")).toContain(
			"text/html",
		);
		expect(page.body).toContain("<title>Pupler</title>");
		expect(page.body).toContain("<body></body>");
	});

	test("serves the 404 page for unknown browser routes", async () => {
		const server = await TestServer.start();

		const page = await server.call<string>("/missing");
		expect(page.response.status).toBe(404);
		expect(page.response.headers.get("content-type")).toContain(
			"text/html",
		);
		expect(page.body).toContain("<title>Pupler | Page Not Found</title>");
		expect(page.body).toContain("Back to dashboard");
	});

	test("keeps JSON 404s for unknown API routes", async () => {
		const server = await TestServer.start();

		const response = await server.call<{ error: string }>("/api/missing");
		expect(response.response.status).toBe(404);
		expect(response.response.headers.get("content-type")).toContain(
			"application/json",
		);
		expect(response.body.error).toBe("Route not found");
	});

	test("starts the server and looks up a product by barcode over HTTP", async () => {
		const server = await TestServer.start();

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

	test("rejects deleting a referenced product over HTTP", async () => {
		const server = await TestServer.start();

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
		const server = await TestServer.start();

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
		const server = await TestServer.start();

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

		const picture = await fetch(
			`${server.baseUrl}/api/products/${created.body.id}/picture`,
		);
		expect(picture.status).toBe(200);
		expect(picture.headers.get("content-type")).toBe("image/png");
		const bytes = new Uint8Array(await picture.arrayBuffer());
		expect(Array.from(bytes)).toEqual([9, 8, 7, 6]);
	});

	test("creates shoppinglist items over HTTP without a parent list", async () => {
		const server = await TestServer.start();

		const product = await server.call<{ id: number }>("/api/products", {
			method: "POST",
			body: {
				name: "Oats",
				category: "food",
				barcode: "333",
				default_unit: "bag",
				is_perishable: false,
			},
		});
		expect(product.response.status).toBe(201);

		const createdItem = await server.call<{
			id: number;
			product_id: number;
			done: boolean;
		}>("/api/shopping-list-items", {
			method: "POST",
			body: {
				product_id: product.body.id,
				quantity: 2,
				unit: "bag",
				done: false,
				source_recipe_id: null,
				notes: "pantry refill",
			},
		});
		expect(createdItem.response.status).toBe(201);
		expect(createdItem.body.product_id).toBe(product.body.id);
		expect(createdItem.body.done).toBe(false);

		const listed = await server.call<
			Array<{ product_id: number; notes: string | null }>
		>("/api/shopping-list-items");
		expect(listed.response.status).toBe(200);
		expect(listed.body).toHaveLength(1);
		expect(listed.body[0].product_id).toBe(product.body.id);
		expect(listed.body[0].notes).toBe("pantry refill");
	});
});
