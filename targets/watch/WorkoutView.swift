//  WorkoutView.swift
//  FLUIDBODY+ Watch (Phase 3, 07.10.2026)
//
//  Écran simple : fréquence cardiaque, kcal actives, temps, bouton pause.
//  Au repos : invitation à lancer une séance depuis l'iPhone.
//  Couleurs de l'app : océan + lime. Accessibilité : chaque valeur a un
//  libellé VoiceOver, Dynamic Type géré par les styles de police système.

import SwiftUI

struct WorkoutView: View {
    @ObservedObject private var manager = WorkoutManager.shared

    private let lime = Color(red: 174/255, green: 239/255, blue: 77/255)
    private let ocean = Color(red: 0/255, green: 14/255, blue: 24/255)

    var body: some View {
        ZStack {
            ocean.ignoresSafeArea()
            switch manager.phase {
            case .idle: idleView
            case .ended: endedView
            case .running, .paused: liveView
            }
        }
    }

    private var idleView: some View {
        VStack(spacing: 8) {
            Text("FLUIDBODY+")
                .font(.headline)
                .foregroundStyle(lime)
            Text("Lance une séance sur ton iPhone : elle démarre ici automatiquement.")
                .font(.footnote)
                .multilineTextAlignment(.center)
                .foregroundStyle(.white.opacity(0.85))
        }
        .padding()
    }

    private var endedView: some View {
        VStack(spacing: 6) {
            Image(systemName: "checkmark.circle.fill")
                .font(.largeTitle)
                .foregroundStyle(lime)
                .accessibilityHidden(true)
            Text("Séance enregistrée dans Santé")
                .font(.footnote)
                .multilineTextAlignment(.center)
                .foregroundStyle(.white)
        }
        .padding()
    }

    private var liveView: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(timeString(manager.elapsed))
                .font(.system(.title2, design: .rounded).monospacedDigit().weight(.semibold))
                .foregroundStyle(lime)
                .accessibilityLabel("Temps écoulé \(Int(manager.elapsed) / 60) minutes \(Int(manager.elapsed) % 60) secondes")

            HStack(spacing: 4) {
                Text(manager.heartRate > 0 ? "\(Int(manager.heartRate.rounded()))" : "…")
                    .font(.system(.title, design: .rounded).monospacedDigit().weight(.bold))
                    .foregroundStyle(.white)
                Image(systemName: "heart.fill")
                    .foregroundStyle(.red)
                    .symbolEffect(.pulse, options: .repeating, isActive: manager.phase == .running && manager.heartRate > 0)
                    .accessibilityHidden(true)
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel(manager.heartRate > 0 ? "Fréquence cardiaque \(Int(manager.heartRate.rounded())) battements par minute" : "Fréquence cardiaque en attente")

            Text("\(Int(manager.activeCalories.rounded())) KCAL")
                .font(.system(.headline, design: .rounded).monospacedDigit())
                .foregroundStyle(Color(red: 1, green: 0.23, blue: 0.19))
                .accessibilityLabel("\(Int(manager.activeCalories.rounded())) kilocalories actives")

            Spacer(minLength: 2)

            Button {
                manager.togglePause()
            } label: {
                Label(manager.phase == .running ? "Pause" : "Reprendre",
                      systemImage: manager.phase == .running ? "pause.fill" : "play.fill")
                    .frame(maxWidth: .infinity)
            }
            .tint(manager.phase == .running ? .white.opacity(0.25) : lime)
            .buttonStyle(.borderedProminent)
        }
        .padding(.horizontal, 6)
        .opacity(manager.phase == .paused ? 0.75 : 1)
    }

    private func timeString(_ t: TimeInterval) -> String {
        let total = Int(t)
        let h = total / 3600, m = (total % 3600) / 60, s = total % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%02d:%02d", m, s)
    }
}
