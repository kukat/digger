import React from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import appPackage from '../../package.json';
import type { RecentQueries } from '../history/RecentQueries';
import { colors } from '../theme';

export interface SettingsConfirmation {
  confirmClearHistory(): Promise<boolean>;
}

export const platformSettingsConfirmation: SettingsConfirmation = {
  confirmClearHistory() {
    return new Promise(resolve => {
      Alert.alert(
        'Clear History?',
        'This removes all Recent Queries from this device. Results are never saved.',
        [
          { style: 'cancel', text: 'Cancel', onPress: () => resolve(false) },
          {
            style: 'destructive',
            text: 'Clear History',
            onPress: () => resolve(true),
          },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });
  },
};

export function SettingsScreen({
  recentQueries,
  confirmation,
}: {
  recentQueries: RecentQueries;
  confirmation: SettingsConfirmation;
}) {
  const insets = useSafeAreaInsets();

  async function clearHistory() {
    if (await confirmation.confirmClearHistory()) {
      await recentQueries.clear();
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.screen,
        { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
      ]}
    >
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.sectionTitle}>Privacy & data</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your DNS data stays private</Text>
        <Text style={styles.description}>
          Digger does not upload Query data. Recent Queries remain on this
          device so you can refill the form; they contain only a normalized name
          and record type. Results are never saved.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          clearHistory().catch(() => undefined);
        }}
        style={styles.clearButton}
      >
        <Text style={styles.clearTitle}>Clear History</Text>
        <Text style={styles.clearDescription}>
          Remove all Recent Queries from this device
        </Text>
      </Pressable>

      <Text style={styles.sectionTitle}>About</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Digger</Text>
        <Text style={styles.description}>Version {appPackage.version}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Open-source licenses & notices</Text>
        <Text style={styles.description}>
          Digger includes c-ares, React, React Native, React Navigation,
          AsyncStorage, Clipboard, Safe Area Context, and React Native Screens.
          These components are available under the MIT License.
        </Text>
        <Text style={styles.notice}>
          c-ares — MIT License{`\n`}Copyright (c) 1998 Massachusetts Institute
          of Technology{`\n`}Copyright (c) 2007–2023 Daniel Stenberg with many
          contributors.
        </Text>
        <Text style={styles.license}>
          Permission is hereby granted, free of charge, to any person obtaining
          a copy of this software and associated documentation files (the
          “Software”), to deal in the Software without restriction, including
          without limitation the rights to use, copy, modify, merge, publish,
          distribute, sublicense, and/or sell copies of the Software, and to
          permit persons to whom the Software is furnished to do so, subject to
          the following conditions: The above copyright notice and this
          permission notice shall be included in all copies or substantial
          portions of the Software.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flexGrow: 1, padding: 20 },
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 22,
  },
  sectionTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
    padding: 16,
  },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  description: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
  notice: { color: colors.ink, fontSize: 13, lineHeight: 19, marginTop: 12 },
  license: {color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 12},
  clearButton: {
    backgroundColor: colors.surface,
    borderColor: colors.danger,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 24,
    padding: 16,
  },
  clearTitle: { color: colors.danger, fontSize: 16, fontWeight: '700' },
  clearDescription: { color: colors.muted, fontSize: 13, marginTop: 4 },
});
