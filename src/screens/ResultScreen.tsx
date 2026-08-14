import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { QueryStackParamList } from '../navigation/types';
import type { DnsQuestion, DnsRecord } from '../native/NativeDns';
import type { ResultActions } from '../results/actions';
import { formatDigResult, formatStructuredResult } from '../results/formatters';
import { useColors } from '../theme';

type Props = NativeStackScreenProps<QueryStackParamList, 'Result'> & {
  resultActions: ResultActions;
};

type ResultView = 'structured' | 'dig';

type Styles = ReturnType<typeof createStyles>;

function QuestionSection({
  questions,
  styles,
}: {
  questions: DnsQuestion[];
  styles: Styles;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Question</Text>
        <Text style={styles.count}>
          {questions.length} {questions.length === 1 ? 'record' : 'records'}
        </Text>
      </View>
      {questions.map((question, index) => (
        <View
          key={`${question.name}-${question.type}-${index}`}
          style={styles.record}
        >
          <View style={styles.recordType}>
            <Text style={styles.recordTypeText}>{question.type}</Text>
          </View>
          <View style={styles.recordBody}>
            <Text style={styles.recordName}>{question.name}</Text>
            <Text style={styles.recordData}>
              {question.type} · {question.recordClass}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function ResultSection({
  title,
  records,
  styles,
}: {
  title: string;
  records: DnsRecord[];
  styles: Styles;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.count}>
          {records.length} {records.length === 1 ? 'record' : 'records'}
        </Text>
      </View>
      {records.map((record, index) => (
        <View
          key={`${record.name}-${record.type}-${index}`}
          style={styles.record}
        >
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

export function ResultScreen({ navigation, route, resultActions }: Props) {
  const { name, type, result } = route.params;
  const [view, setView] = useState<ResultView>('structured');
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const server = result.server
    ? `${result.server.address}:${result.server.port}`
    : 'System resolver';
  const textInput = useMemo(
    () => ({ name, type, result }),
    [name, result, type],
  );
  const selectedText =
    view === 'structured'
      ? formatStructuredResult(textInput)
      : formatDigResult(textInput);
  const selectedViewName = view === 'structured' ? 'Structured' : 'dig-style';

  return (
    <ScrollView
      contentContainerStyle={[styles.screen, { paddingTop: insets.top + 12 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.toolbar}>
        <Pressable
          accessibilityHint="Returns to the Query form and discards this Result."
          accessibilityLabel="Back to Query"
          accessibilityRole="button"
          onPress={navigation.goBack}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>‹ Query</Text>
        </Pressable>
        <View style={styles.actions}>
          <Pressable
            accessibilityHint={`Copies the ${selectedViewName} representation to the clipboard.`}
            accessibilityLabel={`Copy ${selectedViewName} Result`}
            accessibilityRole="button"
            onPress={() => resultActions.copy(selectedText)}
            style={styles.actionButton}
          >
            <Text style={styles.actionText}>Copy</Text>
          </Pressable>
          <Pressable
            accessibilityHint={`Opens the system share sheet with the ${selectedViewName} representation.`}
            accessibilityLabel={`Share ${selectedViewName} Result`}
            accessibilityRole="button"
            onPress={() => {
              resultActions.share(selectedText).catch(() => undefined);
            }}
            style={styles.actionButton}
          >
            <Text style={styles.actionText}>Share</Text>
          </Pressable>
        </View>
      </View>
      <View
        accessible
        accessibilityLabel={`Query ${name}, ${type}. ${result.transport.toUpperCase()} via ${server}.`}
      >
        <Text style={styles.eyebrow}>Current Result</Text>
        <Text style={styles.query}>
          {name} · {type}
        </Text>
        <Text style={styles.route}>
          {result.transport.toUpperCase()} · {server}
        </Text>
      </View>

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

      <View accessibilityRole="tablist" style={styles.segmentedControl}>
        <Pressable
          accessibilityLabel="Structured view"
          accessibilityRole="tab"
          accessibilityState={{ selected: view === 'structured' }}
          onPress={() => setView('structured')}
          style={[
            styles.segment,
            view === 'structured' && styles.segmentSelected,
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              view === 'structured' && styles.segmentTextSelected,
            ]}
          >
            Structured
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="dig view"
          accessibilityRole="tab"
          accessibilityState={{ selected: view === 'dig' }}
          onPress={() => setView('dig')}
          style={[styles.segment, view === 'dig' && styles.segmentSelected]}
        >
          <Text
            style={[
              styles.segmentText,
              view === 'dig' && styles.segmentTextSelected,
            ]}
          >
            dig
          </Text>
        </Pressable>
      </View>

      {view === 'structured' ? (
        <>
          <View style={styles.flags}>
            <Text style={styles.flagsLabel}>Flags</Text>
            <Text style={styles.flagsValue}>
              {result.flags.join('  ') || 'none'}
            </Text>
          </View>
          <QuestionSection questions={result.question} styles={styles} />
          <ResultSection
            title="Answer"
            records={result.answer}
            styles={styles}
          />
          <ResultSection
            title="Authority"
            records={result.authority}
            styles={styles}
          />
          <ResultSection
            title="Additional"
            records={result.additional}
            styles={styles}
          />
        </>
      ) : (
        <View style={styles.digCard}>
          <Text style={styles.digTitle}>dig-style text</Text>
          <Text style={styles.digText} selectable>
            {selectedText}
          </Text>
          <Text style={styles.digHint}>
            Generated from this Result; not byte-for-byte BIND dig output.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const createStyles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    screen: {
      backgroundColor: colors.background,
      flexGrow: 1,
      padding: 20,
      paddingBottom: 40,
    },
    toolbar: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 18,
    },
    backButton: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: 6,
    },
    actions: { flexDirection: 'row', gap: 8 },
    actionButton: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    actionText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
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
      flexShrink: 1,
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
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      marginTop: 18,
      paddingVertical: 12,
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
    segmentedControl: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      flexDirection: 'row',
      marginTop: 18,
      padding: 3,
    },
    segment: {
      alignItems: 'center',
      borderRadius: 7,
      flex: 1,
      justifyContent: 'center',
      minHeight: 44,
      paddingVertical: 8,
    },
    segmentSelected: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
    },
    segmentText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
    segmentTextSelected: { color: colors.accent },
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
      alignItems: 'flex-start',
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      marginTop: 12,
      paddingTop: 12,
    },
    recordType: {
      alignItems: 'center',
      backgroundColor: colors.accentSoft,
      borderRadius: 8,
      justifyContent: 'center',
      marginRight: 10,
      paddingHorizontal: 9,
      paddingVertical: 6,
      width: 76,
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
      flexShrink: 1,
      fontSize: 11,
    },
    recordData: {
      color: colors.ink,
      flexShrink: 1,
      fontSize: 15,
      fontWeight: '600',
      marginTop: 2,
    },
    ttl: {
      color: colors.muted,
      fontSize: 11,
      marginLeft: 8,
    },
    digCard: {
      backgroundColor: colors.codeBackground,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      marginTop: 16,
      padding: 15,
    },
    digTitle: {
      color: colors.ink,
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 10,
    },
    digText: {
      color: colors.ink,
      fontFamily: 'Courier',
      fontSize: 12,
      lineHeight: 18,
    },
    digHint: {
      color: colors.muted,
      fontSize: 11,
      lineHeight: 16,
      marginTop: 14,
    },
  });
