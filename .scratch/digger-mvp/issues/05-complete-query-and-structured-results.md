# 05 — Complete Query and structured Result functionality

**What to build:** Let users construct every MVP Query and inspect a polished structured Result containing the full DNS response rather than an address-only summary.

**Blocked by:** 04 — Harden the cross-platform DNS engine.

**Status:** done

- [x] The Query form supports A, AAAA, CNAME, MX, TXT, NS, SOA, PTR, SRV, CAA, HTTPS, and SVCB.
- [x] A, AAAA, CNAME, MX, and TXT are immediately available while the remaining record types are available through a compact More interaction.
- [x] Valid PTR input accepts IPv4 or IPv6 addresses and converts them to the appropriate reverse-mapping name.
- [x] Other Query types validate DNS names explicitly and do not infer a hostname from a URL.
- [x] Advanced settings use the defaults defined by the spec and remain subordinate to name, record type, and Run Query.
- [x] Result shows Query name, record type, actual transport, server or “System resolver,” response code, elapsed time, and wire size.
- [x] Structured view displays flags plus Question, Answer, Authority, and Additional sections, including record counts for empty sections.
- [x] Every supported record type has a useful structured representation sourced from the complete parsed DNS response.
- [x] Unknown record types remain visible with their numeric type and hexadecimal RDATA instead of being discarded.
- [x] NXDOMAIN, SERVFAIL, REFUSED, and other received response codes are displayed as Results rather than transport errors.
- [x] Failures that do not produce a valid DNS response show concise error states without fabricated DNS sections.
- [x] Controlled DNS scenarios cover each supported record type, all response sections, negative response codes, malformed packets, compression edge cases, and unknown records.

## Comments

Implemented the Query and structured Result work with app-workflow and native DNS-contract coverage.

Marked done. All acceptance tasks complete.
