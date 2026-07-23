import type { BunRequest } from "bun";

import {
	assertKnownFields,
	expectBoolean,
	expectInteger,
	expectNullableInteger,
	expectNullableTimestamp,
	expectString,
	HttpError,
	json,
	parseIdParam,
	readJsonObject,
	readOptionalBodyField,
	requireBodyField,
	utcNow,
	withErrorHandling,
	type Database,
	type JsonObject,
} from "./core";
import {
	ExternalIntegrationProvider,
	ExternalIntegrationStatus,
	ImportScheduleCadence,
	ImportScheduleStatus,
	ImportType,
	isImportScheduleCadence,
	JobStatus,
	JobType,
} from "./job-types";
import {
	isValidTimezone,
	nextScheduleRunAt,
} from "./import-schedule-time";
import { wakeJobWorker } from "./job-worker";

const SCHEDULE_FIELDS = [
	"integration_id",
	"name",
	"cadence",
	"timezone",
	"lookback_days",
	"dry_run",
	"target_client_id",
	"client_ids",
	"project_ids",
	"next_run_at",
];

const expectStringArray = (value: unknown, field: string) => {
	if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
		throw new HttpError(400, `Field \`${field}\` must be an array of strings`);
	}
	return value.map((item) => item.trim()).filter(Boolean);
};

const parseLookbackDays = (body: JsonObject) => {
	if (!Object.prototype.hasOwnProperty.call(body, "lookback_days")) {
		return 14;
	}
	const lookbackDays = readOptionalBodyField(
		body,
		"lookback_days",
		expectNullableInteger,
	);
	if (lookbackDays !== null && lookbackDays !== undefined && lookbackDays < 1) {
		throw new HttpError(400, "Field `lookback_days` must be at least 1 or null");
	}
	return lookbackDays ?? null;
};

const normalizeTimestamp = (value: string | null) =>
	value === null ? null : new Date(value).toISOString();

const parseScheduleBody = (body: JsonObject) => {
	assertKnownFields(body, SCHEDULE_FIELDS);
	const integrationId = requireBodyField(body, "integration_id", expectInteger);
	const cadence = requireBodyField(body, "cadence", expectInteger);
	if (!isImportScheduleCadence(cadence)) {
		throw new HttpError(400, "Field `cadence` must be a valid import schedule cadence");
	}
	const name = requireBodyField(body, "name", expectString).trim();
	if (!name) throw new HttpError(400, "Field `name` cannot be empty");
	const timezone = (
		readOptionalBodyField(body, "timezone", expectString) ?? "UTC"
	).trim();
	if (!timezone) throw new HttpError(400, "Field `timezone` cannot be empty");
	if (!isValidTimezone(timezone)) {
		throw new HttpError(400, "Field `timezone` must be a valid IANA timezone");
	}
	const lookbackDays = parseLookbackDays(body);
	const nextRunAt =
		readOptionalBodyField(body, "next_run_at", expectNullableTimestamp) ?? null;

	return {
		integrationId,
		name,
		cadence,
		timezone,
		nextRunAt: normalizeTimestamp(nextRunAt),
		params: {
			lookback_days: lookbackDays,
			dry_run: readOptionalBodyField(body, "dry_run", expectBoolean) ?? false,
			target_client_id:
				readOptionalBodyField(body, "target_client_id", expectNullableInteger) ??
				null,
			client_ids: readOptionalBodyField(body, "client_ids", expectStringArray) ?? [],
			project_ids: readOptionalBodyField(body, "project_ids", expectStringArray) ?? [],
		},
	};
};

const assertTargetClientExists = async (
	db: Database,
	targetClientId: number | null | undefined,
) => {
	if (targetClientId === null || targetClientId === undefined) return;
	const client = await db.client.client.findUnique({ where: { id: targetClientId } });
	if (!client) throw new HttpError(400, "Target client does not exist");
};

