# Deployment readiness — 2026-10-21

The local Linux release candidate passed the checks below. The live deployment
has not been changed. Tests used packaged production servers, isolated databases
and synthetic data. The original comprehensive pass used `readiness-test`.
The revised candidate, `readiness-no-db`, removes the offline operation table and
needs no schema changes or new migrations; its follow-up validation is recorded below.

## Browser coverage

Headless Chromium 154.0.8037.97 tested desktop (1440 × 1000) and phone
(390 × 844) layouts. Phone interaction and recovery tests also enabled mobile
and touch emulation. The slow-network profile was 800 ms latency, 400 kbps
download and 100 kbps upload.

| Coverage | Passing checks |
| --- | ---: |
| All 34 main pages at desktop and phone widths | 68 |
| All 34 main pages at phone width under slow-network simulation | 34 |
| Application create/edit/delete workflow groups | 11 |
| Timer editing, projectless stop, start again, quick actions and pagination | 3 |
| Product, inventory and recipe editing and image uploads/removals | 3 |
| Storage failures, server failures, permission changes, session expiry and browser shutdown | 5 |
| Multiple tabs, quota errors, stale responses, historical entries and refreshed timer versions | 6 |
| Upgrade from v0.0.18, verified backup, repeat migrations and server restart | 2 |
| Fresh visit, offline installation and first disconnected reload under slow networking | 1 |
| Phone toolbar/table containment and access to rightmost table controls | 3 |
| Loading indicators finish after page data arrives | 5 |

All 141 checks in this original matrix passed with no browser JavaScript errors. Workflow
groups contain multiple actions and persistence checks; these counts are not a
claim that every possible user-input combination was tested.

The page matrix covers overview, locations, todos, settings, MCP connections,
users, integrations, import schedules, jobs, products and statistics, group
detail, inventory and container/item details, receipt browsing/detail, spending
views, shopping lists, recipes/create/detail, clients/detail, projects, and all
three time-report views plus the timer. Workflow checks additionally cover
schedule detail and passkey invitation pages.

Workflow groups exercised client/project editing, archiving and project merging;
receipt pictures, pagination, date filters and grouping; product and recipe
creation; inventory consumption and container management; todo completion,
archival, restoration and sharing-style card controls; shopping viewer/editor
roles and personal hiding; report editing and calendar range creation; API-key
creation/revocation and password changes; user management and passkey login;
Clockify configuration, schedules and job updates; and location/track editing.

## Offline recovery and data preservation

Timer and shopping changes were verified across offline reloads and reconnects.
A persistent Chrome profile retained **64 queued changes** across a full browser
shutdown and restart, then synced them in multiple batches without duplicates.
This included 60 shopping items and timer/manual-entry changes.

A separate test discarded the first sync response after the server committed
the changes. Retrying the original operation IDs created one timer entry, one
list and one item. Original timer timestamps were preserved. Timer conflicts
remained available for review while independent shopping changes continued to
sync. Pending work could be downloaded as JSON and explicitly discarded.

Other checks covered revoked editor permissions, HTTP 503 retries, expired
sessions, offline logout, signing into a different account, quota failures,
multiple tabs competing for the sync lock, and late GET responses arriving after
a successful write. None of these checks lost confirmed pending work.

The upgrade test ran the original v0.0.18 server against its original schema,
saved data through its browser UI, then used the new packaged migrator with a
backup. The backup and upgraded database both passed SQLite integrity checks;
5,001 time entries and the pre-upgrade shopping change were retained. Repeating
the migration twice made no further changes. The existing browser session and
queued offline work also survived the upgrade and a server restart.

## Issues found and fixed during this pass

- Stale overview/editor snapshots could cause false timer conflicts, including
  after the phone had refreshed a change made by another device.
- Historical entries outside the latest 50 needed a saved base version before
  editing; reports also needed to refresh after background sync completed.
- A product picture uploaded after an initial missing-picture response remained
  hidden until a page reload.
