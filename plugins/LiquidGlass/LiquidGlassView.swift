// LiquidGlassView — UIView wrapping iOS 26 UIGlassEffect with a luminous
// border gradient. Falls back to UIBlurEffect(.systemThinMaterial) on iOS
// 15.1–25 so the same component compiles and runs on older devices.
//
// Apple introduced UIGlassEffect at WWDC 2025 (iOS 26) as the UIKit hook
// for the system "Liquid Glass" material. It's a UIVisualEffect subclass,
// so it slots straight into a UIVisualEffectView.
//
// The border is a CAGradientLayer masked to a 1pt ring — top edge brighter
// than the bottom, like real glass catching light from above.

import UIKit

@objc(LiquidGlassView)
class LiquidGlassView: UIView {

    // MARK: - Subviews

    private let effectView = UIVisualEffectView()
    private let borderLayer = CAGradientLayer()
    private let borderMask = CAShapeLayer()

    // MARK: - Exposed props (set from JS via RCTViewManager)

    @objc var glassIntensity: NSNumber = 1.0 {
        didSet { updateIntensity() }
    }

    @objc var glassTint: UIColor? {
        didSet { updateTint() }
    }

    @objc var borderStyle: NSString = "subtle" {
        didSet { updateBorder() }
    }

    @objc var glassCornerRadius: NSNumber = 0 {
        didSet {
            layer.cornerRadius = CGFloat(truncating: glassCornerRadius)
            effectView.layer.cornerRadius = CGFloat(truncating: glassCornerRadius)
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
        // UIGlassEffect is the iOS 26 system material. On older OSes we
        // fall back to systemThinMaterial — visually close, just without
        // the refractive specular Apple ships in 26.
        if #available(iOS 26.0, *) {
            effectView.effect = makeGlassEffect()
        } else {
            effectView.effect = UIBlurEffect(style: .systemThinMaterial)
        }
        effectView.frame = bounds
        effectView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        effectView.clipsToBounds = true
        addSubview(effectView)

        // Luminous border — gradient from bright top to barely-there bottom.
        // CAGradientLayer is anchored to the view; the mask carves out a
        // 1pt ring so we only see the gradient on the edge.
        borderLayer.startPoint = CGPoint(x: 0.5, y: 0)
        borderLayer.endPoint = CGPoint(x: 0.5, y: 1)
        borderLayer.mask = borderMask
        layer.addSublayer(borderLayer)

        applyBorderColors(for: borderStyle as String)
        clipsToBounds = false
    }

    @available(iOS 26.0, *)
    private func makeGlassEffect() -> UIVisualEffect {
        // UIGlassEffect() with the default initializer matches the system
        // "Liquid Glass" look Apple uses across iOS 26 chrome.
        return UIGlassEffect()
    }

    // MARK: - Layout

    override func layoutSubviews() {
        super.layoutSubviews()

        let radius = layer.cornerRadius
        effectView.layer.cornerRadius = radius

        // Resize the gradient + rebuild the ring-shaped mask whenever the
        // bounds change. Both ops are cheap; layoutSubviews fires rarely.
        borderLayer.frame = bounds
        let outer = UIBezierPath(roundedRect: bounds, cornerRadius: radius)
        let inset = bounds.insetBy(dx: 1, dy: 1)
        let inner = UIBezierPath(
            roundedRect: inset,
            cornerRadius: max(0, radius - 1)
        )
        outer.append(inner.reversing())
        borderMask.path = outer.cgPath
        borderMask.frame = bounds
    }

    // MARK: - Prop application

    private func updateIntensity() {
        // glassIntensity nudges the tint alpha so the substrate can read
        // a touch denser when callers want a heavier material. The real
        // UIGlassEffect material itself is fixed by the system.
        guard let tint = glassTint else { return }
        let scale = max(0, min(1, CGFloat(truncating: glassIntensity)))
        effectView.contentView.backgroundColor =
            tint.withAlphaComponent(0.05 * scale)
    }

    private func updateTint() {
        guard let tint = glassTint else {
            effectView.contentView.backgroundColor = .clear
            return
        }
        effectView.contentView.backgroundColor = tint.withAlphaComponent(0.05)
    }

    private func updateBorder() {
        applyBorderColors(for: borderStyle as String)
    }

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
            borderLayer.colors = [
                UIColor.clear.cgColor,
                UIColor.clear.cgColor,
            ]
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
