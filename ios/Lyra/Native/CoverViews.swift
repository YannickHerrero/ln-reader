import SwiftUI
import UIKit

struct CoverArtView: View {
    @Environment(\.lyraPalette) private var palette
    let data: Data?
    let title: String

    var body: some View {
        Group {
            if let data, let image = UIImage(data: data) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                ZStack {
                    LinearGradient(
                        colors: [palette.accent, palette.mauve],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    Text(title.prefix(1).uppercased())
                        .font(.system(size: 44, weight: .black, design: .serif))
                        .foregroundStyle(palette.onAccent)
                }
            }
        }
        .clipped()
        .accessibilityLabel("Couverture de \(title)")
    }
}

struct RemoteCoverView: View {
    @Environment(AppModel.self) private var model
    let url: String?
    let title: String
    @State private var data: Data?

    var body: some View {
        CoverArtView(data: data, title: title)
            .task(id: url) {
                guard let url, let api = model.api else { return }
                data = try? await api.asset(url: url)
            }
    }
}

struct SyncStatusPill: View {
    @Environment(AppModel.self) private var model
    @Environment(\.lyraPalette) private var palette

    private var phase: NativeSyncPhase {
        model.syncCoordinator?.phase ?? .idle
    }

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)
            Text(label)
                .font(.caption.weight(.semibold))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .foregroundStyle(palette.muted)
        .background(palette.surface, in: Capsule())
        .overlay { Capsule().stroke(palette.border) }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Synchronisation : \(label)")
    }

    private var label: String {
        switch phase {
        case .idle: "En attente"
        case .syncing: "Synchronisation"
        case .synced: "Synchronisé"
        case .offline: "Hors ligne"
        case .error: "Erreur"
        }
    }

    private var color: Color {
        switch phase {
        case .idle: palette.muted
        case .syncing: palette.peach
        case .synced: palette.green
        case .offline: palette.muted
        case .error: palette.red
        }
    }
}
