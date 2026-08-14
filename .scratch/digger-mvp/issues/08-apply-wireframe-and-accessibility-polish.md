# 08 — Apply the Digger wireframe and accessibility polish

**What to build:** Turn the complete behavior into the compact, polished mobile experience described by the Digger wireframe while preserving clear interaction and platform accessibility.

**Blocked by:** 06 — Add `dig` output, copy, and sharing; 07 — Add Recent Queries, Settings, and privacy controls.

**Status:** ready-for-human

- [x] Query, Result, History, and Settings follow the wireframe's visual hierarchy, restrained palette, grouped surfaces, compact controls, and mobile-first spacing.
- [x] Name, record type, and Run Query dominate the Query screen while Advanced settings remain discoverable but visually secondary.
- [x] Loading, cancellation, validation, empty, successful Result, negative Result, and transport-error states are visually clear.
- [x] Structured and `dig` switching, copy, share, record selection, More, History rows, deletion, and Settings actions use accessible native interaction patterns.
- [x] Interactive controls have meaningful accessibility roles, labels, states, focus behavior, and adequate touch targets.
- [x] Text scaling, long DNS names, large records, empty sections, light/dark appearance, and narrow supported screens remain usable without hiding essential data.
- [x] iOS and Android present consistent product behavior while respecting platform navigation, sharing, permission, and accessibility conventions.
- [x] App-level tests cover critical polished workflows through accessibility-visible controls rather than styling implementation details.

## Comments

Implemented the wireframe palette and grouped mobile surfaces with light/dark themes, expanded touch targets, semantic Result tabs, accessible guidance and live status announcements, and long-record wrapping. Added app-workflow accessibility coverage. Ready for human review.
