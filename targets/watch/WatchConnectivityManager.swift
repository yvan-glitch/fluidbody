//  WatchConnectivityManager.swift
//  FLUIDBODY+ Watch (Phase 3, 07.10.2026)
//
//  Protocole (miroir de modules/fluidbody-watch côté iPhone) :
//    iPhone → montre : { type: "cmd", cmd: start|pause|resume|stop|cancel, title? }
//    montre → iPhone : { type: "live", hr, kcal, elapsed, phase }   ~1/s
//                      { type: "state", phase }                     à chaque changement
//                      { type: "ended", saved, duration, kcal }     fin de séance
//  Messages temps réel par sendMessage quand l'iPhone est joignable ; les
//  messages importants (ended, et stop/cancel côté iPhone) passent aussi par
//  transferUserInfo (livraison garantie, file d'attente).

import Foundation
import WatchConnectivity

final class WatchConnectivityManager: NSObject, WCSessionDelegate {
    static let shared = WatchConnectivityManager()

    override init() {
        super.init()
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func send(_ payload: [String: Any], guaranteed: Bool) {
        guard WCSession.isSupported() else { return }
        let s = WCSession.default
        guard s.activationState == .activated else { return }
        if s.isReachable {
            s.sendMessage(payload, replyHandler: nil, errorHandler: { _ in })
        }
        if guaranteed {
            s.transferUserInfo(payload)
        }
    }

    private func handle(_ message: [String: Any]) {
        guard (message["type"] as? String) == "cmd", let cmd = message["cmd"] as? String else { return }
        let title = message["title"] as? String
        Task { @MainActor in WorkoutManager.shared.handleCommand(cmd, title: title) }
    }

    // MARK: WCSessionDelegate
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) { handle(message) }
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) { handle(userInfo) }
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}
}
