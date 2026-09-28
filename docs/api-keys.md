# Personal API keys and Puplerbar

In **Settings → API keys**, each user can create named keys for their account
and revoke them individually. The full key appears only when created; Pupler
stores its SHA-256 hash. Send keys as `Authorization: Bearer <key>` to use
the owner's existing API permissions. Keys remain valid until revoked or the
owning account is deleted. Creating, listing and revoking keys requires a
browser session through `/api/auth/api-keys` (GET/POST) and
`/api/auth/api-keys/:id` (DELETE).

Apply database migrations and restart Pupler before using API keys.
The [Puplerbar Omarchy plugin](../omarchy/README.md) shows the current timer
and provides a menu action to stop it using a personal API key.
