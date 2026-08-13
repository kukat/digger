import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {colors} from '../theme';

export function PlaceholderScreen({title}: {title: 'History' | 'Settings'}) {
  const insets = useSafeAreaInsets();
  const description =
    title === 'History'
      ? 'Recent Queries will appear here.'
      : 'App preferences and privacy controls will appear here.';

  return (
    <View style={[styles.screen, {paddingTop: insets.top + 20}]}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.card}>
        <Text style={styles.description}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
    padding: 20,
  },
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 22,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  description: {
    color: colors.muted,
    fontSize: 15,
  },
});
