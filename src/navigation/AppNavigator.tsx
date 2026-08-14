import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  createNativeBottomTabNavigator,
  type NativeBottomTabIcon,
} from '@react-navigation/bottom-tabs/unstable';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { Platform, StyleSheet, useColorScheme } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import type { RecentQueries } from '../history/RecentQueries';
import type { NativeDns } from '../native/NativeDns';
import type { ResultActions } from '../results/actions';
import { HistoryScreen } from '../screens/HistoryScreen';
import { QueryScreen } from '../screens/QueryScreen';
import { ResultScreen } from '../screens/ResultScreen';
import {
  SettingsScreen,
  type SettingsConfirmation,
} from '../screens/SettingsScreen';
import { useColors } from '../theme';
import type {
  HistoryStackParamList,
  QueryStackParamList,
  SettingsStackParamList,
  TabParamList,
} from './types';

const QueryStack = createNativeStackNavigator<QueryStackParamList>();
const HistoryStack = createNativeStackNavigator<HistoryStackParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();
const NativeTabs = createNativeBottomTabNavigator<TabParamList>();
const JavaScriptTabs = createBottomTabNavigator<TabParamList>();

type TabIconProps = { color: string; size: number };

function QueryTabIcon({ color, size }: TabIconProps) {
  return <Ionicons color={color} name="search-outline" size={size} />;
}

function HistoryTabIcon({ color, size }: TabIconProps) {
  return <Ionicons color={color} name="time-outline" size={size} />;
}

function SettingsTabIcon({ color, size }: TabIconProps) {
  return <Ionicons color={color} name="settings-outline" size={size} />;
}

function nativeTabIcon(
  sfSymbol: Extract<NativeBottomTabIcon, { type: 'sfSymbol' }>['name'],
): NativeBottomTabIcon {
  return { type: 'sfSymbol', name: sfSymbol };
}

const nativeStackScreenOptions = {
  headerShadowVisible: false,
  headerTitleAlign: 'left' as const,
  scrollEdgeEffects: {
    bottom: 'automatic' as const,
    top: 'automatic' as const,
  },
};

function QueryNavigator({
  nativeDns,
  recentQueries,
  resultActions,
}: {
  nativeDns: NativeDns;
  recentQueries: RecentQueries;
  resultActions: ResultActions;
}) {
  return (
    <QueryStack.Navigator screenOptions={nativeStackScreenOptions}>
      <QueryStack.Screen
        name="QueryForm"
        options={{ headerLargeTitleEnabled: true, title: 'Query' }}
      >
        {props => (
          <QueryScreen
            {...props}
            nativeDns={nativeDns}
            recentQueries={recentQueries}
          />
        )}
      </QueryStack.Screen>
      <QueryStack.Screen
        name="Result"
        options={{
          headerBackTitle: 'Query',
          title: 'Result',
        }}
      >
        {props => <ResultScreen {...props} resultActions={resultActions} />}
      </QueryStack.Screen>
    </QueryStack.Navigator>
  );
}

function HistoryNavigator({ recentQueries }: { recentQueries: RecentQueries }) {
  return (
    <HistoryStack.Navigator screenOptions={nativeStackScreenOptions}>
      <HistoryStack.Screen
        name="HistoryHome"
        options={{ headerLargeTitleEnabled: true, title: 'History' }}
      >
        {props => <HistoryScreen {...props} recentQueries={recentQueries} />}
      </HistoryStack.Screen>
    </HistoryStack.Navigator>
  );
}

function SettingsNavigator({
  confirmation,
  recentQueries,
}: {
  confirmation: SettingsConfirmation;
  recentQueries: RecentQueries;
}) {
  return (
    <SettingsStack.Navigator screenOptions={nativeStackScreenOptions}>
      <SettingsStack.Screen
        name="SettingsHome"
        options={{ headerLargeTitleEnabled: true, title: 'Settings' }}
      >
        {() => (
          <SettingsScreen
            confirmation={confirmation}
            recentQueries={recentQueries}
          />
        )}
      </SettingsStack.Screen>
    </SettingsStack.Navigator>
  );
}

