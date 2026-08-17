# Digger MVP

Status: done

## Problem Statement

People who need to inspect DNS from a phone must often choose between command-oriented tools that are difficult to use on a small screen and simplified lookup apps that hide the protocol details needed for diagnosis. They need a compact mobile tool that makes a Query easy to construct while still exposing the complete current Result, including response sections, flags, response code, timing, server, transport, and message size.

Users also need confidence that their DNS names and responses remain private. Digger should retain only enough information to rerun a recent Query and must not turn Results into a persistent history or upload query data.

## Solution

Build Digger as an iOS and Android application using React Native 0.87, a C++ TurboModule, and c-ares. A user constructs a Query from a name, record type, resolver, transport, and optional settings. Digger validates the Query, runs it without blocking the interface, and presents the current Result either as a polished structured view or generated `dig`-style text.

The Result will expose complete DNS response sections and useful metadata while treating DNS response codes as valid responses rather than transport failures. Users can cancel an active Query and copy or share the selected Result representation. Digger will store up to 50 unique Recent Queries, consisting only of normalized name and record type, so a prior Query can refill the form without preserving or automatically rerunning its Result.

The product will follow the existing Digger wireframe: Query, History, and Settings are primary tabs, while Result is pushed from Query and remains ephemeral.

## User Stories

