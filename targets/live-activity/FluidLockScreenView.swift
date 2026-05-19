import SwiftUI
import WidgetKit
import ActivityKit

/// Vue lock screen + StandBy + Dynamic Island expanded — la "grande" carte
/// affichée quand l'utilisateur regarde explicitement la Live Activity.
struct FluidLockScreenView: View {
  let context: ActivityViewContext<FluidSessionAttributes>

  private var pillarColor: Color {
    Color(hex: context.attributes.pillarColorHex, fallback: FluidPalette.jellyLime)
  }

  var body: some View {
    HStack(alignment: .center, spacing: 14) {
      ZStack {
        Circle()
          .fill(
            RadialGradient(
              colors: [pillarColor.opacity(0.55), FluidPalette.deepNight],
              center: .center,
              startRadius: 4,
              endRadius: 32
            )
          )
          .frame(width: 56, height: 56)
        FluidJellyfishGlyph()
          .foregroundStyle(pillarColor)
      }

      VStack(alignment: .leading, spacing: 4) {
        Text(context.attributes.pillarLabel.uppercased())
          .font(.caption2)
          .fontWeight(.semibold)
          .foregroundStyle(pillarColor.opacity(0.85))
          .lineLimit(1)
        Text(context.attributes.sessionTitle)
          .font(.subheadline)
          .fontWeight(.semibold)
          .foregroundStyle(.white)
          .lineLimit(1)

        HStack(spacing: 10) {
          Text(timerInterval: context.attributes.startedAt...Date().addingTimeInterval(60 * 60 * 4),
               countsDown: false)
            .font(.system(.callout, design: .rounded).monospacedDigit())
            .foregroundStyle(.white.opacity(0.92))
            .frame(maxWidth: 60, alignment: .leading)

          if let bpm = context.state.bpm {
            Label("\(bpm)", systemImage: "heart.fill")
              .font(.caption)
              .foregroundStyle(FluidPalette.heart)
              .labelStyle(.titleAndIcon)
          }
        }
      }

      Spacer(minLength: 0)

      FluidProgressRing(progress: context.state.progress, tint: pillarColor, size: 44, lineWidth: 4)
    }
    .padding(.horizontal, 14)
    .padding(.vertical, 12)
    .background {
      LinearGradient(
        colors: [FluidPalette.deepNight, FluidPalette.lagoon],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
    }
    .activityBackgroundTint(FluidPalette.deepNight)
    .activitySystemActionForegroundColor(.white)
  }
}
