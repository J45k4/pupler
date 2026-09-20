# Puplerbar

Click **Open Pupler** in the menu to open your configured server in the default
browser. During setup, it opens the URL entered in the server field.

The menu's **Toolbar position** switch moves Puplerbar to **Left**, **Right**,
or **Before clock** (in the center section, immediately left of the clock).
Omarchy saves the placement immediately, preserving the other widgets and
Puplerbar settings. The highlighted option reflects the current bar layout.

Shows the current user's running timer and a locally updated elapsed time.
When no timer is running, click to open the menu, choose an active project
from the searchable selector, optionally enter a description, then click
**Start timer** (or press Enter in the description field). Projects belonging
to archived clients are hidden. Choose **+ New project**, enter a name and
click **Create project** (or press Enter) to create one directly in the menu.
The new project is automatically selected; click **Start timer** when ready.
The helper checks for an existing timer before starting another.

For a running timer, click **Stop timer** (or press Enter). Escape
closes the menu and R refreshes. Status polls every five seconds; failures
disable Stop and recover on the next successful poll. The helper checks the
displayed entry ID again before stopping, so a changed timer is not stopped.
Pupler requires a project before stopping; assign it in the Time page if needed.

Requires Omarchy's Quickshell plugin system and Bun on the shell's PATH.

1. Update Pupler with the included database migration (`bun run prisma:migrate:deploy`)
   and restart it. In **Settings → API keys**, create a key named `Omarchy toolbar`.
2. After installing, click **Set up Pupler** in the toolbar. Enter the server
   URL and paste the API key, then choose **Save and connect**. The key is
   checked before saving to `~/.config/pupler/omarchy.json` with permissions
   `600`. Right-click the widget to change the connection later. Revoked or
   invalid keys also open setup. You can alternatively create the file yourself:

   ```json
   {
       "baseUrl": "http://localhost:5995",
       "apiKey": "paste-the-new-key-here"
   }
   ```

   Use HTTPS for a remote server. The default timer belongs to the key's user.
   Set `"userId": null` for unassigned timers, or an explicit numeric user ID
   for another user's timer in Pupler's shared workspace. The config path can
   be overridden with `PUPLER_OMARCHY_CONFIG` in the shell environment.

3. From the repository root:

   ```sh
   mkdir -p ~/.config/omarchy/plugins
   ln -s "$(pwd)/omarchy" ~/.config/omarchy/plugins/puplerbar
   omarchy plugin validate ./omarchy
   omarchy-shell shell rescanPlugins
   omarchy plugin enable puplerbar --section right
   ```

If Bun is not on the desktop PATH, set `"bunPath": "/absolute/path/to/bun"`
in the widget's shell.json layout entry. Saved credentials take effect immediately.
Keys are never passed on the
command line or emitted in helper output.

To remove the widget: `omarchy plugin disable puplerbar`.
Revoke its key in Pupler Settings to remove API access.
