# Nitro Modules vs. Pure C++ TurboModule for Digger

**Date:** 2026-08-13  
**Question:** Should Digger replace its planned React Native Turbo Native Module with a Margelo Nitro Module so the shared c-ares C++ core can be called on iOS and Android without separate adapters?

## Executive conclusion

**Nitro is technically feasible for Digger, but it does not eliminate all platform-specific work.** It can eliminate most handwritten React Native registration glue around a pure C++ module. It cannot eliminate c-ares build integration, Android's JVM/`ConnectivityManager` initialization, permissions, or network-change integration. Those are operating-system seams rather than JS/native bridge seams.

**Recommendation: keep the pure C++ TurboModule as the MVP baseline and run a short Nitro proof of concept before changing the spec.** Digger exposes only a small, low-frequency API (`query` and `cancel`), so Nitro's call-throughput advantage is immaterial next to network latency. React Native 0.87 officially supports cross-platform pure C++ TurboModules, whereas Nitro adds a third-party JSI/code-generation layer with active React Native 0.87 compatibility work. Adopt Nitro only if the proof of concept builds unpatched release variants on both platforms and passes cancellation, resolver, and network-switch tests.

Confidence: **high** on architectural feasibility and remaining platform seams; **medium** on trouble-free React Native 0.87 adoption until verified in Digger's exact build matrix.

## The key correction

The choice is not:

- TurboModule = separate iOS and Android DNS implementations
- Nitro = one shared C++ DNS implementation

