import { HttpError, withErrorHandling, type Database } from "./core"

type JobEventSubscriber = ReadableStreamDefaultController<Uint8Array>

const encoder = new TextEncoder()
const subscribersByDatabase = new WeakMap<Database, Set<JobEventSubscriber>>()

const subscribersFor = (db: Database) => {
	let subscribers = subscribersByDatabase.get(db)
	if (!subscribers) {
		subscribers = new Set()
		subscribersByDatabase.set(db, subscribers)
	}
	return subscribers
}

const encodeEvent = (event: string, data: unknown) =>
	encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

export const publishJobUpdate = (db: Database, job: unknown) => {
	const subscribers = subscribersByDatabase.get(db)
	if (!subscribers?.size) return
	const event = encodeEvent("job", job)
	for (const subscriber of subscribers) {
		try {
			subscriber.enqueue(event)
		} catch {
			subscribers.delete(subscriber)
		}
	}
}

export const jobEventsRoute = (db: Database) =>
	withErrorHandling(async (req: Request) => {
		if (req.method !== "GET") throw new HttpError(405, "Method not allowed for this route")

		let close = () => {}
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				const subscribers = subscribersFor(db)
				subscribers.add(controller)
				controller.enqueue(encodeEvent("ready", { connected: true }))
				const heartbeat = setInterval(() => {
					try {
						controller.enqueue(encoder.encode(": heartbeat\n\n"))
					} catch {
						close()
					}
				}, 15 * 1000)
				close = () => {
					clearInterval(heartbeat)
					subscribers.delete(controller)
				}
				req.signal.addEventListener("abort", close, { once: true })
			},
			cancel() {
				close()
			},
		})

		return new Response(stream, {
			headers: {
				"Cache-Control": "no-cache, no-transform",
				Connection: "keep-alive",
				"Content-Type": "text/event-stream; charset=utf-8",
				"X-Accel-Buffering": "no",
			},
		})
	})