1. As a mobile DNS user, I want to enter a DNS name, so that I can inspect its records.
2. As a mobile DNS user, I want to select an A record, so that I can inspect IPv4 addresses.
3. As a mobile DNS user, I want to select an AAAA record, so that I can inspect IPv6 addresses.
4. As a mobile DNS user, I want to select a CNAME record, so that I can inspect aliases.
5. As a mobile DNS user, I want to select an MX record, so that I can inspect mail routing.
6. As a mobile DNS user, I want to select a TXT record, so that I can inspect text-based policy and verification data.
7. As a mobile DNS user, I want access to NS, SOA, PTR, SRV, CAA, HTTPS, and SVCB record types, so that I can perform less common diagnostic lookups.
8. As a mobile DNS user, I want common record types visible without opening another screen, so that routine Queries are quick.
9. As a mobile DNS user, I want uncommon record types grouped behind a More action, so that the Query form remains compact.
10. As a mobile DNS user, I want an IP address entered for PTR to become the appropriate reverse-mapping name, so that reverse lookups are convenient.
11. As a mobile DNS user, I want invalid names and settings rejected before network activity begins, so that mistakes are clear and actionable.
12. As a mobile DNS user, I want Digger to treat input as a DNS name rather than guessing a hostname from a URL, so that the Query remains explicit.
13. As a mobile DNS user, I want to use the system resolver by default, so that a normal Query reflects my device's current network configuration.
14. As a network troubleshooter, I want to specify a custom DNS server and port for the current Query, so that I can compare resolver behavior.
15. As a mobile DNS user, I want custom resolver settings to remain part of the current form rather than a managed server collection, so that the MVP stays simple.
16. As a network troubleshooter, I want to choose automatic, UDP-starting, or forced TCP transport, so that I can diagnose transport-specific behavior.
17. As a network troubleshooter, I want a truncated UDP response to retry over TCP, so that I receive a complete Result.
18. As a network troubleshooter, I want the Result to show the transport actually used, so that fallback is visible.
19. As a network troubleshooter, I want EDNS enabled by default with a 1232-byte UDP size, so that modern DNS responses work reliably on typical networks.
20. As a network troubleshooter, I want to change the EDNS UDP size, so that I can investigate message-size behavior.
21. As a DNSSEC-aware user, I want to set the DO bit, so that I can request DNSSEC-related records without being told that Digger validated them.
22. As a mobile DNS user, I want to configure timeout and retry values, so that I can balance responsiveness and unreliable networks.
23. As a mobile DNS user, I want resolver, transport, EDNS, DO, timeout, and retry settings grouped under Advanced, so that the primary form remains focused.
24. As a mobile DNS user, I want useful Advanced defaults, so that a normal Query requires only a name and record type.
25. As a mobile DNS user, I want to start a Query with one prominent action, so that the primary workflow is obvious.
26. As a mobile DNS user, I want fields that alter request semantics locked while a Query is active, so that the displayed request cannot diverge from the one being executed.
27. As a mobile DNS user, I want visible progress while a Query is active, so that I know Digger is working.
28. As a mobile DNS user, I want to cancel an active Query, so that I am not forced to wait for its timeout.
29. As a mobile DNS user, I want cancellation to complete promptly and leave the app responsive, so that failed network conditions do not trap me.
30. As a mobile DNS user, I want multiple sequential Queries to run reliably, so that I can continue troubleshooting without restarting the app.
31. As a mobile DNS user, I want Digger to remain responsive during DNS work, so that native lookup and parsing never block the UI thread.
32. As a mobile DNS user, I want a successful DNS response shown as a Result, so that I can inspect the protocol response.
33. As a network troubleshooter, I want NXDOMAIN, SERVFAIL, and REFUSED shown as DNS Results, so that response codes are not confused with network failures.
34. As a mobile DNS user, I want timeout, cancellation, unreachable network, invalid response, and internal native failures shown as concise error states, so that I understand why no DNS Result exists.
35. As a network troubleshooter, I want to see the response code, so that I can quickly classify the Result.
36. As a network troubleshooter, I want to see response flags, so that I can inspect recursion, authority, truncation, and DNSSEC-related observations.
37. As a network troubleshooter, I want to see Question, Answer, Authority, and Additional sections, so that no important response section is hidden.
38. As a network troubleshooter, I want empty response sections to display their record counts, so that absence is explicit.
39. As a network troubleshooter, I want to see the Result's elapsed time and wire size, so that I can assess response performance and size.
40. As a network troubleshooter, I want to see the actual server endpoint when the platform can provide it, so that I know which resolver answered.
41. As a mobile DNS user, I want to see “System resolver” when an endpoint cannot be identified reliably, so that the app does not fabricate precision.
42. As a network troubleshooter, I want supported records rendered with their record-specific fields, so that structured output is useful rather than opaque.
43. As a network troubleshooter, I want an unknown record to retain its type number and hexadecimal RDATA, so that newer record types are not silently discarded.
44. As a mobile DNS user, I want to switch between Structured and `dig` views of the same Result, so that I can choose readability or familiar diagnostic text.
45. As a command-line DNS user, I want familiar `dig`-style sections and metadata, so that mobile output is easy to interpret.
46. As a command-line DNS user, I want the app to describe its text as `dig`-style rather than byte-for-byte BIND output, so that formatting differences are not misleading.
47. As a mobile DNS user, I want to copy the currently selected Result view, so that I can paste it into another tool or conversation.
48. As a mobile DNS user, I want to share the currently selected Result view, so that I can send diagnostic information through the platform share sheet.
49. As a mobile DNS user, I want Structured copy/share output to be human-readable text, so that recipients do not need Digger.
50. As a mobile DNS user, I want `dig` copy/share output to include the complete generated text, so that the shared diagnostic context is preserved.
51. As a privacy-conscious user, I want the current Result discarded when I leave it, so that Results do not become a hidden archive.
52. As a returning user, I want the Query form retained when I return from Result, so that I can adjust and rerun it.
53. As a returning user, I want a valid started Query added to Recent Queries even if it later returns an error, so that I can retry it.
54. As a privacy-conscious user, I want a Recent Query to contain only its name and record type, so that responses, errors, resolver choices, and timings are not retained.
55. As a returning user, I want Recent Queries deduplicated by normalized name and record type, so that History does not fill with repeats.
56. As a returning user, I want a repeated Recent Query moved to the top, so that the latest work remains easiest to access.
57. As a returning user, I want at most 50 Recent Queries retained, so that local storage remains bounded.
58. As a returning user, I want the oldest Recent Query removed when the limit is exceeded, so that the most recent entries remain available.
59. As a returning user, I want tapping a Recent Query to refill name and record type without executing it, so that I can review the Query first.
60. As a returning user, I want refilling from History to preserve the current resolver and Advanced settings, so that History does not unexpectedly alter network behavior.
61. As a returning user, I want to delete one Recent Query, so that I can remove an unwanted entry.
62. As a privacy-conscious user, I want to clear all Recent Queries from Settings, so that I control retained local data.
63. As a privacy-conscious user, I want Digger to explain that Query data is not uploaded and Recent Queries remain on-device, so that its data handling is clear.
64. As a mobile user, I want Query, History, and Settings as stable primary tabs, so that navigation is predictable.
65. As a mobile user, I want Result opened from Query rather than presented as another tab, so that it is clearly tied to the current Query.
66. As a mobile user, I want Digger to follow the supplied compact visual design, so that technical depth does not make the app feel cluttered.
67. As an iOS user, I want the same core Query and Result behavior as Android users, so that platform choice does not change the product.
68. As an Android user, I want the same core Query and Result behavior as iOS users, so that platform choice does not change the product.
69. As a mobile user, I want Digger to react to Wi-Fi, cellular, and VPN changes, so that a later Query does not reuse an obsolete resolver.
70. As a user of a local-network custom resolver, I want platform permission requirements explained and handled, so that local DNS access succeeds when permitted.
71. As a mobile user, I want About to show the app version, so that I can identify the build I am using.
72. As a mobile user, I want open-source licenses and third-party notices available, so that Digger discloses c-ares and other dependencies.
73. As a privacy-conscious user, I want logs to avoid complete sensitive DNS packets, so that diagnostics do not undermine the app's privacy promise.

