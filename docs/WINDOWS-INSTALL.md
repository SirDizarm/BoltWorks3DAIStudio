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
