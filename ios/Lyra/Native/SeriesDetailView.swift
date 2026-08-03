import SwiftUI

struct SeriesDetailView: View {
    @Environment(AppModel.self) private var model
    let seriesKey: String

    @State private var series: StoredSeries?
    @State private var chapters: [StoredChapter] = []
    @State private var progress: [String: ReadingProgress] = [:]
    @State private var downloadedKeys: Set<String> = []
    @State private var selectedVolumeKey: String?
    @State private var busyChapter: String?
    @State private var isRefreshing = false
    @State private var message: String?
    @AppStorage("lyra.native.chapter-order") private var chapterOrder = "descending"
    @AppStorage("lyra.native.hide-read") private var hideRead = false

    private var displayedChapters: [StoredChapter] {
        chapterOrder == "ascending" ? chapters.reversed() : chapters
    }

    private var groups: [NativeVolumeGroup] {
        var result: [NativeVolumeGroup] = []
        for chapter in displayedChapters {
            let key = volumeKey(chapter.chapter.volume)
            if let index = result.firstIndex(where: { $0.key == key }) {
                result[index].chapters.append(chapter)
            } else {
                result.append(NativeVolumeGroup(
                    key: key,
                    label: volumeLabel(chapter.chapter.volume),
                    chapters: [chapter]
                ))
            }
        }
        return result.map { group in
            var updated = group
            updated.totalCount = group.chapters.count
            updated.completedCount = group.chapters.filter { progress[$0.id]?.completed == true }.count
            if hideRead { updated.chapters.removeAll { progress[$0.id]?.completed == true } }
            return updated
        }.filter { !$0.chapters.isEmpty }
    }

    private var selectedGroup: NativeVolumeGroup? {
        groups.first(where: { $0.key == selectedVolumeKey }) ?? groups.first
    }

    private var currentProgress: ReadingProgress? {
        progress.values.max(by: { $0.lastReadAt < $1.lastReadAt })
    }

    private var startChapter: StoredChapter? {
        if let currentProgress { return chapters.first(where: { $0.id == currentProgress.chapterKey }) }
        return chapters.last
    }

