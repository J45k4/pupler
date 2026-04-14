const formatValue = (value: unknown): string => {
	if (value === null) {
		return "null";
	}
	if (value === undefined) {
		return "";
	}
	if (typeof value === "string") {
		return value;
	}
	if (
		typeof value === "number" ||
		typeof value === "boolean" ||
		typeof value === "bigint"
	) {
		return String(value);
	}
	return JSON.stringify(value);
};

const pad = (value: string, width: number) => value.padEnd(width, " ");

const renderObject = (value: Record<string, unknown>) =>
	Object.entries(value)
		.map(([key, entry]) => `${key}: ${formatValue(entry)}`)
		.join("\n");

const renderPrimitiveArray = (value: unknown[]) =>
	value.map((entry) => formatValue(entry)).join("\n");

const renderTable = (rows: Array<Record<string, unknown>>) => {
	if (!rows.length) {
		return "No rows.";
	}

	const columns: string[] = [];
	for (const row of rows) {
		for (const key of Object.keys(row)) {
			if (!columns.includes(key)) {
				columns.push(key);
			}
		}
	}

	const widths = columns.map((column) =>
		Math.max(
			column.length,
			...rows.map((row) => formatValue(row[column]).length),
		),
	);

	const header = columns.map((column, index) => pad(column, widths[index] ?? column.length)).join(" | ");
	const divider = widths.map((width) => "-".repeat(width)).join("-+-");
	const body = rows.map((row) =>
		columns
			.map((column, index) =>
				pad(formatValue(row[column]), widths[index] ?? column.length),
			)
			.join(" | "),
	);

	return [header, divider, ...body].join("\n");
};

export const renderHuman = (payload: unknown): string => {
	if (payload === null || payload === undefined) {
		return "";
	}
	if (Array.isArray(payload)) {
		if (!payload.length) {
			return "No rows.";
		}
		if (payload.every((entry) => entry && typeof entry === "object" && !Array.isArray(entry))) {
			return renderTable(payload as Array<Record<string, unknown>>);
		}
		return renderPrimitiveArray(payload);
	}
	if (typeof payload === "object") {
		return renderObject(payload as Record<string, unknown>);
	}
	return formatValue(payload);
};

export const printHuman = (payload: unknown) => {
	const rendered = renderHuman(payload);
	if (rendered) {
		console.log(rendered);
	}
};

export const printJson = (payload: unknown) => {
	console.log(JSON.stringify(payload, null, 4));
};
