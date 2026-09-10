# Release privacy cleanup - v49.64.61

Removed machine-specific account paths from helper scripts. Browser helpers resolve Playwright through BWS_PLAYWRIGHT or a locally installed playwright package; no dependency is installed by this change. Unreviewed local images and embedded-image projects are excluded from this release and remain on disk. Automated credential-pattern scanning is not a guarantee that every possible secret can be detected. Public product credits remain unchanged.
