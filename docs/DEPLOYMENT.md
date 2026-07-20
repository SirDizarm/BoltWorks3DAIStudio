# BoltWorks 3D AI Studio deployment

`BoltWorks3DAIStudio` is the canonical source for both local use and GitHub
Pages. Do not keep another editable copy of the studio inside a launcher or
server folder.

## Public deployment

GitHub Pages serves `dist/`, produced by `npm run build:web`. The build composes
the canonical files under `app/modules/` into `dist/app/studio.js` and copies
only browser assets. Server endpoints and Windows launchers are not present in
the Pages artifact.

Local server launchers, logs, caches, generated exports, dependency folders,
temporary files, and backup copies are not runtime web assets and should not be
published as part of the application.

## Optional local server

The separate sibling folder `BoltWorks3DLocalServer` contains only a launcher.
It starts `tools/server.mjs` from this repository. That adapter composes the
same `app/modules/` files in memory and owns the local-only `__ping`, shutdown,
and pending-project endpoints.

Expected layout:

```text
D:\Game\
  BoltWorks3DAIStudio\
  BoltWorks3DLocalServer\
```

This separation ensures that opening the local tool and opening the hosted tool
always loads the same studio source.

## Source-of-truth rule

All editor changes and version updates belong in `index.html`, `app/`, and the
browser assets in this repository. `dist/` is generated and ignored. A local
server helper may start the adapter but must never contain its own editor copy.
