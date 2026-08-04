import { db } from "../db"
import { HttpError, json, type Database } from "./core"
import { displayCurrency, displayMoneyAmount } from "../currency"

type UnitQuantity = {
	unit: string
	quantity: number
}

type MoneyTotal = {
	currency: string
	total: number
}

const roundedQuantity = (value: number) => Math.round(value * 1000) / 1000
const roundedMoney = (value: number) => Math.round(value * 100) / 100

const quantityTotalsByUnit = (
	items: Array<{ quantity: number; unit: string }>,
): UnitQuantity[] => {
	const totals = new Map<string, number>()
	for (const item of items) {
		totals.set(item.unit, (totals.get(item.unit) ?? 0) + item.quantity)
	}

	return [...totals.entries()]
		.map(([unit, quantity]) => ({
			unit,
			quantity: roundedQuantity(quantity),
		}))
		.sort((left, right) => left.unit.localeCompare(right.unit))
}

const receiptItemAmount = (item: {
	quantity: number
	unit_price: number | null
	line_total: number | null
}) => {
	if (item.line_total !== null) {
		return item.line_total
	}
	if (item.unit_price !== null) {
		return item.quantity * item.unit_price
	}
	return null
}

const costTotalsByCurrency = (
	items: Array<{
		quantity: number
		unit_price: number | null
		line_total: number | null
		receipt: { currency: string }
	}>,
): MoneyTotal[] => {
	const totals = new Map<string, number>()
	for (const item of items) {
		const amount = receiptItemAmount(item)
		if (amount === null) {
			continue
		}
		const currency = displayCurrency(item.receipt.currency)
		totals.set(
			currency,
			(totals.get(currency) ?? 0) +
				displayMoneyAmount(amount, item.receipt.currency),
		)
	}

	return [...totals.entries()]
		.map(([currency, total]) => ({
			currency,
			total: roundedMoney(total),
		}))
		.sort((left, right) => left.currency.localeCompare(right.currency))
}

export const productStatsRoute = async (req: Request) => {
	if (req.method !== "GET") {
		throw new HttpError(405, "Method not allowed for this route")
	}

	const url = new URL(req.url)
	for (const key of url.searchParams.keys()) {
		throw new HttpError(400, `Unknown query parameter \`${key}\``)
	}

	const products = await db.client.product.findMany({
		select: {
			id: true,
			name: true,
			category: true,
			default_unit: true,
			receipt_items: {
				select: {
					quantity: true,
					unit: true,
					unit_price: true,
					line_total: true,
					receipt: {
						select: {
							currency: true,
						},
					},
				},
			},
			inventory_items: {
				where: {
					consumed_at: {
						not: null,
					},
				},
				select: {
					quantity: true,
					unit: true,
				},
			},
		},
		orderBy: [{ name: "asc" }, { id: "asc" }],
	})

	return json(
		200,
		products.map((product) => {
			const usedQuantities = quantityTotalsByUnit(product.inventory_items)
			const costTotals = costTotalsByCurrency(product.receipt_items)
			return {
				product_id: product.id,
				product_name: product.name,
				category: product.category,
				default_unit: product.default_unit,
				bought_count: product.receipt_items.length,
				bought_quantities: quantityTotalsByUnit(product.receipt_items),
				total_costs: costTotals,
				total_cost_sort: roundedMoney(
					costTotals.reduce((total, item) => total + item.total, 0),
				),
				used_count: product.inventory_items.length,
				used_quantities: usedQuantities,
				used_sort_quantity: roundedQuantity(
					usedQuantities.reduce(
						(total, item) => total + item.quantity,
						0,
					),
				),
			}
		}),
	)
}
