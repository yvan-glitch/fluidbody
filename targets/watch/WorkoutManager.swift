//  WorkoutManager.swift
//  FLUIDBODY+ Watch (Phase 3, 07.10.2026)
//
//  HKWorkoutSession (.pilates, repli .mindAndBody) + HKLiveWorkoutBuilder :
//  fréquence cardiaque ~1/s et calories actives en direct. Envoie à l'iPhone
//  un « live » par seconde et chaque changement d'état (pause / reprise /
//  fin), reçoit les commandes start / pause / resume / stop / cancel.
//  En fin de séance, finishWorkout() enregistre l'entraînement dans Santé
//  (type Pilates, durée, kcal) : il compte dans les anneaux. L'iPhone ne
//  sauvegarde alors PAS de workout (pas de doublon).
//
//  Règle : aucune erreur ne remonte en exception, tout échec est silencieux
//  côté UI et signalé à l'iPhone par un état.

import Foundation
import HealthKit

@MainActor
final class WorkoutManager: NSObject, ObservableObject {
    static let shared = WorkoutManager()

    enum Phase: String { case idle, running, paused, ended }

    private let healthStore = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var ticker: Timer?

    @Published var phase: Phase = .idle
    @Published var heartRate: Double = 0
    @Published var activeCalories: Double = 0
    @Published var elapsed: TimeInterval = 0
    @Published var title: String = "Pilates"

    // MARK: Autorisations
    func requestAuthorization() async -> Bool {
        guard HKHealthStore.isHealthDataAvailable() else { return false }
        let share: Set<HKSampleType> = [HKQuantityType.workoutType(), HKQuantityType(.activeEnergyBurned), HKQuantityType(.heartRate)]
        let read: Set<HKObjectType> = [HKQuantityType(.heartRate), HKQuantityType(.activeEnergyBurned), HKQuantityType.workoutType()]
        do {
            try await healthStore.requestAuthorization(toShare: share, read: read)
            return true
        } catch {
            return false
        }
    }

    // MARK: Démarrer
    func start(activityType: HKWorkoutActivityType = .pilates, title: String? = nil) async {
        if let title { self.title = title }
        guard session == nil else { return } // déjà en cours (start reçu 2 fois)
        _ = await requestAuthorization()

        func makeSession(_ type: HKWorkoutActivityType) -> HKWorkoutSession? {
            let config = HKWorkoutConfiguration()
            config.activityType = type
            config.locationType = .indoor
            return try? HKWorkoutSession(healthStore: healthStore, configuration: config)
        }
        guard let s = makeSession(activityType) ?? makeSession(.mindAndBody) else {
            sendState()
            return
        }
        let b = s.associatedWorkoutBuilder()
        b.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: s.workoutConfiguration)
        s.delegate = self
        b.delegate = self
        session = s
        builder = b
        heartRate = 0
        activeCalories = 0
        elapsed = 0

        let startDate = Date()
        s.startActivity(with: startDate)
        b.beginCollection(withStart: startDate) { _, _ in }
        phase = .running
        startTicker()
        sendState()
    }

    // MARK: Commandes
    func pause() { if session?.state == .running { session?.pause() } }
    func resume() { if session?.state == .paused { session?.resume() } }
    func togglePause() { phase == .running ? pause() : resume() }

    /// Termine et ENREGISTRE la séance dans Santé.
    func end() {
        guard let session, let builder else { return }
        stopTicker()
        session.end()
        let duration = builder.elapsedTime
        let kcal = activeCalories
        builder.endCollection(withEnd: Date()) { _, _ in
            builder.finishWorkout { workout, _ in
                Task { @MainActor in
                    WatchConnectivityManager.shared.send([
                        "type": "ended",
                        "saved": workout != nil,
                        "duration": duration,
                        "kcal": kcal,
                    ], guaranteed: true)
                    self.reset()
                }
            }
        }
    }

    /// Abandon (séance quittée tout de suite) : rien n'est enregistré.
    func cancel() {
        guard let session, let builder else { return }
        stopTicker()
        session.end()
        builder.discardWorkout()
        WatchConnectivityManager.shared.send(["type": "ended", "saved": false, "duration": 0, "kcal": 0], guaranteed: true)
        reset()
    }

    func handleCommand(_ cmd: String, title: String?) {
        switch cmd {
        case "start": Task { await start(title: title) }
        case "pause": pause()
        case "resume": resume()
        case "stop": end()
        case "cancel": cancel()
        default: break
        }
    }

    private func reset() {
        session = nil
        builder = nil
        phase = .ended
        sendState()
        // Retour à l'écran d'attente après quelques secondes.
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) { [weak self] in
            if self?.session == nil { self?.phase = .idle }
        }
    }

    // MARK: Envoi vers l'iPhone
    private func sendState() {
        WatchConnectivityManager.shared.send(["type": "state", "phase": phase.rawValue], guaranteed: false)
    }

    private func startTicker() {
        stopTicker()
        ticker = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, let builder = self.builder else { return }
                self.elapsed = builder.elapsedTime
                WatchConnectivityManager.shared.send([
                    "type": "live",
                    "hr": self.heartRate,
                    "kcal": self.activeCalories,
                    "elapsed": self.elapsed,
                    "phase": self.phase.rawValue,
                ], guaranteed: false)
            }
        }
    }

    private func stopTicker() {
        ticker?.invalidate()
        ticker = nil
    }
}

// MARK: - HKWorkoutSessionDelegate
extension WorkoutManager: HKWorkoutSessionDelegate {
    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession,
                                    didChangeTo toState: HKWorkoutSessionState,
                                    from fromState: HKWorkoutSessionState,
                                    date: Date) {
        Task { @MainActor in
            switch toState {
            case .running: self.phase = .running
            case .paused: self.phase = .paused
            default: return
            }
            self.sendState()
        }
    }

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        Task { @MainActor in
            self.stopTicker()
            self.session = nil
            self.builder = nil
            self.phase = .idle
            self.sendState()
        }
    }
}

// MARK: - HKLiveWorkoutBuilderDelegate
extension WorkoutManager: HKLiveWorkoutBuilderDelegate {
    nonisolated func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

    nonisolated func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder,
                                    didCollectDataOf collectedTypes: Set<HKSampleType>) {
        var hr: Double?
        var kcal: Double?
        for type in collectedTypes {
            guard let q = type as? HKQuantityType, let stats = workoutBuilder.statistics(for: q) else { continue }
            if q == HKQuantityType(.heartRate) {
                hr = stats.mostRecentQuantity()?.doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
            } else if q == HKQuantityType(.activeEnergyBurned) {
                kcal = stats.sumQuantity()?.doubleValue(for: .kilocalorie())
            }
        }
        Task { @MainActor in
            if let hr { self.heartRate = hr }
            if let kcal { self.activeCalories = kcal }
        }
    }
}