React Native 0.87 itself documents **pure C++ Turbo Native Modules** specifically for sharing one implementation between Android and iOS. The platform-specific pieces are registration/build glue: Android CMake/Gradle plus `OnLoad.cpp`, and an iOS Objective-C++ module provider plus Codegen registration. [React Native 0.87: Cross-Platform Native Modules (C++)](https://reactnative.dev/docs/0.87/the-new-architecture/pure-cxx-modules)

Nitro also supports one C++ implementation for both platforms. Nitrogen generates the typed C++ spec and registration, but the official template still includes an Android package, JNI entry point, CMake/Gradle setup, and an iOS podspec. [Nitro build guide](https://nitro.margelo.com/docs/getting-started/how-to-build-a-nitro-module), [Nitro example-module structure](https://github.com/mrousavy/nitro/tree/v0.36.5/packages/react-native-nitro-test), [Nitro template](https://github.com/mrousavy/nitro/tree/v0.36.5/packages/template)

Therefore Nitro reduces **bridge boilerplate**; it does not make native integration platform-free.

## Fit with Digger's API

Nitro can represent Digger's proposed contract cleanly:

- TypeScript specs generate a shared C++ interface and compile-time converters. [Nitrogen](https://nitro.margelo.com/docs/concepts/nitrogen)
- Custom structs, arrays, enums, optionals, variants/unions, and promises are supported, which is sufficient for `DnsQuery`, `DnsResult`, endpoints, sections, and record-specific data. [Nitro type comparison](https://nitro.margelo.com/docs/resources/comparison), [Nitro type documentation](https://nitro.margelo.com/docs/types/typing-system)
- A pure C++ Hybrid Object can expose `query(...): Promise<DnsResult>` and synchronous `cancel(queryId): void`. Nitro methods are synchronous by default, while a promise-returning implementation can move long-running work off the JS thread. [Nitro sync vs. async](https://nitro.margelo.com/docs/guides/sync-vs-async)
- C++ exceptions and promise failures propagate to JavaScript. Digger should still preserve its own stable error classification instead of exposing arbitrary exception messages as the API. [Nitro errors](https://nitro.margelo.com/docs/guides/errors)

Nitro does **not** provide cancellation merely because a method returns a promise. Digger still needs its query-ID registry, deadlines, c-ares cancellation, and exactly-once completion rules. Nitro only transports the promise and explicit `cancel` call.

A single long-lived `Dns` Hybrid Object is enough. Digger does not need Nitro's object-oriented or high-throughput strengths, such as many native object instances, synchronous property access, or large binary buffers.

## Work Nitro would remove or simplify

Compared with React Native's documented pure C++ TurboModule setup, Nitrogen can generate:

- the C++ spec from a TypeScript `*.nitro.ts` interface;
- JS/JSI/native type converters;
- Hybrid Object constructor registration;
- iOS and Android autolinking sources and build-file includes.

Generated sources are intended to be committed. [Nitrogen generation and registration](https://nitro.margelo.com/docs/concepts/nitrogen), [Nitro configuration](https://nitro.margelo.com/docs/getting-started/configuration-nitro-json)

This likely avoids Digger hand-maintaining React Native's iOS Objective-C++ `ModuleProvider` and Android TurboModule lookup branch. It also provides a more expressive type system than React Native Codegen for variant record data. These are real ergonomic benefits.

## Work Nitro would not remove

### Android c-ares initialization

For Android 8+ with target SDK 26+, c-ares requires the JVM to be registered and a Java `ConnectivityManager` object to be passed through JNI; `ACCESS_NETWORK_STATE` is also required. [c-ares `ares_library_init_android`](https://c-ares.org/docs/ares_library_init_android.html)

A portable C++ Hybrid Object does not receive an Android `Context`. Nitro exposes the React application context to Kotlin code, but a pure C++ implementation still needs JNI/fbjni or a small Kotlin/JNI initializer to pass the required Android object into c-ares. [Nitro Android Context](https://nitro.margelo.com/docs/guides/android-context)

Nitro's own C++ module template contains an Android `Package.kt`, JNI adapter, CMake configuration, and Gradle configuration. [Nitro template Android sources](https://github.com/mrousavy/nitro/tree/v0.36.5/packages/template/android)

### iOS and Android builds

c-ares still must be compiled and linked for iOS device/simulator architectures and Android ABIs. Nitro supplies a place to express those CocoaPods and CMake dependencies, not the c-ares build itself. Nitro's stated minimums are React Native 0.75+, Xcode 16.4+/Swift 5.9+, Android compile SDK 34+, and NDK 27+. [Nitro minimum requirements](https://nitro.margelo.com/docs/getting-started/minimum-requirements)

### Network changes and system resolvers

c-ares recommends a long-lived channel and `ares_reinit()` when system resolver configuration changes. `ares_reinit()` re-reads system configuration and safely updates an existing channel. [c-ares `ares_init_options`](https://c-ares.org/docs/ares_init_options.html), [c-ares `ares_reinit`](https://c-ares.org/docs/ares_reinit.html)

The application must still ensure that relevant OS network changes trigger or are observed by that mechanism. Nitro does not abstract Wi-Fi, cellular, VPN, split-DNS, or resolver lifecycle behavior. Platform-specific verification remains mandatory even if much of the implementation stays in c-ares/common C++.

### Permissions and product integration

Android Internet/network-state permissions, any iOS local-network usage description, release ABI packaging, and platform share behavior remain app/platform concerns. They are unaffected by the module framework.

## React Native 0.87 compatibility and maintenance risk

The latest inspected Nitro release is **0.36.5**. Its package declares a wildcard React Native peer dependency, but its development dependency currently targets React Native 0.85.3 rather than 0.87. [v0.36.5 package metadata](https://github.com/mrousavy/nitro/blob/v0.36.5/packages/react-native-nitro-modules/package.json)

Nitro 0.36.5 includes the new React Native 0.87 iOS JSI installer signature, fixing an earlier startup failure. [v0.36.5 iOS installer](https://github.com/mrousavy/nitro/blob/v0.36.5/packages/react-native-nitro-modules/ios/turbomodule/NativeNitroModules%2BNewArch.mm), [reported RN 0.87 failure](https://github.com/mrousavy/nitro/issues/1435), [merged fix](https://github.com/mrousavy/nitro/pull/1437)

However, at the time of research there is also an open draft PR titled “support react native 0.87” and an open RN 0.87 code-generation compatibility fix for Hybrid Views. Digger does not need Hybrid Views, so the latter is not directly blocking, but both show that the 0.87 compatibility surface is still moving. [Nitro PR #1474](https://github.com/mrousavy/nitro/pull/1474), [Nitro PR #1424](https://github.com/mrousavy/nitro/pull/1424)

Nitro itself installs JSI through a small TurboModule and uses React Native internals, so React Native upgrades can require Nitro updates. React Native's own pure C++ TurboModule API is first-party and avoids that additional compatibility dependency. [Nitro RN 0.87 installer source](https://github.com/mrousavy/nitro/blob/v0.36.5/packages/react-native-nitro-modules/ios/turbomodule/NativeNitroModules%2BNewArch.mm)

## Comparison for Digger

| Criterion | Pure C++ TurboModule | Pure C++ Nitro Module |
|---|---|---|
| Shared DNS implementation | Yes | Yes |
| Handwritten RN registration | Small Android + iOS registration layer | Mostly generated/template glue |
| Android c-ares adapter | Still required | Still required |
| c-ares build setup | Required per platform | Required per platform |
| Typed `Query`/`Result` | Supported, with Codegen constraints | Supported with richer structs/variants |
| Async Query | Promise plus Digger lifecycle | Promise plus Digger lifecycle |
| Cancellation | Digger-owned | Digger-owned |
| Performance relevance | Already negligible vs. DNS/network latency | Faster calls, but no meaningful user benefit here |
| RN 0.87 support ownership | React Native core | Third-party compatibility layer |
| Added runtime/build dependency | None beyond React Native | `react-native-nitro-modules` + generated Nitrogen code |
| Greenfield adoption cost | Moderate registration boilerplate | Moderate library/template and generator setup |

## Recommended proof of concept

Time-box this to roughly one or two engineering days and do it before changing the spec or tickets.

1. Create a local pure-C++ Nitro module using released versions only: React Native 0.87.0, `react-native-nitro-modules` 0.36.5 or newer stable, and matching Nitrogen.
2. Generate a minimal typed API with `query` returning a promise and `cancel` accepting a query ID.
3. Return one structured A Result from C++ first, then link c-ares and run one real system-resolver A Query.
4. Build and run iOS simulator, iOS device, Android debug, and Android release for every intended ABI.
5. Initialize c-ares with Android's JVM and `ConnectivityManager`; prove system resolver discovery rather than only a hard-coded custom resolver.
6. Run a delayed controlled Query, cancel it, and verify one prompt rejection, no later completion, and no crash or leak across repeated runs.
7. Switch Wi-Fi/VPN or default Android network and prove the next Query uses refreshed resolver state.
8. Measure clean-build complexity, generated-code churn, binary-size increment, and whether any patches or unreleased Git dependencies are necessary.

### Go criteria

Adopt Nitro if all are true:

- Both platforms build in debug and release without patching Nitro, React Native, or generated code.
- The stable Nitro release works on React Native 0.87 for Digger's pure C++ Hybrid Object.
- The typed `Query` and complete structured `Result` generate without awkward lossy maps or raw JSI escape hatches.
- Cancellation and object lifetimes remain deterministic under timeout, repeated, and concurrent Queries.
- Android system resolver initialization and network switching require only the expected small OS adapter.
- Build time, binary size, and dependency-upgrade burden fit the project's accepted budget.

### No-go criteria

Stay with a pure C++ TurboModule if any are true:

- RN 0.87 requires a Nitro fork, patch-package change, unpublished commit, or unresolved release-build workaround.
- Android initialization becomes harder to reason about than the direct TurboModule registration path.
- Promise/cancellation ownership is unclear or produces use-after-free, double completion, or JS-runtime lifetime failures.
- Generated types cannot represent Digger's record model cleanly.
- Nitro's additional dependency and generated build machinery save less work than the two small first-party registration points.

## Final recommendation

**Do the Nitro spike now because Digger is greenfield, but do not switch the architecture on assumption alone.** Nitro is a credible option and may produce a cleaner module boundary. For this particular app, its benefit is reduced registration/type boilerplate—not performance and not removal of platform adapters. Unless the spike is completely clean on React Native 0.87, the first-party pure C++ TurboModule remains the lower-risk MVP choice.

## Sources and scope

Primary sources were accessed on **2026-08-13**:

- React Native 0.87 documentation and source-owned guides
- Margelo Nitro documentation, v0.36.5 source/package metadata, and project issues/PRs
- c-ares official manuals and source-owned documentation

No secondary tutorials or benchmark interpretations were used. Nitro's comparison and performance claims are vendor-authored; this analysis does not rely on its benchmark numbers because native call overhead is not material to Digger's network-bound workflow.
