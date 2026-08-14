import type { DnsResult } from '../src/native/NativeDns';
import {
  formatDigResult,
  formatStructuredResult,
} from '../src/results/formatters';

const successfulResult: DnsResult = {
  rcode: 'NOERROR',
  flags: ['qr', 'rd', 'ra'],
  question: [{ name: 'example.com.', type: 'A', recordClass: 'IN' }],
  answer: [
    { name: 'example.com.', type: 'A', ttl: 3600, data: '93.184.216.34' },
  ],
  authority: [],
  additional: [],
  server: { address: '192.0.2.53', port: 53 },
  transport: 'udp',
  elapsedMs: 18,
  wireBytes: 56,
};

describe('Result text formatters', () => {
  test('generates familiar dig-style text from a successful Result without an application query identifier', () => {
    expect(
      formatDigResult({
        name: 'example.com',
        type: 'A',
        result: successfulResult,
      }),
    ).toMatchInlineSnapshot(`
"; <<>> Digger dig-style <<>> example.com A
;; ->>HEADER<<- opcode: QUERY, status: NOERROR
;; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 0

;; QUESTION SECTION:
;example.com.\tIN\tA

;; ANSWER SECTION:
example.com.\t3600\tIN\tA\t93.184.216.34

;; AUTHORITY SECTION:

;; ADDITIONAL SECTION:

;; Query time: 18 msec
;; SERVER: 192.0.2.53#53 (UDP)
;; MSG SIZE rcvd: 56"
`);
  });

  test('formats negative, empty-section, DNSSEC-observation, and unknown-record Results', () => {
    const cases: Array<{ name: string; result: DnsResult }> = [
      {
        name: 'negative',
        result: { ...successfulResult, rcode: 'NXDOMAIN', answer: [] },
      },
      {
        name: 'empty sections',
        result: {
          ...successfulResult,
          answer: [],
          authority: [],
          additional: [],
        },
      },
      {
        name: 'DNSSEC observation',
        result: {
          ...successfulResult,
          flags: ['qr', 'rd', 'ra', 'ad'],
          answer: [
            {
              name: 'example.com.',
              type: 'RRSIG',
              ttl: 300,
              data: 'A 13 2 300 20250101000000 20240101000000 12345 example.com. signature',
            },
          ],
        },
      },
      {
        name: 'unknown record',
        result: {
          ...successfulResult,
          answer: [
            {
              name: 'example.com.',
              type: 'TYPE65400',
              ttl: 60,
              data: 'RDATA: deadbeef',
            },
          ],
        },
      },
    ];

    for (const fixture of cases) {
      expect(
        formatDigResult({
          name: 'example.com',
          type: 'A',
          result: fixture.result,
        }),
      ).toMatchSnapshot(fixture.name);
    }
  });

  test('generates human-readable Structured text from the same Result', () => {
    expect(
      formatStructuredResult({
        name: 'example.com',
        type: 'A',
        result: successfulResult,
      }),
    ).toContain('Answer (1)\nexample.com. · A · 3600\n93.184.216.34');
  });
});
