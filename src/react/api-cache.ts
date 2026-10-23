type PendingRead = { controller: AbortController; promise: Promise<unknown>; readers: number }

export class ApiReadCache {
	private values = new Map<string, { data: unknown; time: number }>()
	private pending = new Map<string, PendingRead>()

	constructor(private freshFor = 15_000, private capacity = 100, private now = Date.now) {}

	peek<T>(key: string): T | null {
		const value = this.values.get(key)
		return value && this.now() - value.time < 5 * 60_000 ? value.data as T : null
	}

	write<T>(key: string, data: T) {
		this.pending.delete(key)
		this.values.delete(key)
		this.values.set(key, { data, time: this.now() })
		while (this.values.size > this.capacity) this.values.delete(this.values.keys().next().value!)
	}

	clear() {
		this.values.clear()
		this.pending.clear()
	}

	read<T>(key: string, load: (signal: AbortSignal) => Promise<T>, signal: AbortSignal, refresh = false): Promise<T> {
		if (signal.aborted) return Promise.reject(signal.reason)
		const value = this.values.get(key)
		if (!refresh && value && this.now() - value.time < this.freshFor) return Promise.resolve(value.data as T)
		let pending = this.pending.get(key)
		if (!pending) {
			const controller = new AbortController()
			pending = { controller, readers: 0, promise: Promise.resolve().then(() => load(controller.signal)) }
			const active = pending
			this.pending.set(key, active)
			active.promise = active.promise.then(data => {
				if (this.pending.get(key) === active && !controller.signal.aborted) this.write(key, data)
				return data
			}).finally(() => {
				if (this.pending.get(key) === active) this.pending.delete(key)
			})
		}
		const active = pending
		active.readers++
		return new Promise<T>((resolve, reject) => {
			let finished = false
			const release = () => {
				if (finished) return
				finished = true
				signal.removeEventListener("abort", abort)
				active.readers--
				if (!active.readers) {
					if (this.pending.get(key) === active) this.pending.delete(key)
					active.controller.abort()
				}
			}
			const abort = () => { release(); reject(signal.reason) }
			signal.addEventListener("abort", abort, { once: true })
			active.promise.then(data => { release(); resolve(data as T) }, error => { release(); reject(error) })
		})
	}
}

export const apiReadCache = new ApiReadCache()
