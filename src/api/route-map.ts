import { requireAdminUser, requireAuthenticatedUser } from "./auth"
import { resolvePublicOrigin } from "../config"
import {
	HttpError,
	withErrorHandling,
	type BunRouteHandler,
	type RouteHandler,
} from "./core"

type ApiHandler = RouteHandler | BunRouteHandler
type ApiRouteMap = Record<string, ApiHandler>
type WrappedRoutes<T extends ApiRouteMap> = {
	[Path in keyof T]: RouteHandler
}

type Authorize = (req: Request) => Promise<unknown>

const publicOrigin = resolvePublicOrigin()

const requireSameOriginMutation = (req: Request) => {
	if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return
	const origin = req.headers.get("origin")
	if (origin && origin !== (publicOrigin ?? new URL(req.url).origin)) throw new HttpError(403, "Cross-origin requests are not allowed")
	if (req.headers.get("sec-fetch-site") === "cross-site") throw new HttpError(403, "Cross-site requests are not allowed")
}

const wrapRoutes = <T extends ApiRouteMap>(
	routeMap: T,
	authorize?: Authorize,
) =>
	Object.fromEntries(
		Object.entries(routeMap).map(([path, handler]) => [
			path,
			withErrorHandling(async (req) => {
				requireSameOriginMutation(req)
				await authorize?.(req)
				const response = await (handler as RouteHandler)(req)
				if (!response.headers.has("Cache-Control")) response.headers.set("Cache-Control", "no-store")
				return response
			}),
		]),
	) as WrappedRoutes<T>

export const createApiRoutes = <
	PublicRoutes extends ApiRouteMap = Record<never, never>,
	AuthenticatedRoutes extends ApiRouteMap = Record<never, never>,
	AdminRoutes extends ApiRouteMap = Record<never, never>,
>(routeGroups: {
	public?: PublicRoutes
	authenticated?: AuthenticatedRoutes
	admin?: AdminRoutes
}) => {
	const publicRoutes = routeGroups.public ?? ({} as PublicRoutes)
	const authenticatedRoutes =
		routeGroups.authenticated ?? ({} as AuthenticatedRoutes)
	const adminRoutes = routeGroups.admin ?? ({} as AdminRoutes)

	return {
		...wrapRoutes(publicRoutes),
		...wrapRoutes(authenticatedRoutes, requireAuthenticatedUser),
		...wrapRoutes(adminRoutes, requireAdminUser),
	} as WrappedRoutes<PublicRoutes> &
		WrappedRoutes<AuthenticatedRoutes> &
		WrappedRoutes<AdminRoutes>
}
