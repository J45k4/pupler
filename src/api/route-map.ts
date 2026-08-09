import { requireAdminUser, requireAuthenticatedUser } from "./auth"
import {
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

const wrapRoutes = <T extends ApiRouteMap>(
	routeMap: T,
	authorize?: Authorize,
) =>
	Object.fromEntries(
		Object.entries(routeMap).map(([path, handler]) => [
			path,
			withErrorHandling(async (req) => {
				await authorize?.(req)
				return (handler as RouteHandler)(req)
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
