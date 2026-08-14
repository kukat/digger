# 06 — Add `dig` output, copy, and sharing

**What to build:** Give users a familiar generated text representation of the current Result and let them copy or share either representation without persisting it.

**Blocked by:** 05 — Complete Query and structured Result functionality.

**Status:** ready-for-human

- [x] A user can switch between Structured and `dig` views of the same current Result.
- [x] The `dig` view includes familiar header, status, flags, section, timing, server, transport, and message-size information when available.
- [x] Text is described as `dig`-style and is not represented as byte-for-byte BIND `dig` output.
- [x] The formatter never parses command output or rendered Structured content; both views are projections of one Result.
- [x] An app lifecycle cancellation identifier is never presented as a DNS transaction ID.
- [x] Copy produces human-readable Structured text or the complete generated `dig` text according to the selected view.
- [x] Share sends the same selected representation through the platform share sheet.
- [x] No copy/share action creates a saved Result, JSON export, raw-packet export, or output file.
- [x] Golden or snapshot tests cover representative successful, negative, empty-section, DNSSEC-observation, and unknown-record Results.

## Comments

Implemented `dig`-style Result formatting, selected-view copy/share actions, and app-workflow plus formatter snapshot coverage. Ready for human review.
