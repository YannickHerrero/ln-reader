import Foundation
import SwiftUI

struct AudiobookControlsView: View {
    let player: AudiobookPlayer
    let palette: ReaderPalette

    var body: some View {
        VStack(spacing: 10) {
            switch player.state {
            case .preparing:
                preparationControls
            case .failed:
                failureControls
            case .playing, .paused, .finished:
                playbackControls
            case .idle:
                EmptyView()
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 10)
        .foregroundStyle(palette.foreground)
        .background(palette.surface.opacity(0.98))
        .overlay(alignment: .top) { Rectangle().fill(palette.border).frame(height: 1) }
        .accessibilityIdentifier("audiobook-controls")
    }

    private var preparationControls: some View {
        HStack(spacing: 12) {
            ProgressView(value: player.generationProgress)
                .tint(palette.accent)
                .frame(width: 72)
            VStack(alignment: .leading, spacing: 2) {
                Text("Création du livre audio…")
                    .font(.subheadline.weight(.bold))
                if let manifest = player.manifest {
                    Text("Segment \(manifest.generatedSegments) sur \(manifest.totalSegments) · OpenAI")
                        .font(.caption)
                        .foregroundStyle(palette.secondary)
                } else {
                    Text("Préparation de la narration OpenAI")
                        .font(.caption)
                        .foregroundStyle(palette.secondary)
                }
            }
            Spacer()
            closeButton
        }
    }

    private var failureControls: some View {
        HStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(palette.accent)
            VStack(alignment: .leading, spacing: 2) {
                Text("Narration indisponible")
                    .font(.subheadline.weight(.bold))
                Text(player.errorMessage ?? "Touchez de nouveau le bouton audio pour réessayer.")
                    .font(.caption)
                    .foregroundStyle(palette.secondary)
                    .lineLimit(2)
            }
            Spacer()
            closeButton
        }
    }

    private var playbackControls: some View {
        VStack(spacing: 8) {
            ProgressView(value: player.chapterProgress)
                .tint(palette.accent)
            HStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(player.chapterTitle ?? "Livre audio")
                        .font(.caption.weight(.bold))
                        .lineLimit(1)
                    Text("Voix IA OpenAI · \(timeLabel)")
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(palette.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Button { player.skip(by: -15) } label: {
                    Image(systemName: "gobackward.15")
                }
                .accessibilityLabel("Reculer de 15 secondes")

                Button { player.togglePlayback() } label: {
                    Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                        .font(.title3)
                }
                .accessibilityLabel(player.isPlaying ? "Mettre la narration en pause" : "Reprendre la narration")

                Button { player.skip(by: 15) } label: {
                    Image(systemName: "goforward.15")
                }
                .accessibilityLabel("Avancer de 15 secondes")

                Menu {
                    ForEach([0.75, 1, 1.25, 1.5, 2], id: \.self) { rate in
                        Button {
                            player.setPlaybackRate(rate)
                        } label: {
                            if player.playbackRate == rate {
                                Label(rateLabel(rate), systemImage: "checkmark")
                            } else {
                                Text(rateLabel(rate))
                            }
                        }
                    }
                } label: {
                    Text(rateLabel(player.playbackRate))
                        .font(.caption.monospacedDigit().weight(.bold))
                }
                .accessibilityLabel("Vitesse de narration")

                closeButton
            }
            .buttonStyle(.plain)
        }
    }

    private var closeButton: some View {
        Button { player.stop() } label: {
            Image(systemName: "xmark")
                .frame(width: 30, height: 30)
                .background(palette.background, in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Arrêter la narration")
    }

    private var timeLabel: String {
        "\(formattedTime(player.elapsed)) / \(formattedTime(player.duration))"
    }

    private func formattedTime(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds > 0 else { return "0:00" }
        let total = Int(seconds.rounded())
        return "\(total / 60):\(String(format: "%02d", total % 60))"
    }

    private func rateLabel(_ rate: Double) -> String {
        rate.formatted(.number.precision(.fractionLength(rate.rounded() == rate ? 0 : 2))) + "×"
    }
}
