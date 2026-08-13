# 09 — Verify release readiness

**What to build:** Produce releasable iOS and Android builds whose behavior, native packaging, permissions, privacy boundaries, and device reliability satisfy the Digger MVP acceptance criteria.

**Blocked by:** 08 — Apply the Digger wireframe and accessibility polish.

**Status:** ready-for-agent

- [ ] Deterministic app and native suites pass for supported records, response codes, malformed responses, cancellation, concurrency, timeout, retry, EDNS, and UDP-to-TCP fallback.
- [ ] Real-device acceptance passes on iOS and Android over Wi-Fi and cellular, with VPN/network-transition coverage and both IPv4 and IPv6 resolver scenarios.
- [ ] Repeated and concurrent Queries do not crash, cross-complete, reuse stale resolver state, or block the UI thread.
- [ ] iOS release builds include the required c-ares architectures, permission descriptions, and third-party notices.
- [ ] Android release bundles include supported native ABIs, required connectivity permissions, and third-party notices without unrelated permissions.
- [ ] Query content and complete DNS packets are absent from production logs, analytics, and remote uploads.
- [ ] Relaunch and storage inspection confirm that Results are not persisted and only allowed Recent Query fields remain on-device.
- [ ] Copy/share output, privacy text, version information, licenses, and Clear History work in release builds.
- [ ] Both platform builds meet the spec's functional parity requirements, allowing only documented differences in system server endpoint availability.
- [ ] Any release-blocking deviations from the spec are resolved or explicitly documented before the MVP is considered complete.
