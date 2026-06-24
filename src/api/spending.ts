import {
	HttpError,
	json,
	parseIntegerQuery,
	parseTimestampQuery,
	withErrorHandling,
	type Database,
} from "./core";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAYS = 30;
const AVERAGE_DAYS_PER_MONTH = 30.44;
const QUERY_FIELDS = new Set(["days", "from", "to", "range"]);

type SpendingPeriod = {
	from: string | null;
	to: string;
	days: number | null;
	range: "days" | "all";
};

type SpendingBucket = {
	category: string;
	currency: string;
	total: number;
	item_count: number;
	missing_total_count: number;
	items: SpendingLineItem[];
};

type SpendingLineItem = {
	id: number;
	receipt_id: number;
	product_id: number | null;
	store_name: string;
	purchased_at: string;
	product_name: string;
	quantity: number;
	unit: string;
	unit_price: number | null;
	line_total: number | null;
	amount: number | null;
};

type SpendingMonthlyAverageTotal = {
	currency: string;
	total: number;
	day_count: number;
};

const roundedMoney = (value: number) => Math.round(value * 100) / 100;

const normalizeCategory = (category: string) => {
	const trimmed = category.trim();
	return trimmed.length ? trimmed : "Uncategorized";
};

const parseSpendingQuery = (url: URL): SpendingPeriod => {
	for (const key of url.searchParams.keys()) {
		if (!QUERY_FIELDS.has(key)) {
			throw new HttpError(400, `Unknown query parameter \`${key}\``);
		}
	}

	const toParam = url.searchParams.get("to");
	const to = toParam
		? parseTimestampQuery("to", toParam)
		: new Date().toISOString();
	const fromParam = url.searchParams.get("from");
	const daysParam = url.searchParams.get("days");
	const rangeParam = url.searchParams.get("range");
	if (rangeParam !== null && rangeParam !== "all") {
		throw new HttpError(400, "Query parameter `range` must be `all`");
	}
	if (rangeParam === "all") {
		if (fromParam !== null || daysParam !== null) {
			throw new HttpError(
				400,
				"Use `range=all` without `from` or `days`",
			);
		}
		return {
			from: null,
			to,
			days: null,
			range: "all",
		};
	}
	if (fromParam !== null && daysParam !== null) {
		throw new HttpError(400, "Use either `from` or `days`, not both");
	}

	const days = daysParam
		? parseIntegerQuery("days", daysParam)
		: DEFAULT_DAYS;

	if (days < 1 || days > 3660) {
		throw new HttpError(
			400,
			"Query parameter `days` must be between 1 and 3660",
		);
	}

	const from = fromParam
		? parseTimestampQuery("from", fromParam)
		: new Date(Date.parse(to) - days * DAY_MS).toISOString();

	if (Date.parse(from) > Date.parse(to)) {
		throw new HttpError(400, "Query parameter `from` must be before `to`");
	}

	return {
		from,
		to,
		days: Math.ceil((Date.parse(to) - Date.parse(from)) / DAY_MS),
		range: "days",
	};
};

const receiptItemAmount = (item: {
	quantity: number;
	unit_price: number | null;
	line_total: number | null;
}) => {
	if (item.line_total !== null) {
		return item.line_total;
	}
	if (item.unit_price !== null) {
		return item.quantity * item.unit_price;
	}
	return null;
};

const bucketKey = (category: string, currency: string) =>
	`${currency}\u0000${category}`;

const calendarDayIndex = (timestamp: string) => {
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) {
		return null;
	}
	return Math.floor(
		Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS,
	);
};

const monthlyAverageTotals = (
	spendingByCurrency: Map<
		string,
		{ firstDay: number; total: number }
	>,
	averageEndDay: number | null,
): SpendingMonthlyAverageTotal[] =>
	[...spendingByCurrency.entries()]
		.map(([currency, spending]) => {
			const endDay = averageEndDay ?? spending.firstDay;
			const dayCount = Math.max(1, endDay - spending.firstDay + 1);
			return {
				currency,
				total: roundedMoney(
					(spending.total / dayCount) * AVERAGE_DAYS_PER_MONTH,
				),
				day_count: dayCount,
			};
		})
		.sort((left, right) => left.currency.localeCompare(right.currency));

