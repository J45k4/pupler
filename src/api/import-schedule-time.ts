import { ImportScheduleCadence } from "./job-types";

type ZonedDateTimeParts = {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
	millisecond: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

const formatterForTimezone = (timezone: string) => {
	let formatter = formatterCache.get(timezone);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat("en-CA", {
			timeZone: timezone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			hourCycle: "h23",
		});
		formatterCache.set(timezone, formatter);
	}
	return formatter;
};

export const isValidTimezone = (timezone: string) => {
	try {
		formatterForTimezone(timezone).format(new Date(0));
		return true;
	} catch {
		return false;
	}
};

const zonedParts = (date: Date, timezone: string): ZonedDateTimeParts => {
	const values = new Map(
		formatterForTimezone(timezone)
			.formatToParts(date)
			.map((part) => [part.type, part.value]),
	);
	return {
		year: Number(values.get("year")),
		month: Number(values.get("month")),
		day: Number(values.get("day")),
		hour: Number(values.get("hour")),
		minute: Number(values.get("minute")),
		second: Number(values.get("second")),
		millisecond: date.getUTCMilliseconds(),
	};
};

const partsEpoch = (parts: ZonedDateTimeParts) =>
	Date.UTC(
		parts.year,
		parts.month - 1,
		parts.day,
		parts.hour,
		parts.minute,
		parts.second,
		parts.millisecond,
	);

const timezoneOffsetMilliseconds = (date: Date, timezone: string) => {
	const instantWithoutMilliseconds =
		Math.floor(date.getTime() / 1000) * 1000;
	return partsEpoch({
		...zonedParts(new Date(instantWithoutMilliseconds), timezone),
		millisecond: 0,
	}) - instantWithoutMilliseconds;
};

const sameZonedParts = (
	left: ZonedDateTimeParts,
	right: ZonedDateTimeParts,
) =>
	left.year === right.year &&
	left.month === right.month &&
	left.day === right.day &&
	left.hour === right.hour &&
	left.minute === right.minute &&
	left.second === right.second &&
	left.millisecond === right.millisecond;

const instantForZonedParts = (
	parts: ZonedDateTimeParts,
	timezone: string,
	preferredOffset: number,
) => {
	const desiredEpoch = partsEpoch(parts);
	const candidateOffsets = new Set([
		preferredOffset,
		timezoneOffsetMilliseconds(new Date(desiredEpoch), timezone),
		timezoneOffsetMilliseconds(
			new Date(desiredEpoch - 36 * 60 * 60 * 1000),
			timezone,
		),
		timezoneOffsetMilliseconds(
			new Date(desiredEpoch + 36 * 60 * 60 * 1000),
			timezone,
		),
	]);
	const candidates = [...candidateOffsets].map((offset) => {
		const instant = new Date(desiredEpoch - offset);
		return {
			instant,
			offset,
			parts: zonedParts(instant, timezone),
		};
	});
	const exactCandidates = candidates.filter((candidate) =>
		sameZonedParts(candidate.parts, parts),
	);
	const exactCandidate =
		exactCandidates.find((candidate) => candidate.offset === preferredOffset) ??
		exactCandidates.sort(
			(left, right) => left.instant.getTime() - right.instant.getTime(),
		)[0];
	if (exactCandidate) return exactCandidate.instant;

	// If the requested wall-clock time is skipped by a DST transition, move to
	// the first representable local time after it.
	const nextCandidate = candidates
		.map((candidate) => ({
			...candidate,
			localDifference: partsEpoch(candidate.parts) - desiredEpoch,
		}))
		.filter((candidate) => candidate.localDifference > 0)
		.sort((left, right) => left.localDifference - right.localDifference)[0];
	return nextCandidate?.instant ?? candidates[0]!.instant;
};

export const nextScheduleRunAt = (
	from: string,
	cadence: number,
	timezone: string,
) => {
	const fromDate = new Date(from);
	if (Number.isNaN(fromDate.getTime())) {
		throw new Error("Cannot calculate the next run from an invalid timestamp");
	}
	if (!isValidTimezone(timezone)) {
		throw new Error(`Cannot calculate the next run for timezone ${timezone}`);
	}
	if (cadence === ImportScheduleCadence.Hourly) {
		return new Date(fromDate.getTime() + 60 * 60 * 1000).toISOString();
	}
	const days =
		cadence === ImportScheduleCadence.Weekly
			? 7
			: cadence === ImportScheduleCadence.Daily
				? 1
				: 0;
	if (!days) return fromDate.toISOString();

	const sourceParts = zonedParts(fromDate, timezone);
	const targetAsUtc = new Date(partsEpoch(sourceParts));
	targetAsUtc.setUTCDate(targetAsUtc.getUTCDate() + days);
	const targetParts: ZonedDateTimeParts = {
		year: targetAsUtc.getUTCFullYear(),
		month: targetAsUtc.getUTCMonth() + 1,
		day: targetAsUtc.getUTCDate(),
		hour: targetAsUtc.getUTCHours(),
		minute: targetAsUtc.getUTCMinutes(),
		second: targetAsUtc.getUTCSeconds(),
		millisecond: targetAsUtc.getUTCMilliseconds(),
	};
	return instantForZonedParts(
		targetParts,
		timezone,
		timezoneOffsetMilliseconds(fromDate, timezone),
	).toISOString();
};
