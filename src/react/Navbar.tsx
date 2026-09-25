import { useEffect, useMemo, useRef, useState } from "react"
import type { AuthUser } from "./auth"
import { mountAppVersion } from "../web/update-widget"

export type NavEntry = {
	href: string
	label: string
	group: string
	keywords?: string
}

export const navigationEntries: NavEntry[] = [
	{ href: "/clients", label: "Clients", group: "Time", keywords: "customers" },
	{ href: "/inventory/expirations", label: "Expirations", group: "Inventory", keywords: "expires food" },
	{ href: "/inventory", label: "Inventory", group: "Inventory", keywords: "stock storage containers" },
	{ href: "/spending/items", label: "Receipt Items", group: "Spending", keywords: "recent purchases search product store category" },
	{ href: "/spending/monthly", label: "Monthly Spending", group: "Spending", keywords: "month chart" },
	{ href: "/time/monthly", label: "Monthly Time", group: "Time", keywords: "month time report" },
	{ href: "/recipes/new", label: "New Recipe", group: "Cooking", keywords: "create recipe" },
	{ href: "/", label: "Overview", group: "Activity", keywords: "home dashboard" },
	{ href: "/products", label: "Products", group: "Catalog", keywords: "barcode product lookup" },
	{ href: "/products/stats", label: "Product Stats", group: "Catalog", keywords: "bought used usage table" },
	{ href: "/projects", label: "Projects", group: "Time", keywords: "work project clockify" },
	{ href: "/receipts", label: "Receipts", group: "Spending", keywords: "purchases receipt" },
	{ href: "/recipes", label: "Recipes", group: "Cooking", keywords: "meals" },
	{ href: "/settings", label: "Settings", group: "Settings", keywords: "password account" },
	{ href: "/integrations", label: "Integrations", group: "Settings", keywords: "clockify imports external" },
	{ href: "/import-schedules", label: "Import Schedules", group: "Settings", keywords: "clockify schedules imports cadence" },
	{ href: "/jobs", label: "Jobs", group: "Settings", keywords: "background jobs imports history" },
	{ href: "/users", label: "Users", group: "Settings", keywords: "accounts administrators permissions" },
	{ href: "/shoppinglist", label: "Shopping List", group: "Planning", keywords: "shopping groceries" },
	{ href: "/spending", label: "Spending Breakdown", group: "Spending", keywords: "categories costs" },
	{ href: "/spending/overview", label: "Spending Overview", group: "Spending", keywords: "money report" },
	{ href: "/time/overview", label: "Time Overview", group: "Time", keywords: "time report" },
	{ href: "/time", label: "Timer", group: "Time", keywords: "time tracking start timer" },
	{ href: "/todos", label: "Todos", group: "Planning", keywords: "tasks" },
	{ href: "/time/weekly", label: "Weekly Time", group: "Time", keywords: "week time report" },
]

const activeEntry = (currentPath: string, entries: NavEntry[]) =>
	entries.find((entry) => currentPath === entry.href) ??
	entries.find(
		(entry) => entry.href !== "/" && currentPath.startsWith(`${entry.href}/`),
	) ??
	entries[0]!

const isActiveHref = (currentPath: string, href: string) =>
	href === "/" ? currentPath === href : currentPath === href || currentPath.startsWith(`${href}/`)

