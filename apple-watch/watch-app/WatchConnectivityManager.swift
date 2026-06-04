//  WatchConnectivityManager.swift
//  FluidBody+ Watch
//
//  Pont montre ↔ téléphone (WCSession). Reçoit l'ordre « démarre la séance X »
//  du téléphone et renvoie les ticks (BPM, temps, kcal) + le résumé final.
//
//  Côté téléphone, le module natif `WatchSessionBridge` (cf. ../ios-bridge/)
//  envoie/écoute les mêmes messages.
//
//  ⚠️ Échafaudage non compilé.

import Foundation
import WatchConnectivity

final class WatchConnectivityManager: NSObject, WCSessionDelegate {
    static let shared = WatchConnectivityManager()

    override init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    // MARK: Montre → Téléphone
    func sendTick(bpm: Double, elapsed: TimeInterval, calories: Double) {
        let payload: [String: Any] = [
            "type": "tick",
            "bpm": bpm,
            "elapsed": elapsed,
            "calories": calories,
        ]
        // sendMessage est temps réel mais nécessite l'app iPhone joignable ;
        // on tolère l'échec (le poignet reste la source de vérité de l'affichage).
        if WCSession.default.isReachable {
            WCSession.default.sendMessage(payload, replyHandler: nil, errorHandler: nil)
        }
    }

    func sendFinished(duration: TimeInterval, calories: Double, avgHeartRate: Double) {
        let payload: [String: Any] = [
            "type": "finished",
            "duration": duration,
            "calories": calories,
            "avgHeartRate": avgHeartRate,
        ]
        // transferUserInfo est garanti (file d'attente) même si l'app n'est pas
        // joignable à l'instant T → idéal pour un événement de fin important.
        WCSession.default.transferUserInfo(payload)
    }

    // MARK: Téléphone → Montre (réception)
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        guard let type = message["type"] as? String else { return }
        if type == "start" {
            let title = message["title"] as? String ?? "Pilates"
            let duration = message["plannedDuration"] as? TimeInterval ?? 0
            DispatchQueue.main.async {
                // Renseigne les métadonnées ; la vue lancera la workout après le
                // compte à rebours. (Ici on prépare le manager.)
                WorkoutManager.shared.start(title: title, plannedDuration: duration)
            }
        } else if type == "stop" {
            DispatchQueue.main.async { WorkoutManager.shared.end() }
        }
    }

    // MARK: Boilerplate WCSessionDelegate
    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {}
}
