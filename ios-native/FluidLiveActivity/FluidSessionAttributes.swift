// Copie identique au fichier du target widget — partagée via le bridge
// Swift. Garder les deux fichiers en sync : ils définissent la *même* struct
// `FluidSessionAttributes` côté app principale et côté widget extension.
// (Pas d'App Group requis pour ça ; chaque target compile sa propre copie.)
//
// Si tu changes ContentState, met à jour aussi
// `targets/live-activity/FluidSessionAttributes.swift`.

import ActivityKit
import Foundation

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
