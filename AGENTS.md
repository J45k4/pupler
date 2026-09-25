Pupler is a service for managing stuff

Read codingstyle.md for coding style guidelines.

## Architecture

- Build with bun and Bun.serve using routes.
- Main entrypoint is in ./src/main.ts and web frontend is in ./src/web folder.

## Testing

- Prefer tests for logic, calculations, data transformations, and API behavior.
- Avoid automated UI tests, including rendered HTML, DOM structure, CSS classes, UI text, and visual snapshots, unless explicitly requested. These tests are brittle when the UI changes.
- Verify UI changes through browser inspection when needed, without adding UI assertions to the test suite.