export function AppNavigator({
  nativeDns,
  recentQueries,
  resultActions,
  settingsConfirmation,
}: {
  nativeDns: NativeDns;
  recentQueries: RecentQueries;
  resultActions: ResultActions;
  settingsConfirmation: SettingsConfirmation;
}) {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const navigationTheme = useMemo(() => {
    const baseTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: colors.accent,
        background: colors.background,
        card: colors.surface,
        text: colors.ink,
        border: colors.border,
        notification: colors.danger,
      },
    };
  }, [colorScheme, colors]);

  return (
    <NavigationContainer theme={navigationTheme}>
      {Platform.OS === 'ios' ? (
        <NativeTabNavigator
          nativeDns={nativeDns}
          recentQueries={recentQueries}
          resultActions={resultActions}
          settingsConfirmation={settingsConfirmation}
        />
      ) : (
        <JavaScriptTabNavigator
          nativeDns={nativeDns}
          recentQueries={recentQueries}
          resultActions={resultActions}
          settingsConfirmation={settingsConfirmation}
        />
      )}
    </NavigationContainer>
  );
}

type TabNavigatorProps = {
  nativeDns: NativeDns;
  recentQueries: RecentQueries;
  resultActions: ResultActions;
  settingsConfirmation: SettingsConfirmation;
};

function NativeTabNavigator({
  nativeDns,
  recentQueries,
  resultActions,
  settingsConfirmation,
}: TabNavigatorProps) {
  const colors = useColors();

  return (
    <NativeTabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarMinimizeBehavior: 'none',
        tabBarStyle: { backgroundColor: colors.surface },
      }}
    >
      <NativeTabs.Screen
        name="Query"
        options={{
          tabBarIcon: nativeTabIcon('magnifyingglass'),
        }}
      >
        {() => (
          <QueryNavigator
            nativeDns={nativeDns}
            recentQueries={recentQueries}
            resultActions={resultActions}
          />
        )}
      </NativeTabs.Screen>
      <NativeTabs.Screen
        name="History"
        options={{ tabBarIcon: nativeTabIcon('clock') }}
      >
        {() => <HistoryNavigator recentQueries={recentQueries} />}
      </NativeTabs.Screen>
      <NativeTabs.Screen
        name="Settings"
        options={{ tabBarIcon: nativeTabIcon('gearshape') }}
      >
        {() => (
          <SettingsNavigator
            confirmation={settingsConfirmation}
            recentQueries={recentQueries}
          />
        )}
      </NativeTabs.Screen>
    </NativeTabs.Navigator>
  );
}

function JavaScriptTabNavigator({
  nativeDns,
  recentQueries,
  resultActions,
  settingsConfirmation,
}: TabNavigatorProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <JavaScriptTabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: styles.tabBar,
      }}
    >
      <JavaScriptTabs.Screen
        name="Query"
        options={{ tabBarIcon: QueryTabIcon }}
      >
        {() => (
          <QueryNavigator
            nativeDns={nativeDns}
            recentQueries={recentQueries}
            resultActions={resultActions}
          />
        )}
      </JavaScriptTabs.Screen>
      <JavaScriptTabs.Screen
        name="History"
        options={{ tabBarIcon: HistoryTabIcon }}
      >
        {() => <HistoryNavigator recentQueries={recentQueries} />}
      </JavaScriptTabs.Screen>
      <JavaScriptTabs.Screen
        name="Settings"
        options={{ tabBarIcon: SettingsTabIcon }}
      >
        {() => (
          <SettingsNavigator
            confirmation={settingsConfirmation}
            recentQueries={recentQueries}
          />
        )}
      </JavaScriptTabs.Screen>
    </JavaScriptTabs.Navigator>
  );
}

const createStyles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    tabBar: {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
    },
  });
