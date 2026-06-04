//  FluidBodyWatchApp.swift
//  FluidBody+ Watch — point d'entrée de l'app montre.
//
//  ⚠️ Échafaudage non compilé.

import SwiftUI

@main
struct FluidBodyWatchApp: App {
    // Active la session WatchConnectivity dès le lancement pour pouvoir
    // recevoir l'ordre « démarre la séance » envoyé par le téléphone.
    init() {
        _ = WatchConnectivityManager.shared
    }

    var body: some Scene {
        WindowGroup {
            WorkoutView()
        }
    }
}
