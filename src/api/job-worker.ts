import { importClockifyJob } from "./clockify-import"
import { utcNow, type Database } from "./core"
import { nextScheduleRunAt } from "./import-schedule-time"
import {
	ExternalIntegrationStatus,
	ImportScheduleCadence,
	ImportScheduleStatus,
	JobStatus,
	JobType,
} from "./job-types"

let workerRunning = false
let workerScheduled = false
let interval: ReturnType<typeof setInterval> | null = null

const enqueueDueSchedules = async (db: Database) => {
	const now = utcNow()
	const schedules = await db.client.importSchedule.findMany({
		where: {
			status: ImportScheduleStatus.Active,
			cadence: { not: ImportScheduleCadence.Manual },
			next_run_at: { lte: now },
			integration: { status: ExternalIntegrationStatus.Active },
		},
		orderBy: [{ next_run_at: "asc" }, { id: "asc" }],
	})

	for (const schedule of schedules) {
		const existingPendingJob = await db.client.job.findFirst({
			where: {
				schedule_id: schedule.id,
				status: { in: [JobStatus.Pending, JobStatus.Running] },
			},
		})
		const followingRun = nextScheduleRunAt(
			schedule.next_run_at ?? now,
			schedule.cadence,
			schedule.timezone,
		)
		if (existingPendingJob) {
			await db.client.importSchedule.update({
				where: { id: schedule.id },
				data: { next_run_at: followingRun, updated_at: now },
			})
			continue
		}
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
		})
		await db.client.importSchedule.update({
			where: { id: schedule.id },
			data: {
				last_job_id: job.id,
				last_run_at: now,
				next_run_at: followingRun,
				updated_at: now,
			},
		})
	}
}

const runOneJob = async (db: Database) => {
	const job = await db.client.job.findFirst({
		where: { status: JobStatus.Pending },
		orderBy: [{ created_at: "asc" }, { id: "asc" }],
	})
	if (!job) return false

	const now = utcNow()
	await db.client.job.update({
		where: { id: job.id },
		data: {
			status: JobStatus.Running,
			started_at: now,
			updated_at: now,
		},
	})

	try {
		if (job.type !== JobType.ClockifyImport) {
			throw new Error(`Unsupported job type ${job.type}`)
		}
		const { result, cursor } = await importClockifyJob(db, job.id)
		await db.client.job.update({
			where: { id: job.id },
			data: {
				status: JobStatus.Completed,
				result_json: JSON.stringify(result),
				error_json: result.errors.length
					? JSON.stringify(result.errors)
					: null,
				cursor_json: JSON.stringify(cursor),
				processed_rows:
					result.created.time_entries +
					result.updated.time_entries +
					result.skipped.running_entries +
					result.skipped.invalid_entries +
					result.skipped.filtered_entries,
				finished_at: utcNow(),
				updated_at: utcNow(),
			},
		})
	} catch (error) {
		await db.client.job.update({
			where: { id: job.id },
			data: {
				status: JobStatus.Failed,
				error_message:
					error instanceof Error ? error.message : "Job failed",
				finished_at: utcNow(),
				updated_at: utcNow(),
			},
		})
	}
	return true
}

const processJobs = async (db: Database) => {
	if (workerRunning) {
		workerScheduled = true
		return
	}

	workerRunning = true
	try {
		do {
			workerScheduled = false
			await enqueueDueSchedules(db)
			while (await runOneJob(db)) {
				// Drain currently pending jobs.
			}
		} while (workerScheduled)
	} finally {
		workerRunning = false
	}
}

export const wakeJobWorker = (db: Database) => {
	void processJobs(db)
}

export const startJobWorker = async (db: Database) => {
	await db.client.job.updateMany({
		where: { status: JobStatus.Running },
		data: {
			status: JobStatus.Pending,
			started_at: null,
			updated_at: utcNow(),
		},
	})
	wakeJobWorker(db)
	if (interval === null) {
		interval = setInterval(() => wakeJobWorker(db), 60 * 1000)
	}
}
