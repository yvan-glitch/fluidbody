//  FluidbodyWatchModule.swift
//  FLUIDBODY+ (Phase 3, 07.10.2026) — pont iPhone ↔ Apple Watch.
//
//  Module Expo (Swift, expo-modules-core) : compatible New Architecture, pas
//  de pont ObjC/TurboModule legacy. RÈGLE : aucune méthode ne lève
//  d'exception vers JS (leçon du crash iOS 26.5 de mai 2026) ; les échecs
//  sont renvoyés comme valeurs.
//
//  JS : modules/fluidbody-watch/index.js → src/hooks/useWatchLiveData.js
//  Montre : targets/watch/WatchConnectivityManager.swift (même protocole).

import ExpoModulesCore
#if os(iOS)
import WatchConnectivity
import HealthKit
#endif

public class FluidbodyWatchModule: Module {
  #if os(iOS)
  private lazy var bridge = WatchBridge()
  #endif

  public func definition() -> ModuleDefinition {
    Name("FluidbodyWatch")
    Events("onWatchMessage")

    OnStartObserving {
      #if os(iOS)
      self.bridge.onMessage = { [weak self] payload in
        self?.sendEvent("onWatchMessage", payload)
      }
      self.bridge.activate()
      #endif
    }

    OnStopObserving {
      #if os(iOS)
      self.bridge.onMessage = nil
      #endif
    }

    // { supported, activated, paired, installed, reachable }
    Function("getStatus") { () -> [String: Bool] in
      #if os(iOS)
      return self.bridge.status()
      #else
      return ["supported": false, "activated": false, "paired": false, "installed": false, "reachable": false]
      #endif
    }

    // Lance l'app montre en mode séance (HKHealthStore.startWatchApp), puis
    // envoie le titre. Résout { launched, error? } ; ne rejette jamais.
    AsyncFunction("startWorkout") { (title: String, promise: Promise) in
      #if os(iOS)
      self.bridge.startWorkout(title: title) { launched, error in
        var res: [String: Any] = ["launched": launched]
        if let error { res["error"] = error }
        promise.resolve(res)
      }
      #else
      promise.resolve(["launched": false, "error": "unsupported"])
      #endif
    }

    // pause | resume | stop | cancel → true si envoyé en temps réel.
    Function("sendCommand") { (cmd: String) -> Bool in
      #if os(iOS)
      return self.bridge.send(cmd: cmd, title: nil)
      #else
      return false
      #endif
    }
  }
}

#if os(iOS)
final class WatchBridge: NSObject, WCSessionDelegate {
  var onMessage: (([String: Any]) -> Void)?
  private let healthStore = HKHealthStore()
  private var activated = false

  func activate() {
    guard WCSession.isSupported(), !activated else { return }
    activated = true
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  func status() -> [String: Bool] {
    guard WCSession.isSupported() else {
      return ["supported": false, "activated": false, "paired": false, "installed": false, "reachable": false]
    }
    activate()
    let s = WCSession.default
    let act = s.activationState == .activated
    return [
      "supported": true,
      "activated": act,
      "paired": act && s.isPaired,
      "installed": act && s.isWatchAppInstalled,
      "reachable": act && s.isReachable,
    ]
  }

  func startWorkout(title: String, completion: @escaping (Bool, String?) -> Void) {
    let st = status()
    guard st["paired"] == true, st["installed"] == true, HKHealthStore.isHealthDataAvailable() else {
      completion(false, "no_watch")
      return
    }
    let config = HKWorkoutConfiguration()
    config.activityType = .pilates
    config.locationType = .indoor
    healthStore.startWatchApp(with: config) { [weak self] success, error in
      // Le titre part aussi en commande « start » : si l'app montre était
      // déjà ouverte, c'est ce message qui démarre la séance.
      _ = self?.send(cmd: "start", title: title)
      completion(success, error?.localizedDescription)
    }
  }

  @discardableResult
  func send(cmd: String, title: String?) -> Bool {
    guard WCSession.isSupported() else { return false }
    let s = WCSession.default
    guard s.activationState == .activated, s.isPaired, s.isWatchAppInstalled else { return false }
    var payload: [String: Any] = ["type": "cmd", "cmd": cmd]
    if let title { payload["title"] = title }
    if s.isReachable {
      s.sendMessage(payload, replyHandler: nil, errorHandler: { _ in })
      return true
    }
    // Fin de séance : livraison garantie même si la montre est hors de portée.
    if cmd == "stop" || cmd == "cancel" {
      s.transferUserInfo(payload)
    }
    return false
  }

  private func forward(_ payload: [String: Any]) {
    onMessage?(payload)
  }

  // MARK: WCSessionDelegate
  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    forward(["type": "reachability", "reachable": activationState == .activated && session.isReachable])
  }
  func sessionDidBecomeInactive(_ session: WCSession) {}
  func sessionDidDeactivate(_ session: WCSession) {
    // Changement de montre appairée : on réactive la session.
    WCSession.default.activate()
  }
  func sessionReachabilityDidChange(_ session: WCSession) {
    forward(["type": "reachability", "reachable": session.isReachable])
  }
  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    forward(message)
  }
  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    forward(userInfo)
  }
}
#endif
