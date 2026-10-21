# Mobile fetch behavior and validation

Measured on 2026-10-21 against the original v0.0.18 source and the updated local
production build. These changes have not been deployed to pupler.dy.fi.

## Fetch changes

| Area | Change |
| --- | --- |
| Initial app | Minify release assets; precompress JavaScript and CSS; serve gzip with encoding negotiation, immutable caching and conditional requests. |
| Page navigation | Share concurrent GETs, reuse fresh reads for 15 seconds, show cached data during refresh and abort reads when their last consumer leaves. Clear private memory data on account changes and successful mutations. |
| Shopping lists | Fetch active items and removed counts; load removed history only when opened. Apply mutation results locally and sync durable changes in the background. |
| Overview | Request the running timer and a bounded eight-item shopping preview instead of complete histories. |
| Monthly and weekly reports | Fetch all day summaries in one bounded request instead of one request per day. Fetch editor options when editing. |
| Timer | Retain existing 50-entry pagination; reload entries after timer changes without repeatedly reloading clients and projects. Save recent timer data and mutations on the device. |
| Receipt detail | Include each row's referenced product in its detail response instead of downloading the complete product catalogue. Existing receipt cursor pagination remains in place. |
| Inventory detail | Load link-selector catalogues when the user opens Edit links. Viewing item properties needs one API request. |
| Authentication | Resolve the user once per request, while checking authentication again on each new request. |

## Chrome slow-network results

Used headless Chromium 154.0.8037.97, a 390 × 844 mobile viewport, and Chrome
DevTools Protocol network simulation: 800 ms latency, 400 kbps download and
100 kbps upload. Login ran before throttling. The cold-page comparison disabled
the browser HTTP cache and service workers; offline preparation still ran in the
updated app. This separates network performance from the offline shell cache.

Both builds used isolated SQLite fixtures containing 5,001 time entries, 1,240
shopping items (1,200 removed), 300 products, 1,000 receipts and 3,000 receipt rows.
These are single-run local measurements, not live deployment timings.
The table records the first optimized candidate. The later revision without
schema changes adds one small session-preparation GET before each new sync batch;
that adds a network round trip before server confirmation. Local edits still
appear immediately. These exact timings have not been remeasured for that revision.

| Interaction | Before | After |
| --- | --- | --- |
| Cold shopping page usable | 43.4 s / 2.00 MB transferred | 8.6 s / 249 KB transferred, including offline preparation |
| Previous monthly report | 4.9 s / 30 API calls | 2.3 s / 1 API call |
| Return to shopping | 9.4 s / 2 API calls | 0.08 s / 0 API calls |
| Add shopping item visible | 9.9 s | 0.15 s, with background sync confirmed in about 1.2 s |
| Mark item bought | About 398 KB transferred | About 0.5 KB transferred; both versions already update the checkbox immediately |
| Inventory detail background fetches | 4 API calls / 774 KB | 1 API call / about 0.5 KB |

Inventory properties were visible in about 1.3 seconds in both builds. The
improvement removes the subsequent catalogue downloads. Opening the link editor
still transfers about 774 KB, and explicitly opening the fixture's 1,200 removed
shopping items transfers about 386 KB. Neither large read happens on initial view.

## Offline and regression validation

Headless Chrome verified timer start, ticking, stop, original device timestamps,
and offline reloads. Shopping checks covered list creation and item addition,
checking, unchecking, removal and restoration across an offline reload.

The reconnect test deliberately dropped the first sync response after the server
committed all nine changes. Retrying the same operation IDs produced one timer
entry, one list and one item. A timer changed by another device remained intact;
the phone's conflict stayed queued while an independent shopping change synced.
Discarding that conflict restored the server timer. Offline logout survived a
reload, another account could not access or replay the saved work, and signing
back into the original account resumed its queue. Mobile screenshots were also
inspected. There were no browser JavaScript errors.

The revised candidate without database schema changes passed 198 regression tests.
Focused offline and compression tests and the production binary smoke test also
passed after the final changes. TypeScript
reports the same 56 existing errors as the original source, with no new errors.

See [offline usage](offline.md) for device storage, synchronization and recovery.
The later [deployment readiness pass](deployment-readiness.md) covers all main
pages, editing workflows, upgrade behavior and additional recovery fixes.
