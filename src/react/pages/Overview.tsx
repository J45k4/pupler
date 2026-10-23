import { apiFetch } from "../api"
import { useState } from "react"
import { Empty, Status, TickingDuration, formatReceiptDateTime, useApi } from "../lib"
import type { ShoppingListItem } from "../lib"
import { useTimePage } from "./use-time-page"
import { shoppingPreview } from "../data-updates"

const TimerPanel = ({ link }: { link: (p: string) => string }) => {
	const { summary, loading, error, reload } = useTimePage(0)
	const running = summary?.running ?? null
	const [pending, setPending] = useState(false)
	const [message, setMessage] = useState("")

	const stop = async () => {
		if (!running || pending) return
		setPending(true)
		setMessage("")
		try {
			await apiFetch(`/api/time-entries/${running.id}/stop`, { method: "POST", body: "{}" })
			reload()
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Could not stop timer.")
		} finally {
			setPending(false)
		}
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
				{message ? <Status message={message} error /> : null}
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
							<button className="primary" type="button" disabled={pending} onClick={() => void stop()}>
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
	const { data: board, loading, error } = useApi<{ items: ShoppingListItem[] }>(
		"/api/shopping-list-items?view=board",
	)
	const data = shoppingPreview(board?.items ?? [])
	const items = data.items

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
						: data?.total
							? `${items.length} of ${data.total} active item(s).`
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
