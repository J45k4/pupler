import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { applyTestSchema } from "./test-db";

export type ApiResponse<TBody = unknown> = {
	body: TBody;
	response: Response;
};

type RunningServer = {
	baseUrl: string;
	dbPath: string;
	filesPath: string;
	process: Bun.Subprocess<"ignore", "pipe", "pipe">;
	tempDir: string;
};

export type CallOptions = Omit<RequestInit, "body" | "headers"> & {
	body?: BodyInit | Record<string, unknown>;
	headers?: HeadersInit;
};

export const projectRoot = resolve(import.meta.dir, "..", "..");

export const getFreePort = () =>
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

export const waitForHealth = async (baseUrl: string, timeoutMs = 5000) => {
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

export class TestServer {
	readonly baseUrl: string;
	readonly dbPath: string;
	readonly filesPath: string;
	readonly process: Bun.Subprocess<"ignore", "pipe", "pipe">;
	readonly tempDir: string;

	constructor(server: RunningServer) {
		this.baseUrl = server.baseUrl;
		this.dbPath = server.dbPath;
		this.filesPath = server.filesPath;
		this.process = server.process;
		this.tempDir = server.tempDir;
	}

	static async start() {
		const port = await getFreePort();
		const tempDir = mkdtempSync(join(tmpdir(), "pupler-e2e-"));
		const dbPath = join(tempDir, "pupler.sqlite");
		mkdirSync(tempDir, { recursive: true });
		applyTestSchema(dbPath);

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
			filesPath: join(tempDir, "files"),
			process: child,
			tempDir,
		});

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
