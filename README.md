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
```

## Native DNS on iOS

The iOS app builds c-ares 1.34.5 from the pinned `c-ares.podspec` and exposes the shared C++ DNS service through the typed `NativeDnsModule` TurboModule. It supports A and AAAA Queries through the system resolver or a custom IPv4/IPv6 resolver and port. iOS may ask for local-network access when the custom resolver is on the local network; allow it for those Queries.

## App workflow seam

`App` accepts an optional `NativeDns` implementation. Production iOS builds use the native TurboModule; app tests inject deterministic responses and errors, so workflow tests never require network access. Deterministic native tests should likewise use a controlled DNS server rather than a public resolver.
