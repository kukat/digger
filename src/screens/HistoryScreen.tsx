import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RecentQueries } from '../history/RecentQueries';
import type { TabParamList } from '../navigation/types';
import { colors } from '../theme';

type Props = BottomTabScreenProps<TabParamList, 'History'> & {
  recentQueries: RecentQueries;
};

function displayName(name: string) {
  return name.endsWith('.') ? name.slice(0, -1) : name;
}

export function HistoryScreen({ navigation, recentQueries }: Props) {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState(recentQueries.getAll());

  useEffect(() => recentQueries.subscribe(setEntries), [recentQueries]);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.screen,
        { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
      ]}
    >
      <Text style={styles.title}>History</Text>
      <Text style={styles.subtitle}>Recent Queries stored on this device</Text>
      {entries.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.empty}>No Recent Queries yet.</Text>
        </View>
      ) : (
        entries.map(entry => {
          const name = displayName(entry.name);
          return (
            <View key={`${entry.name}\0${entry.type}`} style={styles.row}>
              <Pressable
                accessibilityLabel={`Use ${name} ${entry.type}`}
                accessibilityRole="button"
                onPress={() =>
                  navigation.navigate('Query', {
                    screen: 'QueryForm',
                    params: { recentQuery: entry },
                  })
                }
                style={styles.entry}
              >
                <Text style={styles.name}>{name}</Text>
                <Text style={styles.type}>{entry.type} · Tap to use again</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={`Delete ${name} ${entry.type}`}
                accessibilityRole="button"
                onPress={() => {
                  recentQueries.remove(entry).catch(() => undefined);
                }}
                style={styles.deleteButton}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flexGrow: 1, padding: 20 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '700' },
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
  empty: { color: colors.muted, fontSize: 15 },
  row: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginBottom: 10,
    paddingLeft: 16,
  },
  entry: { flex: 1, paddingVertical: 15 },
  name: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  type: { color: colors.muted, fontSize: 12, marginTop: 3 },
  deleteButton: { paddingHorizontal: 16, paddingVertical: 16 },
  deleteText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
});
