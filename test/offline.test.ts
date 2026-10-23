import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { closeDatabase, createApiRoutes, openDatabase } from "../src/api"
import { hashSessionToken } from "../src/api/auth"
import { offlineSyncRoute } from "../src/api/offline"
import { OfflineReceipts } from "../src/api/offline-receipts"
import { setDatabase } from "../src/db"
import { applyTestSchema } from "./support/test-db"
import {
	acknowledgeOfflineOperation,
	createOfflineOperation,
	operationPayload,
	projectedSnapshots,
	offlineReadPath,
	nextOfflineBatch,
	prepareOfflineBatch,
	type OfflineAccount,
} from "../src/react/offline-data"

const stamps = { created_at: "2026-10-21T08:00:00.000Z", updated_at: "2026-10-21T08:00:00.000Z" }
const timerPath = "/api/time-entries?view=timer&offset=0"
const boardPath = "/api/shopping-list-items?view=board"
const emptyTimer = () => ({
	entries: [],
	running: null,
	total: 0,
	offset: 0,
	limit: 50,
	previous_ended_at: null,
	quick_actions: [],
	project_usage: [],
})
const queue = (account: OfflineAccount, path: string, method: string, body: Record<string, any>, now = stamps.created_at) => {
	const operation = createOfflineOperation(account, path, method, body, now)
	account.queue.push(operation)
	return operation
}

