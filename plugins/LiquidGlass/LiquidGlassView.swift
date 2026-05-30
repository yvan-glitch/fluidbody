// LiquidGlassView (v2) — UIView wrapping Apple's iOS 26 UIGlassEffect
// ("Liquid Glass" material) with the FULL public API surface plus a couple
// of qualitative touches that aren't in UIKit:
//
//   • style       — UIGlassEffect.Style (.regular / .clear). There is NO
//                    public `.thin` / `.prominent` / `.depth` / `.adaptive`
//                    in the iOS 26.x SDK (verified against the WWDC25 "Build
//                    a UIKit app with the new design" session + the
//                    UIGlassEffect reference). We map the friendlier JS names
//                    onto the two real cases and emulate "prominent" by
//                    leaning the tint/border heavier — see styleFromJS().
//   • tintColor   — REAL stained-glass tint. Apple requires you to build a
//                    NEW UIGlassEffect with the tint and ANIMATE the view to
//                    it, which is what applyEffect() does via a property
//                    animator.
//   • isInteractive — REAL. The system expands the glass and adds highlights
//                    on touch. We also layer a custom specular burst at the
//                    tap point on top, because the brand look wants a lime
//                    catch the system bounce alone doesn't give.
//
// Non-UIKit extras (work on every OS):
//   • a CADisplayLink-driven specular reflection band that rakes diagonally
//     across the surface on an ~8s loop (paused under Reduce Motion / when
//     off-window), and
//   • a 1pt luminous border gradient (kept from v1).
//
// Fallback path (iOS 15.1–25): UIBlurEffect(.systemUltraThinMaterial) plus a
// soft-light tint overlay so the tint still reads, plus the same specular
// band and border. Everything is guarded so the file compiles and runs on
// pre-26 devices.
//
// IMPORTANT: iOS 26.0 ALREADY shipped style/tintColor/isInteractive. Build
// #86 used the bare `UIGlassEffect()` default and wired none of them — so v2
// is mostly about actually consuming the API that already existed, not about
// new 26.1/26.2 symbols (Apple added none to UIGlassEffect in the point
// releases).

import UIKit

@objc(LiquidGlassView)
class LiquidGlassView: UIView {

    // MARK: - Subviews / layers

    private let effectView = UIVisualEffectView()
    // Hosts the moving specular band + tap bursts; clipped to the corner
    // radius so the reflection never spills past the rounded edge. Sits
    // above the glass, below the RN children.
    private let specularHost = UIView()
    private let specularBand = CAGradientLayer()
    // Soft-light tint overlay — only used on the pre-26 fallback path, where
    // there's no native `tintColor`. On iOS 26 the tint lives on the effect.
    private let fallbackTintLayer = CALayer()
    private let borderLayer = CAGradientLayer()
    private let borderMask = CAShapeLayer()

    private var displayLink: CADisplayLink?
    private var reduceMotion: Bool = UIAccessibility.isReduceMotionEnabled
    // Coalesce the burst of prop didSet calls RN fires on mount/update into a
    // single effect rebuild on the next runloop tick.
    private var effectUpdateScheduled = false

    // MARK: - Exposed props (set from JS via RCTViewManager / RCT_EXPORT)

    // v1 props — kept so existing call sites that send `glassIntensity` /
    // `borderStyle` / `glassCornerRadius` keep working unchanged.
    @objc var glassIntensity: NSNumber = 1.0 {
        didSet { scheduleEffectUpdate() }
    }

    @objc var borderStyle: NSString = "subtle" {
        didSet { applyBorderColors(for: borderStyle as String) }
    }

    @objc var glassCornerRadius: NSNumber = 0 {
        didSet {
            let r = CGFloat(truncating: glassCornerRadius)
            layer.cornerRadius = r
            effectView.layer.cornerRadius = r
            specularHost.layer.cornerRadius = r
            effectView.clipsToBounds = true
            specularHost.clipsToBounds = true
            setNeedsLayout()
        }
    }

    // v2 props.

