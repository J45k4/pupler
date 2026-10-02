import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from "node:crypto"

type CborValue = number | string | Uint8Array | Map<number | string, CborValue>

const cborHead = (major: number, length: number) => {
	if (length < 24) return Buffer.from([(major << 5) | length])
	if (length < 256) return Buffer.from([(major << 5) | 24, length])
	return Buffer.from([(major << 5) | 25, length >> 8, length & 0xff])
}

// Minimal CBOR encoder covering what WebAuthn attestation objects need.
const cbor = (value: CborValue): Buffer => {
	if (typeof value === "number") return value >= 0 ? cborHead(0, value) : cborHead(1, -1 - value)
	if (typeof value === "string") return Buffer.concat([cborHead(3, Buffer.byteLength(value)), Buffer.from(value)])
	if (value instanceof Uint8Array) return Buffer.concat([cborHead(2, value.length), value])
	return Buffer.concat([cborHead(5, value.size), ...[...value].flatMap(([k, v]) => [cbor(k), cbor(v)])])
}

const b64url = (data: Uint8Array) => Buffer.from(data).toString("base64url")
const sha256 = (data: Uint8Array | string) => createHash("sha256").update(data).digest()

const FLAGS_UP_UV = 0x05
const FLAGS_UP_UV_AT = 0x45

export class FakePasskey {
	readonly credentialId = randomBytes(16)
	private readonly privateKey: KeyObject
	private readonly publicJwk: JsonWebKey
	counter = 0

	constructor(readonly origin: string, readonly rpId = new URL(origin).hostname) {
		const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" })
		this.privateKey = privateKey
		this.publicJwk = publicKey.export({ format: "jwk" })
	}

	get id() {
		return b64url(this.credentialId)
	}

	private clientData(type: string, challenge: string, origin: string) {
		return Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }))
	}

	register(options: { challenge: string }, overrides: { origin?: string, rpId?: string } = {}) {
		const coseKey = cbor(new Map<number, CborValue>([
			[1, 2],
			[3, -7],
			[-1, 1],
			[-2, Buffer.from(this.publicJwk.x!, "base64url")],
			[-3, Buffer.from(this.publicJwk.y!, "base64url")],
		]))
		const idLength = Buffer.from([this.credentialId.length >> 8, this.credentialId.length & 0xff])
		const authData = Buffer.concat([
			sha256(overrides.rpId ?? this.rpId),
			Buffer.from([FLAGS_UP_UV_AT]),
			Buffer.alloc(4),
			Buffer.alloc(16),
			idLength,
			this.credentialId,
			coseKey,
		])
		const attestationObject = cbor(new Map<string, CborValue>([["fmt", "none"], ["attStmt", new Map()], ["authData", authData]]))
		return {
			id: this.id,
			rawId: this.id,
			type: "public-key",
			clientExtensionResults: {},
			response: {
				clientDataJSON: b64url(this.clientData("webauthn.create", options.challenge, overrides.origin ?? this.origin)),
				attestationObject: b64url(attestationObject),
				transports: ["internal"],
			},
		}
	}

	authenticate(options: { challenge: string }, overrides: { origin?: string, counter?: number } = {}) {
		this.counter = overrides.counter ?? this.counter + 1
		const counter = Buffer.alloc(4)
		counter.writeUInt32BE(this.counter)
		const authData = Buffer.concat([sha256(this.rpId), Buffer.from([FLAGS_UP_UV]), counter])
		const clientDataJSON = this.clientData("webauthn.get", options.challenge, overrides.origin ?? this.origin)
		const signature = sign("sha256", Buffer.concat([authData, sha256(clientDataJSON)]), this.privateKey)
		return {
			id: this.id,
			rawId: this.id,
			type: "public-key",
			clientExtensionResults: {},
			response: {
				clientDataJSON: b64url(clientDataJSON),
				authenticatorData: b64url(authData),
				signature: b64url(signature),
			},
		}
	}
}
