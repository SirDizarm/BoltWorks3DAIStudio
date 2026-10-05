# v50.0.58 — dismissible startup and recovery errors

- Distinguish a missing application script from a workspace recovery failure and show the failed script URL.
- Add Close and Escape dismissal, retaining an unobtrusive button to reopen error details and retry.
- Release pointer lock and pointer capture on opening; prevent gameplay recapture while the dialog is open, including focus return.
- Preserve recovery records and restore markers. Closing the dialog does not discard or replace saved content.
- Synchronize the source, version labels, and rebuilt `studio-v50.0.58.js` bundle.