## Implementation Decisions

- The MVP targets both iOS and Android with React Native 0.87 using the New Architecture, a typed TurboModule boundary, a shared C++ DNS service, and c-ares. Digger will not execute `dig`, pass shell command strings, or parse command output.
- The React Native layer owns navigation, Query form state, validation presentation, Result presentation, generated `dig`-style formatting, Recent Query persistence, copy/share behavior, and Settings content.
- The native layer owns Query lifecycle, deadlines, retries, cancellation, c-ares channel management, DNS packet construction and parsing, transport selection, server endpoint reporting, elapsed time, and wire size.
- The TurboModule contract accepts a caller-generated cancellation identifier and a typed Query containing name, record type, resolver mode, transport, timeout, retries, DO setting, and optional EDNS UDP size. Cancellation addresses the active operation by that identifier.
- The cancellation identifier is an application lifecycle token and must not be represented as the DNS transaction ID. Generated `dig`-style text may omit a transaction ID unless the parsed DNS response explicitly exposes the real protocol value.
- Resolver mode is explicit: system resolver or custom address and port. The native Result reports the server actually used when that information is reliable; otherwise the UI displays “System resolver.”
- Transport supports automatic, UDP-starting, and forced TCP behavior. Any Query that starts over UDP retries over TCP when the DNS response is truncated. Result transport reports the transport that produced the final response.
- Query defaults are system resolver, automatic transport, EDNS enabled with UDP size 1232, DO disabled, a three-second timeout per attempt, and one retry. The MVP does not persist alternative defaults.
- Supported record types are A, AAAA, CNAME, MX, TXT, NS, SOA, PTR, SRV, CAA, HTTPS, and SVCB. The parser preserves unknown record types as a numeric type and hexadecimal RDATA rather than dropping them.
- The parser retains the DNS response code, flags, Question, Answer, Authority, and Additional sections. It provides structured record values suitable for both visual rendering and deterministic text formatting.
- NOERROR, NXDOMAIN, SERVFAIL, REFUSED, and other received DNS response codes produce a Result. Failures before a valid response are classified as invalid input, timeout, cancellation, network unavailable, protocol parsing failure, or internal native failure.
- DNSSEC behavior is observational only. Digger can request DNSSEC data using DO and display flags or records such as AD and RRSIG, but it does not claim to perform local DNSSEC validation.
- The Query form gives prominence to name, record type, and Run Query. Resolver, transport, EDNS, DO, timeout, and retries remain in a collapsible Advanced area.
- PTR input accepts an IP address and converts it to the correct reverse-mapping name. Other record types accept DNS names and do not extract hostnames from URLs.
- A Query is added to Recent Queries after validation succeeds and native execution begins, regardless of whether execution yields a DNS response or an error.
- Recent Queries are local-only records containing normalized name and record type. They are unique on that pair, ordered by most recent execution, limited to 50, and remove the oldest item when the limit is exceeded.
- Selecting a Recent Query navigates to Query and refills only name and record type. It neither runs the Query nor changes resolver or Advanced settings.
- Result is ephemeral navigation state. Returning to Query retains the form but discards the Result; no response, response code, timing, resolver, transport outcome, or error is persisted.
- Structured and `dig` views are projections of the same Result object. The text formatter never reparses rendered UI or native command output.
- Copy and Share operate on the selected view. Structured output becomes human-readable plain text; `dig` output uses the complete generated text. JSON, raw packet, and file export are not offered.
- The primary navigation contains Query, History, and Settings. Result is pushed from Query and is not a primary tab.
- The visual implementation follows the supplied wireframe's compact hierarchy, restrained palette, grouped cards, segmented Result control, and mobile-first layout while using accessible native controls and platform conventions.
- Native work runs away from the UI thread. Each active Query has a unique identifier, deadline, and cancellation handle, and concurrent Queries cannot complete into the wrong caller.
- c-ares integration constructs and parses complete DNS packets rather than relying only on address lookup convenience APIs, preserving protocol metadata and all four response sections.
- Network changes invalidate resolver/channel state. Subsequent Queries use the current Wi-Fi, cellular, or VPN network rather than a stale resolver configuration.
- iOS integrates c-ares for device and simulator architectures, registers the C++ TurboModule through Objective-C++, executes DNS work on a dedicated queue, observes network changes, and supplies the required local-network usage description for applicable custom resolvers.
- Android integrates c-ares and the C++ module with the NDK and CMake for supported release ABIs, initializes c-ares with Android connectivity services, declares Internet and network-state permissions, observes default network changes, and packages native libraries for app-bundle delivery.
- The native implementation begins with a focused spike proving A/AAAA Queries, system and custom resolvers, UDP/TCP behavior, timeout, cancellation, IPv6, concurrency, network switching, and acceptable binary-size/build costs on real iOS and Android devices before the full MVP proceeds.
- Privacy is enforced by architecture: no application service uploads Query content, Results are not persisted, Recent Queries remain on-device, and production logging does not record complete packets or sensitive full response content.

