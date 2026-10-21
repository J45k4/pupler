import { randomUUID } from "node:crypto"
import { HttpError } from "./core"

export type OfflineReceipt = {
	user_id: number
	client_id: string
	local_id: number | null
	request_hash: string
	result_json?: string
}

export const unconfirmedOfflineChange =
	"Could not confirm this change after the server restarted or its retry history expired. Check the server data before discarding or re-entering it. Your device copy has been kept."

// These receipts deliberately live only in this server process. A phone must save
// the session before sending; an unknown session must never be replayed blindly.
export class OfflineReceipts {
	session = randomUUID()
	entries = new Map<string, OfflineReceipt>()
	private localIds = new Map<string, string>()
	private bytes = 0
	private tail = Promise.resolve()

	constructor(
		private limit = 10_000,
		private byteLimit = 32 * 1024 * 1024,
	) {}

	async run<T>(action: () => Promise<T>): Promise<T> {
		const previous = this.tail
		let release!: () => void
		this.tail = new Promise<void>((resolve) => {
			release = resolve
		})
		await previous
		try {
			return await action()
		} finally {
			release()
		}
	}

	prepare() {
		if (this.entries.size >= this.limit || this.bytes >= this.byteLimit) {
			this.session = randomUUID()
			this.entries.clear()
			this.localIds.clear()
			this.bytes = 0
		}
		return this.session
	}

	private localKey(userId: number, clientId: string, localId: number) {
		return `${userId}/${clientId}/${localId}`
	}

	findLocal(userId: number, clientId: string, localId: number) {
		const id = this.localIds.get(this.localKey(userId, clientId, localId))
		return id ? this.entries.get(id) : undefined
	}

	reserve(id: string, receipt: OfflineReceipt) {
		if (this.entries.size >= this.limit || this.bytes >= this.byteLimit) throw new HttpError(409, unconfirmedOfflineChange)
		if (receipt.local_id !== null && this.findLocal(receipt.user_id, receipt.client_id, receipt.local_id))
			throw new HttpError(409, "Offline local identifier was already used")
		this.entries.set(id, receipt)
	}

	confirm(id: string, value: unknown) {
		const receipt = this.entries.get(id)!
		receipt.result_json = JSON.stringify(value)
		this.bytes += Buffer.byteLength(receipt.result_json)
		if (receipt.local_id !== null) this.localIds.set(this.localKey(receipt.user_id, receipt.client_id, receipt.local_id), id)
	}
}
