import NativeDnsModule, {
  type DnsQuery,
  type DnsQuestion,
  type DnsRecord,
  type DnsRecordType,
  type DnsResult,
} from '../../specs/NativeDnsModule';

export type {DnsRecordType};
export type DnsFailureCode =
  | 'invalid_input'
  | 'timeout'
  | 'cancelled'
  | 'network_unavailable'
  | 'invalid_response'
  | 'internal_native';
export type {DnsQuery, DnsQuestion, DnsRecord, DnsResult};

const failurePrefix = /^DIGGER_DNS_([A-Z_]+):\s*(.*)$/s;
const failureCodes = new Set<DnsFailureCode>([
  'invalid_input',
  'timeout',
  'cancelled',
  'network_unavailable',
  'invalid_response',
  'internal_native',
]);

export class NativeDnsError extends Error {
  constructor(
    public readonly code: DnsFailureCode,
    message: string,
  ) {
    super(message);
    this.name = 'NativeDnsError';
  }
}

export function classifyNativeDnsFailure(reason: unknown): NativeDnsError {
  if (reason instanceof NativeDnsError) {
    return reason;
  }
  const message = reason instanceof Error ? reason.message : String(reason);
  const match = failurePrefix.exec(message);
  const code = match?.[1]?.toLowerCase() as DnsFailureCode | undefined;
  if (code && failureCodes.has(code)) {
    return new NativeDnsError(code, match?.[2] || 'The DNS Query failed.');
  }
  return new NativeDnsError(
    'internal_native',
    message || 'The DNS Query could not be completed.',
  );
}

export interface NativeDns {
  query(queryId: string, request: DnsQuery): Promise<DnsResult>;
  cancel(queryId: string): void;
}

export const nativeDns: NativeDns = {
  query(queryId, request) {
    if (NativeDnsModule == null) {
      return Promise.reject(new Error('Native DNS is not available.'));
    }
    return NativeDnsModule.query(queryId, request).catch(reason => {
      throw classifyNativeDnsFailure(reason);
    });
  },
  cancel(queryId) {
    NativeDnsModule?.cancel(queryId);
  },
};
