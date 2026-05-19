import SwiftUI

/// Glyphe méduse simplifié — pas l'animation complète de l'app (les widgets
/// ne supportent que des animations très limitées via TimelineView).
/// Forme statique stylisée, à colorer via `.foregroundStyle`.
struct FluidJellyfishGlyph: View {
  var body: some View {
    Canvas { ctx, size in
      let w = size.width
      let h = size.height
      // Dôme
      var dome = Path()
      dome.addArc(
        center: CGPoint(x: w / 2, y: h * 0.42),
        radius: w * 0.32,
        startAngle: .degrees(180),
        endAngle: .degrees(0),
        clockwise: false
      )
      ctx.fill(dome, with: .color(.primary.opacity(0.95)))

      // Tentacules — 3 lignes ondulées
      for i in 0..<3 {
        var t = Path()
        let x0 = w * (0.32 + Double(i) * 0.18)
        t.move(to: CGPoint(x: x0, y: h * 0.42))
        t.addCurve(
          to: CGPoint(x: x0 + 4, y: h * 0.9),
          control1: CGPoint(x: x0 - 6, y: h * 0.6),
          control2: CGPoint(x: x0 + 10, y: h * 0.75)
        )
        ctx.stroke(t, with: .color(.primary.opacity(0.7)), lineWidth: 1.8)
      }
    }
    .frame(width: 22, height: 22)
    .accessibilityHidden(true)
  }
}
