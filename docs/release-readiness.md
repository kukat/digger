# Release readiness

Ship from a local signing-capable Mac to App Store Connect and Google Play:

```sh
npm run verify:release
npm run bump:patch    # or bump:minor / bump:major / bump:build
# commit the three version files, then:
npm run release:android
npm run release:ios
```

`bump:*` updates `package.json`, Android `versionName`/`versionCode`, and iOS `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION` together. Use `bump:build` when a store rejects the binary and the marketing version must stay the same. Both store scripts re-run `verify:release` before compiling.

`npm run verify:release` checks the version alignment, iOS privacy and local-network declarations, Android's permission allowlist and release ABI configuration, c-ares pin, visible notices, local-only Recent Query storage boundary, and absence of first-party logging/upload APIs at the Query/Result boundary. It complements (but does not replace) the deterministic suites:

```sh
npm run typecheck
npm run lint
npm test -- --runInBand
npm run test:native
npm run verify:release
```

## Signed artifacts

Release credentials are deliberately not stored in the repository. Copy [`.envrc.example`](../.envrc.example) to `.envrc`, fill in the values, and run `direnv allow`. Android release tasks refuse to run without a non-debug keystore.

```sh
npm run release:android
```

The command produces `android/app/build/outputs/bundle/release/app-release.aab` and verifies that it includes `arm64-v8a` and `x86_64` native libraries only.

For iOS, use a signing-capable Mac with the Digger App ID and distribution profile available through automatic signing:

```sh
npm run release:ios
```

The command archives and exports `build/release/ipa/Digger.ipa`. It requires a real Apple Developer team, so it is intentionally not run by the repository's deterministic checks.

Upload the signed artifacts to TestFlight and the Play internal track:

```sh
asc publish testflight --app "$DIGGER_IOS_APP_ID" --ipa "./build/release/ipa/Digger.ipa" --upload-only --wait --output json
gpc releases upload android/app/build/outputs/bundle/release/app-release.aab --track internal --app me.cyao.digger
```

## Human release gate

The following cannot be inferred from source or simulated by the host suite and must be recorded against the candidate build before shipment. Use non-sensitive test names and do not attach packets or Result text.

| Scenario | iOS | Android |
| --- | --- | --- |
| Install the signed release artifact and launch | required | required |
| System and custom IPv4/IPv6 resolver Query | required | required |
| Repeated and concurrent Queries; cancel a black-holed Query | required | required |
| UDP truncation fallback and forced TCP | required | required |
| Query after Wi-Fi → cellular → Wi-Fi | required | required |
| Query before/after VPN connect and disconnect | required | required |
| Type, scroll, and change tabs during a delayed Query | required | required |
| Copy/share, privacy text, version, notices, and Clear History | required | required |
| Relaunch and inspect storage: only name/type Recent Queries persist | required | required |

The device, OS version, build identifier, network transition, resolver address class (without sensitive Query content), observed Result/error class, and cancellation latency should be recorded for each row. The system resolver endpoint may be unavailable on one platform; this is the only accepted parity difference.

## Current release-blocking deviations

No signed candidate or real-device matrix result is checked into this repository. Signing credentials, physical devices, cellular service, and VPN control are intentionally external to source control. Until the signed artifacts and every row in the human release gate are recorded, this MVP is **not approved for release**.