    // The tint COLOR of the glass. Reused name (`glassTint`) so the existing
    // Obj-C bridge export keeps working; on iOS 26 this becomes the real
    // `UIGlassEffect.tintColor`, on older OSes a soft-light overlay colour.
    @objc var glassTint: UIColor? {
        didSet { scheduleEffectUpdate() }
    }

    // 0…1 strength applied as the alpha of the tint colour. Lets JS pass an
    // opaque brand hex (#B8E62E) and dial intensity separately.
    @objc var tintIntensity: NSNumber = 0.18 {
        didSet { scheduleEffectUpdate() }
    }

    // "automatic" | "regular" | "thin" | "prominent" | "clear".
    @objc var glassStyle: NSString = "regular" {
        didSet { scheduleEffectUpdate() }
    }

    // System interactivity: glass expands + highlights on touch. We also add
    // a custom tap-burst recognizer when this is on.
    @objc var interactive: Bool = false {
        didSet { applyInteractive() }
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

    deinit {
        displayLink?.invalidate()
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - Setup

    private func setupView() {
        // Base material. On iOS 26 we start from a regular glass effect; the
        // first scheduleEffectUpdate() from JS props refines style/tint.
        if #available(iOS 26.0, *) {
            effectView.effect = UIGlassEffect(style: .regular)
        } else {
            effectView.effect = UIBlurEffect(style: .systemUltraThinMaterial)
        }
        effectView.frame = bounds
        effectView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        effectView.clipsToBounds = true
        addSubview(effectView)

        // Fallback tint overlay (soft-light) — hidden on iOS 26 where the tint
        // is baked into the effect itself.
        fallbackTintLayer.frame = bounds
        fallbackTintLayer.compositingFilter = "softLightBlendMode"
        fallbackTintLayer.isHidden = true
        effectView.contentView.layer.addSublayer(fallbackTintLayer)

        // Specular host sits above the glass. Non-interactive so it never
        // steals touches from the RN children above it.
        specularHost.frame = bounds
        specularHost.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        specularHost.isUserInteractionEnabled = false
        specularHost.clipsToBounds = true
        addSubview(specularHost)

        // Diagonal specular band — a translucent white wedge that the display
        // link slides across the surface. Horizontal gradient, transparent →
        // bright → transparent, rotated so it reads as raking light.
        specularBand.colors = [
            UIColor(white: 1.0, alpha: 0.0).cgColor,
            UIColor(white: 1.0, alpha: 0.10).cgColor,
            UIColor(white: 1.0, alpha: 0.0).cgColor,
        ]
        specularBand.locations = [0.0, 0.5, 1.0]
        specularBand.startPoint = CGPoint(x: 0, y: 0)
        specularBand.endPoint = CGPoint(x: 1, y: 0)
        specularBand.transform = CATransform3DMakeRotation(.pi / 9, 0, 0, 1) // ~20° rake
        specularHost.layer.addSublayer(specularBand)

        // Luminous 1pt border (kept from v1) — bright top → faint bottom.
        borderLayer.startPoint = CGPoint(x: 0.5, y: 0)
        borderLayer.endPoint = CGPoint(x: 0.5, y: 1)
        borderLayer.mask = borderMask
        layer.addSublayer(borderLayer)
        applyBorderColors(for: borderStyle as String)

        clipsToBounds = false

        // React to the user toggling Reduce Motion at runtime.
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(reduceMotionChanged),
            name: UIAccessibility.reduceMotionStatusDidChangeNotification,
            object: nil
        )
    }

    // MARK: - Window lifecycle (drives the display link)

    override func didMoveToWindow() {
        super.didMoveToWindow()
        if window != nil {
            startSpecularLoop()
        } else {
            stopSpecularLoop()
        }
    }

    // MARK: - Layout

