import React from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {AppNavigator} from './src/navigation/AppNavigator';
import {nativeDns as productionNativeDns, type NativeDns} from './src/native/NativeDns';
import {platformResultActions, type ResultActions} from './src/results/actions';

type AppProps = {
  nativeDns?: NativeDns;
  resultActions?: ResultActions;
};

function App({
  nativeDns = productionNativeDns,
  resultActions = platformResultActions,
}: AppProps) {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <AppNavigator nativeDns={nativeDns} resultActions={resultActions} />
    </SafeAreaProvider>
  );
}

export default App;