- Blocked browser storage could cause unhandled errors; unavailable sync locks
  needed retries, and other tabs needed notification after changes synced.
- Phone-width product controls and wide tables could overflow the page. Tables
  now scroll inside their containers, and the product toolbar wraps.
- Several pages kept displaying their initial loading message after data arrived.
- Offline installation downloaded the application script a second time. It now
  reuses the browser's cached assets; a fresh-visit network capture confirmed one
  application-script download instead of two.

## Follow-up: unchanged database schema

Offline sync now uses bounded server-memory receipts. The phone saves the server
session and exact request before sending each batch. Lost acknowledgements can
be retried while those receipts remain available. If the server restarts or
receipt history rotates, uncertain attempted changes remain on the phone for
review, rather than risking duplicate creates. Never-sent work can sync normally.
Acknowledged dependencies are remapped on the phone, so later batches do not
need old server receipts. This mode is intended for one server process.

`prisma/schema.prisma`, `src/migrations.ts` and all migration files match the
original checkout. No `offline_operations` table is created or required.

The revised production build passed **19 browser workflow groups**, covering:

| Follow-up coverage | Passing groups |
| --- | ---: |
| Storage/HTTP failures, permission changes, expired sessions and 64 changes across browser shutdown | 5 |
| Multiple tabs, quotas, stale reads, historical reports and refreshed timer versions | 6 |
| Original v0.0.18 schema, unchanged migration count, backup and never-sent work across restart | 2 |
| No operation table, lost confirmation followed by server restart, and dependent timer batches across restart | 3 |
| Timer editing, manual entries, projectless stop, quick actions and pagination | 3 |

The eight interrupted-connection/offline scenarios described above also passed
again under the slow-network profile. No browser JavaScript errors occurred.
One initial lifecycle run timed out waiting for an authentication request to
settle; a complete rerun passed all six groups without application changes.
The temporary request tracker now clears abandoned requests on page navigation.

The restart test verified that an already committed item was not created twice
after its response was lost, even when Retry was pressed after restart. The
uncertain device copy remained downloadable, while a new independent item synced.
A separate 51-change test restarted the server between two acknowledged batches;
the timer start/stop timestamps and all 49 shopping items were preserved.
Upgrade checks retained 5,001 time entries and the same **17 migrations** on both
sides, with no offline operation table in either database.

## Regression and package checks

- Latest `bun test`: **198 passed, 0 failed**, 4,152 assertions across 22 files.
- Focused offline regression tests passed, including the newly reproduced cache
  version and historical-entry cases.
- Production build and standalone smoke test passed: migration, backup, admin
  creation, login, HTML, JavaScript, CSS and favicon.
- TypeScript retains the same **56 existing diagnostics** as the original source;
  no new diagnostics were introduced. The complete type check is not green.
- `git diff --check` passed. Mobile screenshots were inspected, including offline
  status, conflict recovery and horizontal table controls.

Temporary browser scripts, final JSON results, screenshots and logs are under
`/tmp/pupler-browser-check/`. The final result files are in `readiness-pages`,
`readiness-slow-pages`, `workflows-all`, `readiness-time`, `readiness-uploads`,
`advanced-offline`, `lifecycle`, `upgrade`, `first-visit`, `layout-final` and
`loading-final`. Interrupted-sync results are in `offline-results.json`.
The revised candidate's results are in `no-db-advanced-offline`,
`no-db-lifecycle`, `no-db-upgrade`, `no-db-restart-guard` and
`no-db-readiness-time`, with an aggregate in `no-db-validation-results.json`.

## Deployment boundary

This validates the local Linux production build in Chromium. Passkey browser
tests used a Chrome virtual authenticator; Clockify tests used a local fixture
server. Physical phones, Safari/iOS, real Clockify credentials and release builds
for other operating systems were not verified in this pass.

Use the existing installer/updater for its backup and normal migration checks.
This candidate adds no migrations and runs against the existing v0.0.18 schema.
Release CI and a smoke check through the production HTTPS origin remain part of
deployment validation.
