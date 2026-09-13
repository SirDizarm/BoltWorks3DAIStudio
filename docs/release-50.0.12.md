# BWS 50.0.12

- Store installed plugin packages and enabled preferences together in IndexedDB, rather than competing with workspace saves for localStorage capacity.
- Migrate existing plugin state without deleting legacy storage records. Commit before changing active state; serialize writes and retain prior installation on failure.
- Update plugin and scene controls to wait for persistence.
