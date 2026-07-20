# BoltWorks 3D AI Studio

> Experimental preview: this application is under active development. Features may be incomplete and bugs can occur.

Current preview version: **v48.0.10**, with canonical feature modules for the toolbar, panels, viewport, meshes, rigging, import/export, plugins, and styling. GitHub Pages and the local adapter consume the same module sources.

## Local development source

`D:\Game\BoltWorks3DAIStudio` is the canonical local development repository. Make 3D Studio and bone/rig changes here, then commit and push this repository to publish the GitHub Pages version.

BoltWorks 3D AI Studio is the 3D modeling, AI-assisted model generation, bone placement, rigging, animation, scene-rendering, and export application in the BoltWorks tool family.

The 2D scene, sprite, asset, and Character Animator workflows live in the separate **BoltWorks 2D Studio** project.

## Run locally

```text
npm start
```

The primary document is `index.html`; canonical application logic lives under
`app/modules/`. The local adapter composes those files in memory, while
`npm run build:web` creates the static GitHub Pages artifact in `dist/`.

`index.html` can also be opened directly. It loads the generated classic bundle
`app/studio-v48.0.10.js`, so direct file opening does not depend on module CORS or a
running server. After editing files under `app/modules/`, run
`npm run build:studio` to refresh that bundle; `npm start` and `npm run check`
also refresh it automatically.
## License and rights

Copyright (c) 2026 Daniel Rydin.

Source code is licensed under the [Apache License 2.0](LICENSE). BoltWorks branding and visual assets are not part of that license grant; see [trademark policy](docs/legal/TRADEMARKS.md) and [asset license](docs/legal/ASSET-LICENSE.md).
