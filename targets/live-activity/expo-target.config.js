/**
 * Apple Target config — Live Activity widget extension.
 * Consumed by @bacons/apple-targets at `npx expo prebuild` time.
 *
 * Bundle suffix is appended to the host app's bundle id by the plugin:
 *   com.ytissot.fluidbody.live-activity
 *
 * App Group must be created in the Apple Developer portal first
 * and assigned to BOTH the main app bundle id and this widget bundle id.
 */

/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'FluidLiveActivity',
  bundleIdentifier: '.live-activity',
  deploymentTarget: '16.2',
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit'],
  entitlements: {
    'com.apple.security.application-groups': [
      'group.com.ytissot.fluidbody.shared',
    ],
  },
  colors: {
    $accent: '#AEEF4D',
    JellyfishGreen: '#AEEF4D',
    AquaBlue: '#64BEFF',
    DeepNight: '#000E18',
  },
});
