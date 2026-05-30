// LiquidGlassTVView — tvOS 26 native "Liquid Glass" view.
//
// Research (WWDC25): UIGlassEffect ships on tvOS 26 exactly like iOS 26 —
// it's a UIVisualEffect subclass usable inside a UIVisualEffectView, with
// the same `tintColor` / `isInteractive` knobs. So on tvOS 26 we use the
// real system material; on tvOS < 26 we fall back to a dark ultra-thin
// blur + hand-rolled overlays (still native, far cheaper than the JS
// BlurView fallback the app shipped on build #85).
//
// This file is a SEPARATE module from the iPhone LiquidGlassView so the
// working iOS binary (build #84/#85) is never touched. The whole body is
// wrapped in `#if os(tvOS)` so it compiles to nothing if it ever lands in
// a non-TV target.
//
// Layers, bottom → top:
//   1. effectView      — UIGlassEffect (tvOS 26) or UIBlurEffect(.dark) (older)
//   2. specularLayer   — animated diagonal sheen sweeping L→R (CABasicAnimation)
//   3. topReflection   — 1pt bright line along the top edge (glass catching light)
//   4. borderLayer     — luminous edge gradient, lime accent when accent="green"
//
// Focus: tvOS focus is owned by the JS TouchableOpacity that wraps this
// view (the view itself isn't in the focus chain), so intensification is
// driven by the `glassFocused` prop rather than didUpdateFocus — that's
// the reliable RN path. When focused we brighten the tint, ramp the sheen
// opacity, and intensify the border. We ALSO override didUpdateFocus as a
// harmless secondary signal in case the view ever becomes focusable.

#if os(tvOS)
import UIKit

@objc(LiquidGlassTVView)
class LiquidGlassTVView: UIView {

    // MARK: - Subviews / layers

    private let effectView = UIVisualEffectView()
    private let specularLayer = CAGradientLayer()
    private let topReflection = CALayer()
    private let borderLayer = CAGradientLayer()
    private let borderMask = CAShapeLayer()

    private let sweepKey = "liquidGlassSheen"

    // MARK: - Exposed props (set from JS via RCTViewManager)

    @objc var glassIntensity: NSNumber = 1.0 {
        didSet { updateTint() }
    }

    @objc var glassTint: UIColor? {
        didSet { updateTint() }
    }

    @objc var borderStyle: NSString = "subtle" {
        didSet { updateBorder() }
    }

    // "cyan" (default) | "green" — drives the border + sheen accent so the
    // TV card matches the JS GlassCardTV accent prop.
    @objc var accent: NSString = "cyan" {
        didSet { updateBorder() }
    }

    // Driven by the wrapping TouchableOpacity's focus state in JS.
    @objc var glassFocused: Bool = false {
        didSet { applyFocus(animated: true) }
    }

    @objc var glassCornerRadius: NSNumber = 0 {
        didSet {
            let r = CGFloat(truncating: glassCornerRadius)
            layer.cornerRadius = r
            effectView.layer.cornerRadius = r
            effectView.clipsToBounds = true
            setNeedsLayout()
        }
    }

