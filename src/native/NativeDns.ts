import {Platform} from 'react-native';

import NativeDnsModule, {
  type DnsQuery,
  type DnsQuestion,
  type DnsRecord,
  type DnsResult,
} from '../../specs/NativeDnsModule';

export type DnsRecordType = 'A' | 'AAAA';
export type {DnsQuery, DnsQuestion, DnsRecord, DnsResult};

export interface NativeDns {
  query(queryId: string, request: DnsQuery): Promise<DnsResult>;
  cancel(queryId: string): void;
}

export const nativeDns: NativeDns = {
  query(queryId, request) {
    if (Platform.OS !== 'ios' || NativeDnsModule == null) {
      return Promise.reject(
        new Error('Native DNS is not available on this platform yet.'),
      );
    }
    return NativeDnsModule.query(queryId, request);
  },
  cancel(queryId) {
    NativeDnsModule?.cancel(queryId);
  },
};
