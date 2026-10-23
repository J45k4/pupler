export const upsertItem = <T extends { id: number | string }>(items: T[] | null | undefined, item: T): T[] => {
	const current = items ?? []
	return current.some(value => value.id === item.id) ? current.map(value => value.id === item.id ? item : value) : [item, ...current]
}

export const shoppingPreview = <T extends { id: number; done: boolean; created_at: string }>(items: T[]) => {
	const pending = items.filter(item => !item.done).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id - b.id)
	return { items: pending.slice(0, 8), total: pending.length }
}
