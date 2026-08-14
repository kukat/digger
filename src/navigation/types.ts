import type { NavigatorScreenParams } from '@react-navigation/native';

import type { RecentQuery } from '../history/RecentQueries';
import type { DnsRecordType, DnsResult } from '../native/NativeDns';

export type QueryStackParamList = {
  QueryForm: { recentQuery?: RecentQuery } | undefined;
  Result: {
    name: string;
    type: DnsRecordType;
    result: DnsResult;
  };
};

export type HistoryStackParamList = {
  HistoryHome: undefined;
};

export type SettingsStackParamList = {
  SettingsHome: undefined;
};

export type TabParamList = {
  Query: NavigatorScreenParams<QueryStackParamList> | undefined;
  History: NavigatorScreenParams<HistoryStackParamList> | undefined;
  Settings: NavigatorScreenParams<SettingsStackParamList> | undefined;
};
