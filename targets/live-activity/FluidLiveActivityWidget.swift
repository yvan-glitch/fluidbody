import SwiftUI
import WidgetKit
import ActivityKit

/// Widget bundle racine du target — déclare la Live Activity.
@main
struct FluidLiveActivityBundle: WidgetBundle {
  var body: some Widget {
    FluidSessionLiveActivity()
  }
}

struct FluidSessionLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: FluidSessionAttributes.self) { context in
      // ── Lock screen / StandBy ──
      FluidLockScreenView(context: context)
    } dynamicIsland: { context in
      let pillar = Color(hex: context.attributes.pillarColorHex, fallback: FluidPalette.jellyLime)

      return DynamicIsland {
        // ── Expanded (long-press / when other activity is folded) ──
        DynamicIslandExpandedRegion(.leading) {
          ZStack {
            Circle()
              .fill(pillar.opacity(0.25))
              .frame(width: 38, height: 38)
            FluidJellyfishGlyph()
              .foregroundStyle(pillar)
          }
          .padding(.leading, 4)
        }

        DynamicIslandExpandedRegion(.trailing) {
          FluidProgressRing(progress: context.state.progress, tint: pillar, size: 38, lineWidth: 3.5)
            .padding(.trailing, 4)
        }

        DynamicIslandExpandedRegion(.center) {
          VStack(spacing: 2) {
            Text(context.attributes.pillarLabel.uppercased())
              .font(.caption2)
              .foregroundStyle(pillar.opacity(0.85))
              .lineLimit(1)
            Text(context.attributes.sessionTitle)
              .font(.subheadline)
              .fontWeight(.semibold)
              .foregroundStyle(.white)
              .lineLimit(1)
          }
        }

        DynamicIslandExpandedRegion(.bottom) {
          HStack(spacing: 10) {
            Text(timerInterval: context.attributes.startedAt...Date().addingTimeInterval(60 * 60 * 4),
                 countsDown: false)
              .font(.system(.callout, design: .rounded).monospacedDigit())
              .foregroundStyle(.white.opacity(0.92))

            Spacer()

            if let bpm = context.state.bpm {
              Label("\(bpm)", systemImage: "heart.fill")
                .font(.caption)
                .foregroundStyle(FluidPalette.heart)
            }
          }
          .padding(.horizontal, 4)
        }
      } compactLeading: {
        FluidJellyfishGlyph()
          .foregroundStyle(pillar)
      } compactTrailing: {
        Text(timerInterval: context.attributes.startedAt...Date().addingTimeInterval(60 * 60 * 4),
             countsDown: false)
          .font(.caption.monospacedDigit())
          .foregroundStyle(.white)
          .frame(maxWidth: 44)
      } minimal: {
        // Visible quand plusieurs Live Activities coexistent — favoriser BPM
        // si dispo (signal "le user est en effort live"), sinon méduse.
        if let bpm = context.state.bpm {
          Text("\(bpm)")
            .font(.caption2.monospacedDigit())
            .foregroundStyle(FluidPalette.heart)
        } else {
          FluidJellyfishGlyph()
            .foregroundStyle(pillar)
        }
      }
      .widgetURL(URL(string: "fluidbody://session/active"))
      .keylineTint(pillar)
    }
  }
}
