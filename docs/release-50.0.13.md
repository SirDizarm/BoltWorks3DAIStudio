# BWS 50.0.13

- Extract Image to Mesh algorithms and UI into a separate optional package; the new editor no longer bundles the reconstruction generator. Legacy remains unchanged.
- API 3 validates returned mesh geometry before explicit insertion. AI referenceMatch.createMesh requires the installed, enabled plugin.
- Shared image helpers remain for other tools; tools/image-to-mesh is development-only, not bundled.
- Functional and visual tests pending. BWS not published.
