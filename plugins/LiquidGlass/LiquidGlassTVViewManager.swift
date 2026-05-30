// LiquidGlassTVViewManager — RCTViewManager exposing LiquidGlassTVView to
// React Native on tvOS. Mirrors LiquidGlassViewManager (iOS) but vends the
// tvOS view. Property exports are declared in LiquidGlassTV.m via
// RCT_EXTERN_MODULE, so no generated Swift→ObjC header is needed here.
//
// react-native-tvos runs the Old Architecture on tvOS (newArchEnabled=false
// in app.config.js), so the legacy RCTViewManager path is the correct one.
//
// Wrapped in `#if os(tvOS)` so it only compiles into the tvOS target.

#if os(tvOS)
import React
import UIKit

@objc(LiquidGlassTVViewManager)
class LiquidGlassTVViewManager: RCTViewManager {

    override static func requiresMainQueueSetup() -> Bool {
        return true
    }

    override func view() -> UIView! {
        return LiquidGlassTVView()
    }
}
#endif
