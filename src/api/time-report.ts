import {
	HttpError,
	json,
	parseTimestampQuery,
	withErrorHandling,
	type Database,
} from "./core";

const QUERY_FIELDS = new Set(["from", "to", "range"]);

type TimeReportPeriod = {
	from: string | null;
	to: string;
	range: "custom" | "all";
};

type TimeReportProjectTotal = {
	project_id: number;
	project_name: string;
	project_color: string;
	total_seconds: number;
	entry_count: number;
};

const parseTimeReportQuery = (url: URL): TimeReportPeriod => {
	for (const key of url.searchParams.keys()) {
		if (!QUERY_FIELDS.has(key)) {
			throw new HttpError(400, `Unknown query parameter \`${key}\``);
		}
	}

	const toParam = url.searchParams.get("to");
	const to = toParam
		? parseTimestampQuery("to", toParam)
		: new Date().toISOString();
	const rangeParam = url.searchParams.get("range");
	const fromParam = url.searchParams.get("from");

	if (rangeParam !== null && rangeParam !== "all") {
		throw new HttpError(400, "Query parameter `range` must be `all`");
	}
	if (rangeParam === "all") {
		if (fromParam !== null) {
			throw new HttpError(400, "Use `range=all` without `from`");
		}
		return { from: null, to, range: "all" };
	}

	const from = fromParam ? parseTimestampQuery("from", fromParam) : null;
	if (from !== null && Date.parse(from) > Date.parse(to)) {
		throw new HttpError(400, "Query parameter `from` must be before `to`");
	}

	return { from, to, range: "custom" };
};

const entryDurationSeconds = (
	entry: { started_at: string; ended_at: string | null },
	period: TimeReportPeriod,
) => {
	const startMs = Math.max(
		Date.parse(entry.started_at),
		period.from === null ? Number.NEGATIVE_INFINITY : Date.parse(period.from),
	);
	const endMs = Math.min(
		Date.parse(entry.ended_at ?? period.to),
		Date.parse(period.to),
	);
	return Math.max(0, Math.floor((endMs - startMs) / 1000));
};

export const timeReportRoute = (db: Database) =>
	withErrorHandling(async (req: Request) => {
		if (req.method !== "GET") {
			throw new HttpError(405, "Method not allowed for this route");
		}

		const url = new URL(req.url);
		const period = parseTimeReportQuery(url);
		const entries = await db.client.timeEntry.findMany({
			where: {
				started_at: { lte: period.to },
				...(period.from === null
					? {}
					: {
							OR: [
								{ ended_at: null },
								{ ended_at: { gte: period.from } },
							],
						}),
			},
			include: {
				project: {
					select: {
						id: true,
						name: true,
						color: true,
						archived_at: true,
					},
				},
			},
			orderBy: [{ started_at: "desc" }, { id: "desc" }],
		});

		const totals = new Map<number, TimeReportProjectTotal>();
		let totalSeconds = 0;

		for (const entry of entries) {
			const seconds = entryDurationSeconds(entry, period);
			if (seconds <= 0) continue;
			totalSeconds += seconds;
			const existing = totals.get(entry.project_id);
			if (existing) {
				existing.total_seconds += seconds;
				existing.entry_count += 1;
				continue;
			}
			totals.set(entry.project_id, {
				project_id: entry.project_id,
				project_name: entry.project.name,
				project_color: entry.project.color,
				total_seconds: seconds,
				entry_count: 1,
			});
		}

		const runningEntry = entries.find((entry) => entry.ended_at === null) ?? null;

		return json(200, {
			period,
			total_seconds: totalSeconds,
			running_entry: runningEntry,
			project_totals: [...totals.values()].sort(
				(left, right) =>
					right.total_seconds - left.total_seconds ||
					left.project_name.localeCompare(right.project_name),
			),
		});
	});
