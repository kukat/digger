# Use a pure C++ TurboModule for native DNS

Digger will expose its shared C++ c-ares DNS service through React Native 0.87's first-party pure C++ TurboModule. Nitro Modules were considered for their generated bindings and reduced registration boilerplate, but they do not remove the required platform-specific c-ares build, Android `ConnectivityManager` initialization, permissions, or network lifecycle work; for Digger's small network-bound API, those benefits do not justify an additional compatibility-sensitive JSI dependency.
