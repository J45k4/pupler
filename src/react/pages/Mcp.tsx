import { ConnectedApps } from "../ConnectedApps"

export const McpPage = () => (
	<section className="workspace workspace--single mcp-page">
		<div className="page-heading">
			<div>
				<h1 className="page-title">MCP</h1>
				<p className="page-copy">Manage the apps you have connected to Pupler through MCP.</p>
			</div>
		</div>
		<ConnectedApps />
	</section>
)