## Testing Decisions

- Good tests assert externally observable behavior at the highest practical seam. They verify what a user sees or what the typed native contract returns, not component internals, private helper calls, c-ares implementation details, or incidental state shape.
- The primary app workflow seam renders the React Native application with an injectable `NativeDns` implementation, isolated Recent Query storage, and controlled copy/share adapters. Through this seam, tests exercise Query validation, defaults, Advanced settings, loading, cancellation, response and error presentation, navigation, Structured/`dig` switching, copy/share, History behavior, and clearing local data.
- The primary native seam invokes the C++ DNS service through its public contract against a controllable DNS server. It verifies complete structured Results, supported and unknown record handling, response codes, flags and sections, custom resolver routing, IPv4/IPv6 endpoints, EDNS, timeout, cancellation, concurrency, malformed responses, and UDP-to-TCP fallback.
- A controlled DNS server and owned authoritative test zone provide deterministic responses for NOERROR, NXDOMAIN, SERVFAIL, REFUSED, truncation, delayed responses, malformed compression pointers, unknown records, and each supported record type. Public resolvers are supplementary smoke coverage only and never the basis of deterministic tests.
- The generated `dig`-style formatter receives fixed Result fixtures and uses snapshot or golden assertions for stable, readable output. Structured and text views are also checked against the same fixture to prevent semantic drift.
- Recent Query tests verify local-only fields, normalization-based deduplication, most-recent ordering, the 50-item limit, single deletion, clear-all behavior, and refill without automatic execution or Advanced-setting replacement.
- Packet codec golden tests are permitted below the primary seam for safety-critical edge cases that are difficult to diagnose through the full service, including compressed names, malformed compression loops, truncation, unknown RDATA, and boundary lengths. These tests assert parsed protocol behavior rather than mirroring implementation steps.
- Minimal integration tests verify that the generated TurboModule binding preserves typed Query and Result values, propagates classified errors, and routes cancellation to the correct active Query.
- Device smoke tests cover real iOS and Android builds, native library loading, system and custom resolvers, cancellation responsiveness, repeated and concurrent Queries, IPv4 and IPv6 DNS servers, UDP/TCP behavior, and absence of UI-thread blocking.
- The device matrix covers Wi-Fi, cellular, and VPN transitions on iOS and Android, including a Query after each transition to ensure stale resolver state is not reused. Android coverage includes the minimum supported API level and representative modern versions.
- Release checks verify required permissions and privacy strings, app-bundle/native ABI packaging, open-source notices, and the absence of persisted Results or sensitive packet logging.
- Platform parity is evaluated from shared acceptance scenarios: equivalent Queries produce semantically equivalent Results and error classes on iOS and Android, allowing only platform-specific differences in the discoverability of the system server endpoint.
- The repository currently has no implementation or prior test suite. The two agreed seams—the app workflow seam and native DNS contract seam—establish the initial testing conventions; lower-level tests should be added only where those seams cannot provide precise, deterministic coverage.

## Out of Scope

- Recursive trace behavior equivalent to `dig +trace`.
- Local DNSSEC signature or chain-of-trust validation.
- DNS-over-HTTPS and DNS-over-TLS.
- AXFR, TSIG, dynamic DNS updates, and authoritative server administration.
- A device-wide DNS proxy, VPN, or traffic interception capability.
- Executing or embedding BIND `dig`, accepting shell command syntax, or promising byte-for-byte identical output.
- Persisting, searching, favoriting, syncing, or exporting Results.
- Saving resolver profiles, favorite DNS servers, or persistent Query defaults.
- JSON, raw packet, or file export.
- Automatically parsing URLs to infer DNS names.
- Uploading telemetry that contains Query names or complete DNS responses.
- Preemptive architecture or UI for post-MVP protocols and diagnostic modes.

## Further Notes

- The existing technical plan is the source for detailed MVP behavior and delivery phases.
- The Digger design wireframe is available at `docs/wireframe/digger-wireframe.html` and should guide visual hierarchy and navigation rather than be treated as pixel-perfect production code.
- The repository uses the domain terms Query, Result, and Recent Query. A Result is never a history entry or saved result.
- There are currently no ADRs affecting this feature.
- The native spike is a delivery gate: proceed with c-ares as the shared core only after cancellation, concurrency, network switching, packet coverage, binary size, and build maintenance are acceptable on both platforms.
