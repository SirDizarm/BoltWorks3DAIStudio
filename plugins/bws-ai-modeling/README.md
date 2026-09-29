# BWS AI Modeling plugin

This optional plugin owns the AI-facing BoltWorksConnect tool catalog. BWS does not expose the Connect AI control unless this package is installed and enabled.

Install `plugin.bwsplugin` from BWS **Plugins > Install from file**, review its AI edit permissions, then enable it. Disable or remove it to disconnect and remove the AI tools.

The package is declarative: it contains tool names, descriptions, access levels, and mappings to BWS's validated editor operations. It does not execute downloaded JavaScript and cannot bypass BWS validation, revision checks, undo history, or connection consent.

Shell fusion is limited to 8 source objects and 40,000 total source triangles per call. AI clients must inspect scene triangle counts and combine larger models in staged groups.
AI shell fusion uses a frame-yielding surface path so BoltWorksConnect can continue servicing connection heartbeats while geometry is processed.

The broader target API and acceptance criteria are recorded in `SPEC.md`. Version 1 exposes operations already implemented by BWS; future operations belong in this plugin contract after the corresponding safe engine capability exists.
