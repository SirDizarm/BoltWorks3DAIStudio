# Project workflow rules

- Keep the canonical source modules and the versioned browser bundle synchronized for every source change.
- Before editing, identify the exact bundle loaded by `index.html` and state its version. The local direct-entry bundle is kept at the project root so the live app cannot lock the source output directory.
- Whenever the version changes, update every visible version label in `index.html` as well as its title, metadata, cache-busting query strings, and bundle script path. The index must always display the current version consistently.
- After editing, rebuild or update that exact bundle. If a running process locks it, do not silently leave the source and bundle divergent: report the locked filename, the source filename, and the exact rebuild step still required.
- In the final response, always name the source file, the loaded bundle filename, and whether both are synchronized.

- Every source, behavior, or corrective change must increment the app version, even when fixing a previous attempt. Document the change against that new version, update the visible version in index.html, and keep the loaded bundle filename synchronized so each build is unambiguous to test.
