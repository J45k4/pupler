import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";

import { HttpError, type Database } from "./core";

const safeExtension = (filename: string) => {
	const extension = extname(filename).toLowerCase();
	if (!extension) {
		return "";
	}

	return extension.replace(/[^.a-z0-9]/g, "").slice(0, 16);
};

const resolveStoredPath = (db: Database, relativePath: string) => {
	const root = resolve(db.filesPath);
	const absolutePath = resolve(root, relativePath);
	const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;

	if (absolutePath !== root && !absolutePath.startsWith(rootPrefix)) {
		throw new HttpError(500, "Stored file path escapes the configured files directory");
	}

	return absolutePath;
};

const buildStoredPath = (
	assetType: string,
	resourceId: number,
	filename: string,
) =>
	`${assetType}/${resourceId}/${crypto.randomUUID()}${safeExtension(filename)}`;

export const writeUploadedFile = async (
	db: Database,
	options: {
		assetType: string;
		file: File;
		resourceId: number;
	},
) => {
	const relativePath = buildStoredPath(
		options.assetType,
		options.resourceId,
		options.file.name || "upload",
	);
	const absolutePath = resolveStoredPath(db, relativePath);
	const bytes = new Uint8Array(await options.file.arrayBuffer());

	await mkdir(dirname(absolutePath), { recursive: true });
	await writeFile(absolutePath, bytes);

	return {
		absolutePath,
		relativePath,
		size: bytes.byteLength,
	};
};

export const readStoredFile = async (
	db: Database,
	relativePath: string | null | undefined,
	notFoundMessage: string,
) => {
	if (!relativePath) {
		throw new HttpError(404, notFoundMessage);
	}

	try {
		return await readFile(resolveStoredPath(db, relativePath));
	} catch (error) {
		if (
			error &&
			typeof error === "object" &&
			"code" in error &&
			error.code === "ENOENT"
		) {
			throw new HttpError(404, notFoundMessage);
		}
		throw error;
	}
};

export const deleteStoredFile = async (
	db: Database,
	relativePath: string | null | undefined,
) => {
	if (!relativePath) {
		return;
	}

	await rm(resolveStoredPath(db, relativePath), { force: true });
};

export const deleteStoredFileBestEffort = async (
	db: Database,
	relativePath: string | null | undefined,
) => {
	try {
		await deleteStoredFile(db, relativePath);
	} catch {
		// Orphaned files are preferable to leaving broken DB references in place.
	}
};
