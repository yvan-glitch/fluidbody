//  WorkoutManager.swift
//  FluidBody+ Watch
//
//  Cœur de l'app montre : démarre une HKWorkoutSession (.pilates) qui (1) garde
//  l'app éveillée écran allumé pendant la séance, (2) fournit un flux de
//  fréquence cardiaque ~1/sec via HKLiveWorkoutBuilder. Publie heartRate /
//  elapsed / activeCalories en @Published pour que la vue SwiftUI se mette à
//  jour en temps réel, et renvoie chaque "tick" au téléphone via WatchConnectivity.
//
//  ⚠️ Échafaudage non compilé — base à ajuster à la première compilation Xcode.

import Foundation
import HealthKit
import Combine

@MainActor
final class WorkoutManager: NSObject, ObservableObject {
    static let shared = WorkoutManager()

    private let healthStore = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?

    // État publié → la vue SwiftUI s'y abonne.
    @Published var heartRate: Double = 0          // BPM courant
    @Published var activeCalories: Double = 0     // kcal actives
    @Published var elapsed: TimeInterval = 0      // secondes depuis le début
    @Published var isRunning = false
    @Published var isAuthorized = false

    // Métadonnées de la séance en cours (envoyées par le téléphone).
    private(set) var seanceTitle: String = "Pilates"
    private(set) var plannedDuration: TimeInterval = 0

    private var timer: Timer?
    private var startDate: Date?

    // MARK: Autorisations HealthKit
    func requestAuthorization() async {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        let typesToShare: Set = [HKQuantityType.workoutType()]
        let typesToRead: Set = [
            HKQuantityType(.heartRate),
            HKQuantityType(.activeEnergyBurned),
        ]
        do {
            try await healthStore.requestAuthorization(toShare: typesToShare, read: typesToRead)
            isAuthorized = true
        } catch {
            isAuthorized = false
        }
    }

    // MARK: Démarrer une séance
    func start(title: String = "Pilates", plannedDuration: TimeInterval = 0) {
        guard !isRunning else { return }
        self.seanceTitle = title
        self.plannedDuration = plannedDuration

        let config = HKWorkoutConfiguration()
        config.activityType = .pilates          // = 66, cohérent avec l'app
        config.locationType = .indoor

        do {
            session = try HKWorkoutSession(healthStore: healthStore, configuration: config)
            builder = session?.associatedWorkoutBuilder()
            builder?.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: config)
            session?.delegate = self
            builder?.delegate = self

            let start = Date()
            startDate = start
            session?.startActivity(with: start)
            builder?.beginCollection(withStart: start) { [weak self] _, _ in
                Task { @MainActor in self?.isRunning = true }
            }
            startTicking()
        } catch {
            // En cas d'échec on reste silencieux côté UI ; à logger en debug.
        }
    }

    // MARK: Pause / Reprise
    func togglePause() {
        guard let session else { return }
        if session.state == .running {
            session.pause()
        } else if session.state == .paused {
            session.resume()
        }
    }

    // MARK: Terminer
    func end() {
        guard let session, let builder else { return }
        let endDate = Date()
        session.end()
        builder.endCollection(withEnd: endDate) { [weak self] _, _ in
            builder.finishWorkout { _, _ in
                Task { @MainActor in self?.cleanup() }
            }
        }
        // Renvoie un résumé final au téléphone.
        WatchConnectivityManager.shared.sendFinished(
            duration: elapsed,
            calories: activeCalories,
            avgHeartRate: heartRate
        )
    }

    private func cleanup() {
        timer?.invalidate(); timer = nil
        isRunning = false
        session = nil
        builder = nil
    }

    // MARK: Timer d'affichage (1 Hz) + tick vers le téléphone
    private func startTicking() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, let start = self.startDate else { return }
                self.elapsed = Date().timeIntervalSince(start)
                WatchConnectivityManager.shared.sendTick(
                    bpm: self.heartRate,
                    elapsed: self.elapsed,
                    calories: self.activeCalories
                )
            }
        }
    }
}

// MARK: - HKWorkoutSessionDelegate
extension WorkoutManager: HKWorkoutSessionDelegate {
    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession,
                                    didChangeTo toState: HKWorkoutSessionState,
                                    from fromState: HKWorkoutSessionState,
                                    date: Date) {}
    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession,
                                    didFailWithError error: Error) {}
}

// MARK: - HKLiveWorkoutBuilderDelegate (flux temps réel)
extension WorkoutManager: HKLiveWorkoutBuilderDelegate {
    nonisolated func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

    nonisolated func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder,
                                    didCollectDataOf collectedTypes: Set<HKSampleType>) {
        for type in collectedTypes {
            guard let quantityType = type as? HKQuantityType,
                  let stats = workoutBuilder.statistics(for: quantityType) else { continue }
            Task { @MainActor in
                if quantityType == HKQuantityType(.heartRate) {
                    let unit = HKUnit.count().unitDivided(by: .minute())
                    self.heartRate = stats.mostRecentQuantity()?.doubleValue(for: unit) ?? self.heartRate
                } else if quantityType == HKQuantityType(.activeEnergyBurned) {
                    let unit = HKUnit.kilocalorie()
                    self.activeCalories = stats.sumQuantity()?.doubleValue(for: unit) ?? self.activeCalories
                }
            }
        }
    }
}