    // MARK: - Init

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupView()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupView()
    }

    // MARK: - Setup

    private func setupView() {
        if #available(tvOS 26.0, *) {
            effectView.effect = makeGlassEffect(focused: false)
        } else {
            // Native fallback for tvOS < 26 — still a real UIVisualEffectView,
            // not the JS BlurView. NOTE: the iOS `.system*Material*` styles
            // are unavailable on tvOS; tvOS only ships the classic blur styles
            // (.light/.extraLight/.dark/.regular/.prominent). `.dark` is the
            // closest match to the dark substrate the app wants.
            effectView.effect = UIBlurEffect(style: .dark)
        }
        effectView.frame = bounds
        effectView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        effectView.clipsToBounds = true
        addSubview(effectView)

        // Specular sheen — a near-clear → faint-white → near-clear horizontal
        // band, three times wider than the view, swept L→R forever. Lives on
        // the effect view's contentView so it composites with the blur.
        specularLayer.startPoint = CGPoint(x: 0, y: 0)
        specularLayer.endPoint = CGPoint(x: 1, y: 0)
        specularLayer.locations = [0.0, 0.5, 1.0]
        specularLayer.opacity = 0.0
        effectView.contentView.layer.addSublayer(specularLayer)

        // 1pt top reflection — the brightest single line, like the lip of a
        // pane of glass catching overhead light.
        topReflection.backgroundColor = UIColor(white: 1.0, alpha: 0.55).cgColor
        layer.addSublayer(topReflection)

        // Luminous edge gradient masked to a 1.5pt ring.
        borderLayer.startPoint = CGPoint(x: 0.5, y: 0)
        borderLayer.endPoint = CGPoint(x: 0.5, y: 1)
        borderLayer.mask = borderMask
        layer.addSublayer(borderLayer)

        updateSpecularColors()
        applyBorderColors(for: borderStyle as String)
        clipsToBounds = false

        startSweep()
    }

    @available(tvOS 26.0, *)
    private func makeGlassEffect(focused: Bool) -> UIVisualEffect {
        let glass = UIGlassEffect()
        // Subtle accent tint; brighter when focused so the card "lifts" on
        // the Siri Remote. nil tint keeps the pure system look at rest.
        if focused {
            glass.tintColor = accentColor().withAlphaComponent(0.22)
        }
        // Interactive glass reacts to the focus/press ripple on tvOS.
        glass.isInteractive = true
        return glass
    }

    // MARK: - Layout

    override func layoutSubviews() {
        super.layoutSubviews()

        let radius = layer.cornerRadius
        effectView.layer.cornerRadius = radius

        // Sheen band: 3× width so it can slide fully across.
        specularLayer.frame = CGRect(
            x: 0, y: 0, width: bounds.width * 3, height: bounds.height
        )

        // Top reflection line, inset to follow the corner radius.
        let inset = min(radius, 8)
        topReflection.frame = CGRect(
            x: inset, y: 0, width: max(0, bounds.width - inset * 2), height: 1
        )

        borderLayer.frame = bounds
        let outer = UIBezierPath(roundedRect: bounds, cornerRadius: radius)
        let innerRect = bounds.insetBy(dx: 1.5, dy: 1.5)
        let inner = UIBezierPath(
            roundedRect: innerRect,
            cornerRadius: max(0, radius - 1.5)
        )
        outer.append(inner.reversing())
        borderMask.path = outer.cgPath
        borderMask.frame = bounds
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        // Re-arm the sweep if the view was detached and re-attached (CA strips
        // animations when a layer leaves the window).
        if window != nil {
            startSweep()
        }
    }

    // MARK: - Sweep animation

    private func startSweep() {
        specularLayer.removeAnimation(forKey: sweepKey)
        let anim = CABasicAnimation(keyPath: "position.x")
        // Slide the (3× wide) band so its bright centre crosses the view.
        anim.fromValue = -bounds.width
        anim.toValue = bounds.width * 2
        anim.duration = glassFocused ? 3.2 : 6.0
        anim.repeatCount = .infinity
        anim.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        specularLayer.add(anim, forKey: sweepKey)
    }

    // MARK: - Prop application

    private func accentColor() -> UIColor {
        if (accent as String) == "green" {
            // Fluidbody lime #B8E62E
            return UIColor(red: 184/255, green: 230/255, blue: 46/255, alpha: 1)
        }
        // Bioluminescent cyan
        return UIColor(red: 120/255, green: 220/255, blue: 255/255, alpha: 1)
    }

    private func updateSpecularColors() {
        let clear = UIColor(white: 1.0, alpha: 0.0).cgColor
        let band = UIColor(white: 1.0, alpha: 0.14).cgColor
        specularLayer.colors = [clear, band, clear]
    }

    private func updateTint() {
        let scale = max(0, min(1, CGFloat(truncating: glassIntensity)))
        if let tint = glassTint {
            effectView.contentView.backgroundColor =
                tint.withAlphaComponent(0.06 * scale)
        } else {
            effectView.contentView.backgroundColor = .clear
        }
    }

    private func updateBorder() {
        applyBorderColors(for: borderStyle as String)
    }

    private func applyBorderColors(for style: String) {
        let tint = accentColor()
        switch style {
        case "off":
            borderLayer.isHidden = true
            topReflection.isHidden = true
        case "bright":
            borderLayer.isHidden = false
            topReflection.isHidden = false
            borderLayer.colors = [
                tint.withAlphaComponent(0.85).cgColor,
                tint.withAlphaComponent(0.35).cgColor,
                tint.withAlphaComponent(0.15).cgColor,
            ]
        case "subtle":
            fallthrough
        default:
            borderLayer.isHidden = false
            topReflection.isHidden = false
            borderLayer.colors = [
                tint.withAlphaComponent(0.55).cgColor,
                tint.withAlphaComponent(0.20).cgColor,
                tint.withAlphaComponent(0.08).cgColor,
            ]
        }
    }

    // MARK: - Focus

    private func applyFocus(animated: Bool) {
        let work = {
            self.specularLayer.opacity = self.glassFocused ? 1.0 : 0.0
            self.borderLayer.opacity = self.glassFocused ? 1.0 : 0.85
            self.topReflection.opacity = self.glassFocused ? 1.0 : 0.7
        }
        if animated {
            let t = CATransaction.begin()
            CATransaction.setAnimationDuration(0.22)
            work()
            CATransaction.commit()
            _ = t
        } else {
            CATransaction.begin()
            CATransaction.setDisableActions(true)
            work()
            CATransaction.commit()
        }

        // Re-arm the sweep at the focus-appropriate speed.
        startSweep()

        // Animate the glass tint to the focused/unfocused variant on tvOS 26.
        if #available(tvOS 26.0, *) {
            let target = makeGlassEffect(focused: glassFocused)
            if animated {
                UIView.animate(withDuration: 0.25) {
                    self.effectView.effect = target
                }
            } else {
                effectView.effect = target
            }
        }
    }

    // Secondary, harmless focus signal — the view normally isn't focusable
    // (the RN TouchableOpacity above it is), but if a future layout makes it
    // focusable we still react.
    override func didUpdateFocus(
        in context: UIFocusUpdateContext,
        with coordinator: UIFocusAnimationCoordinator
    ) {
        super.didUpdateFocus(in: context, with: coordinator)
        let nowFocused = (context.nextFocusedView == self)
        if nowFocused != glassFocused {
            glassFocused = nowFocused
        }
    }
}
#endif
