import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

export type AppColors = {
  background: string;
  surface: string;
  ink: string;
  muted: string;
  border: string;
  accent: string;
  accentSoft: string;
  danger: string;
  dangerSoft: string;
  codeBackground: string;
};

export const lightColors: AppColors = {
  background: '#F4F6F2',
  surface: '#FFFFFF',
  ink: '#15231D',
  muted: '#64706A',
  border: '#D8DED9',
  accent: '#176B52',
  accentSoft: '#DCEDE6',
  danger: '#A33D35',
  dangerSoft: '#F9E8E5',
  codeBackground: '#F8FAF8',
};

export const darkColors: AppColors = {
  background: '#101412',
  surface: '#181D1A',
  ink: '#EDF4EE',
  muted: '#A7B3AA',
  border: '#334039',
  accent: '#62D2B7',
  accentSoft: '#173B34',
  danger: '#FF9C96',
  dangerSoft: '#442522',
  codeBackground: '#0D110F',
};

const ThemeContext = createContext<AppColors>(lightColors);

export function DiggerThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;

  return React.createElement(
    ThemeContext.Provider,
    { value: colors },
    children,
  );
}

export function useColors() {
  return useContext(ThemeContext);
}
