import SwiftUI

/// Mini anneau de progression (0..1). Style cohérent avec les rings
/// de l'écran Activity / VideoPlayer.
struct FluidProgressRing: View {
  let progress: Double
  let tint: Color
  var size: CGFloat = 36
  var lineWidth: CGFloat = 3.5

  var body: some View {
    ZStack {
      Circle()
        .stroke(tint.opacity(0.18), lineWidth: lineWidth)
      Circle()
        .trim(from: 0, to: max(0, min(1, progress)))
        .stroke(
          tint,
          style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
        )
        .rotationEffect(.degrees(-90))
        .animation(.easeOut(duration: 0.4), value: progress)
    }
    .frame(width: size, height: size)
  }
}
