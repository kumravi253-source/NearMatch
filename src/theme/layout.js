import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Screens were laid out against hardcoded paddings — 60px at the top of
// every screen, 22px under the tab bar. Those numbers were tuned on a
// notched iPhone, where the top safe-area inset is ~59px, so they happen
// to line up there and nowhere else.
//
// Android status bar heights vary by device (24px on older hardware, more
// on punch-hole displays), and modern Android draws edge-to-edge, so
// content sits under the system bars unless it is padded out of the way.
// A fixed 60px does not track any of that.
//
// These helpers keep the original numbers as design floors — so screens
// look the same on the devices they were tuned for — and grow to whatever
// the system reports when that is larger. The one deliberate change is the
// tab bar: 22px is less than the 34px iOS home indicator, so the labels
// currently sit inside it. Taking the inset fixes that on iOS as well.

const SCREEN_TOP_MIN = 60;
const TAB_BAR_BOTTOM_MIN = 22;

/** Top padding for a screen whose first row of content starts at the top. */
export function useScreenTopPadding() {
  const insets = useSafeAreaInsets();
  return { paddingTop: Math.max(insets.top, SCREEN_TOP_MIN) };
}

/** Bottom padding for the tab bar, clearing the home indicator / nav bar. */
export function useTabBarPadding() {
  const insets = useSafeAreaInsets();
  return { paddingBottom: Math.max(insets.bottom, TAB_BAR_BOTTOM_MIN) };
}

/**
 * Vertical padding for a scrollable screen. Takes the floors the screen was
 * originally written with, since those differ per screen (a centered auth
 * form wants less than a long profile form).
 */
export function useScrollPadding(topMin, bottomMin) {
  const insets = useSafeAreaInsets();
  return {
    paddingTop: Math.max(insets.top, topMin),
    paddingBottom: Math.max(insets.bottom, bottomMin),
  };
}
