import { db } from "../db"
import { HttpError } from "../api/core"
import { deleteStoredFileBestEffort, readStoredFile, requireSafeImageType, writeUploadedFile } from "../api/file-storage"
import { expires, hash, oauthOrigin, readLimited, requireScope, secret, transaction, trustedOrigin, type McpIdentity } from "../oauth/core"
import type { Prisma } from "../generated/prisma/client"

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const imageTypes = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"] as const

export const validateImageBytes = (bytes: Buffer, type: string) => {
	const matches = type === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
		: type === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
		: type === "image/gif" ? ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString())
		: type === "image/webp" ? bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP"
		: type === "image/avif" ? bytes.subarray(4, 8).toString() === "ftyp" && /avif|avis/.test(bytes.subarray(8, 32).toString()) : false
	if (!matches) throw new HttpError(400, "Image bytes do not match the declared image type")
}

export const cleanupUploads = async () => {
	const now = new Date().toISOString()
	await db.client.oAuthToken.deleteMany({ where: { expires_at: { lt: now } } })
	await db.client.oAuthAuthorization.deleteMany({ where: { expires_at: { lt: now } } })
	const expired = await db.client.mcpUpload.findMany({ where: { expires_at: { lt: new Date().toISOString() } }, take: 100 })
	for (const upload of expired) {
		if (!upload.consumed && upload.path) await deleteStoredFileBestEffort(db, upload.path)
		await db.client.mcpUpload.deleteMany({ where: { id: upload.id, expires_at: { lt: new Date().toISOString() } } })
	}
}

export const prepareUpload = async (identity: McpIdentity, origin: string, filename: string, contentType: string) => {
	requireScope(identity, "receipts:write")
	requireSafeImageType(new File([], filename, { type: contentType }))
	await cleanupUploads()
	if (await db.client.mcpUpload.count({ where: { grant_id: identity.id, consumed: false } }) >= 20) throw new HttpError(429, "Finish or wait for existing uploads to expire before preparing more")
	const token = secret()
	const upload = await db.client.mcpUpload.create({ data: { id: secret(), grant_id: identity.id, token_hash: hash(token), filename, content_type: contentType, expires_at: expires(900) } })
	return { image_id: upload.id, upload_url: `${origin}/mcp/uploads/${token}`, method: "PUT", content_type: contentType, max_bytes: MAX_IMAGE_BYTES, expires_at: upload.expires_at, instructions: "Upload the original local file bytes with HTTP PUT to upload_url (for example curl --upload-file). Do not send a local path or a public image URL as the tool image_id. The URL is a secret single-use upload credential. After a successful upload, pass image_id to create_receipt or replace_receipt_image." }
}

export const uploadRoute = async (req: Request) => {
	try {
		trustedOrigin(req)
		if (req.method !== "PUT") throw new HttpError(405, "Use PUT with the original image bytes")
		const token = new URL(req.url).pathname.split("/").at(-1) ?? ""
		const upload = await db.client.mcpUpload.findUnique({ where: { token_hash: hash(token) }, include: { grant: true } })
		if (!upload || !upload.grant || upload.path || upload.consumed || upload.expires_at <= new Date().toISOString() || upload.grant.revoked_at || upload.grant.resource !== `${oauthOrigin(req)}/mcp`) throw new HttpError(401, "Invalid or expired upload link")
		const bytes = await readLimited(req, MAX_IMAGE_BYTES)
		if (!bytes.length) throw new HttpError(400, "Image may not be empty")
		validateImageBytes(bytes, upload.content_type)
		const stored = await writeUploadedFile(db, { assetType: "mcp-uploads", resourceId: 0, file: new File([bytes], upload.filename, { type: upload.content_type }) })
		try {
			const changed = await db.client.mcpUpload.updateMany({ where: { id: upload.id, path: null, consumed: false, expires_at: { gt: new Date().toISOString() }, grant: { revoked_at: null } }, data: { path: stored.relativePath, size_bytes: bytes.length } })
			if (!changed.count) throw new HttpError(409, "Upload was already used or revoked")
		} catch (error) {
			await deleteStoredFileBestEffort(db, stored.relativePath)
			throw error
		}
		return Response.json({ image_id: upload.id, size_bytes: bytes.length }, { headers: { "Cache-Control": "no-store" } })
	} catch (error) {
		return Response.json({ error: error instanceof HttpError ? error.message : "Upload failed" }, { status: error instanceof HttpError ? error.status : 500, headers: { "Cache-Control": "no-store" } })
	}
}

export const claimImage = async (tx: Prisma.TransactionClient, identity: McpIdentity, imageId: string) => {
	const upload = await tx.mcpUpload.findUnique({ where: { id: imageId } })
	if (!upload || upload.grant_id !== identity.id || upload.consumed || !upload.path || !upload.size_bytes || upload.expires_at <= new Date().toISOString()) throw new HttpError(400, "Image must be an uploaded, unused image from this connection")
	const changed = await tx.mcpUpload.updateMany({ where: { id: imageId, consumed: false }, data: { consumed: true, path: null } })
	if (!changed.count) throw new HttpError(409, "Image was already attached")
	return tx.file.create({ data: { path: upload.path, content_type: upload.content_type, filename: upload.filename, size_bytes: upload.size_bytes, created_at: new Date().toISOString() } })
}

export const replaceImage = async (identity: McpIdentity, receiptId: number, imageId: string) => {
	const previous = await transaction(async tx => {
		const receipt = await tx.receipt.findUnique({ where: { id: receiptId }, include: { picture_file: true } })
		if (!receipt) throw new HttpError(404, "Receipt not found")
		const image = await claimImage(tx, identity, imageId)
		await tx.receipt.update({ where: { id: receiptId }, data: { picture_file_id: image.id, updated_at: new Date().toISOString() } })
		if (receipt.picture_file) await tx.file.delete({ where: { id: receipt.picture_file.id } })
		return receipt.picture_file
	})
	if (previous) await deleteStoredFileBestEffort(db, previous.path)
	return { receipt_id: receiptId, image_attached: true }
}

export const uploadedImage = async (identity: McpIdentity, imageId: string) => {
	const upload = await db.client.mcpUpload.findUnique({ where: { id: imageId } })
	if (!upload || upload.grant_id !== identity.id || upload.consumed || !upload.path || upload.expires_at <= new Date().toISOString()) throw new HttpError(404, "Uploaded image not found")
	return { type: "image" as const, data: (await readStoredFile(db, upload.path, "Image not found")).toString("base64"), mimeType: upload.content_type }
}
