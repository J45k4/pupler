import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { HttpError, type JsonObject } from "./core";

type EncryptedEnvelope = {
	version: 1;
	algorithm: "aes-256-gcm";
	iv: string;
	tag: string;
	ciphertext: string;
};

const resolveEncryptionKey = () => {
	const rawKey = process.env.PUPLER_ENCRYPTION_KEY;
	if (!rawKey) {
		throw new HttpError(500, "PUPLER_ENCRYPTION_KEY is required");
	}

	const key = Buffer.from(rawKey, "base64");
	if (key.byteLength !== 32) {
		throw new HttpError(500, "PUPLER_ENCRYPTION_KEY must be a base64 32-byte key");
	}
	return key;
};

export const encryptJson = (payload: JsonObject) => {
	const key = resolveEncryptionKey();
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key, iv);
	const plaintext = JSON.stringify(payload);
	const ciphertext = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);
	const envelope: EncryptedEnvelope = {
		version: 1,
		algorithm: "aes-256-gcm",
		iv: iv.toString("base64"),
		tag: cipher.getAuthTag().toString("base64"),
		ciphertext: ciphertext.toString("base64"),
	};
	return JSON.stringify(envelope);
};

export const decryptJson = (encrypted: string) => {
	const envelope = JSON.parse(encrypted) as EncryptedEnvelope;
	if (envelope.version !== 1 || envelope.algorithm !== "aes-256-gcm") {
		throw new HttpError(500, "Unsupported encrypted credentials format");
	}

	const decipher = createDecipheriv(
		"aes-256-gcm",
		resolveEncryptionKey(),
		Buffer.from(envelope.iv, "base64"),
	);
	decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
	const plaintext = Buffer.concat([
		decipher.update(Buffer.from(envelope.ciphertext, "base64")),
		decipher.final(),
	]).toString("utf8");

	return JSON.parse(plaintext) as JsonObject;
};

