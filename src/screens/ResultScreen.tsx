import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import type {QueryStackParamList} from '../navigation/types';
import type {DnsRecord} from '../native/NativeDns';
import {colors} from '../theme';

type Props = NativeStackScreenProps<QueryStackParamList, 'Result'>;

function ResultSection({title, records}: {title: string; records: DnsRecord[]}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.count}>{records.length}</Text>
      </View>
      {records.map((record, index) => (
        <View key={`${record.name}-${record.type}-${index}`} style={styles.record}>
          <View style={styles.recordType}>
            <Text style={styles.recordTypeText}>{record.type}</Text>
          </View>
          <View style={styles.recordBody}>
            <Text style={styles.recordName}>{record.name}</Text>
            <Text style={styles.recordData}>{record.data}</Text>
          </View>
          <Text style={styles.ttl}>{record.ttl}</Text>
        </View>
      ))}
    </View>
  );
}

export function ResultScreen({navigation, route}: Props) {
  const {name, type, result} = route.params;
  const insets = useSafeAreaInsets();
  const server = result.server
    ? `${result.server.address}:${result.server.port}`
    : 'System resolver';

  return (
    <ScrollView
      contentContainerStyle={[styles.screen, {paddingTop: insets.top + 12}]}>
      <Pressable
        accessibilityLabel="Back to Query"
        accessibilityRole="button"
        onPress={navigation.goBack}
        style={styles.backButton}>
        <Text style={styles.backButtonText}>‹ Query</Text>
      </Pressable>
      <Text style={styles.eyebrow}>Current Result</Text>
      <Text style={styles.query}>{name} · {type}</Text>
      <Text style={styles.route}>{result.transport.toUpperCase()} · {server}</Text>

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Rcode</Text>
          <Text style={styles.metricValue}>{result.rcode}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Time</Text>
          <Text style={styles.metricValue}>{result.elapsedMs} ms</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Size</Text>
          <Text style={styles.metricValue}>{result.wireBytes} B</Text>
        </View>
      </View>

      <View style={styles.flags}>
        <Text style={styles.flagsLabel}>Flags</Text>
        <Text style={styles.flagsValue}>{result.flags.join('  ') || 'none'}</Text>
      </View>

      <ResultSection title="Answer" records={result.answer} />
      <ResultSection title="Authority" records={result.authority} />
      <ResultSection title="Additional" records={result.additional} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 18,
    paddingVertical: 4,
  },
  backButtonText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  query: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '700',
    marginTop: 5,
  },
  route: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 5,
  },
  metrics: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginTop: 22,
    paddingVertical: 15,
  },
  metric: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  flags: {
    flexDirection: 'row',
    marginVertical: 18,
  },
  flagsLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    marginRight: 12,
  },
  flagsValue: {
    color: colors.ink,
    fontFamily: 'Courier',
    fontSize: 13,
  },
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
    padding: 15,
  },
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  count: {
    backgroundColor: colors.accentSoft,
    borderRadius: 10,
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  record: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
  },
  recordType: {
    backgroundColor: colors.accentSoft,
    borderRadius: 8,
    marginRight: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  recordTypeText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  recordBody: {
    flex: 1,
  },
  recordName: {
    color: colors.muted,
    fontSize: 11,
  },
  recordData: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  ttl: {
    color: colors.muted,
    fontSize: 11,
    marginLeft: 8,
  },
});
