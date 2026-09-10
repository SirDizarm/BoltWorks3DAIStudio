# House Wall overlap correction - v49.64.30

House Wall now partitions the wall rectangle into non-overlapping timber and plaster sections. Rails and studs form a union rather than multiple overlapping boxes. Door/window voids are excluded from all sections. Adjacent same-material cells are merged where possible. Timber remains slightly deeper than plaster, but plaster no longer extends beneath its exterior top/side faces.

This addresses coincident exterior faces at the top rail, stud intersections and opening frame without polygon-offset rendering tricks. Parts remain closed editable box solids; internal touching faces are retained, not welded into a single manifold shell. Existing dimensions, colors, texture input and offsets remain supported. The partition changes part names/counts, so seed-based per-part texture assignments may differ after regeneration.

Refresh to v49.64.30 and Build / Update Geometry on the existing House Wall graph. Existing generated meshes are not rewritten until rebuilding. Baked/detached walls are not modified. Source app/modules/geometry-assets.js is synchronized with loaded studio-v49.64.30.js. No live visual test performed.
