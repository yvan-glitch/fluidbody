import Foundation
import ActivityKit
import React

/// React Native module that bridges JS → ActivityKit.
///
/// JS side calls `NativeModules.FluidLiveActivity.{start,update,end}`. All
/// promises resolve to `nil` no-op on iOS < 16.2 or if the user has disabled
/// Live Activities in Settings — the JS layer logs and continues.
///
/// Only one activity is held in memory at a time : starting a new one ends
/// the previous activity (matches our UX : 1 VideoPlayer = 1 activity).
@objc(FluidLiveActivity)
final class FluidLiveActivityModule: NSObject {

  private var currentActivityId: String?

  // MARK: - React Native plumbing

  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc func constantsToExport() -> [AnyHashable: Any]! {
    var supported = false
    if #available(iOS 16.2, *) {
      supported = ActivityAuthorizationInfo().areActivitiesEnabled
    }
    return [
      "supported": supported,
      "minIOS": "16.2",
    ]
  }

  // MARK: - Public RN methods

  @objc(start:resolver:rejecter:)
  func start(
    _ payload: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.2, *) else {
      resolve(nil)
      return
    }
    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
      reject("E_LIVE_ACTIVITY_DISABLED",
             "Live Activities disabled in Settings", nil)
      return
    }

    let sessionTitle = (payload["sessionTitle"] as? String) ?? "Séance"
    let pillarLabel  = (payload["pillarLabel"] as? String) ?? ""
    let pillarColor  = (payload["pillarColorHex"] as? String) ?? "#AEEF4D"
    let totalSec     = (payload["totalSec"] as? Int) ?? 0
    let elapsedSec   = (payload["elapsedSec"] as? Int) ?? 0
    let progress     = (payload["progress"] as? Double) ?? 0.0
    let bpm          = payload["bpm"] as? Int

    // Close any stale activity before starting a new one.
    Task { await self.endAllActivities() }

    let attrs = FluidSessionAttributes(
      sessionTitle: sessionTitle,
      pillarLabel: pillarLabel,
      pillarColorHex: pillarColor,
      startedAt: Date().addingTimeInterval(TimeInterval(-elapsedSec))
    )
    let state = FluidSessionAttributes.ContentState(
      elapsedSec: elapsedSec,
      totalSec: totalSec,
      bpm: bpm,
      progress: progress
    )

    do {
      let activity: Activity<FluidSessionAttributes>
      if #available(iOS 16.2, *) {
        activity = try Activity.request(
          attributes: attrs,
          content: .init(state: state, staleDate: nil),
          pushType: nil
        )
      } else {
        // Compiler is happy ; runtime guarded above.
        resolve(nil)
        return
      }
      currentActivityId = activity.id
      resolve(activity.id)
    } catch {
      reject("E_LIVE_ACTIVITY_REQUEST", error.localizedDescription, error)
    }
  }

  @objc(update:resolver:rejecter:)
  func update(
    _ payload: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.2, *) else { resolve(nil); return }
    guard let activityId = currentActivityId,
          let activity = Activity<FluidSessionAttributes>.activities
            .first(where: { $0.id == activityId })
    else {
      resolve(nil)
      return
    }

    let elapsedSec = (payload["elapsedSec"] as? Int) ?? activity.content.state.elapsedSec
    let totalSec   = (payload["totalSec"]   as? Int) ?? activity.content.state.totalSec
    let progress   = (payload["progress"]   as? Double) ?? activity.content.state.progress
    let bpm        = payload["bpm"] as? Int   // nil-aware : pas dans payload = on garde

    let nextBpm: Int? = payload["bpm"] is NSNull
      ? nil
      : (bpm ?? activity.content.state.bpm)

    let newState = FluidSessionAttributes.ContentState(
      elapsedSec: elapsedSec,
      totalSec: totalSec,
      bpm: nextBpm,
      progress: progress
    )

    Task {
      await activity.update(.init(state: newState, staleDate: nil))
      resolve(activityId)
    }
  }

  @objc(end:resolver:rejecter:)
  func end(
    _ payload: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.2, *) else { resolve(nil); return }
    guard let activityId = currentActivityId,
          let activity = Activity<FluidSessionAttributes>.activities
            .first(where: { $0.id == activityId })
    else {
      resolve(nil)
      return
    }

    let elapsedSec = (payload["elapsedSec"] as? Int) ?? activity.content.state.elapsedSec
    let totalSec   = (payload["totalSec"]   as? Int) ?? activity.content.state.totalSec
    let bpm        = payload["bpm"] as? Int

    let finalState = FluidSessionAttributes.ContentState(
      elapsedSec: elapsedSec,
      totalSec: totalSec,
      bpm: bpm,
      progress: 1.0
    )

    Task {
      // .immediate dismisses the activity right away ; pass .after(...) to
      // leave the result card visible for a moment if we want a celebration.
      await activity.end(.init(state: finalState, staleDate: nil), dismissalPolicy: .immediate)
      currentActivityId = nil
      resolve(nil)
    }
  }

  // MARK: - Helpers

  @available(iOS 16.2, *)
  private func endAllActivities() async {
    for a in Activity<FluidSessionAttributes>.activities {
      await a.end(nil, dismissalPolicy: .immediate)
    }
    currentActivityId = nil
  }
}