    override func layoutSubviews() {
        super.layoutSubviews()

        let radius = layer.cornerRadius
        effectView.layer.cornerRadius = radius
        specularHost.layer.cornerRadius = radius

        CATransaction.begin()
        CATransaction.setDisableActions(true)
        fallbackTintLayer.frame = bounds

        // The band is one bounds-width wide and slid horizontally by the
        // display link; it's taller than the host so the rake fully covers
        // the corners at the top/bottom of its travel.
        specularBand.frame = CGRect(
            x: 0,
            y: -bounds.height * 0.5,
            width: bounds.width,
            height: bounds.height * 2.0
        )
        CATransaction.commit()

        // Border gradient + ring mask.
        borderLayer.frame = bounds
        let outer = UIBezierPath(roundedRect: bounds, cornerRadius: radius)
        let inset = bounds.insetBy(dx: 1, dy: 1)
        let inner = UIBezierPath(roundedRect: inset, cornerRadius: max(0, radius - 1))
        outer.append(inner.reversing())
        borderMask.path = outer.cgPath
        borderMask.frame = bounds
    }

    // MARK: - Effect (style + tint + intensity), coalesced

    private func scheduleEffectUpdate() {
        guard !effectUpdateScheduled else { return }
        effectUpdateScheduled = true
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.effectUpdateScheduled = false
            self.applyEffect()
        }
    }

    // Resolve the tint colour at its requested intensity (alpha), or nil.
    private func resolvedTint() -> UIColor? {
        guard let tint = glassTint else { return nil }
        var strength = CGFloat(truncating: tintIntensity)
        // "prominent" reads denser — give the tint a touch more presence.
        if (glassStyle as String).lowercased() == "prominent" {
            strength = min(1.0, strength * 1.6 + 0.04)
        }
        strength = max(0, min(1, strength * CGFloat(truncating: glassIntensity)))
        return tint.withAlphaComponent(strength)
    }

    @available(iOS 26.0, *)
    private func styleFromJS() -> UIGlassEffect.Style {
        // Only `.regular` and `.clear` exist publicly. Map the friendly names:
        //   clear / thin            → .clear  (more transparent, lighter)
        //   regular / automatic / prominent → .regular
        // ("prominent" stays .regular but gets a heavier tint via resolvedTint.)
        switch (glassStyle as String).lowercased() {
        case "clear", "thin":
            return .clear
        default:
            return .regular
        }
    }

    private func applyEffect() {
        let tint = resolvedTint()

        if #available(iOS 26.0, *) {
            // Apple's contract: to change tint/style you build a NEW
            // UIGlassEffect and animate the view onto it. A short property
            // animator gives the tint/style swap the liquid morph.
            let effect = UIGlassEffect(style: styleFromJS())
            effect.isInteractive = interactive
            effect.tintColor = tint
            fallbackTintLayer.isHidden = true

            let animator = UIViewPropertyAnimator(duration: 0.35, curve: .easeOut) {
                self.effectView.effect = effect
            }
            animator.startAnimation()
        } else {
            // Pre-26: keep the ultra-thin blur, drive the tint through the
            // soft-light overlay so it tints without killing translucency.
            if effectView.effect == nil {
                effectView.effect = UIBlurEffect(style: .systemUltraThinMaterial)
            }
            if let tint = tint {
                fallbackTintLayer.isHidden = false
                fallbackTintLayer.backgroundColor = tint.cgColor
            } else {
                fallbackTintLayer.isHidden = true
            }
        }
    }

    // MARK: - Interactivity

    private var tapRecognizer: UITapGestureRecognizer?

    private func applyInteractive() {
        // The native `isInteractive` lives on the effect, so re-apply it.
        scheduleEffectUpdate()

        if interactive {
            if tapRecognizer == nil {
                let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
                tap.cancelsTouchesInView = false // let RN children still receive the tap
                addGestureRecognizer(tap)
                tapRecognizer = tap
            }
        } else if let tap = tapRecognizer {
            removeGestureRecognizer(tap)
            tapRecognizer = nil
        }
    }

    @objc private func handleTap(_ gr: UITapGestureRecognizer) {
        let point = gr.location(in: specularHost)
        emitSpecularBurst(at: point)
    }

    // A radial lime/white catch that blooms and fades at the tap point —
    // complements the system's `isInteractive` expansion.
    private func emitSpecularBurst(at point: CGPoint) {
        if reduceMotion { return }
        let burst = CAGradientLayer()
        burst.type = .radial
        let accent = glassTint ?? UIColor.white
        burst.colors = [
            accent.withAlphaComponent(0.55).cgColor,
            accent.withAlphaComponent(0.0).cgColor,
        ]
        burst.locations = [0.0, 1.0]
        burst.startPoint = CGPoint(x: 0.5, y: 0.5)
        burst.endPoint = CGPoint(x: 1.0, y: 1.0)
        let size: CGFloat = max(bounds.width, bounds.height) * 0.9
        burst.frame = CGRect(x: point.x - size / 2, y: point.y - size / 2, width: size, height: size)
        specularHost.layer.addSublayer(burst)

        let scale = CABasicAnimation(keyPath: "transform.scale")
        scale.fromValue = 0.2
        scale.toValue = 1.0
        scale.duration = 0.5
        scale.timingFunction = CAMediaTimingFunction(name: .easeOut)

        let fade = CABasicAnimation(keyPath: "opacity")
        fade.fromValue = 1.0
        fade.toValue = 0.0
        fade.duration = 0.5
        fade.timingFunction = CAMediaTimingFunction(name: .easeOut)

        CATransaction.begin()
        CATransaction.setCompletionBlock { burst.removeFromSuperlayer() }
        burst.add(scale, forKey: "scale")
        burst.add(fade, forKey: "fade")
        burst.opacity = 0
        CATransaction.commit()
    }

    // MARK: - Specular sweep loop (CADisplayLink)

    private func startSpecularLoop() {
        guard displayLink == nil, !reduceMotion else {
            // Under Reduce Motion, park the band off-screen so it's invisible.
            if reduceMotion { positionSpecular(phase: -0.3) }
            return
        }
        let link = CADisplayLink(target: self, selector: #selector(stepSpecular(_:)))
        link.add(to: .main, forMode: .common)
        displayLink = link
    }

    private func stopSpecularLoop() {
        displayLink?.invalidate()
        displayLink = nil
    }

    @objc private func stepSpecular(_ link: CADisplayLink) {
        // 8s loop. phase 0…1 maps to the band travelling from fully off the
        // left edge to fully off the right edge.
        let period = 8.0
        let t = link.timestamp.truncatingRemainder(dividingBy: period) / period
        positionSpecular(phase: CGFloat(t))
    }

    private func positionSpecular(phase: CGFloat) {
        // Travel from -1 (off left) to +1 (off right) of the band's own width.
        let travel = (phase * 2.0 - 1.0)
        let dx = travel * bounds.width
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        // Preserve the rake rotation while translating.
        var t = CATransform3DMakeRotation(.pi / 9, 0, 0, 1)
        t = CATransform3DTranslate(t, dx, 0, 0)
        specularBand.transform = t
        CATransaction.commit()
    }

    @objc private func reduceMotionChanged() {
        reduceMotion = UIAccessibility.isReduceMotionEnabled
        if reduceMotion {
            stopSpecularLoop()
            positionSpecular(phase: -0.3)
        } else if window != nil {
            startSpecularLoop()
        }
    }

    // MARK: - Border

    private func applyBorderColors(for style: String) {
        switch style {
        case "bright":
            borderLayer.isHidden = false
            borderLayer.colors = [
                UIColor(white: 1.0, alpha: 0.70).cgColor,
                UIColor(white: 1.0, alpha: 0.30).cgColor,
                UIColor(white: 1.0, alpha: 0.15).cgColor,
            ]
        case "off":
            borderLayer.isHidden = true
            borderLayer.colors = [UIColor.clear.cgColor, UIColor.clear.cgColor]
        case "subtle":
            fallthrough
        default:
            borderLayer.isHidden = false
            borderLayer.colors = [
                UIColor(white: 1.0, alpha: 0.45).cgColor,
                UIColor(white: 1.0, alpha: 0.18).cgColor,
                UIColor(white: 1.0, alpha: 0.08).cgColor,
            ]
        }
    }
}
