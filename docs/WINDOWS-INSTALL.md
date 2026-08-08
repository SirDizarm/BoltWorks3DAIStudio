# BoltWorks 3D AI Studio Windows Install

This app can now be installed on Windows without requiring Python.

## Quick install

1. Open [`windows/Install-3D-Model-Studio.cmd`](../windows/Install-3D-Model-Studio.cmd)
2. It copies the studio into `%LocalAppData%\3DModelStudio`
3. It creates a desktop shortcut and Start Menu shortcut
4. It associates `.modelerproj` files with the launcher for the current user

## Update

- Double-click [`windows/Update-3D-Model-Studio.cmd`](../windows/Update-3D-Model-Studio.cmd)
- It refreshes the installed copy in `%LocalAppData%\3DModelStudio` with the latest workspace version

## Launch

- Double-click the desktop shortcut, or
- run `windows/Launch-3D-Model-Studio.ps1` from the installed studio folder.

## Rebuild after source changes

- Double-click [`windows/Rebuild-3D-Model-Studio.cmd`](../windows/Rebuild-3D-Model-Studio.cmd) in `D:\Game\BoltWorks3DAIStudio` any time `app/modules/*.js` or other source files change (for example after an AI assistant edits the source directly).
- It runs `npm run build:studio`, which regenerates the versioned bundle that `index.html` loads directly. `npm start` does not need this, since it composes the modules live.
- Run it before opening `index.html` directly or pushing to GitHub Pages, so the published version matches the edited source.

## Rebuild, check, and push in one click

- Double-click [`windows/Rebuild-And-Push-3D-Model-Studio.cmd`](../windows/Rebuild-And-Push-3D-Model-Studio.cmd) to do the full sequence with no typing: rebuild the bundle, commit the rebuilt bundle file if it changed, run `npm run check`, then `git push` to `origin/main` if there is anything new to send.
- It stops before committing/pushing if the rebuild or checks fail, so nothing broken goes to GitHub.
- It commits exactly one file itself: the versioned direct-open bundle (`app/studio-v<version>.js`), and only when that file actually changed. That bundle is a required build output the live site depends on, so it always needs to be in the same push as the source changes that produced it. It never stages or commits anything else — deciding which other source files belong in a push (and leaving out local-only test files) stays a separate, reviewed step.
- If there is nothing new to push, it says so and finishes without contacting GitHub.

## Stop the app

- Use the `Stop Server` button inside the studio toolbar
- It shuts down the local host and then tries to close the app tab/window

## Open a saved project

After installation, double-click a `.modelerproj` file and the launcher will start the local app host and queue that project into the studio.

## Uninstall

Run:

- [`windows/Uninstall-3D-Model-Studio.ps1`](../windows/Uninstall-3D-Model-Studio.ps1)
- or double-click [`windows/Uninstall-3D-Model-Studio.cmd`](../windows/Uninstall-3D-Model-Studio.cmd)

## Notes

- This is a lightweight Windows install path, not an MSI yet.
- It requires Node.js and starts the canonical local adapter on `http://127.0.0.1:4173`.
- The next step, if you want a more app-like package, would be a real desktop wrapper or MSI builder around this installed copy.
