# Local editor bundle

The local server builds and serves the studio bundle named in index.html.
Previously it rebuilt app/studio-v49.64.7.js while the editor loaded a different
root-level bundle. That allowed source fixes to build successfully without
appearing in the running editor.

Restart the server after source edits. The active studio bundle is served from
the server's compiled source with cache-control: no-store. The old app-level URL
remains an alias for compatibility.

MCP scene summary includes a rig report: active skin ID, bone count, timeline
frame, scene attachment, duplicate skin IDs and sampled vertex displacement.
Use an explicit matching MCP URL and session token when several servers run.
Nonzero displacement confirms evaluated skin motion, not visual rig quality.
