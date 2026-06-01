// LiquidGlass.m — Obj-C bridge that declares the LiquidGlassViewManager
// and its view properties to React Native's bridge. RCT_EXTERN_MODULE
// generates the registration code at compile time; the actual
// implementation lives in LiquidGlassViewManager.swift and is resolved
// at runtime via the @objc(LiquidGlassViewManager) attribute.

#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(LiquidGlassViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(glassIntensity, NSNumber)
RCT_EXPORT_VIEW_PROPERTY(glassTint, UIColor)
RCT_EXPORT_VIEW_PROPERTY(borderStyle, NSString)
RCT_EXPORT_VIEW_PROPERTY(glassCornerRadius, NSNumber)

// v2 — iOS 26.x UIGlassEffect API surface
RCT_EXPORT_VIEW_PROPERTY(glassStyle, NSString)
RCT_EXPORT_VIEW_PROPERTY(tintIntensity, NSNumber)
RCT_EXPORT_VIEW_PROPERTY(interactive, BOOL)

@end