export const createJobFromSchedule = async (
	db: Database,
	scheduleId: number,
) => {
	const schedule = await db.client.importSchedule.findUnique({
		where: { id: scheduleId },
		include: { integration: true },
	});
	if (!schedule) throw new HttpError(404, "Resource not found");
	if (schedule.status !== ImportScheduleStatus.Active) {
		throw new HttpError(400, "Import schedule is not active");
	}
	if (schedule.integration.status !== ExternalIntegrationStatus.Active) {
		throw new HttpError(400, "External integration is not active");
	}

	const now = utcNow();
	const job = await db.client.job.create({
		data: {
			schedule_id: schedule.id,
			integration_id: schedule.integration_id,
			type: JobType.ClockifyImport,
			status: JobStatus.Pending,
			params_json: schedule.params_json,
			cursor_json: schedule.cursor_json,
			created_at: now,
			updated_at: now,
		},
	});
	await db.client.importSchedule.update({
		where: { id: schedule.id },
		data: {
			last_job_id: job.id,
			last_run_at: now,
			updated_at: now,
		},
	});
	return job;
};

export const importSchedulesCollectionRoute = (db: Database) =>
	withErrorHandling(async (req: Request) => {
		if (req.method === "GET") {
			return json(
				200,
				await db.client.importSchedule.findMany({
					orderBy: [{ id: "asc" }],
				}),
			);
		}
		if (req.method === "POST") {
			const values = parseScheduleBody(await readJsonObject(req));
			const integration = await db.client.externalIntegration.findUnique({
				where: { id: values.integrationId },
			});
			if (!integration) throw new HttpError(400, "Integration does not exist");
			if (integration.provider !== ExternalIntegrationProvider.Clockify) {
				throw new HttpError(400, "Integration must be a Clockify integration");
			}
			await assertTargetClientExists(db, values.params.target_client_id);
			const now = utcNow();
			const nextRunAt =
				values.cadence === ImportScheduleCadence.Manual
					? values.nextRunAt
					: values.nextRunAt ??
						nextScheduleRunAt(now, values.cadence, values.timezone);
			return json(
				201,
				await db.client.importSchedule.create({
					data: {
						integration_id: values.integrationId,
						type: ImportType.Clockify,
						status: ImportScheduleStatus.Active,
						name: values.name,
						cadence: values.cadence,
						timezone: values.timezone,
						params_json: JSON.stringify(values.params),
						cursor_json: null,
						next_run_at: nextRunAt,
						last_run_at: null,
						last_job_id: null,
						created_at: now,
						updated_at: now,
					},
				}),
			);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});

export const importScheduleDetailRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		const id = parseIdParam(req.params.id ?? "");
		const schedule = await db.client.importSchedule.findUnique({ where: { id } });
		if (!schedule) throw new HttpError(404, "Resource not found");

		if (req.method === "GET") return json(200, schedule);
		if (req.method === "PATCH") {
			const body = await readJsonObject(req);
			assertKnownFields(body, [...SCHEDULE_FIELDS, "status"]);
			const values: Record<string, unknown> = {};
			const integrationId = readOptionalBodyField(body, "integration_id", expectInteger);
			if (integrationId !== undefined) {
				const integration = await db.client.externalIntegration.findUnique({
					where: { id: integrationId },
				});
				if (!integration) throw new HttpError(400, "Integration does not exist");
				if (integration.provider !== ExternalIntegrationProvider.Clockify) {
					throw new HttpError(400, "Integration must be a Clockify integration");
				}
				values.integration_id = integrationId;
			}
			const name = readOptionalBodyField(body, "name", expectString);
			if (name !== undefined) {
				const trimmedName = name.trim();
				if (!trimmedName) throw new HttpError(400, "Field `name` cannot be empty");
				values.name = trimmedName;
			}
			const cadence = readOptionalBodyField(body, "cadence", expectInteger);
			if (cadence !== undefined) {
				if (!isImportScheduleCadence(cadence)) {
					throw new HttpError(400, "Field `cadence` must be a valid import schedule cadence");
				}
				values.cadence = cadence;
			}
			const timezone = readOptionalBodyField(body, "timezone", expectString);
			if (timezone !== undefined) {
				const trimmedTimezone = timezone.trim();
				if (!trimmedTimezone) throw new HttpError(400, "Field `timezone` cannot be empty");
				if (!isValidTimezone(trimmedTimezone)) {
					throw new HttpError(400, "Field `timezone` must be a valid IANA timezone");
				}
				values.timezone = trimmedTimezone;
			}
			const status = readOptionalBodyField(body, "status", expectInteger);
			if (status !== undefined) {
				if (
					!Object.values(ImportScheduleStatus).includes(
						status as ImportScheduleStatus,
					)
				) {
					throw new HttpError(400, "Field `status` must be a valid schedule status");
				}
				values.status = status;
			}
			const currentParams = JSON.parse(schedule.params_json) as {
				lookback_days?: number | null;
				dry_run?: boolean;
				target_client_id?: number | null;
				client_ids?: string[];
				project_ids?: string[];
			};
			const nextParams = { ...currentParams };
			if (Object.prototype.hasOwnProperty.call(body, "lookback_days")) {
				nextParams.lookback_days = parseLookbackDays(body);
			}
			const dryRun = readOptionalBodyField(body, "dry_run", expectBoolean);
			if (dryRun !== undefined) nextParams.dry_run = dryRun;
			const targetClientId = readOptionalBodyField(
				body,
				"target_client_id",
				expectNullableInteger,
			);
			if (targetClientId !== undefined) {
				await assertTargetClientExists(db, targetClientId);
				nextParams.target_client_id = targetClientId;
			}
			const clientIds = readOptionalBodyField(body, "client_ids", expectStringArray);
			if (clientIds !== undefined) nextParams.client_ids = clientIds;
			const projectIds = readOptionalBodyField(body, "project_ids", expectStringArray);
			if (projectIds !== undefined) nextParams.project_ids = projectIds;
			if (
				Object.prototype.hasOwnProperty.call(body, "lookback_days") ||
				dryRun !== undefined ||
				targetClientId !== undefined ||
				clientIds !== undefined ||
				projectIds !== undefined
			) {
				values.params_json = JSON.stringify(nextParams);
			}
			const nextRunAt = readOptionalBodyField(
				body,
				"next_run_at",
				expectNullableTimestamp,
			);
			if (nextRunAt !== undefined) {
				values.next_run_at = normalizeTimestamp(nextRunAt);
			}
			const finalCadence = (values.cadence as number | undefined) ?? schedule.cadence;
			const finalTimezone =
				(values.timezone as string | undefined) ?? schedule.timezone;
			const finalNextRunAt = Object.prototype.hasOwnProperty.call(
				values,
				"next_run_at",
			)
				? (values.next_run_at as string | null)
				: schedule.next_run_at;
			if (
				finalCadence !== ImportScheduleCadence.Manual &&
				finalNextRunAt === null
			) {
				values.next_run_at = nextScheduleRunAt(
					utcNow(),
					finalCadence,
					finalTimezone,
				);
			}
			if (!Object.keys(values).length) {
				throw new HttpError(400, "PATCH request must contain at least one writable field");
			}
			values.updated_at = utcNow();
			return json(
				200,
				await db.client.importSchedule.update({ where: { id }, data: values }),
			);
		}
		throw new HttpError(405, "Method not allowed for this route");
	});

export const importScheduleRunRoute = (db: Database) =>
	withErrorHandling(async (req: BunRequest<string>) => {
		if (req.method !== "POST") {
			throw new HttpError(405, "Method not allowed for this route");
		}
		const job = await createJobFromSchedule(db, parseIdParam(req.params.id ?? ""));
		wakeJobWorker(db);
		return json(202, job);
	});
