import React, { useMemo } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  RecentQueries,
  recentQueryStorage,
  type RecentQueryStorage,
} from './src/history/RecentQueries';
import { AppNavigator } from './src/navigation/AppNavigator';
import {
  nativeDns as productionNativeDns,
  type NativeDns,
} from './src/native/NativeDns';
import {
  platformResultActions,
  type ResultActions,
} from './src/results/actions';
import {
  platformSettingsConfirmation,
  type SettingsConfirmation,
} from './src/screens/SettingsScreen';
import { DiggerThemeProvider } from './src/theme';

type AppProps = {
  nativeDns?: NativeDns;
  recentQueryStorage?: RecentQueryStorage;
  resultActions?: ResultActions;
  settingsConfirmation?: SettingsConfirmation;
};

function App({
  nativeDns = productionNativeDns,
  recentQueryStorage: storage = recentQueryStorage,
  resultActions = platformResultActions,
  settingsConfirmation = platformSettingsConfirmation,
}: AppProps) {
  const recentQueries = useMemo(() => new RecentQueries(storage), [storage]);
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <DiggerThemeProvider>
        <StatusBar
          barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
        />
        <AppNavigator
          nativeDns={nativeDns}
          recentQueries={recentQueries}
          resultActions={resultActions}
          settingsConfirmation={settingsConfirmation}
        />
      </DiggerThemeProvider>
    </SafeAreaProvider>
  );
}

export default App;
