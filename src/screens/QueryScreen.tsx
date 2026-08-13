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
import type {NativeDns} from '../native/NativeDns';
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const nextQueryId = useRef(0);
  const insets = useSafeAreaInsets();

  async function runQuery() {
    const normalizedName = name.trim();
    if (!normalizedName || isLoading) {
      return;
    }

    setError(undefined);
    setIsLoading(true);
    const queryId = `query-${++nextQueryId.current}`;

    try {
      const result = await nativeDns.query(queryId, {
        name: normalizedName,
        type: 'A',
        ...defaults,
      });
      navigation.push('Result', {
        name: normalizedName,
        type: 'A',
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
          <View accessibilityRole="radio" accessibilityState={{checked: true}} style={styles.typePill}>
            <Text style={styles.typeText}>A</Text>
          </View>
        </View>
      </View>

      <View style={styles.advanced}>
        <Text style={styles.advancedTitle}>Advanced</Text>
        <Text style={styles.advancedValue}>
          System resolver · Auto · EDNS 1232 · DO off · 3s · 1 retry
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
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 9,
  },
  typeText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '700',
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
    marginTop: 5,
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
