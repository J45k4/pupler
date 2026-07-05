const BASE_CURRENCY = "EUR";

const EUR_EXCHANGE_RATES: Record<string, number> = {
	EUR: 1,
	USD: 0.87727,
};

export const displayCurrency = (currency: string) => {
	const normalized = currency.trim().toUpperCase();
	return EUR_EXCHANGE_RATES[normalized] === undefined
		? normalized
		: BASE_CURRENCY;
};

export const displayMoneyAmount = (amount: number, currency: string) => {
	const normalized = currency.trim().toUpperCase();
	const rate = EUR_EXCHANGE_RATES[normalized];
	return rate === undefined ? amount : amount * rate;
};
