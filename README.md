# Digger

Digger is a React Native app for running DNS Queries and inspecting the current Result.

## Development

Requirements follow the React Native environment setup for iOS and Android. This project uses React Native 0.87 and the New Architecture.

```sh
npm install
npm start
npm run ios       # after bundle exec pod install
npm run android
```

## Checks

```sh
npm run typecheck
npm run lint
npm test
```

## App workflow seam

`App` accepts an optional `NativeDns` implementation. Production development builds use the simulated implementation in `src/native/NativeDns.ts`; app tests inject deterministic responses and errors, so workflow tests never require network access.
