import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import React from 'react';
import {StyleSheet, Text} from 'react-native';

import type {RecentQueries} from '../history/RecentQueries';
import type {NativeDns} from '../native/NativeDns';
import type {ResultActions} from '../results/actions';
import {HistoryScreen} from '../screens/HistoryScreen';
import {QueryScreen} from '../screens/QueryScreen';
import {ResultScreen} from '../screens/ResultScreen';
import {
  SettingsScreen,
  type SettingsConfirmation,
} from '../screens/SettingsScreen';
import {colors} from '../theme';
import type {QueryStackParamList, TabParamList} from './types';

const QueryStack = createNativeStackNavigator<QueryStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

function TabIcon({symbol, color}: {symbol: string; color: string}) {
  return <Text style={[styles.tabIcon, {color}]}>{symbol}</Text>;
}

function QueryTabIcon({color}: {color: string}) {
  return <TabIcon color={color} symbol="⌕" />;
}

function HistoryTabIcon({color}: {color: string}) {
  return <TabIcon color={color} symbol="◴" />;
}

function SettingsTabIcon({color}: {color: string}) {
  return <TabIcon color={color} symbol="⚙" />;
}

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
    <QueryStack.Navigator>
      <QueryStack.Screen name="QueryForm" options={{headerShown: false}}>
        {props => (
          <QueryScreen {...props} nativeDns={nativeDns} recentQueries={recentQueries} />
        )}
      </QueryStack.Screen>
      <QueryStack.Screen name="Result" options={{headerShown: false}}>
        {props => <ResultScreen {...props} resultActions={resultActions} />}
      </QueryStack.Screen>
    </QueryStack.Navigator>
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
  return (
    <NavigationContainer>
      <Tabs.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: styles.tabBar,
        }}>
        <Tabs.Screen
          name="Query"
          options={{tabBarIcon: QueryTabIcon}}>
          {() => (
            <QueryNavigator
              nativeDns={nativeDns}
              recentQueries={recentQueries}
              resultActions={resultActions}
            />
          )}
        </Tabs.Screen>
        <Tabs.Screen
          name="History"
          options={{tabBarIcon: HistoryTabIcon}}>
          {props => <HistoryScreen {...props} recentQueries={recentQueries} />}
        </Tabs.Screen>
        <Tabs.Screen
          name="Settings"
          options={{tabBarIcon: SettingsTabIcon}}>
          {() => (
            <SettingsScreen
              confirmation={settingsConfirmation}
              recentQueries={recentQueries}
            />
          )}
        </Tabs.Screen>
      </Tabs.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
  },
  tabIcon: {
    fontSize: 21,
  },
});
