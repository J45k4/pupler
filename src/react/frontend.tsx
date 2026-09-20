import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App"
import { AuthProvider } from "./auth"
import { installLinkInterceptor } from "./router"

installLinkInterceptor(document.body)

const elem = document.getElementById("root")!

const app = (
	<StrictMode>
		<AuthProvider>
			<App />
		</AuthProvider>
	</StrictMode>
)

if (import.meta.hot) {
	const root = (import.meta.hot.data.root ??= createRoot(elem))
	root.render(app)
} else {
	createRoot(elem).render(app)
}
