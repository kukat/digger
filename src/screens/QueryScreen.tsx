import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useRef, useState} from 'react';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type {QueryStackParamList} from '../navigation/types';
import type {DnsRecordType, NativeDns} from '../native/NativeDns';
import type {DnsResolver} from '../../specs/NativeDnsModule';
import {colors} from '../theme';

type Props = NativeStackScreenProps<QueryStackParamList, 'QueryForm'> & {
  nativeDns: NativeDns;
};

const defaults = {
  resolver: {mode: 'system' as const},
  transport: 'auto' as const,
  timeoutMs: 3000,
  retries: 1,
  dnssecOk: false,
  ednsUdpSize: 1232,
};

export function QueryScreen({nativeDns, navigation}: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<DnsRecordType>('A');
  const [resolverMode, setResolverMode] = useState<DnsResolver['mode']>('system');
  const [resolverAddress, setResolverAddress] = useState('');
  const [resolverPort, setResolverPort] = useState('53');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const nextQueryId = useRef(0);
  const insets = useSafeAreaInsets();

  async function runQuery() {
    const normalizedName = name.trim();
    if (!normalizedName || isLoading) {
      return;
    }

    let resolver: DnsResolver = defaults.resolver;
    if (resolverMode === 'custom') {
      const port = Number(resolverPort);
      if (!resolverAddress.trim() || !Number.isInteger(port) || port < 1 || port > 65535) {
        setError('Enter a valid custom resolver address and port.');
        return;
      }
      resolver = {mode: 'custom', address: resolverAddress.trim(), port};
    }

    setError(undefined);
    setIsLoading(true);
    const queryId = `query-${++nextQueryId.current}`;

    try {
      const result = await nativeDns.query(queryId, {
        name: normalizedName,
        type,
        ...defaults,
        resolver,
      });
      navigation.push('Result', {
        name: normalizedName,
        type,
        result,
      });
    } catch (queryError) {
      setError(
        queryError instanceof Error
          ? queryError.message
          : 'The Query could not be completed.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={[styles.screen, {paddingTop: insets.top + 20}]}>
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
          {(['A', 'AAAA'] as const).map(recordType => {
            const selected = type === recordType;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{checked: selected}}
                disabled={isLoading}
                key={recordType}
                onPress={() => setType(recordType)}
                style={[styles.typePill, selected && styles.typePillSelected]}>
                <Text style={[styles.typeText, selected && styles.typeTextSelected]}>
                  {recordType}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.advanced}>
        <Text style={styles.advancedTitle}>Resolver</Text>
        <View accessibilityRole="radiogroup" style={styles.types}>
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
                style={[styles.typePill, selected && styles.typePillSelected]}>
                <Text style={[styles.typeText, selected && styles.typeTextSelected]}>
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
              style={[styles.input, styles.resolverAddress]}
              value={resolverAddress}
            />
            <TextInput
              accessibilityLabel="Custom resolver port"
              editable={!isLoading}
              keyboardType="number-pad"
              maxLength={5}
              onChangeText={setResolverPort}
              style={[styles.input, styles.resolverPort]}
              value={resolverPort}
            />
          </View>
        ) : null}
        <Text style={styles.advancedValue}>
          Auto · EDNS 1232 · DO off · 3s · 1 retry
        </Text>
      </View>

      {error ? (
        <View accessible accessibilityRole="alert" style={styles.errorCard}>
          <Text style={styles.errorTitle}>Query failed</Text>
          <Text style={styles.errorText}>{error}</Text>
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
        disabled={isLoading || !name.trim()}
        onPress={runQuery}
        style={({pressed}) => [
          styles.runButton,
          (isLoading || !name.trim()) && styles.runButtonDisabled,
          pressed && styles.runButtonPressed,
        ]}>
        <Text style={styles.runButtonText}>
          {isLoading ? 'Running Query…' : 'Run Query'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
  },
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    marginBottom: 22,
    marginTop: 3,
  },
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
  recordLabel: {
    marginTop: 18,
  },
  types: {
    flexDirection: 'row',
    marginTop: 10,
  },
  typePill: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
    paddingHorizontal: 20,
    paddingVertical: 9,
  },
  typePillSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  typeText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '700',
  },
  typeTextSelected: {
    color: colors.accent,
  },
  advanced: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 4,
    paddingVertical: 18,
  },
  advancedTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '600',
  },
  advancedValue: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 10,
  },
  resolverFields: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  resolverAddress: {
    flex: 1,
    fontSize: 15,
  },
  resolverPort: {
    fontSize: 15,
    width: 64,
  },
  loading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
  },
  errorCard: {
    backgroundColor: '#F9E8E5',
    borderRadius: 12,
    marginTop: 16,
    padding: 14,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: colors.ink,
    marginTop: 3,
  },
  runButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 14,
    marginTop: 'auto',
    paddingVertical: 16,
  },
  runButtonDisabled: {
    opacity: 0.45,
  },
  runButtonPressed: {
    opacity: 0.8,
  },
  runButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
