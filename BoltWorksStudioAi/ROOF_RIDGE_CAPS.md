# Rounded ridge caps - v49.64.41

Roof nodes now default to Rounded ridge caps. Ridge tile length controls segment spacing. Each cap is a closed-thickness half-round shell with a tapered socket; successive pieces overlap along the main ridge. Radius adapts to roof column width within a bounded range. Caps use the Roof node material and seeded roof-color variation. Disable the option to restore the previous straight ridge strip.

Existing curved-roof batch presets adopt the caps when rebuilt. This change adds the horizontal ridge caps only, not hip junctions or the sloped verge tiles also visible in the reference. No photo textures used.

geometry-building.js synchronized with studio-v49.64.41.js and index version labels. Bundle built; no live visual checks performed.
