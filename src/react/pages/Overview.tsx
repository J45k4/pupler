import { apiFetch } from "../api"
import { Empty, Status, TickingDuration, formatReceiptDateTime, useApi } from "../lib"
import type { ShoppingListItem, TimeEntry } from "../lib"

const TimerPanel = ({ link }: { link: (p: string) => string }) => {
	const { data, loading, error, reload } = useApi<TimeEntry[]>("/api/time-entries?sort=started_at&order=desc")
	const running = (data ?? []).find((e) => e.ended_at === null) ?? null

	const stop = async () => {
		if (!running) return
		await apiFetch(`/api/time-entries/${running.id}/stop`, { method: "POST", body: "{}" })
		reload()
	}

	return (
		<div className="card panel dashboard-timer-panel">
			<div className="section-header">
				<h2>Timer</h2>
				<a className="secondary action-link" href={link("/time")} data-link="">
					Open Time
				</a>
			</div>
			<div id="dashboard-timer">
				{loading ? <p className="page-copy">Loading…</p> : null}
				{error ? <Status message={error} error /> : null}
				{!loading && !error && !running ? (
					<div className="dashboard-timer-empty">
						<Empty message="No timer running." />
						<a className="primary action-link" href={link("/time")} data-link="">
							Start Timer
						</a>
					</div>
				) : null}
				{!loading && !error && running ? (
					<div className="time-running dashboard-timer-running">
						<div className="time-running__project">
							<span className="time-color" style={{ ["--time-color" as string]: running.project?.color ?? "#2d7c6f" }} />
							<strong>{running.project?.name ?? "No project"}</strong>
						</div>
						<div id="dashboard-running-timer-duration" className="time-running__duration">
							<TickingDuration startedAt={running.started_at} />
						</div>
						{running.description ? <p className="section-copy">{running.description}</p> : null}
						<div className="time-running__actions">
							<a className="secondary action-link" href={link("/time")} data-link="">
								Edit
							</a>
							<button className="primary" type="button" onClick={() => void stop()}>
								Stop
							</button>
						</div>
						<div className="section-copy">Running since {formatReceiptDateTime(running.started_at)}.</div>
					</div>
				) : null}
			</div>
		</div>
	)
}

const ShoppingPanel = ({ link }: { link: (p: string) => string }) => {
	const { data, loading, error } = useApi<ShoppingListItem[]>(
		"/api/shopping-list-items?done=false&sort=created_at&order=asc",
	)
	const items = (data ?? []).slice(0, 8)

	return (
		<div className="card panel dashboard-shopping-panel">
			<div className="section-header">
				<h2>Shoppinglist</h2>
				<a className="secondary action-link" href={link("/shoppinglist")} data-link="">
					View All
				</a>
			</div>
			<div id="dashboard-shopping-list">
				{loading ? <p className="page-copy">Loading…</p> : null}
				{error ? <Status message={error} error /> : null}
				{!loading && !error && items.length === 0 ? <Empty message="No active shoppinglist items." /> : null}
				{!loading && !error && items.length > 0 ? (
					<div className="dashboard-shopping-list">
						{items.map((item) => (
							<a key={item.id} className="dashboard-shopping-item" href={link("/shoppinglist")} data-link="">
								<span className="dashboard-shopping-item__image dashboard-shopping-item__image--placeholder" />
								<div className="dashboard-shopping-item__main">
									<strong>{item.name}</strong>
									<span>{`${item.quantity} ${item.unit}`.trim()}</span>
								</div>
							</a>
						))}
					</div>
				) : null}
			</div>
			<Status
				message={
					loading || error
						? ""
						: (data ?? []).length
							? `${Math.min((data ?? []).length, 8)} of ${(data ?? []).length} active item(s).`
							: "Shoppinglist is empty."
				}
			/>
		</div>
	)
}

export const OverviewPage = ({ link }: { link: (p: string) => string }) => (
	<section className="dashboard-grid">
		<TimerPanel link={link} />
		<ShoppingPanel link={link} />
	</section>
)
