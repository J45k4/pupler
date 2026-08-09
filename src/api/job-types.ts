export enum ExternalIntegrationProvider {
	Clockify = 1,
}

export enum ExternalIntegrationStatus {
	Active = 1,
	Disabled = 2,
}

export enum ImportType {
	Clockify = 1,
}

export enum ImportScheduleStatus {
	Active = 1,
	Paused = 2,
}

export enum ImportScheduleCadence {
	Manual = 1,
	Hourly = 2,
	Daily = 3,
	Weekly = 4,
}

export enum JobType {
	ClockifyImport = 1,
}

export enum JobStatus {
	Pending = 1,
	Running = 2,
	Completed = 3,
	Failed = 4,
}

export const isImportScheduleCadence = (value: number) =>
	Object.values(ImportScheduleCadence).includes(value)