export const Navbar = ({
	currentPath,
	user,
	link,
	onLogout,
}: {
	currentPath: string
	user: AuthUser | null
	link: (path: string) => string
	onLogout: () => void
}) => {
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState("")
	const [accountOpen, setAccountOpen] = useState(false)
	const menuRef = useRef<HTMLDivElement>(null)
	const triggerRef = useRef<HTMLButtonElement>(null)
	const searchRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		if (!user) return
		return mountAppVersion()
	}, [user?.id, user?.is_admin])

	const entries = useMemo(
		() => (user?.is_admin ? navigationEntries : navigationEntries.filter((e) => e.href !== "/users")),
		[user?.is_admin],
	)
	const active = activeEntry(currentPath, entries)
	const resultsRef = useRef<HTMLDivElement>(null)
	const normalized = query.trim().toLowerCase()
	const visible = entries.filter(
		(entry) =>
			!normalized ||
			`${entry.label} ${entry.group} ${entry.keywords ?? ""}`.toLowerCase().includes(normalized),
	)

	useEffect(() => {
		if (open) {
			searchRef.current?.focus()
			searchRef.current?.select()
		} else {
			setQuery("")
		}
	}, [open ])

	useEffect(() => {
		if (!open) return
		const onOutsideClick = (event: MouseEvent) => {
			if (!(event.target instanceof Node)) return
			if (menuRef.current?.contains(event.target)) return
			if (triggerRef.current?.contains(event.target)) return
			setOpen(false)
		}
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false)
		}
		const onTypeAhead = (event: KeyboardEvent) => {
			const target = event.target
			if (
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				(target instanceof HTMLElement && target.isContentEditable)
			) {
				return
			}
			if (event.ctrlKey || event.metaKey || event.altKey) return
			if (event.key.length === 1) {
				event.preventDefault()
				setQuery((q) => q + event.key)
				searchRef.current?.focus()
			} else if (event.key === "Backspace") {
				event.preventDefault()
				setQuery((q) => q.slice(0, -1))
				searchRef.current?.focus()
			}
		}
		document.addEventListener("click", onOutsideClick)
		document.addEventListener("keydown", onKey)
		document.addEventListener("keydown", onTypeAhead)
		return () => {
			document.removeEventListener("click", onOutsideClick)
			document.removeEventListener("keydown", onKey)
			document.removeEventListener("keydown", onTypeAhead)
		}
	}, [open ])

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "j") {
				event.preventDefault()
				setOpen((v) => !v)
			}
		}
		document.addEventListener("keydown", onKey)
		return () => document.removeEventListener("keydown", onKey)
	}, [])

	useEffect(() => {
		setOpen(false)
	}, [currentPath])

	const label = user ? (user.username ?? user.name) : null

	return (
		<header className="site-header">
			<div className="site-header__inner">
				<a className="brand" href={link("/")} data-link="">
					<span className="brand__badge">Pupler</span>
				</a>
				{user ? (
					<div className="navigation-hub">
						<button
							ref={triggerRef}
							id="navigation-hub-trigger"
							className="navigation-hub__trigger"
							type="button"
							aria-haspopup="dialog"
							aria-expanded={String(open)}
							aria-controls="navigation-hub-menu"
							onClick={() => setOpen((v) => !v)}
						>
							<img src="/favicon.png" alt="" aria-hidden="true" className="navigation-hub__logo" />
							<span className="navigation-hub__label">{active.label}</span>
						</button>
						<div
							ref={menuRef}
							id="navigation-hub-menu"
							className={`navigation-menu card${visible.length === 0 ? " navigation-menu--empty" : ""}`}
							hidden={!open}
						>
							<input
								ref={searchRef}
								id="navigation-menu-search"
								className="navigation-menu__search"
								type="search"
								placeholder="Search or jump to a page"
								autoComplete="off"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "ArrowDown" || e.key === "ArrowUp") {
										e.preventDefault()
										const links = Array.from(
											resultsRef.current?.querySelectorAll<HTMLAnchorElement>("a.navigation-menu__result") ?? [],
										)
										if (!links.length) return
										if (e.key === "ArrowDown") links[0]?.focus()
										else links[links.length - 1]?.focus()
										return
									}
									if (e.key !== "Enter") return
									const firstVisible = visible[0]
									if (firstVisible) {
										window.location.assign(link(firstVisible.href))
										setOpen(false)
									}
								}}
							/>
							<div className="navigation-menu__section-title">Pages</div>
							<div
								ref={resultsRef}
								id="navigation-menu-results"
								className="navigation-menu__results"
								onKeyDown={(e) => {
									if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
									if (!(e.target instanceof HTMLAnchorElement)) return
									e.preventDefault()
									const links = Array.from(
										resultsRef.current?.querySelectorAll<HTMLAnchorElement>("a.navigation-menu__result") ?? [],
									)
									const current = links.indexOf(e.target)
									if (current === -1) return
									const next =
										e.key === "ArrowDown"
											? links[(current + 1) % links.length]
											: links[(current - 1 + links.length) % links.length]
									next?.focus()
								}}
							>
								{visible.map((entry) => (
									<a
										key={entry.href}
										className={`navigation-menu__result${isActiveHref(currentPath, entry.href) ? " navigation-menu__result--active" : ""}`}
										href={link(entry.href)}
										data-link=""
										data-navigation-entry=""
										onClick={() => setOpen(false)}
									>
										<span className="navigation-menu__result-mark" aria-hidden="true">
											{entry.label.slice(0, 1)}
										</span>
										<span>
											<strong>{entry.label}</strong>
											<small>{entry.group}</small>
										</span>
									</a>
								))}
							</div>
						</div>
					</div>
				) : null}
				{currentPath !== "/login" ? (
					!user ? (
						<a className="account-login" href={link("/login")} data-link="">
							Login
						</a>
					) : (
						<div className={`account-menu${accountOpen ? " account-menu--open" : ""}`}>
							<button
								className="account-menu__trigger"
								type="button"
								aria-haspopup="true"
								aria-expanded={String(accountOpen)}
								onClick={() => setAccountOpen((v) => !v)}
								onBlur={(e) => {
									if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) {
										setAccountOpen(false)
									}
								}}
							>
								{label}
							</button>
							<div className="account-menu__dropdown" hidden={!accountOpen}>
								<div className="account-menu__username">{label}</div>
								<a className="account-menu__link" href={link("/settings")} data-link="" onClick={() => setAccountOpen(false)}>
									Settings
								</a>
								<a className="account-menu__link" href={link("/integrations")} data-link="" onClick={() => setAccountOpen(false)}>
									Integrations
								</a>
								<button className="account-menu__logout" type="button" onClick={() => void onLogout()}>
									Logout
								</button>
							</div>
						</div>
					)
				) : null}
			</div>
		</header>
	)
}
