import { useEffect } from "react"
import { useAuth } from "./auth"
import { matchAnyRoute, navigate, usePath } from "./router"
import { Navbar } from "./Navbar"
import { LoginPage } from "./pages/Login"
import { TodosPage } from "./pages/Todos"
import { OverviewPage } from "./pages/Overview"
import { SettingsPage } from "./pages/Settings"
import { McpPage } from "./pages/Mcp"
import { ProductsPage } from "./pages/Products"
import { ProductDetailPage } from "./pages/ProductDetail"
import { ProductStatsPage } from "./pages/ProductStats"
import { GroupDetailPage } from "./pages/GroupDetail"
import { InventoryPage } from "./pages/Inventory"
import { ExpirationsPage } from "./pages/Expirations"
import { InventoryContainerDetailPage } from "./pages/InventoryContainerDetail"
import { InventoryItemDetailPage } from "./pages/InventoryItemDetail"
import { ReceiptsPage } from "./pages/Receipts"
import { ReceiptDetailPage } from "./pages/ReceiptDetail"
import { SpendingItemsPage, SpendingMonthlyPage, SpendingOverviewPage, SpendingPage } from "./pages/Spending"
import { ShoppingListsPage } from "./pages/ShoppingLists"
import { RecipeCreatePage, RecipeDetailPage, RecipesPage } from "./pages/Recipes"
import { TimeMonthlyPage, TimeOverviewPage, TimePage, TimeWeeklyPage } from "./pages/Time"
import { ClientDetailPage, ClientsPage } from "./pages/Clients"
import { ProjectsPage } from "./pages/Projects"
import { UsersPage } from "./pages/Users"
import { IntegrationsPage } from "./pages/Integrations"
import { ImportScheduleDetailPage, ImportSchedulesPage } from "./pages/ImportSchedules"
import { JobsPage } from "./pages/Jobs"

const BASE = "/react"

const link = (path: string) => (path === "/settings" || path === "/mcp/connections" || path === "/time" || path.startsWith("/time/") ? path : path === "/" ? BASE : `${BASE}${path}`)

const stripBase = (path: string) =>
	/^\/react\/(settings|mcp\/connections|time)(\/|$)/.test(path)
		? path
		: path === BASE || path === `${BASE}/`
		? "/"
		: path.startsWith(`${BASE}/`)
			? path.slice(BASE.length)
			: path

const ROUTES = ["/login", "/todos", "/settings", "/mcp/connections", "/users", "/integrations", "/import-schedules/:id", "/import-schedules", "/jobs", "/products/stats", "/products/:id", "/products", "/groups/:id", "/inventory", "/inventory/expirations", "/inventory/containers/:id", "/inventory/items/:id", "/receipts/:id", "/receipts", "/spending/overview", "/spending/monthly", "/spending/items", "/spending", "/shoppinglist", "/recipes/new", "/recipes/:id", "/recipes", "/clients/:id", "/clients", "/projects", "/time/overview", "/time/weekly", "/time/monthly", "/time", "/"]

export const App = () => {
	const rawPath = usePath()
	const path = stripBase(rawPath)
	const { user, loading, logout } = useAuth()

	const needsLogin = !loading && path !== "/login" && !user
	const needsHome = !loading && path === "/login" && !!user

	useEffect(() => {
		if (needsLogin) navigate(`${BASE}/login?redirect=${encodeURIComponent(path)}`)
	}, [needsLogin, path])

	useEffect(() => {
		if (needsHome) navigate(BASE)
	}, [needsHome])

	useEffect(() => {
		document.body.classList.remove("nav-open")
	}, [path])

	if (loading) return <main className="page-shell">Loading…</main>

	if (needsLogin || needsHome) {
		return <main className="page-shell">Redirecting…</main>
	}

	const match = matchAnyRoute(ROUTES, path)

	return (
		<>
			<Navbar currentPath={path} user={user} link={link} onLogout={logout} />
			<main className="page-shell page-shell--wide">
				{match?.pattern === "/login" ? <LoginPage link={link} navigate={navigate} /> : null}
				{match?.pattern === "/todos" ? <TodosPage /> : null}
				{match?.pattern === "/settings" ? <SettingsPage /> : null}
				{match?.pattern === "/mcp/connections" ? <McpPage /> : null}
				{match?.pattern === "/products" ? <ProductsPage link={link} /> : null}
				{match?.pattern === "/products/stats" ? <ProductStatsPage link={link} /> : null}
				{match?.pattern === "/products/:id" ? <ProductDetailPage id={match.params.id ?? ""} link={link} /> : null}
				{match?.pattern === "/groups/:id" ? <GroupDetailPage id={match.params.id ?? ""} link={link} /> : null}
				{match?.pattern === "/inventory" ? <InventoryPage link={link} /> : null}
				{match?.pattern === "/inventory/expirations" ? <ExpirationsPage link={link} /> : null}
				{match?.pattern === "/inventory/containers/:id" ? (
					<InventoryContainerDetailPage id={match.params.id ?? ""} link={link} navigate={navigate} />
				) : null}
				{match?.pattern === "/inventory/items/:id" ? <InventoryItemDetailPage id={match.params.id ?? ""} link={link} /> : null}
				{match?.pattern === "/receipts" ? <ReceiptsPage link={link} /> : null}
				{match?.pattern === "/receipts/:id" ? <ReceiptDetailPage id={match.params.id ?? ""} link={link} /> : null}
				{match?.pattern === "/spending" ? <SpendingPage link={link} /> : null}
				{match?.pattern === "/spending/overview" ? <SpendingOverviewPage link={link} /> : null}
				{match?.pattern === "/spending/monthly" ? <SpendingMonthlyPage /> : null}
				{match?.pattern === "/spending/items" ? <SpendingItemsPage link={link} /> : null}
				{match?.pattern === "/shoppinglist" ? <ShoppingListsPage link={link} /> : null}
				{match?.pattern === "/recipes" ? <RecipesPage link={link} /> : null}
				{match?.pattern === "/recipes/new" ? <RecipeCreatePage link={link} navigate={navigate} /> : null}
				{match?.pattern === "/recipes/:id" ? <RecipeDetailPage id={match.params.id ?? ""} link={link} /> : null}
				{match?.pattern === "/clients" ? <ClientsPage link={link} /> : null}
				{match?.pattern === "/clients/:id" ? <ClientDetailPage id={match.params.id ?? ""} link={link} /> : null}
				{match?.pattern === "/projects" ? <ProjectsPage link={link} /> : null}
				{match?.pattern === "/time" ? <TimePage link={link} /> : null}
				{match?.pattern === "/time/overview" ? <TimeOverviewPage link={link} /> : null}
				{match?.pattern === "/time/weekly" ? <TimeWeeklyPage link={link} /> : null}
				{match?.pattern === "/time/monthly" ? <TimeMonthlyPage link={link} /> : null}
				{match?.pattern === "/users" ? <UsersPage /> : null}
				{match?.pattern === "/integrations" ? <IntegrationsPage /> : null}
				{match?.pattern === "/import-schedules" ? <ImportSchedulesPage link={link} /> : null}
				{match?.pattern === "/import-schedules/:id" ? (
					<ImportScheduleDetailPage id={match.params.id ?? ""} link={link} />
				) : null}
				{match?.pattern === "/jobs" ? <JobsPage /> : null}
				{match?.pattern === "/" ? <OverviewPage link={link} /> : null}
				{!match ? (
					<section className="card panel">
						<p className="page-copy">Not found: {path}</p>
					</section>
				) : null}
			</main>
		</>
	)
}
