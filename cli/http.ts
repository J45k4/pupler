import { readCliConfig } from "./config";
import { CliError } from "./error";

type QueryValue = string | number | boolean | null | undefined;

type JsonRequestOptions = {
	baseUrl: string;
	path: string;
	method?: string;
	body?: unknown;
	query?: Record<string, QueryValue>;
};

type BodyRequestOptions = {
	baseUrl: string;
	path: string;
	method?: string;
	body: BodyInit;
	query?: Record<string, QueryValue>;
};

let sessionCookie: string | null = null;

const requestHeaders = (body?: unknown) => ({
	...(body === undefined ? {} : { "Content-Type": "application/json" }),
	...(sessionCookie ? { Cookie: sessionCookie } : {}),
});

const storeSessionCookie = (response: Response) => {
	const setCookie = response.headers.get("set-cookie");
	const match = setCookie?.match(/pupler_session=[^;]+/);
	if (match) sessionCookie = match[0];
};

export const loginCli = async (baseUrl: string, username: string, password: string) => {
	const response = await fetch(buildUrl(baseUrl, "/api/auth/login"), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username, password }),
	});
	if (!response.ok) throw new CliError(await readErrorMessage(response));
	storeSessionCookie(response);
};

export const bootstrapCli = async (
	baseUrl: string,
	body: { name: string; username: string; password: string; email?: string | null },
) => {
	const response = await fetch(buildUrl(baseUrl, "/api/auth/bootstrap"), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!response.ok) throw new CliError(await readErrorMessage(response));
	return response.json();
};

const buildUrl = (baseUrl: string, path: string, query?: Record<string, QueryValue>) => {
	const url = new URL(path, normalizeBaseUrl(baseUrl));

	if (query) {
		for (const [key, value] of Object.entries(query)) {
			if (value === undefined) {
				continue;
			}
			url.searchParams.set(key, value === null ? "null" : String(value));
		}
	}

	return url;
};

const readErrorMessage = async (response: Response) => {
	const contentType = response.headers.get("content-type") ?? "";
	if (contentType.includes("application/json")) {
		try {
			const body = (await response.json()) as { error?: string };
			if (body.error) {
				return body.error;
			}
			return JSON.stringify(body);
		} catch {
			return `Request failed with status ${response.status}`;
		}
	}

	const text = await response.text();
	return text || `Request failed with status ${response.status}`;
};

const ensureOk = async (response: Response) => {
	if (response.ok) {
		return;
	}

	throw new CliError(await readErrorMessage(response));
};

export const normalizeBaseUrl = (value: string) => {
	const normalized = value.trim();
	if (!normalized) {
		throw new CliError("Base URL cannot be empty");
	}
	return normalized.endsWith("/") ? normalized : `${normalized}/`;
};

export const resolveBaseUrl = (override?: string) =>
	normalizeBaseUrl(
		override ??
			process.env.PUPLER_BASE_URL ??
			readCliConfig().baseUrl ??
			"http://localhost:5995",
	);

export const requestJson = async ({
	baseUrl,
	path,
	method = "GET",
	body,
	query,
}: JsonRequestOptions) => {
	let response: Response;

	try {
		response = await fetch(buildUrl(baseUrl, path, query), {
			method,
			headers: requestHeaders(body),
			body: body === undefined ? undefined : JSON.stringify(body),
		});
	} catch (error) {
		throw new CliError(
			error instanceof Error ? error.message : "Request failed",
		);
	}

	await ensureOk(response);
	const contentType = response.headers.get("content-type") ?? "";
	if (response.status === 204) {
		return null;
	}
	if (contentType.includes("application/json")) {
		return await response.json();
	}
	return await response.text();
};

export const requestBody = async ({
	baseUrl,
	path,
	method = "POST",
	body,
	query,
}: BodyRequestOptions) => {
	let response: Response;

	try {
		response = await fetch(buildUrl(baseUrl, path, query), {
			method,
			headers: { ...(sessionCookie ? { Cookie: sessionCookie } : {}) },
			body,
		});
	} catch (error) {
		throw new CliError(
			error instanceof Error ? error.message : "Request failed",
		);
	}

	await ensureOk(response);
	const contentType = response.headers.get("content-type") ?? "";
	return {
		contentType,
		data: contentType.includes("application/json")
			? await response.json()
			: await response.text(),
	};
};

export const requestBinary = async ({
	baseUrl,
	path,
	method = "GET",
	query,
}: Omit<JsonRequestOptions, "body">) => {
	let response: Response;

	try {
		response = await fetch(buildUrl(baseUrl, path, query), {
			method,
			headers: requestHeaders(),
		});
	} catch (error) {
		throw new CliError(
			error instanceof Error ? error.message : "Request failed",
		);
	}

	await ensureOk(response);
	return {
		bytes: new Uint8Array(await response.arrayBuffer()),
		contentType: response.headers.get("content-type") ?? "application/octet-stream",
	};
};
