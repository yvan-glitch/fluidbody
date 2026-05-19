import ActivityKit
import Foundation

/// Live Activity payload pour une séance Fluidbody en cours.
///
/// Static (`Attributes`) : ne change pas pendant la séance.
/// Dynamic (`ContentState`) : pushé depuis JS via `update`.
///
/// `startedAt` permet aux vues SwiftUI d'utiliser `Text(timerInterval:)` pour
/// faire tourner le chrono sans réveiller la couche JS — Apple budgétise
/// les updates à ~1/s par activity.
public struct FluidSessionAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public var elapsedSec: Int
    public var totalSec: Int
    public var bpm: Int?
    public var progress: Double

    public init(elapsedSec: Int, totalSec: Int, bpm: Int?, progress: Double) {
      self.elapsedSec = elapsedSec
      self.totalSec = totalSec
      self.bpm = bpm
      self.progress = max(0, min(1, progress))
    }
  }

  public var sessionTitle: String
  public var pillarLabel: String
  public var pillarColorHex: String
  public var startedAt: Date

  public init(sessionTitle: String, pillarLabel: String, pillarColorHex: String, startedAt: Date) {
    self.sessionTitle = sessionTitle
    self.pillarLabel = pillarLabel
    self.pillarColorHex = pillarColorHex
    self.startedAt = startedAt
  }
}