describe("offline operation protocol without schema changes", () => {
	let directory: string
	let database: ReturnType<typeof openDatabase>
	let handler: (request: Request) => Response | Promise<Response>
	let account: OfflineAccount
	let other: number
	let project: number
	let list: number
	let session: string
	beforeEach(async () => {
		directory = mkdtempSync(join(tmpdir(), "pupler-offline-"))
		const path = join(directory, "test.db")
		applyTestSchema(path)
		database = openDatabase(path)
		setDatabase(database)
		const user = await database.client.user.create({ data: { name: "Phone user", ...stamps } })
		other = (await database.client.user.create({ data: { name: "Other user", ...stamps } })).id
		for (const id of [user.id, other])
			await database.client.userSession.create({
				data: {
					user_id: id,
					token_hash: hashSessionToken(`offline-${id}`),
					expires_at: "2099-01-01T00:00:00.000Z",
					last_seen_at: stamps.created_at,
					created_at: stamps.created_at,
				},
			})
		project = (await database.client.project.create({ data: { name: "Phone work", color: "#123456", ...stamps } })).id
		list = (
			await database.client.shoppingList.create({
				data: {
					name: "Groceries",
					...stamps,
					members: { create: { user_id: user.id, role: "editor", created_at: stamps.created_at } },
				},
			})
		).id
		account = {
			user,
			client_id: crypto.randomUUID(),
			queue: [],
			snapshots: {
				[timerPath]: { time: Date.now(), data: emptyTimer() },
				[boardPath]: { time: Date.now(), data: { items: [], removed_counts: {} } },
				"/api/shopping-lists": {
					time: Date.now(),
					data: [{ id: list, name: "Groceries", role: "editor", hidden: false, ...stamps }],
				},
				"/api/projects?sort=name&order=asc": { time: Date.now(), data: [{ id: project, name: "Phone work" }] },
			},
		}
		handler = createApiRoutes({ authenticated: { "/api/offline/sync": offlineSyncRoute } })["/api/offline/sync"]
		session = (
			await (
				await handler(
					new Request("http://localhost/api/offline/sync", { headers: { Cookie: `pupler_session=offline-${user.id}` } }),
				)
			).json()
		).sync_session
	})
	afterEach(async () => {
		await closeDatabase(database)
		rmSync(directory, { recursive: true, force: true })
	})
	const sync = (operations = account.queue.map(operationPayload), user = account.user.id, syncSession = session) =>
		handler(
			new Request("http://localhost/api/offline/sync", {
				method: "POST",
				headers: { Cookie: `pupler_session=offline-${user}`, "Content-Type": "application/json" },
				body: JSON.stringify({ user_id: account.user.id, client_id: account.client_id, sync_session: syncSession, operations }),
			}),
		)

	test("starting and stopping offline preserves phone timestamps, survives serialization, and replays exactly once", async () => {
		const start = queue(account, "/api/time-entries/start", "POST", { project_id: project, description: "Offline work" })
		queue(account, `/api/time-entries/${start.local_id}/stop`, "POST", {}, "2026-10-21T08:20:00.000Z")
		account = JSON.parse(JSON.stringify(account))
		const projected = projectedSnapshots(account)[timerPath]!.data
		expect(projected.running).toBeNull()
		expect(projected.entries[0].started_at).toBe(stamps.created_at)
		expect(projected.entries[0].ended_at).toBe("2026-10-21T08:20:00.000Z")
		expect(account.snapshots[timerPath]!.data.entries).toEqual([])
		const payload = account.queue.map(operationPayload)
		const response = await sync(payload)
		expect(response.status).toBe(200)
		const first = (await response.json()) as any
		expect(first.results.map((result: any) => result.status)).toEqual([200, 200])
		expect(await (await sync(payload)).json()).toEqual(first)
		expect(await database.client.timeEntry.count()).toBe(1)
		expect(await database.client.$queryRawUnsafe<{ name: string }[]>("SELECT name FROM sqlite_master WHERE name = 'offline_operations'")).toEqual([])
		for (const result of first.results)
			acknowledgeOfflineOperation(
				account,
				account.queue.find((operation) => operation.id === result.id)!,
				result.result,
			)
		expect(account.queue).toEqual([])
		expect(account.snapshots[timerPath]!.data.running).toBeNull()
		expect(account.snapshots[timerPath]!.data.total).toBe(1)
		expect(account.snapshots[timerPath]!.data.entries[0].id).toBe(first.results[0].result.id)
		expect(account.snapshots[timerPath]!.data.entries[0].user_id).toBe(account.user.id)
	})

	test("an acknowledged timer edit supplies the next stop version instead of an older overview snapshot", async () => {
		const running = await database.client.timeEntry.create({
			data: { user_id: account.user.id, project_id: project, started_at: stamps.created_at, ...stamps },
		})
		account.snapshots = { "/api/time-entries?running=true": { time: 0, data: [running] }, ...account.snapshots }
		account.snapshots[timerPath]!.data.running = running
		const edited = queue(account, `/api/time-entries/${running.id}`, "PATCH", { description: "Edited on phone" })
		const response = ((await (await sync()).json()) as any).results[0]
		expect(response.status).toBe(200)
		acknowledgeOfflineOperation(account, edited, response.result)
		const stop = queue(account, `/api/time-entries/${running.id}/stop`, "POST", {}, "2026-10-21T09:00:00.000Z")
		expect(stop.expected_updated_at).toBe(response.result.updated_at)
		expect(((await (await sync()).json()) as any).results[0].status).toBe(200)
		expect(offlineReadPath("/api/time-entries?running=true")).toBe(false)
		expect(offlineReadPath("/api/time-entries?sort=started_at&order=desc")).toBe(false)
		expect(offlineReadPath("/api/shopping-list-items?view=overview")).toBe(false)
		expect(offlineReadPath(timerPath)).toBe(true)
		expect(offlineReadPath(boardPath)).toBe(true)
	})

	test("historical entries loaded by a report can be edited and acknowledged outside the recent timer page", async () => {
		const entry = await database.client.timeEntry.create({
			data: {
				user_id: account.user.id,
				project_id: project,
				description: "Old report entry",
				started_at: "2026-01-02T08:00:00.000Z",
				ended_at: "2026-01-02T09:00:00.000Z",
				...stamps,
			},
		})
		account.snapshots[`/api/time-entries/${entry.id}`] = { time: Date.now(), data: entry }
		const edited = queue(account, `/api/time-entries/${entry.id}`, "PATCH", { description: "Edited through report" })
		expect(projectedSnapshots(account)[`/api/time-entries/${entry.id}`]!.data.description).toBe("Edited through report")
		const response = ((await (await sync()).json()) as any).results[0]
		expect(response.status).toBe(200)
		acknowledgeOfflineOperation(account, edited, response.result)
		expect(account.snapshots[`/api/time-entries/${entry.id}`]!.data.updated_at).toBe(response.result.updated_at)
		const deleted = queue(account, `/api/time-entries/${entry.id}`, "DELETE", {})
		expect(deleted.expected_updated_at).toBe(response.result.updated_at)
		expect(((await (await sync()).json()) as any).results[0].status).toBe(200)
	})

	test("a refreshed timer view supersedes an older saved editor version from before another device's change", async () => {
		const old = await database.client.timeEntry.create({
			data: { user_id: account.user.id, project_id: project, started_at: stamps.created_at, ...stamps },
		})
		account.snapshots[`/api/time-entries/${old.id}`] = { time: 1, data: old }
		const current = await database.client.timeEntry.update({
			where: { id: old.id },
			data: { description: "Changed by other device", updated_at: "2026-10-21T08:10:00.000Z" },
		})
		account.snapshots[timerPath] = { time: 2, data: { ...emptyTimer(), running: current } }
		const stopped = queue(account, `/api/time-entries/${old.id}/stop`, "POST", {}, "2026-10-21T09:00:00.000Z")
		expect(stopped.expected_updated_at).toBe(current.updated_at)
		expect(((await (await sync()).json()) as any).results[0].status).toBe(200)
	})

	test("offline list creation, adding, checking, removing and restoring resolve local IDs in order", async () => {
		const created = queue(account, "/api/shopping-lists", "POST", { name: "Offline groceries" })
		const item = queue(account, "/api/shopping-list-items", "POST", {
			shopping_list_id: created.local_id,
			name: "Milk",
			quantity: 2,
			unit: "pcs",
		})
		queue(account, `/api/shopping-list-items/${item.local_id}`, "PATCH", { done: true })
		queue(account, `/api/shopping-list-items/${item.local_id}`, "PATCH", { removed: true })
		queue(account, `/api/shopping-list-items/${item.local_id}`, "PATCH", { removed: false })
		const projected = projectedSnapshots(account)
		expect(projected[boardPath]!.data.items[0].name).toBe("Milk")
		expect(projected[boardPath]!.data.items[0].done).toBe(false)
		expect(projected[boardPath]!.data.removed_counts[created.local_id!]).toBe(0)
		const payload = account.queue.map(operationPayload)
		const first = (await (await sync(payload)).json()) as any
		expect(first.results.map((result: any) => result.status)).toEqual([200, 200, 200, 200, 200])
		expect(await (await sync(payload)).json()).toEqual(first)
		expect(await database.client.shoppingListItem.count()).toBe(1)
		for (const result of first.results)
			acknowledgeOfflineOperation(
				account,
				account.queue.find((operation) => operation.id === result.id)!,
				result.result,
			)
		expect(account.snapshots[boardPath]!.data.items).toHaveLength(1)
		expect(account.snapshots[boardPath]!.data.items[0].shopping_list_id).toBe(first.results[0].result.id)
		expect(account.snapshots[boardPath]!.data.items[0].removed_at).toBeNull()
	})

	test("a conflicting timer is kept for review while independent shopping changes still sync", async () => {
		const running = await database.client.timeEntry.create({
			data: { user_id: account.user.id, project_id: project, started_at: stamps.created_at, ...stamps },
		})
		account.snapshots[timerPath]!.data.running = running
		queue(account, `/api/time-entries/${running.id}/stop`, "POST", {}, "2026-10-21T08:20:00.000Z")
		queue(account, "/api/shopping-list-items", "POST", { shopping_list_id: list, name: "Bread", quantity: 1, unit: "pcs" })
		await database.client.timeEntry.update({
			where: { id: running.id },
			data: { description: "Changed elsewhere", updated_at: "2026-10-21T08:10:00.000Z" },
		})
		const response = (await (await sync()).json()) as any
		expect(response.results.map((result: any) => result.status)).toEqual([409, 200])
		expect(response.results[0].error).toContain("another device")
		expect((await database.client.timeEntry.findUnique({ where: { id: running.id } }))?.ended_at).toBeNull()
		expect(await database.client.shoppingListItem.count()).toBe(1)
	})

	test("creating or reopening a running entry cannot stop a timer started by another device", async () => {
		const entry = await database.client.timeEntry.create({
			data: {
				user_id: account.user.id,
				project_id: project,
				started_at: "2026-10-21T07:00:00.000Z",
				ended_at: "2026-10-21T07:30:00.000Z",
				...stamps,
			},
		})
		account.snapshots[timerPath]!.data.entries = [entry]
		account.snapshots[timerPath]!.data.total = 1
		const reopened = queue(account, `/api/time-entries/${entry.id}`, "PATCH", { ended_at: null })
		expect(projectedSnapshots(account)[timerPath]!.data.total).toBe(0)
		const manual = queue(account, "/api/time-entries", "POST", {
			project_id: project,
			started_at: "2026-10-21T09:00:00.000Z",
			ended_at: null,
		})
		const remote = await database.client.timeEntry.create({
			data: { user_id: account.user.id, project_id: project, started_at: "2026-10-21T08:00:00.000Z", ...stamps },
		})
		const response = (await (await sync()).json()) as any
		expect(response.results.map((result: any) => result.status)).toEqual([409, 409])
		expect((await database.client.timeEntry.findUnique({ where: { id: remote.id } }))?.ended_at).toBeNull()
		expect((await database.client.timeEntry.findUnique({ where: { id: entry.id } }))?.ended_at).toBe(entry.ended_at)
		expect(reopened.optimistic.id).toBe(entry.id)
		expect(manual.expected_running_id).toBe(entry.id)
	})

	test("partial acknowledgements remap dependent writes and concurrent retries apply a change once", async () => {
		const listChange = queue(account, "/api/shopping-lists", "POST", { name: "Phone list" })
		const item = queue(account, "/api/shopping-list-items", "POST", { shopping_list_id: listChange.local_id, name: "Milk" })
		expect(projectedSnapshots(account)[`/api/shopping-list-items?shopping_list_id=${listChange.local_id}&removed=true`]!.data).toEqual(
			[],
		)
		const createdList = ((await (await sync([operationPayload(listChange)])).json()) as any).results[0].result
		acknowledgeOfflineOperation(account, listChange, createdList)
		expect(account.queue[0]!.body.shopping_list_id).toBe(createdList.id)
		const payload = [operationPayload(item)]
		const responses = await Promise.all([sync(payload), sync(payload)])
		const results = (await Promise.all(responses.map((response) => response.json()))) as any[]
		expect(results.some((response) => response.results[0].status === 200)).toBe(true)
		const retried = ((await (await sync(payload)).json()) as any).results[0]
		expect(retried.status).toBe(200)
		expect(await database.client.shoppingListItem.count()).toBe(1)
		acknowledgeOfflineOperation(account, item, retried.result)
		expect(account.queue).toEqual([])
		expect(account.snapshots[boardPath]!.data.items[0].shopping_list_id).toBe(createdList.id)
	})

	test("acknowledging a new entry remaps the report changes of its pending edits", async () => {
		const created = queue(account, "/api/time-entries", "POST", { project_id: project, description: "Created", started_at: "2026-10-21T08:00:00.000Z", ended_at: "2026-10-21T09:00:00.000Z" })
		const edited = queue(account, `/api/time-entries/${created.local_id}`, "PATCH", { description: "Later edit" })
		const response = ((await (await sync([operationPayload(created)])).json()) as any).results[0].result
		acknowledgeOfflineOperation(account, created, response)
		expect(edited.path).toBe(`/api/time-entries/${response.id}`)
		expect(edited.time_changes?.[0]?.before?.id).toBe(response.id)
		expect(edited.time_changes?.[0]?.after?.id).toBe(response.id)
		expect(edited.time_changes?.[0]?.after?.description).toBe("Later edit")
		expect(operationPayload(edited)).not.toHaveProperty("time_changes")
	})

	test("revoked editor access, different accounts, changed payloads and unsupported actions cannot bypass authorization", async () => {
		queue(account, "/api/shopping-list-items", "POST", { shopping_list_id: list, name: "Milk", quantity: 1, unit: "pcs" })
		const payload = account.queue.map(operationPayload)
		expect((await sync(payload, other)).status).toBe(401)
		await database.client.shoppingListMember.update({
			where: { shopping_list_id_user_id: { shopping_list_id: list, user_id: account.user.id } },
			data: { role: "viewer" },
		})
		expect(((await (await sync(payload)).json()) as any).results[0].status).toBe(403)
		expect(await database.client.shoppingListItem.count()).toBe(0)
		await database.client.shoppingListMember.update({
			where: { shopping_list_id_user_id: { shopping_list_id: list, user_id: account.user.id } },
			data: { role: "editor" },
		})
		expect(((await (await sync(payload)).json()) as any).results[0].status).toBe(200)
		expect((await sync(payload, other)).status).toBe(401)
		const changed = structuredClone(payload)
		changed[0]!.body.name = "Changed payload"
		expect(((await (await sync(changed)).json()) as any).results[0].status).toBe(409)
		expect(
			((await (await sync([{ ...payload[0]!, id: crypto.randomUUID(), path: "/api/users/1", method: "DELETE" }])).json()) as any)
				.results[0].status,
		).toBe(400)
		expect((await handler(new Request("http://localhost/api/offline/sync", { method: "POST" }))).status).toBe(401)
		expect((await sync(Array.from({ length: 51 }, () => payload[0]!))).status).toBe(400)
	})

	test("a lost confirmation followed by a server restart cannot replay an already committed item", async () => {
		const operation = queue(account, "/api/shopping-list-items", "POST", { shopping_list_id: list, name: "Saved before restart" })
		prepareOfflineBatch(account, [operation.id], session)
		const payload = account.queue.map(operationPayload)
		expect(((await (await sync(payload)).json()) as any).results[0].status).toBe(200)
		await closeDatabase(database)
		database = openDatabase(join(directory, "test.db"))
		setDatabase(database)
		const response = ((await (await sync(payload)).json()) as any).results[0]
		expect(response.status).toBe(409)
		expect(response.error).toContain("server restarted")
		expect(await database.client.shoppingListItem.count()).toBe(1)
		// Retrying in the UI retains the attempt's original session, even after reload.
		account = JSON.parse(JSON.stringify(account))
		operation.error = response.error
		const current = (
			await (
				await handler(
					new Request("http://localhost/api/offline/sync", { headers: { Cookie: `pupler_session=offline-${account.user.id}` } }),
				)
			).json()
		).sync_session
		expect(current).not.toBe(session)
		expect(prepareOfflineBatch(account, [operation.id], current)[0]!.attempt!.session).toBe(session)
		// Work that was never attempted may use the new server normally.
		const unsent = queue(account, "/api/shopping-list-items", "POST", { shopping_list_id: list, name: "Never sent before restart" })
		expect(((await (await sync([operationPayload(unsent)], account.user.id, current)).json()) as any).results[0].status).toBe(200)
		expect(await database.client.shoppingListItem.count()).toBe(2)
	})

	test("an acknowledged timer dependency does not need server receipt history after a restart", async () => {
		const start = queue(account, "/api/time-entries/start", "POST", { project_id: project })
		const stop = queue(account, `/api/time-entries/${start.local_id}/stop`, "POST", {}, "2026-10-21T09:00:00.000Z")
		const response = ((await (await sync([operationPayload(start)])).json()) as any).results[0]
		acknowledgeOfflineOperation(account, start, response.result)
		expect(stop.base_operation_id).toBeNull()
		expect(stop.expected_updated_at).toBe(response.result.updated_at)
		expect(stop.path).toBe(`/api/time-entries/${response.result.id}/stop`)
		await closeDatabase(database)
		database = openDatabase(join(directory, "test.db"))
		setDatabase(database)
		const current = (
			await (
				await handler(
					new Request("http://localhost/api/offline/sync", { headers: { Cookie: `pupler_session=offline-${account.user.id}` } }),
				)
			).json()
		).sync_session
		expect(((await (await sync([operationPayload(stop)], account.user.id, current)).json()) as any).results[0].status).toBe(200)
		expect((await database.client.timeEntry.findUnique({ where: { id: response.result.id } }))?.ended_at).toBe(stop.body.ended_at)
	})

	test("partly acknowledged batches retain their original retry payloads and sessions", async () => {
		const created = queue(account, "/api/shopping-lists", "POST", { name: "Partially acknowledged" })
		const item = queue(account, "/api/shopping-list-items", "POST", { shopping_list_id: created.local_id, name: "Milk" })
		prepareOfflineBatch(
			account,
			account.queue.map((operation) => operation.id),
			session,
		)
		const original = structuredClone(operationPayload(item))
		const responses = ((await (await sync()).json()) as any).results
		acknowledgeOfflineOperation(account, created, responses[0].result)
		expect(item.body.shopping_list_id).toBe(responses[0].result.id)
		expect(operationPayload(item)).toEqual(original)
		const unsent = queue(account, "/api/shopping-list-items", "POST", { shopping_list_id: list, name: "Later work" })
		account = JSON.parse(JSON.stringify(account))
		expect(nextOfflineBatch(account).map((operation) => operation.id)).toEqual([item.id])
		expect(((await (await sync(nextOfflineBatch(account).map(operationPayload))).json()) as any).results[0]).toEqual(responses[1])
		acknowledgeOfflineOperation(account, account.queue[0]!, responses[1].result)
		expect(nextOfflineBatch(account).map((operation) => operation.id)).toEqual([unsent.id])
		expect(await database.client.shoppingListItem.count()).toBe(1)
	})

	test("an unexpected failure after commit remains uncertain instead of being executed again", async () => {
		queue(account, "/api/shopping-list-items", "POST", { shopping_list_id: list, name: "Commit without confirmation" })
		const original = database.client
		const faultyDatabase = {
			...database,
			client: new Proxy(original, {
				get(target, property) {
					if (property === "$transaction")
						return async (...args: any[]) => {
							await (original.$transaction as any)(...args)
							throw new Error("Lost database confirmation")
						}
					return Reflect.get(target, property)
				},
			}),
		}
		setDatabase(faultyDatabase)
		session = (
			await (
				await handler(
					new Request("http://localhost/api/offline/sync", { headers: { Cookie: `pupler_session=offline-${account.user.id}` } }),
				)
			).json()
		).sync_session
		try {
			expect(((await (await sync()).json()) as any).results[0].status).toBe(500)
		} finally {
			faultyDatabase.client = original
		}
		expect(((await (await sync()).json()) as any).results[0].status).toBe(409)
		expect(await database.client.shoppingListItem.count()).toBe(1)
	})
})

test("bounded receipt history rotates its session and never silently forgets deduplication", async () => {
	const store = new OfflineReceipts(1, 1024)
	const session = store.prepare()
	store.reserve("one", { user_id: 1, client_id: "phone", local_id: -1, request_hash: "hash" })
	store.confirm("one", { id: 42 })
	expect(store.findLocal(1, "phone", -1)?.result_json).toBe('{"id":42}')
	expect(() => store.reserve("two", { user_id: 1, client_id: "phone", local_id: null, request_hash: "other" })).toThrow(
		"retry history expired",
	)
	expect(store.prepare()).not.toBe(session)
	expect(store.entries.size).toBe(0)
	expect(store.findLocal(1, "phone", -1)).toBeUndefined()
	const byteBound = new OfflineReceipts(100, 1)
	const old = byteBound.prepare()
	byteBound.reserve("one", { user_id: 1, client_id: "phone", local_id: null, request_hash: "hash" })
	byteBound.confirm("one", { id: 42 })
	expect(byteBound.prepare()).not.toBe(old)
})
