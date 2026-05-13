// Responsive layout helpers for iPad/tablet support.
//
// React-Native's module-level `Dimensions.get('window')` is captured once and
// goes stale on iPad rotation / split-view resize. These helpers use
// `useWindowDimensions()` so any screen that consumes them re-layouts when
// the window resizes.
//
// Design intent: keep content readable on big screens by capping it to a
// "phone-feel" max width and centering. Larger surfaces (background
// gradients, bubbles) still cover the full screen — only the content column
// is constrained.

import { useWindowDimensions } from 'react-native';

// 768 = iPad mini portrait (744) crosses this threshold; matches the
// IS_IPAD heuristic already used elsewhere.
export const TABLET_BREAKPOINT = 768;
// Above this we treat the device as a "large" tablet (iPad Air 11" landscape
// is 1180px; iPad Pro 13" landscape is 1376px).
export const LARGE_TABLET_BREAKPOINT = 1100;

// Cap content column width on tablets — keeps line-length, button width and
// card density close to the phone baseline. ~440 reads like an iPhone Pro
// Max portrait, which most layouts in this app were designed for.
export const PHONE_CONTENT_MAX_WIDTH = 440;
// Slightly wider for screens that have side-by-side cards on tablet
// (paywall plans, profile sections) — gives them room to breathe.
export const WIDE_CONTENT_MAX_WIDTH = 720;

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  const isLargeTablet = width >= LARGE_TABLET_BREAKPOINT;
  const isLandscape = width > height;
  return {
    width,
    height,
    isTablet,
    isLargeTablet,
    isLandscape,
  };
}

// Number of grid columns for card/list layouts based on width. Used by
// Bibliotheque and similar screens that show a card grid.
export function gridColsForWidth(width) {
  if (width >= LARGE_TABLET_BREAKPOINT) return 4;
  if (width >= TABLET_BREAKPOINT) return 3;
  return 2;
}

// Style applied to the inner content wrapper of a screen so it centers and
// caps to `maxWidth` on tablets. `paddingHorizontal` is preserved so existing
// per-screen padding still applies inside the centered column.
export function tabletContentStyle(width, maxWidth) {
  if (width < TABLET_BREAKPOINT) return null;
  const cap = maxWidth || PHONE_CONTENT_MAX_WIDTH;
  return { width: '100%', maxWidth: cap, alignSelf: 'center' };
}