export const spendingRoute = (db: Database) =>
	withErrorHandling(async (req: Request) => {
		if (req.method !== "GET") {
			throw new HttpError(405, "Method not allowed for this route");
		}

		const url = new URL(req.url);
		const period = parseSpendingQuery(url);
		const items = await db.client.receiptItem.findMany({
			where: {
				receipt: {
					purchased_at: {
						...(period.from === null ? {} : { gte: period.from }),
						lte: period.to,
					},
				},
			},
			select: {
				id: true,
				quantity: true,
				unit: true,
				unit_price: true,
				line_total: true,
				receipt: {
					select: {
						id: true,
						store_name: true,
						purchased_at: true,
						currency: true,
					},
				},
				product: {
					select: {
						id: true,
						name: true,
						category: true,
					},
				},
			},
			orderBy: [{ receipt: { purchased_at: "desc" } }, { id: "asc" }],
		});

		const buckets = new Map<string, SpendingBucket>();
		const spendingByCurrency = new Map<
			string,
			{ firstDay: number; total: number }
		>();
		const averageEndDay = calendarDayIndex(period.to);
		let itemCount = 0;
		let missingTotalCount = 0;

		for (const item of items) {
			itemCount += 1;
			const category = normalizeCategory(item.product.category);
			const currency = item.receipt.currency;
			const key = bucketKey(category, currency);
			let bucket = buckets.get(key);
			if (!bucket) {
				bucket = {
					category,
					currency,
					total: 0,
					item_count: 0,
					missing_total_count: 0,
					items: [],
				};
				buckets.set(key, bucket);
			}

			bucket.item_count += 1;
			const amount = receiptItemAmount(item);
			bucket.items.push({
				id: item.id,
				receipt_id: item.receipt.id,
				product_id: item.product.id,
				store_name: item.receipt.store_name,
				purchased_at: item.receipt.purchased_at,
				product_name: item.product.name,
				quantity: item.quantity,
				unit: item.unit,
				unit_price: item.unit_price,
				line_total: item.line_total,
				amount: amount === null ? null : roundedMoney(amount),
			});
			if (amount === null) {
				bucket.missing_total_count += 1;
				missingTotalCount += 1;
				continue;
			}
			bucket.total += amount;

			const itemDay = calendarDayIndex(item.receipt.purchased_at);
			if (itemDay !== null) {
				const spending = spendingByCurrency.get(currency);
				if (spending) {
					spending.firstDay = Math.min(spending.firstDay, itemDay);
					spending.total += amount;
				} else {
					spendingByCurrency.set(currency, {
						firstDay: itemDay,
						total: amount,
					});
				}
			}
		}

		const categories = [...buckets.values()]
			.map((bucket) => ({
				...bucket,
				total: roundedMoney(bucket.total),
			}))
			.sort(
				(left, right) =>
					left.currency.localeCompare(right.currency) ||
					right.total - left.total ||
					left.category.localeCompare(right.category),
			);

		const currencyTotals = new Map<string, number>();
		for (const bucket of categories) {
			currencyTotals.set(
				bucket.currency,
				(currencyTotals.get(bucket.currency) ?? 0) + bucket.total,
			);
		}

		return json(200, {
			period,
			item_count: itemCount,
			missing_total_count: missingTotalCount,
			currency_totals: [...currencyTotals.entries()]
				.map(([currency, total]) => ({
					currency,
					total: roundedMoney(total),
				}))
				.sort((left, right) => left.currency.localeCompare(right.currency)),
			monthly_average_totals: monthlyAverageTotals(
				spendingByCurrency,
				averageEndDay,
			),
			categories,
		});
	});
