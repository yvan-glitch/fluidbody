// LiquidGlassTV.m — Obj-C bridge declaring LiquidGlassTVViewManager and its
// view properties to the RN bridge. RCT_EXTERN_MODULE generates the
// registration; the implementation lives in LiquidGlassTVViewManager.swift,
// resolved at runtime via @objc(LiquidGlassTVViewManager).
//
// tvOS-only — this file is only added to the Xcode project on EAS *-tv
// builds (see plugins/withLiquidGlass.js), so no platform guard is needed,
// but the RN headers are identical to iOS.

#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(LiquidGlassTVViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(glassIntensity, NSNumber)
RCT_EXPORT_VIEW_PROPERTY(glassTint, UIColor)
RCT_EXPORT_VIEW_PROPERTY(borderStyle, NSString)
RCT_EXPORT_VIEW_PROPERTY(accent, NSString)
RCT_EXPORT_VIEW_PROPERTY(glassStyle, NSString)
RCT_EXPORT_VIEW_PROPERTY(glassFocused, BOOL)
RCT_EXPORT_VIEW_PROPERTY(glassCornerRadius, NSNumber)

@end
