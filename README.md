# Digger

Digger is a React Native app for running DNS Queries and inspecting the current Result.

## Development

Requirements follow the React Native environment setup for iOS and Android. This project uses React Native 0.87 and the New Architecture.

```sh
npm install
npm start
npm run ios       # after cd ios && bundle exec pod install
npm run android
```

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run test:native # requires Homebrew c-ares
npm run verify:release
(cd android && ./gradlew connectedDebugAndroidTest) # requires a device/emulator
```

## Native DNS

Both apps expose the shared C++ c-ares 1.34.5 DNS service through the typed `NativeDnsModule` TurboModule. They support cancellable A and AAAA Queries through the system resolver or a custom IPv4/IPv6 resolver and port, with UDP/TCP selection, truncation fallback, EDNS, DO, timeouts, retries, and classified failures.

The iOS build uses the pinned `c-ares.podspec`. iOS may ask for local-network access when the custom resolver is on the local network; allow it for those Queries.

The Android CMake build downloads the checksum-pinned c-ares release and packages the native module for every configured release ABI. At startup, Android supplies c-ares with `ConnectivityManager`, so each system Query uses the current network's resolver configuration.

Every Query gets a fresh c-ares channel, preventing later Queries from reusing stale resolver state after a network transition. Deterministic coverage, binary-size measurements, build requirements, and the physical-device verification matrix are recorded in [`docs/native-dns-spike.md`](docs/native-dns-spike.md). Signed release commands, packaging checks, and the remaining human release gate are documented in [`docs/release-readiness.md`](docs/release-readiness.md).

## App workflow seam

`App` accepts an optional `NativeDns` implementation. Production iOS builds use the native TurboModule; app tests inject deterministic responses and errors, so workflow tests never require network access. Deterministic native tests should likewise use a controlled DNS server rather than a public resolver.
