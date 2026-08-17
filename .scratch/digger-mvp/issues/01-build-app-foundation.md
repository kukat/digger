# 01 — Build the Digger app foundation

**What to build:** A React Native 0.87 application that establishes Digger's navigation, app-level testing seam, and smallest complete Query-to-Result workflow before native DNS complexity is introduced.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] The application uses React Native 0.87 with the New Architecture enabled and launches in iOS and Android development builds.
- [x] Query, History, and Settings are stable primary tabs, while Result is pushed from Query rather than exposed as a tab.
- [x] A user can enter a name, run a simulated A Query through an injectable `NativeDns` boundary, observe loading, and reach an ephemeral Result.
- [x] Returning from Result retains the Query form but discards the prior Result.
- [x] The app workflow test seam can control native responses and errors without relying on network access.
- [x] Automated tests exercise the simulated Query-to-Result workflow through user-visible controls and output rather than component internals.

## Comments

Implemented. All acceptance tasks complete.
