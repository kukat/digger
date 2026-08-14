import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useRef, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import type {DnsResolver, DnsQuery} from '../../specs/NativeDnsModule';
import type {QueryStackParamList} from '../navigation/types';
import {
  NativeDnsError,
  type DnsFailureCode,
  type DnsRecordType,
  type NativeDns,
} from '../native/NativeDns';
import {colors} from '../theme';

type Props = NativeStackScreenProps<QueryStackParamList, 'QueryForm'> & {
  nativeDns: NativeDns;
};

type QueryError = {
  code: DnsFailureCode;
  message: string;
};

const errorTitles: Record<DnsFailureCode, string> = {
  invalid_input: 'Invalid Query',
  timeout: 'Query timed out',
  cancelled: 'Query cancelled',
  network_unavailable: 'Network unavailable',
  invalid_response: 'Invalid DNS response',
  internal_native: 'Query failed',
};

const transportOptions = [
  {value: 'auto' as const, label: 'Automatic'},
  {value: 'udp' as const, label: 'Start with UDP'},
  {value: 'tcp' as const, label: 'TCP only'},
];
const commonRecordTypes: DnsRecordType[] = ['A', 'AAAA', 'CNAME', 'MX', 'TXT'];
const moreRecordTypes: DnsRecordType[] = [
  'NS',
  'SOA',
  'PTR',
  'SRV',
  'CAA',
  'HTTPS',
  'SVCB',
];

function integerInRange(value: string, minimum: number, maximum: number) {
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum
    ? number
    : undefined;
}

function reverseMappingName(value: string): string | undefined {
  const ipv4 = value.split('.');
  if (
    ipv4.length === 4 &&
    ipv4.every(part => /^\d+$/.test(part) && Number(part) <= 255)
  ) {
    return `${ipv4.reverse().join('.')}.in-addr.arpa.`;
  }

  const halves = value.toLowerCase().split('::');
  if (halves.length > 2) {
    return undefined;
  }
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  if (
    left.length + right.length > 8 ||
    (halves.length === 1 && left.length !== 8) ||
    ![...left, ...right].every(part => /^[0-9a-f]{1,4}$/.test(part))
  ) {
    return undefined;
  }
  const groups = [
    ...left,
    ...Array(8 - left.length - right.length).fill('0'),
    ...right,
  ];
  return `${groups
    .map(group => group.padStart(4, '0'))
    .join('')
    .split('')
    .reverse()
    .join('.')}.ip6.arpa.`;
}

