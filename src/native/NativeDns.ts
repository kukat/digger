export type DnsRecordType = 'A';

export type DnsQuery = {
  name: string;
  type: DnsRecordType;
  resolver: {mode: 'system'};
  transport: 'auto';
  timeoutMs: number;
  retries: number;
  dnssecOk: boolean;
  ednsUdpSize: number;
};

export type DnsQuestion = {
  name: string;
  type: DnsRecordType;
  class: 'IN';
};

export type DnsRecord = {
  name: string;
  type: DnsRecordType;
  ttl: number;
  data: string;
};

export type DnsResult = {
  rcode: string;
  flags: string[];
  question: DnsQuestion[];
  answer: DnsRecord[];
  authority: DnsRecord[];
  additional: DnsRecord[];
  server?: {address: string; port: number};
  transport: 'udp' | 'tcp';
  elapsedMs: number;
  wireBytes: number;
};

export interface NativeDns {
  query(queryId: string, request: DnsQuery): Promise<DnsResult>;
  cancel(queryId: string): void;
}

const SIMULATION_DELAY_MS = 600;

export const simulatedNativeDns: NativeDns = {
  query(_queryId, request) {
    return new Promise(resolve => {
      setTimeout(() => {
        const name = request.name.endsWith('.')
          ? request.name
          : `${request.name}.`;

        resolve({
          rcode: 'NOERROR',
          flags: ['qr', 'rd', 'ra'],
          question: [{name, type: 'A', class: 'IN'}],
          answer: [
            {name, type: 'A', ttl: 3600, data: '93.184.216.34'},
          ],
          authority: [],
          additional: [],
          transport: 'udp',
          elapsedMs: 18,
          wireBytes: 56,
        });
      }, SIMULATION_DELAY_MS);
    });
  },
  cancel() {},
};
