# Testing

Run the full suite with `bun test`. Tests start temporary Pupler servers and
SQLite databases; they do not use the installed service or its data.

For focused checks:

```sh
bun test test/punisher.test.ts
bun test test/mcp.test.ts
bun test test/api.test.ts test/e2e.test.ts
bun test test/migrations.test.ts
```

## Punisher security suite

`test/punisher.test.ts` is the security regression suite. Its main scope is
**authentication and authorization**: protected API routes and `/mcp` must reject
missing or invalid credentials across HTTP methods, and users must not gain
access to another user's time entries. It also checks that a browser session
cannot stand in for an MCP OAuth token or an upload link.

The suite covers related security boundaries: cross-origin browser mutations,
trusted public-origin configuration, safe image responses, and administrator-only
update checks. Public login, OAuth discovery, registration, and authorization
routes have different access rules, so they are not part of Punisher's
protected-route loop.

`/mcp/uploads/:token` uses a short-lived, single-use upload token rather than a
session or ordinary OAuth bearer token. Punisher checks that an invalid link is
rejected. `test/mcp.test.ts` tests the complete upload lifecycle, OAuth code and
refresh flows, scopes, revocation, and shopping-list viewer/editor permissions.

API and migration behavior live in `test/api.test.ts` and
`test/migrations.test.ts`; `test/e2e.test.ts` checks HTTP integration. Keep
automated tests focused on behavior and permissions. Inspect visual UI changes
in a browser instead of adding brittle DOM or screenshot assertions.
