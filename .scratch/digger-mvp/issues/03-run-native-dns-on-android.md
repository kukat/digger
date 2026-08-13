# 03 — Run native DNS Queries on Android

**What to build:** Bring the real native Query workflow to Android using the same typed contract and shared C++ DNS behavior established on iOS.

**Blocked by:** 02 — Run native DNS Queries on iOS.

**Status:** ready-for-agent

- [ ] A user can run A and AAAA Queries against the Android system resolver and see a real Result.
- [ ] A user can run the same Queries against a valid custom IPv4 or IPv6 resolver and port.
- [ ] Android and iOS return semantically equivalent Results and error categories for the same controlled DNS response.
- [ ] c-ares receives the Android connectivity integration required to use the current network's resolver configuration.
- [ ] Internet and network-state access are declared without requesting unrelated permissions.
- [ ] Native libraries build and load for the supported Android release ABIs.
- [ ] Deterministic Android native contract tests cover system-facing integration and controlled custom-resolver responses without relying on public DNS availability.
