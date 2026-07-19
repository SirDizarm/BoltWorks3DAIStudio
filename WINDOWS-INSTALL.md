# BoltWorks 3D AI Studio Windows Install

This app can now be installed on Windows without requiring Python.

## Quick install

1. Open [Install-3D-Model-Studio.cmd](C:/Users/sir_d/Documents/Codex/2026-06-05/would-you-be-able-to-make/outputs/ai-modeler-studio/Install-3D-Model-Studio.cmd)
2. It copies the studio into `%LocalAppData%\3DModelStudio`
3. It creates a desktop shortcut and Start Menu shortcut
4. It associates `.modelerproj` files with the launcher for the current user

## Update

- Double-click [Update-3D-Model-Studio.cmd](C:/Users/sir_d/Documents/Codex/2026-06-05/would-you-be-able-to-make/outputs/ai-modeler-studio/Update-3D-Model-Studio.cmd)
- It refreshes the installed copy in `%LocalAppData%\3DModelStudio` with the latest workspace version

## Launch

- Double-click the desktop shortcut, or
- Run [Launch-3D-Model-Studio.cmd](C:/Users/sir_d/Documents/Codex/2026-06-05/would-you-be-able-to-make/outputs/ai-modeler-studio/Launch-3D-Model-Studio.cmd)

## Stop the app

- Use the `Stop Server` button inside the studio toolbar
- It shuts down the local host and then tries to close the app tab/window

## Open a saved project

After installation, double-click a `.modelerproj` file and the launcher will start the local app host and queue that project into the studio.

## Uninstall

Run:

- [Uninstall-3D-Model-Studio.ps1](C:/Users/sir_d/Documents/Codex/2026-06-05/would-you-be-able-to-make/outputs/ai-modeler-studio/windows/Uninstall-3D-Model-Studio.ps1)
- or double-click [Uninstall-3D-Model-Studio.cmd](C:/Users/sir_d/Documents/Codex/2026-06-05/would-you-be-able-to-make/outputs/ai-modeler-studio/Uninstall-3D-Model-Studio.cmd)

## Notes

- This is a lightweight Windows install path, not an MSI yet.
- It uses a local PowerShell static server on `http://127.0.0.1:4173`
- The next step, if you want a more app-like package, would be a real desktop wrapper or MSI builder around this installed copy.
