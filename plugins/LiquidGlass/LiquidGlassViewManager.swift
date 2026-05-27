// LiquidGlassViewManager — RCTViewManager that exposes LiquidGlassView to
// React Native. The Obj-C bridge (LiquidGlass.m) declares the property
// exports via RCT_EXTERN_MODULE so we don't need a Swift→Obj-C generated
// header here.

import React
import UIKit

@objc(LiquidGlassViewManager)
class LiquidGlassViewManager: RCTViewManager {

    override static func requiresMainQueueSetup() -> Bool {
        return true
    }

    override func view() -> UIView! {
        return LiquidGlassView()
    }
}
