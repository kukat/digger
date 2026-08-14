import type {DnsRecordType, DnsResult} from '../native/NativeDns';

export type QueryStackParamList = {
  QueryForm: undefined;
  Result: {
    name: string;
    type: DnsRecordType;
    result: DnsResult;
  };
};

export type TabParamList = {
  Query: undefined;
  History: undefined;
  Settings: undefined;
};
