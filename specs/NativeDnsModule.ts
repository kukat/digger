import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export type DnsSystemResolver = {
  mode: 'system';
};

export type DnsCustomResolver = {
  mode: 'custom';
  address: string;
  port: number;
};

export type DnsResolver = DnsSystemResolver | DnsCustomResolver;

// Codegen cannot generate a discriminated union here, so native validation
// enforces that custom mode carries both address and port.
type DnsResolverSpec = {
  mode: string;
  address?: string;
  port?: number;
};

export type DnsRecordType =
  | 'A'
  | 'AAAA'
  | 'CNAME'
  | 'MX'
  | 'TXT'
  | 'NS'
  | 'SOA'
  | 'PTR'
  | 'SRV'
  | 'CAA'
  | 'HTTPS'
  | 'SVCB';

type DnsQuerySpec = {
  name: string;
  type: DnsRecordType;
  resolver: DnsResolverSpec;
  transport: 'auto' | 'udp' | 'tcp';
  timeoutMs: number;
  retries: number;
  dnssecOk: boolean;
  ednsUdpSize?: number;
};

export type DnsQuery = Omit<DnsQuerySpec, 'resolver'> & {
  resolver: DnsResolver;
};

export type DnsQuestion = {
  name: string;
  type: string;
  recordClass: string;
};

export type DnsRecord = {
  name: string;
  type: string;
  ttl: number;
  data: string;
};

export type DnsServerEndpoint = {
  address: string;
  port: number;
};

export type DnsResult = {
  rcode: string;
  flags: Array<string>;
  question: Array<DnsQuestion>;
  answer: Array<DnsRecord>;
  authority: Array<DnsRecord>;
  additional: Array<DnsRecord>;
  server?: DnsServerEndpoint;
  transport: 'udp' | 'tcp';
  elapsedMs: number;
  wireBytes: number;
};

export interface Spec extends TurboModule {
  readonly query: (queryId: string, request: DnsQuerySpec) => Promise<DnsResult>;
  readonly cancel: (queryId: string) => void;
}

export default TurboModuleRegistry.get<Spec>('NativeDnsModule');
