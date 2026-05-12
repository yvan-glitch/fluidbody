// ThemeProvider — single source of truth for the FluidBody theme.
//
// State:
//   - `mode`         : 'auto' | 'light' | 'dark', user-chosen, persisted.
//   - `theme`        : the resolved theme object (darkTheme or lightTheme).
//   - `setMode`      : updater that writes back to AsyncStorage.
//   - 'auto' follows `useColorScheme()`. Both `system` and `mode` re-resolve
//     the theme any time either changes — no manual subscribe needed.
//
// The provider also owns the **transition overlay**: when the resolved theme
// changes (user toggled, or the OS flipped while in auto), we briefly tint
// the whole screen with the *previous* theme background colour and fade it
// out with the Apple symmetric curve so the swap doesn't feel jarring.
//
// React Native's `useColorScheme` can momentarily return `null` while the
// runtime initialises — we treat that as "no signal yet" and fall back to
// dark, which avoids a one-frame light flash on cold start.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, useColorScheme, View, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GLASS_DURATIONS, GLASS_EASING } from '../components/ui/glassTokens';
import {
  darkTheme,
  resolveTheme,
  THEME_MODES,
  THEME_STORAGE_KEY,
} from './index';

const ThemeContext = createContext({
  theme: darkTheme,
  mode: 'auto',
  resolvedMode: 'dark',
  setMode: () => {},
});

export function ThemeProvider({ children, initialMode }) {
  // `mode` is the user's stated preference. `resolvedMode` is what we end
  // up rendering after considering 'auto' + the system colour scheme.
  const system = useColorScheme();
  const [mode, setModeState] = useState(initialMode || 'auto');
  const [hydrated, setHydrated] = useState(!!initialMode);

  // Hydrate from storage on mount. If the user has never set a preference
  // (typical first launch), keep the 'auto' default — *don't* write it back
  // unless they explicitly pick one in the UI.
  useEffect(function() {
    let cancelled = false;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then(function(v) {
        if (cancelled) return;
        if (v && THEME_MODES.indexOf(v) >= 0) setModeState(v);
        setHydrated(true);
      })
      .catch(function() { if (!cancelled) setHydrated(true); });
    return function() { cancelled = true; };
  }, []);

  const theme = useMemo(() => resolveTheme(mode, system), [mode, system]);
  const resolvedMode = theme.mode;

  // ── Transition overlay ──
  // When the resolved theme flips, capture the previous bg colour into a
  // ref, mount a full-screen `Animated.View` painted with that colour, and
  // fade its opacity from 1→0 over GLASS_DURATIONS.base. The new theme is
  // already rendered underneath; the overlay just hides the abrupt swap.
  //
  // We never store the previous theme in React state because doing so
  // would force a re-render with the *old* theme one frame after the new
  // one — visually that looks like a flicker. A ref is enough: the overlay
  // is essentially "static" old colour for the duration of the fade.
  const prevBgRef = useRef(theme.colors.bg);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const [overlayColor, setOverlayColor] = useState(null);

  useEffect(function() {
    if (!hydrated) {
      // Avoid playing the fade on the very first hydration tick — that's
      // not a user-triggered transition, it's the cold-start render.
      prevBgRef.current = theme.colors.bg;
      return;
    }
    if (prevBgRef.current === theme.colors.bg) return;
    setOverlayColor(prevBgRef.current);
    prevBgRef.current = theme.colors.bg;
    overlayOpacity.setValue(1);
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: GLASS_DURATIONS.base,
      easing: GLASS_EASING,
      useNativeDriver: true,
    }).start(function(res) {
      if (res?.finished) setOverlayColor(null);
    });
  }, [theme.colors.bg, hydrated]);

  const setMode = useCallback(function(next) {
    if (THEME_MODES.indexOf(next) < 0) return;
    setModeState(next);
    AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(function() {});
  }, []);

  const value = useMemo(() => ({ theme, mode, resolvedMode, setMode }), [theme, mode, resolvedMode, setMode]);

  return (
    <ThemeContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        {overlayColor != null ? (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: overlayColor, opacity: overlayOpacity },
            ]}
          />
        ) : null}
      </View>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

// Convenience selector — same idea as `useTheme().theme` but with a stable
// reference for shallow-compare optimisations later.
export function useColors() {
  return useContext(ThemeContext).theme.colors;
}

export function useGlassTokens() {
  return useContext(ThemeContext).theme.glass;
}

// Force-dark hook for surfaces that ALWAYS render against a dark background
// regardless of the global theme (the video player overlay, for instance).
// Returns the dark theme directly so primitives keep their look in those
// special zones without prop-drilling `tint="dark"` everywhere.
export function useForcedDarkTheme() {
  // Bypass context entirely so we don't trigger re-renders when the user
  // flips light/dark while a video is playing.
  return darkTheme;
}

// Platform.OS bridge for the dynamic blur tint. `Platform` is imported here
// only because the BlurView prop differs on iOS vs Android in subtle ways
// when in light mode (Android benefits from "systemMaterialLight").
export function pickBlurTint(theme) {
  if (theme.mode === 'light') {
    return Platform.OS === 'ios' ? 'light' : 'light';
  }
  return Platform.OS === 'ios' ? 'dark' : 'dark';
}
