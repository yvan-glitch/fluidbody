// ThemedStatusBar — drop-in <StatusBar> that follows the active theme.
//
// Use at the root of any screen whose background follows the global theme
// (Profil, MonCorps, etc.). For screens that always render against a known
// background — e.g. VideoPlayer (always pitch-black video) — pass an
// explicit `force` prop instead of relying on theme.

import { StatusBar } from 'react-native';
import { useTheme } from './ThemeProvider';

export default function ThemedStatusBar({ force, animated = true, backgroundColor }) {
  const { theme } = useTheme();
  const barStyle = force || theme.colors.statusBarStyle;
  return (
    <StatusBar
      barStyle={barStyle}
      animated={animated}
      backgroundColor={backgroundColor || 'transparent'}
      translucent
    />
  );
}
