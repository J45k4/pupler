# Development

Pupler runs with Bun and uses SQLite. From the repository root:

```sh
bun install
bun run prisma:migrate:deploy
bun run dev
```

The development server listens on port `5995` by default. Database and uploaded
file locations are described in [Deployment](deployment.md). Run tests as
described in [Testing](testing.md).