    var body: some View {
        ScrollView {
            if let series {
                VStack(spacing: 0) {
                    hero(series)
                    chapterSection
                        .padding(.horizontal, 18)
                        .padding(.vertical, 26)
                }
            } else {
                ProgressView("Chargement de la série…")
                    .frame(maxWidth: .infinity)
                    .padding(.top, 100)
            }
        }
        .background(LyraDesign.background)
        .navigationTitle(series?.series.title ?? "Série")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button {
                    chapterOrder = chapterOrder == "ascending" ? "descending" : "ascending"
                } label: {
                    Text(chapterOrder == "ascending" ? "1→N" : "N→1")
                        .font(.caption.bold())
                }
                .accessibilityLabel("Changer l’ordre des chapitres")
                Button(action: refresh) {
                    Image(systemName: isRefreshing ? "hourglass" : "arrow.clockwise")
                }
                .disabled(isRefreshing)
                .accessibilityLabel("Actualiser la série")
            }
        }
        .task { await loadLocal() }
        .onChange(of: groups.map(\.key)) { _, keys in
            if selectedVolumeKey == nil || !keys.contains(selectedVolumeKey!) {
                selectedVolumeKey = keys.first
            }
        }
    }

    private func hero(_ item: StoredSeries) -> some View {
        ZStack(alignment: .bottom) {
            CoverArtView(data: model.covers[item.id], title: item.series.title)
                .frame(height: 460)
                .blur(radius: 22)
                .scaleEffect(1.12)
                .opacity(0.55)
            LinearGradient(
                colors: [.black.opacity(0.1), Color(uiColor: .systemBackground)],
                startPoint: .top,
                endPoint: .bottom
            )
            VStack(spacing: 14) {
                CoverArtView(data: model.covers[item.id], title: item.series.title)
                    .frame(width: 170, height: 250)
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                    .shadow(radius: 18)
                Text(item.series.status ?? "Roman")
                    .font(.caption.weight(.black))
                    .tracking(2)
                    .foregroundStyle(LyraDesign.accent)
                Text(item.series.title)
                    .font(.system(size: 31, weight: .black, design: .rounded))
                    .multilineTextAlignment(.center)
                if let author = item.series.author {
                    Text("par \(author)").foregroundStyle(.secondary)
                }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack {
                        ForEach(item.series.genres, id: \.self) { genre in
                            Text(genre)
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(LyraDesign.raised, in: Capsule())
                        }
                    }
                }
                if let description = item.series.description {
                    Text(description)
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .lineLimit(6)
                        .multilineTextAlignment(.center)
                }
                if let startChapter {
                    NavigationLink {
                        NativeReaderView(seriesKey: seriesKey, chapterKey: startChapter.id)
                    } label: {
                        Label(currentProgress == nil ? "Commencer · \(startChapter.chapter.title)" : "Continuer · \(startChapter.chapter.title)", systemImage: "play.fill")
                    }
                    .buttonStyle(LyraPrimaryButtonStyle())
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 16)
        }
        .clipped()
    }

    private var chapterSection: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .firstTextBaseline) {
                Text(chapters.contains(where: { $0.chapter.volume != nil }) ? "Volumes et chapitres" : "Chapitres")
                    .font(.title2.weight(.black))
                Spacer()
                Text("\(chapters.count) disponibles")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let message {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(message.contains("échoué") ? .red : .secondary)
            }
            Toggle("Masquer les chapitres lus", isOn: $hideRead)
                .font(.subheadline.weight(.semibold))

            if groups.count > 1 || chapters.contains(where: { $0.chapter.volume != nil }) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(groups) { group in
                            Button {
                                selectedVolumeKey = group.key
                            } label: {
                                VStack(alignment: .leading, spacing: 5) {
                                    Text(group.label).font(.headline)
                                    Text("\(group.completedCount)/\(group.totalCount) lus")
                                        .font(.caption)
                                    ProgressView(value: Double(group.completedCount), total: Double(max(1, group.totalCount)))
                                        .tint(LyraDesign.accent)
                                }
                                .frame(width: 150, alignment: .leading)
                                .padding(12)
                                .background(
                                    group.key == selectedGroup?.key ? LyraDesign.accent.opacity(0.14) : LyraDesign.raised,
                                    in: RoundedRectangle(cornerRadius: 16)
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }

            if chapters.isEmpty {
                ContentUnavailableView("Aucun chapitre", systemImage: "book.closed")
            } else if groups.isEmpty {
                ContentUnavailableView("Tous les chapitres sont lus", systemImage: "checkmark.circle", description: Text("Désactivez le filtre pour les relire."))
            } else {
                ForEach(selectedGroup?.chapters ?? []) { item in
                    chapterRow(item)
                }
            }
        }
    }

    private func chapterRow(_ item: StoredChapter) -> some View {
        let chapterProgress = progress[item.id]
        let downloaded = downloadedKeys.contains(item.id)
        return HStack(spacing: 12) {
            NavigationLink {
                NativeReaderView(seriesKey: seriesKey, chapterKey: item.id)
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: chapterProgress?.completed == true ? "checkmark.circle.fill" : "circle")
                        .foregroundStyle(chapterProgress?.completed == true ? LyraDesign.accent : .secondary)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.chapter.title)
                            .font(.headline)
                            .foregroundStyle(.primary)
                            .multilineTextAlignment(.leading)
                        HStack {
                            if let published = item.chapter.publishedAt { Text(published) }
                            Text("Novel-FR")
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                }
            }
            .buttonStyle(.plain)
            Spacer(minLength: 8)
            Button {
                toggleDownload(item.id)
            } label: {
                if busyChapter == item.id {
                    ProgressView().frame(width: 38, height: 38)
                } else {
                    Image(systemName: downloaded ? "checkmark.circle.fill" : "arrow.down.circle")
                        .font(.title2)
                        .frame(width: 38, height: 38)
                }
            }
            .disabled(busyChapter != nil)
            .accessibilityLabel(downloaded ? "Supprimer le téléchargement de \(item.chapter.title)" : "Télécharger \(item.chapter.title)")
        }
        .padding(13)
        .lyraCard()
    }

    private func loadLocal() async {
        do {
            series = try await model.store.series(key: seriesKey)
            chapters = try await model.store.chapters(seriesKey: seriesKey)
            progress = Dictionary(uniqueKeysWithValues: try await model.store.progress(seriesKey: seriesKey).map { ($0.chapterKey, $0) })
            downloadedKeys = try await model.store.downloadedChapterKeys(seriesKey: seriesKey)
            if selectedVolumeKey == nil {
                let currentChapter = currentProgress.flatMap { value in chapters.first(where: { $0.id == value.chapterKey }) }
                selectedVolumeKey = volumeKey(currentChapter?.chapter.volume ?? chapters.first?.chapter.volume)
            }
        } catch {
            message = error.localizedDescription
        }
    }

    private func refresh() {
        isRefreshing = true
        message = nil
        Task {
            defer { isRefreshing = false }
            do {
                try await model.refreshSeries(key: seriesKey)
                await loadLocal()
                message = "Liste des chapitres actualisée."
            } catch {
                message = "L’actualisation a échoué : \(error.localizedDescription)"
            }
        }
    }

    private func toggleDownload(_ chapterKey: String) {
        busyChapter = chapterKey
        message = nil
        Task {
            defer { busyChapter = nil }
            do {
                try await model.toggleDownload(seriesKey: seriesKey, chapterKey: chapterKey)
                downloadedKeys = try await model.store.downloadedChapterKeys(seriesKey: seriesKey)
            } catch {
                message = "Le téléchargement a échoué : \(error.localizedDescription)"
            }
        }
    }
}

private struct NativeVolumeGroup: Identifiable {
    let key: String
    let label: String
    var chapters: [StoredChapter]
    var completedCount = 0
    var totalCount = 0

    var id: String { key }
}

func volumeKey(_ volume: Double?) -> String {
    guard let volume else { return "extras" }
    return "volume:\(Int((volume * 1_000).rounded()))"
}

func volumeLabel(_ volume: Double?) -> String {
    guard let volume else { return "Prologue / Extras" }
    let value = volume.rounded() == volume ? String(Int(volume)) : String(volume).replacingOccurrences(of: ".", with: ",")
    return "Volume \(value)"
}
