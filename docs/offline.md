# Timer and shopping lists offline

Sign in while connected and let Pupler finish loading before using it offline.
Pupler saves the app, timer, projects, clients and shopping lists on that device.
HTTPS is required outside localhost for the offline app cache.

You can start and stop timers, edit saved time entries, create shopping lists,
add items, mark them bought, remove them and restore them without a connection.
Timer timestamps come from the moment you act on the phone, including when the
browser is closed and reopened before syncing. Existing projects are available
offline; creating projects, sharing lists and changing permissions require a
connection. Older timer pages and removed-item history are available after
opening those pages online. Items removed on this device can be restored offline.

Changes are saved in the browser before the UI confirms them. The navbar sync
indicator and timer display update from that saved copy immediately, including when the
browser reports that it is online but network requests stall. The overview and
timer page share the same saved timer state. Late responses cannot replace a
newer local action.

Open time reports also update their entry rows, durations and project/client
totals from queued edits. Reloading a report while connected applies unsynced
edits over its server data; discarding unsent changes restores the previous view.

The navbar sync indicator shows pending changes without moving the page. Tap it
to see saved changes and retry, download or discard unsynced work. Pupler syncs
automatically when the connection returns or the app becomes visible. The app does not need to stay open while offline;
reopen it to sync. Each change has an identifier, and the server keeps a bounded
retry history in memory. Retrying an interrupted connection against the same
server session returns the previous result without duplicating a timer, list or item.

If a send fails, the navbar shows an error. Open it for details and Retry sync.
Connection and server failures retain the device copy and retry automatically;
the error clears after a successful sync. Expired sign-ins ask you to sign in again,
and conflicts stay available for review. Error status is shared between open tabs
of the same account.

This version needs **no database schema changes or new migrations**. Pending
changes and their exact attempted requests are stored in the browser's IndexedDB.
The server's retry history is lost on restart and rotates after 10,000 operations
or 32 MiB of saved responses. If a previously attempted change is still unconfirmed
when that history disappears, Pupler keeps it for review instead of automatically
sending it again. Check the saved timers or shopping items from another device,
download the pending copy if needed, then discard or re-enter it as appropriate.
Retry does not bypass this protection. Changes that have never been sent can
sync normally after a server restart. Run a single server process for this mode.

If another device changes a timer, Pupler keeps the phone's pending work for
review instead of overwriting the server timer. Shopping changes can still sync.
The sync dropdown lets you retry, download a copy or explicitly discard
unsynced changes. Shared-list permissions are checked again during sync.

Saved data and pending changes belong to the signed-in account. Logging out
prevents its queue from syncing; sign in as the same account to continue. Browser
storage is the device's copy: clearing site data removes unsynced changes. Keep
the device clock accurate so offline timer durations are correct.
