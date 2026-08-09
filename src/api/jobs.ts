import type { BunRequest } from "bun"

import {
	HttpError,
	json,
	parseIdParam,
	withErrorHandling,
	type Database,
} from "./core"

export const jobsCollectionRoute = (db: Database) =>
	withErrorHandling(async (req: Request) => {
		if (req.method !== "GET") {
			throw new HttpError(405, "Method not allowed for this route")
		}
		return json(
			200,
			await db.client.job.findMany({
				orderBy: [{ created_at: "desc" }, { id: "desc" }],
			}),
		)
	})

export const jobDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		if (req.method !== "GET") {
			throw new HttpError(405, "Method not allowed for this route")
		}
		const id = parseIdParam(req.params.id ?? "")
		const job = await db.client.job.findUnique({ where: { id } })
		if (!job) throw new HttpError(404, "Resource not found")
		return json(200, job)
	})
