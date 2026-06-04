//  WatchSessionBridge.swift  (cible iPhone, pas la montre)
//  FluidBody+
//
//  Module natif React Native : permet à VideoPlayer.js de (1) lancer la séance
//  sur la montre, (2) recevoir les BPM temps réel renvoyés par la montre pour
//  les afficher aussi dans l'app (effet FitOn sur les deux écrans).
//
//  Exposé à JS sous le nom `WatchSession` :
//    NativeModules.WatchSession.startWatchWorkout({ title, plannedDuration })
//    NativeModules.WatchSession.stopWatchWorkout()
//    + événements: 'onWatchHeartRate' {bpm,elapsed,calories}, 'onWatchWorkoutEnded' {duration,calories,avgHeartRate}
//
//  ⚠️ Échafaudage non compilé.

import Foundation
import WatchConnectivity
import React

@objc(WatchSession)
final class WatchSessionBridge: RCTEventEmitter, WCSessionDelegate {

    private var hasListeners = false

    override init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    override static func requiresMainQueueSetup() -> Bool { true }
    override func supportedEvents() -> [String]! { ["onWatchHeartRate", "onWatchWorkoutEnded"] }
    override func startObserving() { hasListeners = true }
    override func stopObserving() { hasListeners = false }

    // MARK: API exposée à JS
    @objc(startWatchWorkout:resolver:rejecter:)
    func startWatchWorkout(_ info: NSDictionary,
                           resolver resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard WCSession.default.activationState == .activated else {
            resolve(["ok": false, "reason": "not-activated"]); return
        }
        var payload: [String: Any] = ["type": "start"]
        payload["title"] = info["title"] as? String ?? "Pilates"
        payload["plannedDuration"] = info["plannedDuration"] as? Double ?? 0
        if WCSession.default.isReachable {
            WCSession.default.sendMessage(payload, replyHandler: nil, errorHandler: nil)
            resolve(["ok": true])
        } else {
            // La montre n'est pas joignable (app montre fermée). On tente une
            // remise via le contexte applicatif pour qu'elle démarre au réveil.
            try? WCSession.default.updateApplicationContext(payload)
            resolve(["ok": true, "reachable": false])
        }
    }

    @objc(stopWatchWorkout)
    func stopWatchWorkout() {
        guard WCSession.default.isReachable else { return }
        WCSession.default.sendMessage(["type": "stop"], replyHandler: nil, errorHandler: nil)
    }

    // MARK: Montre → Téléphone (réception) → événements RN
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        guard hasListeners, let type = message["type"] as? String else { return }
        if type == "tick" {
            sendEvent(withName: "onWatchHeartRate", body: [
                "bpm": message["bpm"] ?? 0,
                "elapsed": message["elapsed"] ?? 0,
                "calories": message["calories"] ?? 0,
            ])
        }
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        guard hasListeners, (userInfo["type"] as? String) == "finished" else { return }
        sendEvent(withName: "onWatchWorkoutEnded", body: [
            "duration": userInfo["duration"] ?? 0,
            "calories": userInfo["calories"] ?? 0,
            "avgHeartRate": userInfo["avgHeartRate"] ?? 0,
        ])
    }

    // MARK: Boilerplate
    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {}
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) { WCSession.default.activate() }
}
