# 02 — Run native DNS Queries on iOS

**What to build:** Replace the simulated path on iOS with real A and AAAA Queries through the typed TurboModule, shared C++ DNS service, and c-ares, supporting both system and custom resolvers.

**Blocked by:** 01 — Build the Digger app foundation.

**Status:** ready-for-agent

- [ ] A user can run A and AAAA Queries against the iOS system resolver and see a real Result in the existing workflow.
- [ ] A user can supply a valid custom IPv4 or IPv6 resolver address and port for the current Query.
- [ ] The native contract accepts typed Query values and returns typed response code, flags, DNS sections, elapsed time, wire size, transport, and optional server endpoint values.
- [ ] When iOS cannot reliably identify the system server endpoint, Result reports that it used the system resolver rather than inventing an address.
- [ ] DNS work runs away from the UI thread and repeated Queries leave the application responsive.
- [ ] c-ares is available in supported iOS device and simulator builds, with local-network access described when required for a custom resolver.
- [ ] Deterministic native contract tests use controlled DNS responses rather than depending on a public resolver.
