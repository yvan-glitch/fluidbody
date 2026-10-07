//  FluidBodyWatchApp.swift
//  FLUIDBODY+ Watch (Phase 3, 07.10.2026) — point d'entrée.
//
//  L'iPhone lance l'app montre avec HKHealthStore.startWatchApp(with:) :
//  watchOS réveille l'app et appelle handle(_ workoutConfiguration:), qui
//  démarre directement la séance (le décompte 3·2·1 est déjà fait sur
//  l'iPhone).

import SwiftUI
import WatchKit
import HealthKit

final class AppDelegate: NSObject, WKApplicationDelegate {
    func applicationDidFinishLaunching() {
        _ = WatchConnectivityManager.shared
    }

    func handle(_ workoutConfiguration: HKWorkoutConfiguration) {
        Task { @MainActor in
            await WorkoutManager.shared.start(activityType: workoutConfiguration.activityType)
        }
    }
}

@main
struct FluidBodyWatchApp: App {
    @WKApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    init() {
        _ = WatchConnectivityManager.shared
    }

    var body: some Scene {
        WindowGroup {
            WorkoutView()
        }
    }
}
