import type {DnsResult} from '../native/NativeDns';

export type QueryStackParamList = {
  QueryForm: undefined;
  Result: {
    name: string;
    type: 'A' | 'AAAA';
    result: DnsResult;
  };
};

export type TabParamList = {
  Query: undefined;
  History: undefined;
  Settings: undefined;
};
