# Copy selection priority - v49.64.38

Ctrl+C now copies triangles only in active face-pick mode with no multi-object transform selection. Mesh/group copying takes priority for multi-object selections, and old selectedFaces data does not switch normal mesh copying into triangle-patch copying.

Reported roof-tile project has four untextured curved panels plus a custom copied triangle patch; its texture library is empty. The supplied screenshot is consistent with overlapping surfaces, not a lost texture. Existing patches are not automatically removed. Intentional paste-in-place can still cause z-fighting until copies are moved apart.

panels.js and studio-v49.64.38.js synchronized. Bundle built; no live rendering validation performed. User project unchanged.
