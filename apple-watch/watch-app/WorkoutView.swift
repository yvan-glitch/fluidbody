//  WorkoutView.swift
//  FluidBody+ Watch
//
//  L'écran au poignet, façon FitOn : compte à rebours d'intro, puis timer +
//  gros BPM + calories + boutons. Couleurs reprises de l'app (océan + lime).
//
//  ⚠️ Échafaudage non compilé.

import SwiftUI

struct WorkoutView: View {
    @StateObject private var manager = WorkoutManager.shared
    @State private var countdown: Int = 3      // 3..2..1 avant de lancer
    @State private var started = false

    private let lime = Color(red: 174/255, green: 239/255, blue: 77/255)
    private let ocean = Color(red: 0/255, green: 14/255, blue: 24/255)

    var body: some View {
        ZStack {
            ocean.ignoresSafeArea()

            if !started {
                countdownView
            } else {
                liveView
            }
        }
        .onAppear {
            Task { await manager.requestAuthorization() }
        }
    }

    // MARK: Compte à rebours d'intro
    private var countdownView: some View {
        VStack(spacing: 6) {
            Text(manager.seanceTitle)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white.opacity(0.8))
            Text("\(countdown)")
                .font(.system(size: 64, weight: .heavy, design: .rounded))
                .foregroundStyle(lime)
                .contentTransition(.numericText())
        }
        .onAppear { tickCountdown() }
    }

    private func tickCountdown() {
        guard countdown > 0 else {
            started = true
            manager.start(title: manager.seanceTitle, plannedDuration: manager.plannedDuration)
            return
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            countdown -= 1
            tickCountdown()
        }
    }

    // MARK: Écran en séance
    private var liveView: some View {
        VStack(spacing: 8) {
            // Fréquence cardiaque — la star, comme FitOn
            HStack(spacing: 6) {
                Image(systemName: "heart.fill")
                    .foregroundStyle(.red)
                    .symbolEffect(.pulse, options: .repeating)
                Text(manager.heartRate > 0 ? "\(Int(manager.heartRate))" : "--")
                    .font(.system(size: 44, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                Text("BPM").font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.5))
            }

            // Timer
            Text(timeString(manager.elapsed))
                .font(.system(size: 26, weight: .medium, design: .monospaced))
                .foregroundStyle(lime)

            // Calories
            Text("\(Int(manager.activeCalories)) kcal")
                .font(.system(size: 13))
                .foregroundStyle(.white.opacity(0.6))

            Spacer(minLength: 4)

            // Contrôles
            HStack(spacing: 12) {
                Button {
                    manager.togglePause()
                } label: {
                    Image(systemName: manager.isRunning ? "pause.fill" : "play.fill")
                        .frame(maxWidth: .infinity)
                }
                .tint(.white.opacity(0.2))

                Button {
                    manager.end()
                } label: {
                    Image(systemName: "stop.fill")
                        .frame(maxWidth: .infinity)
                }
                .tint(.red.opacity(0.7))
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(.horizontal, 8)
    }

    private func timeString(_ t: TimeInterval) -> String {
        let m = Int(t) / 60, s = Int(t) % 60
        return String(format: "%02d:%02d", m, s)
    }
}
