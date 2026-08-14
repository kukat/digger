# 09 — Verify release readiness

**What to build:** Produce releasable iOS and Android builds whose behavior, native packaging, permissions, privacy boundaries, and device reliability satisfy the Digger MVP acceptance criteria.

**Blocked by:** 08 — Apply the Digger wireframe and accessibility polish.

**Status:** ready-for-human

- [x] Deterministic app and native suites pass for supported records, response codes, malformed responses, cancellation, concurrency, timeout, retry, EDNS, and UDP-to-TCP fallback.
- [ ] Real-device acceptance passes on iOS and Android over Wi-Fi and cellular, with VPN/network-transition coverage and both IPv4 and IPv6 resolver scenarios.
- [x] Repeated and concurrent Queries do not crash, cross-complete, or reuse stale resolver state in deterministic native and app suites; UI-thread responsiveness remains a device check.
- [x] An iOS arm64 Release archive includes c-ares, the local-network usage description, and in-app third-party notices.
- [x] An Android Release AAB includes arm64-v8a, armeabi-v7a, x86, and x86_64 native libraries; its permission allowlist contains only Internet and network-state access, and notices are in-app.
- [x] Query content and complete DNS packets are absent from first-party production logs, analytics, and remote-upload paths by static release verification.
- [x] Relaunch and storage tests confirm that Results are not persisted and only allowed Recent Query fields remain on-device.
- [x] Copy/share output, privacy text, version information, licenses, and Clear History are covered by app workflow tests; release-device confirmation remains part of the matrix.
- [ ] Both platform builds meet the spec's functional parity requirements, allowing only documented differences in system server endpoint availability.
- [x] Release-blocking deviations and their human verification matrix are explicitly documented in `docs/release-readiness.md`.

## Comments

Implemented release signing/packaging commands and static release verification. `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, `npm run test:native`, and `npm run verify:release` pass. A throwaway-key Android Release AAB was built and verified to contain every configured ABI; an unsigned iOS arm64 Release archive passed store validation. Production signing and the device Wi-Fi/cellular/VPN matrix remain deliberate human release gates; see `docs/release-readiness.md`.
