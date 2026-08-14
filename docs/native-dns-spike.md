# Native DNS spike results

Recorded for issue 04 on 2026-08-14. The comparison baseline is app-foundation commit `7de432f`, before c-ares and the native DNS module were added.

## Automated behavior matrix

`npm run test:native` runs the shared public `DnsService` contract against loopback DNS servers. The same scenarios are compiled into Android debug instrumentation coverage.

| Area | Deterministic coverage |
| --- | --- |
| Address families | Custom resolver endpoints and A/AAAA Results over IPv4 and IPv6 |
| Lifecycle | Sequential Queries, concurrent Queries, isolated cancellation, controlled delay, and per-Query deadlines |
| Timeout/retry | Exact configured attempt count, timeout classification, and successful retry after a dropped packet |
| Transport | UDP-starting, forced TCP, and truncated-UDP fallback to a complete TCP Result |
| EDNS/DNSSEC | EDNS disabled, configurable UDP size, DO on OPT, no accidental CD flag, and observable AD response flag |
| Failures | Invalid input, timeout, cancellation, unavailable resolver, and malformed protocol response |
| Resolver freshness | Two sequential Queries through different resolver endpoints using one service instance |

Each Query creates its own c-ares channel. No system resolver channel is cached between Queries. On Android, a new channel asks the process-wide c-ares Android integration (backed by `ConnectivityManager`) for current DNS configuration. On iOS, a new channel reloads current system resolver configuration. Consequently, a Query started after a Wi-Fi, cellular, or VPN transition does not inherit an old channel. An already-active Query is not migrated between networks.

The JavaScript workflow tests additionally cover field locking, progress, immediate cancellation, stale-completion suppression, Advanced settings, and classified error presentation.

## Binary-size measurement

Release builds were made from the same machine and React Native dependency cache. Sizes are raw bytes unless shown otherwise.

### Android release APK

The APK contains all four configured ABIs; Play app bundles deliver only the matching ABI to a device.

| Artifact | Foundation baseline | Native DNS build | Delta |
| --- | ---: | ---: | ---: |
| APK | 64,348,542 | 65,848,038 | +1,499,496 (+2.33%) |
| `libappmodules.so`, arm64-v8a | 754,984 | 1,153,640 | +398,656 |
| `libappmodules.so`, armeabi-v7a | 550,312 | 829,804 | +279,492 |
| `libappmodules.so`, x86 | 731,252 | 1,131,432 | +400,180 |
| `libappmodules.so`, x86_64 | 761,888 | 1,171,016 | +409,128 |

The installed per-device native impact is about 0.28–0.41 MB because only one ABI is delivered.

### iOS release simulator

The simulator executable is universal, so thin architecture measurements are included.

| Artifact | Foundation baseline | Native DNS build | Delta |
| --- | ---: | ---: | ---: |
| Universal executable | 4,211,016 | 4,945,720 | +734,704 |
| Thin arm64 executable | 2,081,096 | 2,455,352 | +374,256 |
| Thin x86_64 executable | 2,111,448 | 2,471,888 | +360,440 |
| Uncompressed `.app` | 42,720 KiB | 43,444 KiB | +724 KiB (+1.69%) |

The measured increase is accepted for the MVP: less than 0.5 MB for a device architecture and less than 2.5% for the measured aggregate packages.

## Ongoing build requirements

- c-ares is checksum/tag pinned at 1.34.5 on both platforms.
- iOS compiles the pinned pod sources during `bundle exec pod install` / Xcode builds; no runtime framework is added.
- Android requires the repository's configured NDK and CMake. Its first configure downloads the checksum-pinned c-ares source; subsequent builds use Gradle/CMake caches.
- Host contract tests require Homebrew c-ares. This is test-only and is not linked into either mobile artifact.
- Release builds completed for iOS Simulator and all Android release ABIs after the hardening work.

These requirements and measured size are acceptable for continuing the MVP.

## Physical-device matrix

The following checks require human control of radios/VPN and remain a release gate. Do not substitute public-resolver automation for them.

| Check | iOS | Android |
| --- | --- | --- |
| Build/install native library | Build and install succeeded on an iPhone 17; launch was blocked because the attached phone was locked | Pending; no Android device or emulator was attached |
| Cancel a black-holed Query promptly; UI remains interactive | Pending | Pending |
| Repeated and concurrent IPv4/IPv6 custom Queries | Pending | Pending |
| Truncated UDP fallback and forced TCP | Pending | Pending |
| Query after Wi-Fi → cellular → Wi-Fi | Pending | Pending |
| Query before/after VPN connect and disconnect | Pending | Pending |
| Scroll/type/switch tabs during a delayed Query to confirm no UI-thread blocking | Pending | Pending |

For each run, record OS/device, resolver endpoint, observed transport, cancellation latency, and whether the post-transition Result used the expected network. Do not capture complete DNS packets or sensitive Query names in the record.
