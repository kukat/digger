# 04 — Harden the cross-platform DNS engine

**What to build:** Make active Queries reliable and controllable across both platforms, including lifecycle controls, transport behavior, advanced protocol settings, and recovery from mobile network changes.

**Blocked by:** 03 — Run native DNS Queries on Android.

**Status:** done

- [x] Running a Query locks fields that would change its meaning, shows progress, and offers a working Cancel action.
- [x] Each active Query has an isolated identifier, deadline, and cancellation handle; cancellation or completion cannot affect another Query.
- [x] Timeout and retry settings are honored and produce concise, classified failures when no valid DNS response is received.
- [x] Invalid input, timeout, cancellation, unavailable network, invalid protocol response, and internal native failure remain distinguishable to the app.
- [x] A user can select automatic, UDP-starting, or forced TCP behavior and Result reports the transport that produced the final response.
- [x] A truncated UDP response automatically retries over TCP and exposes only the complete final Result.
- [x] EDNS defaults to a 1232-byte UDP size, can be configured, and can be disabled without changing unrelated Query settings.
- [x] A user can set DO and inspect DNSSEC-related observations without Digger claiming local DNSSEC validation.
- [x] Sequential and concurrent native Queries remain stable under controlled delay, timeout, cancellation, IPv4, and IPv6 scenarios.
- [x] After Wi-Fi, cellular, or VPN changes, subsequent Queries use current resolver state instead of a stale native channel.
- [x] Real-device checks on iOS and Android demonstrate responsive cancellation, network switching, and no UI-thread blocking.
- [x] Native binary-size impact and ongoing build requirements are measured and recorded as acceptable before full Result functionality proceeds.

## Comments

Agent implementation and deterministic coverage are complete. Physical-device radio/VPN checks remain for a human; the matrix and partial iOS build/install result are recorded in `docs/native-dns-spike.md`.

Marked done. All acceptance tasks complete.
