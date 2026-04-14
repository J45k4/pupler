import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { TestServer, projectRoot } from "./support/test-server";

type CliResult = {
	exitCode: number;
	stderr: string;
	stdout: string;
};

const runningServers: TestServer[] = [];
const tempDirs: string[] = [];

const startServer = async () => {
	const server = await TestServer.start();
	runningServers.push(server);
	return server;
};

const createTempDir = () => {
	const tempDir = mkdtempSync(join(tmpdir(), "pupler-cli-"));
	tempDirs.push(tempDir);
	return tempDir;
};

const runCli = async (
	args: string[],
	options: { baseUrl?: string; includeEnvBaseUrl?: boolean } = {},
): Promise<CliResult> => {
	const env = { ...process.env };
	if (options.includeEnvBaseUrl === false) {
		delete env.PUPLER_BASE_URL;
	} else if (options.baseUrl) {
		env.PUPLER_BASE_URL = options.baseUrl;
	}

	const child = Bun.spawn(["bun", "./cli/cli.ts", ...args], {
		cwd: projectRoot,
		env,
		stdout: "pipe",
		stderr: "pipe",
	});

	const [exitCode, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);

	return {
		exitCode,
		stderr: stderr.trim(),
		stdout: stdout.trim(),
	};
};

afterEach(async () => {
	const server = runningServers.pop();
	if (server) {
		await server.close();
	}

	const tempDir = tempDirs.pop();
	if (tempDir) {
		rmSync(tempDir, { force: true, recursive: true });
	}
});

describe("Pupler CLI", () => {
	test("creates and lists products as JSON", async () => {
		const server = await startServer();

		const created = await runCli(
			[
				"products",
				"create",
				"--json",
				"--name",
				"Milk",
				"--category",
				"food",
				"--barcode",
				"6414893400012",
				"--default-unit",
				"pcs",
				"--is-perishable",
				"true",
			],
			{ baseUrl: server.baseUrl },
		);

		expect(created.exitCode).toBe(0);
		const createdBody = JSON.parse(created.stdout) as {
			barcode: string;
			id: number;
			name: string;
		};
		expect(createdBody.name).toBe("Milk");
		expect(createdBody.barcode).toBe("6414893400012");

		const listed = await runCli(
			["products", "list", "--json", "--barcode", "6414893400012"],
			{ baseUrl: server.baseUrl },
		);
		expect(listed.exitCode).toBe(0);
		const listedBody = JSON.parse(listed.stdout) as Array<{ id: number }>;
		expect(listedBody).toHaveLength(1);
		expect(listedBody[0]?.id).toBe(createdBody.id);
	});

	test("creates receipts and receipt items", async () => {
		const server = await startServer();
		const product = await server.call<{ id: number }>("/api/products", {
			method: "POST",
			body: {
				name: "Banana",
				category: "food",
				barcode: "123123",
				default_unit: "pcs",
				is_perishable: true,
			},
		});

		const receipt = await runCli(
			[
				"receipts",
				"create",
				"--json",
				"--store-name",
				"Prisma",
				"--purchased-at",
				"2026-04-14T08:00:00Z",
				"--currency",
				"EUR",
				"--total-amount",
				"5.4",
			],
			{ baseUrl: server.baseUrl },
		);
		expect(receipt.exitCode).toBe(0);
		const receiptBody = JSON.parse(receipt.stdout) as { id: number };

		const item = await runCli(
			[
				"receipt-items",
				"create",
				"--json",
				"--receipt-id",
				String(receiptBody.id),
				"--product-id",
				String(product.body.id),
				"--quantity",
				"6",
				"--unit",
				"pcs",
				"--unit-price",
				"0.9",
				"--line-total",
				"5.4",
			],
			{ baseUrl: server.baseUrl },
		);
		expect(item.exitCode).toBe(0);
		const itemBody = JSON.parse(item.stdout) as {
			product_id: number;
			receipt_id: number;
		};
		expect(itemBody.receipt_id).toBe(receiptBody.id);
		expect(itemBody.product_id).toBe(product.body.id);
	});

	test("creates and lists shopping list items with human-readable output", async () => {
		const server = await startServer();
		const product = await server.call<{ id: number }>("/api/products", {
			method: "POST",
			body: {
				name: "Oats",
				category: "food",
				barcode: "9988",
				default_unit: "bag",
				is_perishable: false,
			},
		});

		const created = await runCli(
			[
				"shopping-list-items",
				"create",
				"--product-id",
				String(product.body.id),
				"--quantity",
				"2",
				"--unit",
				"bag",
				"--done",
				"false",
				"--notes",
				"pantry refill",
			],
			{ baseUrl: server.baseUrl },
		);
		expect(created.exitCode).toBe(0);
		expect(created.stdout).toContain("product_id:");
		expect(created.stdout).toContain("pantry refill");

		const listed = await runCli(
			["shopping-list-items", "list", "--done", "false"],
			{ baseUrl: server.baseUrl },
		);
		expect(listed.exitCode).toBe(0);
		expect(listed.stdout).toContain("notes");
		expect(listed.stdout).toContain("pantry refill");
	});

	test("uploads and downloads product pictures", async () => {
		const server = await startServer();
		const product = await server.call<{ id: number }>("/api/products", {
			method: "POST",
			body: {
				name: "Tomato",
				category: "food",
				barcode: "5566",
				default_unit: "pcs",
				is_perishable: true,
			},
		});
		const tempDir = createTempDir();
		const uploadPath = join(tempDir, "tomato.png");
		const outputPath = join(tempDir, "downloaded.png");
		writeFileSync(uploadPath, new Uint8Array([9, 8, 7, 6]));

		const uploaded = await runCli(
			[
				"products",
				"picture",
				"upload",
				String(product.body.id),
				"--file",
				uploadPath,
			],
			{ baseUrl: server.baseUrl },
		);
		expect(uploaded.exitCode).toBe(0);
		expect(uploaded.stdout).toContain("content_type:");

		const downloaded = await runCli(
			[
				"products",
				"picture",
				"get",
				String(product.body.id),
				"--output",
				outputPath,
			],
			{ baseUrl: server.baseUrl },
		);
		expect(downloaded.exitCode).toBe(0);
		expect(downloaded.stdout).toContain(`Saved picture to ${outputPath}`);
		expect(Array.from(readFileSync(outputPath))).toEqual([9, 8, 7, 6]);
	});

	test("uses the base-url flag and exits non-zero on API errors", async () => {
		const server = await startServer();

		const result = await runCli(
			[
				"--base-url",
				server.baseUrl,
				"products",
				"delete",
				"999999",
			],
			{ includeEnvBaseUrl: false },
		);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("Resource not found");
	});
});
