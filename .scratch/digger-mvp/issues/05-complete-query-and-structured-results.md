# 05 — Complete Query and structured Result functionality

**What to build:** Let users construct every MVP Query and inspect a polished structured Result containing the full DNS response rather than an address-only summary.

**Blocked by:** 04 — Harden the cross-platform DNS engine.

**Status:** ready-for-agent

- [ ] The Query form supports A, AAAA, CNAME, MX, TXT, NS, SOA, PTR, SRV, CAA, HTTPS, and SVCB.
- [ ] A, AAAA, CNAME, MX, and TXT are immediately available while the remaining record types are available through a compact More interaction.
- [ ] Valid PTR input accepts IPv4 or IPv6 addresses and converts them to the appropriate reverse-mapping name.
- [ ] Other Query types validate DNS names explicitly and do not infer a hostname from a URL.
- [ ] Advanced settings use the defaults defined by the spec and remain subordinate to name, record type, and Run Query.
- [ ] Result shows Query name, record type, actual transport, server or “System resolver,” response code, elapsed time, and wire size.
- [ ] Structured view displays flags plus Question, Answer, Authority, and Additional sections, including record counts for empty sections.
- [ ] Every supported record type has a useful structured representation sourced from the complete parsed DNS response.
- [ ] Unknown record types remain visible with their numeric type and hexadecimal RDATA instead of being discarded.
- [ ] NXDOMAIN, SERVFAIL, REFUSED, and other received response codes are displayed as Results rather than transport errors.
- [ ] Failures that do not produce a valid DNS response show concise error states without fabricated DNS sections.
- [ ] Controlled DNS scenarios cover each supported record type, all response sections, negative response codes, malformed packets, compression edge cases, and unknown records.