function normalizedDnsName(value: string): string | undefined {
  const name = value.trim();
  if (
    !name ||
    name.includes('://') ||
    name.includes('/') ||
    name.includes('?') ||
    name.includes('#') ||
    name.length > 253
  ) {
    return undefined;
  }
  const labels = name.replace(/\.$/, '').split('.');
  if (
    labels.some(
      label =>
        !label ||
        label.length > 63 ||
        !/^[a-zA-Z0-9_](?:[a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?$/.test(label),
    )
  ) {
    return undefined;
  }
  return `${labels.join('.')}.`;
}

export function QueryScreen({nativeDns, navigation}: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<DnsRecordType>('A');
  const [resolverMode, setResolverMode] = useState<DnsResolver['mode']>('system');
  const [resolverAddress, setResolverAddress] = useState('');
  const [resolverPort, setResolverPort] = useState('53');
  const [transport, setTransport] = useState<DnsQuery['transport']>('auto');
  const [ednsEnabled, setEdnsEnabled] = useState(true);
  const [ednsUdpSize, setEdnsUdpSize] = useState('1232');
  const [dnssecOk, setDnssecOk] = useState(false);
  const [timeoutMs, setTimeoutMs] = useState('3000');
  const [retries, setRetries] = useState('1');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [moreTypesOpen, setMoreTypesOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<QueryError>();
  const nextQueryId = useRef(0);
  const activeQueryId = useRef<string | undefined>(undefined);
  const insets = useSafeAreaInsets();

  function validateRequest(normalizedName: string): DnsQuery | undefined {
    if (!normalizedName) {
      setError({code: 'invalid_input', message: 'Enter a DNS name.'});
      return undefined;
    }

    let resolver: DnsResolver = {mode: 'system'};
    if (resolverMode === 'custom') {
      const port = integerInRange(resolverPort, 1, 65535);
      if (!resolverAddress.trim() || port === undefined) {
        setError({
          code: 'invalid_input',
          message: 'Enter a valid custom resolver address and port.',
        });
        return undefined;
      }
      resolver = {mode: 'custom', address: resolverAddress.trim(), port};
    }

    const parsedTimeout = integerInRange(timeoutMs, 250, 120000);
    const parsedRetries = integerInRange(retries, 0, 10);
    const parsedEdnsSize = ednsEnabled
      ? integerInRange(ednsUdpSize, 512, 65535)
      : undefined;
    if (parsedTimeout === undefined || parsedRetries === undefined) {
      setError({
        code: 'invalid_input',
        message: 'Timeout must be 250–120000 ms and retries must be 0–10.',
      });
      return undefined;
    }
    if (dnssecOk && !ednsEnabled) {
      setError({
        code: 'invalid_input',
        message: 'DNSSEC OK requires EDNS to be enabled.',
      });
      return undefined;
    }
    if (ednsEnabled && parsedEdnsSize === undefined) {
      setError({
        code: 'invalid_input',
        message: 'EDNS UDP size must be 512–65535 bytes.',
      });
      return undefined;
    }

    return {
      name: normalizedName,
      type,
      resolver,
      transport,
      timeoutMs: parsedTimeout,
      retries: parsedRetries,
      dnssecOk,
      ednsUdpSize: parsedEdnsSize,
    };
  }

  async function runQuery() {
    if (isLoading) {
      return;
    }
    const normalizedName =
      type === 'PTR' ? reverseMappingName(name.trim()) : normalizedDnsName(name);
    if (!normalizedName) {
      setError({
        code: 'invalid_input',
        message:
          type === 'PTR'
            ? 'Enter a valid IPv4 or IPv6 address for a PTR Query.'
            : 'Enter a valid DNS name, not a URL.',
      });
      return;
    }
    const request = validateRequest(normalizedName);
    if (!request) {
      return;
    }

    setError(undefined);
    setIsLoading(true);
    const queryId = `query-${++nextQueryId.current}`;
    activeQueryId.current = queryId;

    try {
      const result = await nativeDns.query(queryId, request);
      if (activeQueryId.current !== queryId) {
        return;
      }
      activeQueryId.current = undefined;
      navigation.push('Result', {
        name: type === 'PTR' ? normalizedName : name.trim(),
        type,
        result,
      });
    } catch (queryError) {
      if (activeQueryId.current !== queryId) {
        return;
      }
      activeQueryId.current = undefined;
      if (queryError instanceof NativeDnsError) {
        setError({code: queryError.code, message: queryError.message});
      } else {
        setError({
          code: 'internal_native',
          message:
            queryError instanceof Error
              ? queryError.message
              : 'The Query could not be completed.',
        });
      }
    } finally {
      if (activeQueryId.current === queryId || activeQueryId.current === undefined) {
        setIsLoading(false);
      }
    }
  }

  function cancelQuery() {
    const queryId = activeQueryId.current;
    if (!queryId) {
      return;
    }
    activeQueryId.current = undefined;
    nativeDns.cancel(queryId);
    setIsLoading(false);
    setError({
      code: 'cancelled',
      message: 'The DNS Query was cancelled.',
    });
  }

  const advancedSummary = `${
    transportOptions.find(option => option.value === transport)?.label
  } · ${ednsEnabled ? `EDNS ${ednsUdpSize}` : 'EDNS off'} · DO ${
    dnssecOk ? 'on' : 'off'
  } · ${timeoutMs} ms · ${retries} ${retries === '1' ? 'retry' : 'retries'}`;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.screen,
        {paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20},
      ]}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Query</Text>
      <Text style={styles.subtitle}>Inspect a DNS response</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          accessibilityLabel="DNS name"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
          onChangeText={setName}
          onSubmitEditing={runQuery}
          placeholder="example.com"
          placeholderTextColor={colors.muted}
          returnKeyType="go"
          style={styles.input}
          value={name}
        />

        <Text style={[styles.label, styles.recordLabel]}>RR type</Text>
        <View accessibilityRole="radiogroup" style={styles.types}>
          {commonRecordTypes.map(recordType => {
            const selected = type === recordType;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{checked: selected}}
                disabled={isLoading}
                key={recordType}
                onPress={() => setType(recordType)}
                style={[styles.pill, selected && styles.pillSelected]}>
                <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                  {recordType}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{expanded: moreTypesOpen}}
          disabled={isLoading}
          onPress={() => setMoreTypesOpen(open => !open)}
          style={styles.moreTypesButton}>
          <Text style={styles.moreTypesText}>
            {moreTypesOpen ? 'Fewer record types' : 'More record types'}
          </Text>
        </Pressable>
        {moreTypesOpen ? (
          <View accessibilityRole="radiogroup" style={styles.wrappedPills}>
            {moreRecordTypes.map(recordType => {
              const selected = type === recordType;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{checked: selected}}
                  disabled={isLoading}
                  key={recordType}
                  onPress={() => setType(recordType)}
                  style={[styles.pill, selected && styles.pillSelected]}>
                  <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                    {recordType}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      <View style={styles.advanced}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{expanded: advancedOpen}}
          onPress={() => setAdvancedOpen(open => !open)}
          style={styles.advancedHeader}>
          <View style={styles.advancedHeaderText}>
            <Text style={styles.advancedTitle}>Advanced settings</Text>
            <Text style={styles.advancedSummary}>{advancedSummary}</Text>
          </View>
          <Text style={styles.chevron}>{advancedOpen ? '−' : '+'}</Text>
        </Pressable>

        {advancedOpen ? (
          <View style={styles.advancedBody}>
            <Text style={styles.settingLabel}>Resolver</Text>
            <View accessibilityRole="radiogroup" style={styles.wrappedPills}>
              {(['system', 'custom'] as const).map(mode => {
                const selected = resolverMode === mode;
                const label = mode === 'system' ? 'System resolver' : 'Custom resolver';
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{checked: selected}}
                    disabled={isLoading}
                    key={mode}
                    onPress={() => setResolverMode(mode)}
                    style={[styles.pill, selected && styles.pillSelected]}>
                    <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {resolverMode === 'custom' ? (
              <View style={styles.resolverFields}>
                <TextInput
                  accessibilityLabel="Custom resolver address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  onChangeText={setResolverAddress}
                  placeholder="192.0.2.53 or 2001:db8::53"
                  placeholderTextColor={colors.muted}
                  style={[styles.compactInput, styles.resolverAddress]}
                  value={resolverAddress}
                />
                <TextInput
                  accessibilityLabel="Custom resolver port"
                  editable={!isLoading}
                  keyboardType="number-pad"
                  maxLength={5}
                  onChangeText={setResolverPort}
                  style={[styles.compactInput, styles.resolverPort]}
                  value={resolverPort}
                />
              </View>
            ) : null}

            <Text style={styles.settingLabel}>Transport</Text>
            <View accessibilityRole="radiogroup" style={styles.wrappedPills}>
              {transportOptions.map(option => {
                const selected = transport === option.value;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{checked: selected}}
                    disabled={isLoading}
                    key={option.value}
                    onPress={() => setTransport(option.value)}
                    style={[styles.pill, selected && styles.pillSelected]}>
                    <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                <Text style={styles.settingLabel}>EDNS</Text>
                <Text style={styles.helpText}>Advertise a UDP response size</Text>
              </View>
              <Pressable
                accessibilityLabel="Enable EDNS"
                accessibilityRole="switch"
                accessibilityState={{checked: ednsEnabled}}
                disabled={isLoading}
                onPress={() => setEdnsEnabled(enabled => !enabled)}
                style={[styles.switch, ednsEnabled && styles.switchOn]}>
                <View style={[styles.switchThumb, ednsEnabled && styles.switchThumbOn]} />
              </Pressable>
            </View>
            {ednsEnabled ? (
              <TextInput
                accessibilityLabel="EDNS UDP size"
                editable={!isLoading}
                keyboardType="number-pad"
                maxLength={5}
                onChangeText={setEdnsUdpSize}
                style={styles.compactInput}
                value={ednsUdpSize}
              />
            ) : null}

            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                <Text style={styles.settingLabel}>DNSSEC OK (DO)</Text>
                <Text style={styles.helpText}>Requests DNSSEC data; Digger does not validate it</Text>
              </View>
              <Pressable
                accessibilityLabel="Request DNSSEC records"
                accessibilityRole="switch"
                accessibilityState={{checked: dnssecOk}}
                disabled={isLoading}
                onPress={() => setDnssecOk(enabled => !enabled)}
                style={[styles.switch, dnssecOk && styles.switchOn]}>
                <View style={[styles.switchThumb, dnssecOk && styles.switchThumbOn]} />
              </Pressable>
            </View>

            <View style={styles.numericFields}>
              <View style={styles.numericField}>
                <Text style={styles.settingLabel}>Timeout (ms)</Text>
                <TextInput
                  accessibilityLabel="Timeout in milliseconds"
                  editable={!isLoading}
                  keyboardType="number-pad"
                  maxLength={6}
                  onChangeText={setTimeoutMs}
                  style={styles.compactInput}
                  value={timeoutMs}
                />
              </View>
              <View style={styles.numericField}>
                <Text style={styles.settingLabel}>Retries</Text>
                <TextInput
                  accessibilityLabel="Retries"
                  editable={!isLoading}
                  keyboardType="number-pad"
                  maxLength={2}
                  onChangeText={setRetries}
                  style={styles.compactInput}
                  value={retries}
                />
              </View>
            </View>
          </View>
        ) : null}
      </View>

      {error ? (
        <View accessible accessibilityRole="alert" style={styles.errorCard}>
          <Text style={styles.errorTitle}>{errorTitles[error.code]}</Text>
          <Text style={styles.errorText}>{error.message}</Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>Looking up {name.trim()}…</Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={!isLoading && !name.trim()}
        onPress={isLoading ? cancelQuery : runQuery}
        style={({pressed}) => [
          styles.runButton,
          isLoading && styles.cancelButton,
          !isLoading && !name.trim() && styles.runButtonDisabled,
          pressed && styles.runButtonPressed,
        ]}>
        <Text style={[styles.runButtonText, isLoading && styles.cancelButtonText]}>
          {isLoading ? 'Cancel Query' : 'Run Query'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flexGrow: 1,
    padding: 20,
  },
  title: {color: colors.ink, fontSize: 32, fontWeight: '700'},
  subtitle: {color: colors.muted, fontSize: 15, marginBottom: 22, marginTop: 3},
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  input: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    color: colors.ink,
    fontSize: 20,
    paddingHorizontal: 0,
    paddingVertical: 12,
  },
  recordLabel: {marginTop: 18},
  types: {flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, rowGap: 8},
  moreTypesButton: {alignSelf: 'flex-start', marginTop: 12, paddingVertical: 4},
  moreTypesText: {color: colors.accent, fontSize: 13, fontWeight: '700'},
  wrappedPills: {flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, rowGap: 8},
  pill: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  pillSelected: {backgroundColor: colors.accentSoft, borderColor: colors.accent},
  pillText: {color: colors.muted, fontSize: 14, fontWeight: '700'},
  pillTextSelected: {color: colors.accent},
  advanced: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 4,
    paddingVertical: 14,
  },
  advancedHeader: {alignItems: 'center', flexDirection: 'row'},
  advancedHeaderText: {flex: 1},
  advancedTitle: {color: colors.ink, fontSize: 15, fontWeight: '600'},
  advancedSummary: {color: colors.muted, fontSize: 11, marginTop: 4},
  chevron: {color: colors.accent, fontSize: 22, marginLeft: 12},
  advancedBody: {paddingTop: 16},
  settingLabel: {color: colors.ink, fontSize: 13, fontWeight: '600', marginTop: 10},
  helpText: {color: colors.muted, fontSize: 11, marginTop: 2},
  resolverFields: {flexDirection: 'row', gap: 12, marginTop: 8},
  resolverAddress: {flex: 1},
  resolverPort: {width: 70},
  compactInput: {
    borderColor: colors.border,
    borderRadius: 9,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 14,
    marginTop: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  switchRow: {alignItems: 'center', flexDirection: 'row', marginTop: 10},
  switchText: {flex: 1, paddingRight: 12},
  switch: {
    backgroundColor: colors.border,
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    padding: 3,
    width: 48,
  },
  switchOn: {backgroundColor: colors.accent},
  switchThumb: {backgroundColor: '#FFFFFF', borderRadius: 11, height: 22, width: 22},
  switchThumbOn: {alignSelf: 'flex-end'},
  numericFields: {flexDirection: 'row', gap: 12, marginTop: 6},
  numericField: {flex: 1},
  loading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  loadingText: {color: colors.muted, fontSize: 14},
  errorCard: {backgroundColor: '#F9E8E5', borderRadius: 12, marginTop: 16, padding: 14},
  errorTitle: {color: colors.danger, fontSize: 14, fontWeight: '700'},
  errorText: {color: colors.ink, marginTop: 3},
  runButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 14,
    marginTop: 'auto',
    paddingVertical: 16,
  },
  cancelButton: {backgroundColor: colors.surface, borderColor: colors.danger, borderWidth: 1},
  cancelButtonText: {color: colors.danger},
  runButtonDisabled: {opacity: 0.45},
  runButtonPressed: {opacity: 0.8},
  runButtonText: {color: '#FFFFFF', fontSize: 16, fontWeight: '700'},
});
