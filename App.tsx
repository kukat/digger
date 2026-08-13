import React from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {AppNavigator} from './src/navigation/AppNavigator';
import {type NativeDns, simulatedNativeDns} from './src/native/NativeDns';

type AppProps = {
  nativeDns?: NativeDns;
};

function App({nativeDns = simulatedNativeDns}: AppProps) {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <AppNavigator nativeDns={nativeDns} />
    </SafeAreaProvider>
  );
}

export default App;
