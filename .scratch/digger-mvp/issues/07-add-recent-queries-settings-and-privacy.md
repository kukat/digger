# 07 — Add Recent Queries, Settings, and privacy controls

**What to build:** Provide useful on-device Query recall and transparent data controls without turning History into a Result archive.

**Blocked by:** 04 — Harden the cross-platform DNS engine.

**Status:** done

- [x] A valid Query is added to Recent Queries when native execution begins, regardless of whether it later returns a response or an error.
- [x] Each Recent Query stores only normalized name and record type; it never stores Result data, response code, timing, resolver, transport outcome, or error details.
- [x] Recent Queries are unique by normalized name and record type, ordered by most recent execution, and limited to 50 entries with the oldest removed first.
- [x] Selecting a Recent Query refills name and record type without executing it or replacing current resolver and Advanced settings.
- [x] A user can delete one Recent Query from History.
- [x] Settings offers Clear History and removes all Recent Queries after appropriate user confirmation.
- [x] Relaunching the app retains Recent Queries but does not restore any Result.
- [x] Privacy information states that Query data is not uploaded and Recent Queries remain on the device.
- [x] About displays the app version, open-source licenses, c-ares attribution, and applicable third-party notices.
- [x] Automated app workflow tests verify persistence boundaries, deduplication, ordering, capacity, refill, individual deletion, and clear-all behavior.

## Comments

Implemented local Recent Query persistence, History and Settings workflows, privacy/About disclosures, and app-workflow coverage.

Marked done. All acceptance tasks complete.
