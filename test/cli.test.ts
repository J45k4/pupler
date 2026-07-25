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
	options: {
		baseUrl?: string;
		configPath?: string;
		includeEnvBaseUrl?: boolean;
	} = {},
): Promise<CliResult> => {
	const env = { ...process.env };
	delete env.PUPLER_CONFIG_PATH;
	if (options.includeEnvBaseUrl === false) {
		delete env.PUPLER_BASE_URL;
	} else if (options.baseUrl) {
		env.PUPLER_BASE_URL = options.baseUrl;
	}
	if (options.configPath) {
		env.PUPLER_CONFIG_PATH = options.configPath;
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
	test("documents inventory item linking in help output", async () => {
		const help = await runCli(["inventory-items", "update", "--help"]);

		expect(help.exitCode).toBe(0);
		expect(help.stdout).toContain("--product-id <integer|null>");
		expect(help.stdout).toContain("--receipt-item-id <integer|null>");
		expect(help.stdout).toContain(
			"bun ./cli/cli.ts inventory-items update 7 --product-id 42",
		);
		expect(help.stdout).toContain(
			"bun ./cli/cli.ts inventory-items update 7 --receipt-item-id null",
		);
		expect(help.stdout).toContain("--expires-at 2026-05-01T00:00:00.000Z");
	});

	test("creates and lists ingredients as JSON", async () => {
		const server = await startServer();

		const created = await runCli(
			[
				"ingredients",
				"create",
				"--json",
				"--name",
				"Sausage",
				"--default-unit",
				"pcs",
			],
			{ baseUrl: server.baseUrl },
		);

		expect(created.exitCode).toBe(0);
		const createdBody = JSON.parse(created.stdout) as {
			default_unit: string | null;
			id: number;
			name: string;
		};
		expect(createdBody.name).toBe("Sausage");
		expect(createdBody.default_unit).toBe("pcs");

		const listed = await runCli(
			["ingredients", "list", "--json", "--name", "sausage"],
			{ baseUrl: server.baseUrl },
		);
		expect(listed.exitCode).toBe(0);
		const listedBody = JSON.parse(listed.stdout) as Array<{ id: number }>;
		expect(listedBody).toHaveLength(1);
		expect(listedBody[0]?.id).toBe(createdBody.id);
	});

	test("creates and lists groups as JSON", async () => {
		const server = await startServer();

		const created = await runCli(
			["groups", "create", "--json", "--name", "Grocery"],
			{ baseUrl: server.baseUrl },
		);
		expect(created.exitCode).toBe(0);
		const createdBody = JSON.parse(created.stdout) as {
			id: number;
			name: string;
		};
		expect(createdBody.name).toBe("Grocery");

		const listed = await runCli(
			["groups", "list", "--json", "--name", "grocery"],
			{ baseUrl: server.baseUrl },
		);
		expect(listed.exitCode).toBe(0);
		const listedBody = JSON.parse(listed.stdout) as Array<{ id: number }>;
		expect(listedBody).toHaveLength(1);
		expect(listedBody[0]?.id).toBe(createdBody.id);
	});

	test("creates and lists users as JSON", async () => {
		const server = await startServer();

		const created = await runCli(
			[
				"users",
				"create",
				"--json",
				"--name",
				"Alice",
				"--username",
				"alice",
				"--email",
				"alice@example.com",
				"--password-hash",
				"hashed-password",
			],
			{ baseUrl: server.baseUrl },
		);
		expect(created.exitCode).toBe(0);
		const createdBody = JSON.parse(created.stdout) as {
			email: string | null;
			id: number;
			name: string;
			password_hash?: string;
			username: string | null;
		};
		expect(createdBody.name).toBe("Alice");
		expect(createdBody.username).toBe("alice");
		expect(createdBody.email).toBe("alice@example.com");
		expect(createdBody.password_hash).toBeUndefined();

		const listed = await runCli(
			["users", "list", "--json", "--username", "alice"],
			{ baseUrl: server.baseUrl },
		);
		expect(listed.exitCode).toBe(0);
		const listedBody = JSON.parse(listed.stdout) as Array<{ id: number }>;
		expect(listedBody).toHaveLength(1);
		expect(listedBody[0]?.id).toBe(createdBody.id);
	});

	test("creates time projects and starts/stops time entries", async () => {
		const server = await startServer();

		const user = await runCli(
			["users", "create", "--json", "--name", "Alice"],
			{ baseUrl: server.baseUrl },
		);
		expect(user.exitCode).toBe(0);
		const userBody = JSON.parse(user.stdout) as {
			id: number;
			name: string;
		};
		expect(userBody.name).toBe("Alice");

		const client = await runCli(
			[
				"clients",
				"create",
				"--json",
				"--name",
				"OpenAI",
				"--color",
				"#6f5aa8",
				"--archived-at",
				"null",
			],
			{ baseUrl: server.baseUrl },
		);
		expect(client.exitCode).toBe(0);
		const clientBody = JSON.parse(client.stdout) as {
			id: number;
			name: string;
		};
		expect(clientBody.name).toBe("OpenAI");

		const project = await runCli(
			[
				"projects",
				"create",
				"--json",
				"--client-id",
				String(clientBody.id),
				"--name",
				"Pupler",
				"--color",
				"#2d7c6f",
				"--archived-at",
				"null",
			],
			{ baseUrl: server.baseUrl },
		);
		expect(project.exitCode).toBe(0);
		const projectBody = JSON.parse(project.stdout) as {
			id: number;
			client_id: number | null;
			name: string;
		};
		expect(projectBody.name).toBe("Pupler");
		expect(projectBody.client_id).toBe(clientBody.id);

		const started = await runCli(
			[
				"time-entries",
				"start",
				"--json",
				"--user-id",
				String(userBody.id),
				"--project-id",
				String(projectBody.id),
				"--description",
				"Build timer",
				"--started-at",
				"2026-05-26T10:00:00.000Z",
			],
			{ baseUrl: server.baseUrl },
		);
		expect(started.exitCode).toBe(0);
		const startedBody = JSON.parse(started.stdout) as {
			id: number;
			ended_at: string | null;
			user_id: number | null;
		};
		expect(startedBody.ended_at).toBeNull();
		expect(startedBody.user_id).toBe(userBody.id);

		const stopped = await runCli(
			[
				"time-entries",
				"stop",
				String(startedBody.id),
				"--json",
				"--ended-at",
				"2026-05-26T11:15:00.000Z",
			],
			{ baseUrl: server.baseUrl },
		);
		expect(stopped.exitCode).toBe(0);
		const stoppedBody = JSON.parse(stopped.stdout) as {
			ended_at: string | null;
		};
		expect(stoppedBody.ended_at).toBe("2026-05-26T11:15:00.000Z");

		const listed = await runCli(
			[
				"time-entries",
				"list",
				"--json",
				"--user-id",
				String(userBody.id),
				"--project-id",
				String(projectBody.id),
			],
			{ baseUrl: server.baseUrl },
		);
		expect(listed.exitCode).toBe(0);
		const listedBody = JSON.parse(listed.stdout) as Array<{ id: number }>;
		expect(listedBody).toHaveLength(1);
		expect(listedBody[0]?.id).toBe(startedBody.id);
	});

	test("merges projects from the CLI", async () => {
		const server = await startServer();

		const keeper = await server.call<{ id: number }>("/api/projects", {
			method: "POST",
			body: {
				name: "puppybot",
				color: "#2d7c6f",
				archived_at: null,
			},
		});
		const duplicate = await server.call<{ id: number }>("/api/projects", {
			method: "POST",
			body: {
				name: "puppybot",
				color: "#6f5aa8",
				archived_at: null,
			},
		});
		const entry = await server.call<{ id: number }>("/api/time-entries", {
			method: "POST",
			body: {
				project_id: duplicate.body.id,
				started_at: "2026-05-26T08:00:00.000Z",
				ended_at: "2026-05-26T09:00:00.000Z",
			},
		});

		const merged = await runCli(
			[
				"projects",
				"merge",
				String(keeper.body.id),
				"--json",
				"--source-id",
				String(duplicate.body.id),
			],
			{ baseUrl: server.baseUrl },
		);
		expect(merged.exitCode).toBe(0);
		const mergedBody = JSON.parse(merged.stdout) as {
			moved_time_entry_count: number;
			source_archived: boolean;
			source_deleted: boolean;
			target: { id: number };
		};
		expect(mergedBody.target.id).toBe(keeper.body.id);
		expect(mergedBody.moved_time_entry_count).toBe(1);
		expect(mergedBody.source_archived).toBe(true);
		expect(mergedBody.source_deleted).toBe(false);

		const moved = await server.call<{ project_id: number }>(
			`/api/time-entries/${entry.body.id}`,
		);
		expect(moved.body.project_id).toBe(keeper.body.id);

		const help = await runCli(["projects", "merge", "--help"]);
		expect(help.exitCode).toBe(0);
		expect(help.stdout).toContain("projects merge <keeper-id>");
		expect(help.stdout).toContain("--source-id <integer>");
	});

	test("creates and lists products as JSON", async () => {
		const server = await startServer();
		const ingredient = await server.call<{ id: number }>("/api/ingredients", {
			method: "POST",
			body: {
				name: "Milk",
				default_unit: "pcs",
			},
		});

		const created = await runCli(
			[
				"products",
				"create",
				"--json",
				"--ingredient-id",
				String(ingredient.body.id),
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
			ingredient_id: number | null;
			id: number;
			name: string;
		};
		expect(createdBody.name).toBe("Milk");
		expect(createdBody.barcode).toBe("6414893400012");
		expect(createdBody.ingredient_id).toBe(ingredient.body.id);

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
		const group = await runCli(
			["groups", "create", "--json", "--name", "Grocery"],
			{ baseUrl: server.baseUrl },
		);
		expect(group.exitCode).toBe(0);
		const groupBody = JSON.parse(group.stdout) as { id: number };

		const receipt = await runCli(
			[
				"receipts",
				"create",
				"--json",
				"--group-id",
				String(groupBody.id),
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
		const receiptBody = JSON.parse(receipt.stdout) as {
			group: { id: number; name: string } | null;
			group_id: number | null;
			id: number;
		};
		expect(receiptBody.group_id).toBe(groupBody.id);
		expect(receiptBody.group?.name).toBe("Grocery");

		const listedReceipts = await runCli(
			["receipts", "list", "--json", "--group-id", String(groupBody.id)],
			{ baseUrl: server.baseUrl },
		);
		expect(listedReceipts.exitCode).toBe(0);
		const listedReceiptBody = JSON.parse(listedReceipts.stdout) as Array<{
			id: number;
		}>;
		expect(listedReceiptBody).toHaveLength(1);
		expect(listedReceiptBody[0]?.id).toBe(receiptBody.id);

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

		const created = await runCli(
			[
				"shopping-list-items",
				"create",
				"--name",
				"Light bulb",
				"--quantity",
				"2",
				"--unit",
				"pcs",
				"--done",
				"false",
				"--notes",
				"hall closet",
			],
			{ baseUrl: server.baseUrl },
		);
		expect(created.exitCode).toBe(0);
		expect(created.stdout).toContain("name:");
		expect(created.stdout).toContain("Light bulb");
		expect(created.stdout).toContain("hall closet");

		const listed = await runCli(
			["shopping-list-items", "list", "--done", "false"],
			{ baseUrl: server.baseUrl },
		);
		expect(listed.exitCode).toBe(0);
		expect(listed.stdout).toContain("notes");
		expect(listed.stdout).toContain("hall closet");
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

	test("stores the base URL in a CLI config file", async () => {
		const tempDir = createTempDir();
		const configPath = join(tempDir, "pupler-config.json");

		const setResult = await runCli(
			["config", "set-url", "http://example.test:7000"],
			{ configPath, includeEnvBaseUrl: false },
		);

		expect(setResult.exitCode).toBe(0);
		expect(setResult.stdout).toContain("base_url:");
		expect(setResult.stdout).toContain("http://example.test:7000/");

		const showResult = await runCli(["config", "show", "--json"], {
			configPath,
			includeEnvBaseUrl: false,
		});
		expect(showResult.exitCode).toBe(0);
		expect(JSON.parse(showResult.stdout)).toEqual({
			base_url: "http://example.test:7000/",
			config_path: configPath,
		});
	});

	test("uses the configured base URL when no flag or env override is set", async () => {
		const server = await startServer();
		const tempDir = createTempDir();
		const configPath = join(tempDir, "pupler-config.json");

		const configured = await runCli(
			["config", "set-url", server.baseUrl],
			{ configPath, includeEnvBaseUrl: false },
		);
		expect(configured.exitCode).toBe(0);

		const listed = await runCli(["ingredients", "list", "--json"], {
			configPath,
			includeEnvBaseUrl: false,
		});
		expect(listed.exitCode).toBe(0);
		expect(JSON.parse(listed.stdout)).toEqual([]);
	});
});
