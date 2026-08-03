import SwiftUI

struct NativeReaderView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme

    let seriesKey: String
    let chapterKey: String

    @State private var series: StoredSeries?
    @State private var chapters: [StoredChapter] = []
    @State private var chapter: StoredChapter?
    @State private var content: SourceChapterContent?
    @State private var preferences = ReaderPreferences.defaults
    @State private var ratio = 0.0
    @State private var focusedIndex = 0
    @State private var controlsVisible = true
    @State private var isDownloaded = false
    @State private var isDownloadBusy = false
    @State private var isLoading = true
    @State private var isOfflineCopy = false
    @State private var errorMessage: String?
    @State private var showsSettings = false
    @State private var restorationToken = 0
    @State private var saveTask: Task<Void, Never>?

    private var palette: ReaderPalette { ReaderPalette.resolve(preferences.paper, colorScheme: colorScheme) }
    private var blocks: [ChapterBlock] { content?.readableBlocks ?? [] }
    private var focusedUnits: [FocusedReaderUnit] { readerUnits(blocks: blocks, mode: preferences.mode) }

    private var volumeChapters: [StoredChapter] {
        guard let chapter else { return chapters }
        return chapters.filter { volumeKey($0.chapter.volume) == volumeKey(chapter.chapter.volume) }
    }

    private var chapterIndex: Int { volumeChapters.firstIndex(where: { $0.id == chapterKey }) ?? -1 }
    private var previousChapter: StoredChapter? {
        let index = chapterIndex
        return index >= 0 && index + 1 < volumeChapters.count ? volumeChapters[index + 1] : nil
    }
    private var nextChapter: StoredChapter? {
        let index = chapterIndex
        return index > 0 ? volumeChapters[index - 1] : nil
    }

    var body: some View {
        ZStack {
            palette.background.ignoresSafeArea()
            if isLoading {
                ProgressView("Chargement du chapitre…")
                    .tint(palette.foreground)
                    .foregroundStyle(palette.foreground)
            } else if let errorMessage {
                ContentUnavailableView(
                    "Lecture impossible",
                    systemImage: "wifi.exclamationmark",
                    description: Text(errorMessage)
                )
                .foregroundStyle(palette.foreground)
            } else if content != nil {
                if preferences.mode == .continuous {
                    VStack(spacing: 0) {
                        readerBar
                        ContinuousReaderContent(
                            chapterTitle: chapter?.chapter.title ?? content?.title ?? "Chapitre",
                            blocks: blocks,
                            preferences: preferences,
                            palette: palette,
                            offlineCopy: isOfflineCopy,
                            ratio: $ratio,
                            restorationToken: restorationToken,
                            onRatioChanged: scheduleProgressSave,
                            navigation: { chapterNavigation }
                        )
                    }
                } else {
                    FocusedNativeReader(
                        units: focusedUnits,
                        index: $focusedIndex,
                        controlsVisible: $controlsVisible,
                        preferences: preferences,
                        palette: palette,
                        onIndexChanged: focusedIndexChanged,
                        footer: { focusedFooter }
                    )
                    .overlay(alignment: .top) {
                        if controlsVisible { readerBar.transition(.move(edge: .top).combined(with: .opacity)) }
                    }
                }
            }
        }
        .animation(.easeOut(duration: 0.2), value: controlsVisible)
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $showsSettings) {
            ReaderSettingsView(preferences: preferences, onSave: applyPreferences)
                .presentationDetents([.medium, .large])
        }
        .task(id: chapterKey) { await load() }
        .onDisappear {
            saveTask?.cancel()
            Task {
                await persistProgress(ratio)
                await model.reloadLibrary()
            }
        }
    }

    private var readerBar: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Button { dismiss() } label: {
                    Image(systemName: "chevron.left")
                        .frame(width: 38, height: 38)
                        .background(palette.foreground.opacity(0.08), in: Circle())
                }
                .accessibilityLabel("Retour à la série")
                VStack(alignment: .leading, spacing: 2) {
                    Text(series?.series.title ?? "Lyra")
                        .font(.caption.weight(.bold))
                        .lineLimit(1)
                    Text(chapter?.chapter.title ?? content?.title ?? "Chapitre")
                        .font(.caption2)
                        .foregroundStyle(palette.secondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 4)
                Button { showsSettings = true } label: {
                    Image(systemName: "textformat.size")
                        .frame(width: 38, height: 38)
                }
                .accessibilityLabel("Réglages de lecture")
                Button(action: toggleDownload) {
                    if isDownloadBusy {
                        ProgressView().frame(width: 38, height: 38)
                    } else {
                        Image(systemName: isDownloaded ? "checkmark.circle.fill" : "arrow.down.circle")
                            .frame(width: 38, height: 38)
                    }
                }
                .disabled(isDownloadBusy || content == nil)
                .accessibilityLabel(isDownloaded ? "Supprimer le téléchargement" : "Télécharger ce chapitre")
            }
            .padding(.horizontal, 12)
            .padding(.top, 6)
            .padding(.bottom, 8)
            ProgressView(value: ratio)
                .tint(LyraDesign.accent)
                .scaleEffect(x: 1, y: 0.65, anchor: .center)
        }
        .foregroundStyle(palette.foreground)
        .background(palette.background.opacity(0.96))
    }

    @ViewBuilder
    private var chapterNavigation: some View {
        HStack(alignment: .top, spacing: 12) {
            if let previousChapter {
                NavigationLink {
                    NativeReaderView(seriesKey: seriesKey, chapterKey: previousChapter.id)
                } label: {
                    Label(previousChapter.chapter.title, systemImage: "arrow.left")
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                Spacer()
            }
            if let nextChapter {
                NavigationLink {
                    NativeReaderView(seriesKey: seriesKey, chapterKey: nextChapter.id)
                } label: {
                    HStack {
                        Text(nextChapter.chapter.title)
                        Image(systemName: "arrow.right")
                    }
                    .frame(maxWidth: .infinity, alignment: .trailing)
                }
            } else {
                Button("Fin · Retour à la série") { dismiss() }
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
        .font(.subheadline.weight(.bold))
        .foregroundStyle(LyraDesign.accent)
        .padding(.horizontal, 22)
        .padding(.vertical, 30)
    }

    @ViewBuilder
    private var focusedFooter: some View {
        if focusedIndex == max(0, focusedUnits.count - 1) {
            if let nextChapter {
                NavigationLink {
                    NativeReaderView(seriesKey: seriesKey, chapterKey: nextChapter.id)
                } label: {
                    Label("Chapitre suivant", systemImage: "arrow.right.circle.fill")
                }
                .buttonStyle(LyraPrimaryButtonStyle())
            } else {
                Button("Fin · Retour à la série") { dismiss() }
                    .buttonStyle(LyraPrimaryButtonStyle())
            }
        }
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        controlsVisible = true
        preferences = ReaderPreferenceStore().load()
        do {
            series = try await model.store.series(key: seriesKey)
            chapters = try await model.store.chapters(seriesKey: seriesKey)
            chapter = chapters.first(where: { $0.id == chapterKey })
            guard series != nil, chapter != nil else {
                errorMessage = "Ce chapitre ne fait plus partie de votre bibliothèque."
                isLoading = false
                return
            }
            let saved = try await model.store.progress(chapterKey: chapterKey)
            ratio = saved?.scrollRatio ?? 0
            if let downloaded = try await model.store.downloadedContent(chapterKey: chapterKey) {
                content = downloaded
                isDownloaded = true
                isOfflineCopy = true
            } else if let api = model.api {
                content = try await api.chapter(key: chapterKey)
                isDownloaded = false
                isOfflineCopy = false
            } else {
                errorMessage = "Ce chapitre n’est pas téléchargé et le serveur est indisponible."
            }
            focusedIndex = unitIndex(for: ratio, count: focusedUnits.count)
            restorationToken += 1
            if content != nil { await persistProgress(ratio) }
        } catch {
            if content == nil {
                errorMessage = "Ce chapitre n’est pas disponible hors ligne. \(error.localizedDescription)"
            }
        }
        isLoading = false
    }

    private func applyPreferences(_ next: ReaderPreferences) {
        let currentRatio = preferences.mode == .continuous
            ? ratio
            : ratioForUnit(index: focusedIndex, count: focusedUnits.count)
        preferences = next.normalized
        ReaderPreferenceStore().save(preferences)
        ratio = currentRatio
        if preferences.mode == .continuous {
            restorationToken += 1
        } else {
            focusedIndex = unitIndex(for: currentRatio, count: focusedUnits.count)
        }
        Task { await persistProgress(currentRatio) }
    }

    private func focusedIndexChanged(_ index: Int) {
        focusedIndex = min(max(0, index), max(0, focusedUnits.count - 1))
        ratio = ratioForUnit(index: focusedIndex, count: focusedUnits.count)
        Task { await persistProgress(ratio) }
    }

    private func scheduleProgressSave(_ nextRatio: Double) {
        ratio = nextRatio
        saveTask?.cancel()
        saveTask = Task {
            try? await Task.sleep(for: .milliseconds(350))
            guard !Task.isCancelled else { return }
            await persistProgress(nextRatio)
        }
    }

    private func persistProgress(_ nextRatio: Double) async {
        await model.saveProgress(
            seriesKey: seriesKey,
            chapterKey: chapterKey,
            ratio: nextRatio,
            completed: nextRatio >= 0.98
        )
    }

    private func toggleDownload() {
        guard let content else { return }
        isDownloadBusy = true
        Task {
            defer { isDownloadBusy = false }
            do {
                if isDownloaded {
                    try await model.store.removeDownload(chapterKey: chapterKey)
                    isDownloaded = false
                    isOfflineCopy = false
                } else {
                    try await model.store.download(seriesKey: seriesKey, content: content)
                    isDownloaded = true
                    isOfflineCopy = true
                }
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}

private struct ContinuousReaderContent<Navigation: View>: View {
    let chapterTitle: String
    let blocks: [ChapterBlock]
    let preferences: ReaderPreferences
    let palette: ReaderPalette
    let offlineCopy: Bool
    @Binding var ratio: Double
    let restorationToken: Int
    let onRatioChanged: (Double) -> Void
    @ViewBuilder let navigation: () -> Navigation

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    VStack(alignment: .leading, spacing: 14) {
                        HStack {
                            Text(offlineCopy ? "DISPONIBLE HORS LIGNE" : "LECTURE EN LIGNE")
                            Spacer()
                            Text("LECTURE CONTINUE")
                        }
                        .font(.caption2.weight(.black))
                        .tracking(1.2)
                        .foregroundStyle(LyraDesign.accent)
                        Text(chapterTitle)
                            .font(.system(size: 38, weight: .black, design: .rounded))
                            .foregroundStyle(palette.foreground)
                    }
                    .padding(.horizontal, 22)
                    .padding(.top, 34)
                    .padding(.bottom, 30)
                    .id("reader-start")

                    ForEach(Array(blocks.enumerated()), id: \.offset) { index, block in
                        ReaderBlockView(block: block, preferences: preferences, palette: palette)
                            .id("reader-block-\(index)")
                    }
                    Color.clear.frame(height: 1).id("reader-end")
                    navigation()
                }
            }
            .scrollIndicators(.visible)
            .onScrollGeometryChange(for: Double.self) { geometry in
                let available = max(1, geometry.contentSize.height - geometry.containerSize.height)
                return min(1, max(0, geometry.contentOffset.y / available))
            } action: { _, nextRatio in
                guard abs(nextRatio - ratio) > 0.001 else { return }
                ratio = nextRatio
                onRatioChanged(nextRatio)
            }
            .task(id: restorationToken) {
                await Task.yield()
                if ratio >= 0.98 {
                    proxy.scrollTo("reader-end", anchor: .bottom)
                } else if blocks.isEmpty || ratio <= 0.001 {
                    proxy.scrollTo("reader-start", anchor: .top)
                } else {
                    let index = min(blocks.count - 1, max(0, Int((ratio * Double(blocks.count - 1)).rounded())))
                    proxy.scrollTo("reader-block-\(index)", anchor: .top)
                }
            }
        }
    }
}

private struct ReaderBlockView: View {
    let block: ChapterBlock
    let preferences: ReaderPreferences
    let palette: ReaderPalette

    private var bodyFont: Font {
        .system(
            size: preferences.fontSize,
            weight: .regular,
            design: preferences.fontFamily == .serif ? .serif : .default
        )
    }

    var body: some View {
        Group {
            switch block.kind {
            case .heading2:
                Text(block.text)
                    .font(.system(size: preferences.fontSize + 8, weight: .black, design: .rounded))
                    .padding(.top, 24)
            case .heading3:
                Text(block.text)
                    .font(.system(size: preferences.fontSize + 4, weight: .bold, design: .rounded))
                    .padding(.top, 18)
            case .blockquote:
                Text(block.text)
                    .font(bodyFont.italic())
                    .padding(.leading, 16)
                    .overlay(alignment: .leading) { Rectangle().fill(LyraDesign.accent).frame(width: 3) }
            case .listItem:
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text("•").foregroundStyle(LyraDesign.accent)
                    Text(block.text).font(bodyFont)
                }
            case .divider:
                Divider().overlay(palette.secondary.opacity(0.3)).padding(.vertical, 16)
            case .paragraph:
                Text(block.text).font(bodyFont)
            }
        }
        .lineSpacing(preferences.fontSize * max(0, preferences.lineHeight - 1))
        .foregroundStyle(palette.foreground)
        .textSelection(.enabled)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 22)
        .padding(.bottom, block.kind == .divider ? 0 : 18)
        .accessibilityLabel(block.text)
    }
}

private struct FocusedNativeReader<Footer: View>: View {
    let units: [FocusedReaderUnit]
    @Binding var index: Int
    @Binding var controlsVisible: Bool
    let preferences: ReaderPreferences
    let palette: ReaderPalette
    let onIndexChanged: (Int) -> Void
    @ViewBuilder let footer: () -> Footer

    private var current: FocusedReaderUnit? {
        units.indices.contains(index) ? units[index] : nil
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                palette.background
                VStack(spacing: 26) {
                    Spacer(minLength: controlsVisible ? 92 : 34)
                    if let current {
                        Text(current.text)
                            .font(focusedFont(for: current))
                            .lineSpacing(preferences.fontSize * max(0, preferences.lineHeight - 1))
                            .multilineTextAlignment(current.kind == .heading2 || current.kind == .heading3 ? .center : .leading)
                            .foregroundStyle(palette.foreground)
                            .frame(maxWidth: 680, alignment: .leading)
                            .padding(.horizontal, 30)
                            .contentTransition(.opacity)
                    } else {
                        Text("Ce chapitre est vide.").foregroundStyle(palette.secondary)
                    }
                    Spacer()
                    if controlsVisible {
                        VStack(spacing: 14) {
                            Text("\(min(index + 1, units.count)) / \(units.count)")
                                .font(.caption.monospacedDigit().weight(.bold))
                                .foregroundStyle(palette.secondary)
                            footer()
                        }
                        .padding(.horizontal, 24)
                        .padding(.bottom, 22)
                    }
                }
            }
            .contentShape(Rectangle())
            .simultaneousGesture(SpatialTapGesture().onEnded { value in
                let third = geometry.size.width / 3
                if value.location.x < third {
                    move(by: -1)
                } else if value.location.x > third * 2 {
                    move(by: 1)
                } else {
                    controlsVisible.toggle()
                }
            })
            .gesture(DragGesture(minimumDistance: 34).onEnded { value in
                guard abs(value.translation.width) > abs(value.translation.height) else { return }
                move(by: value.translation.width < 0 ? 1 : -1)
            })
            .accessibilityElement(children: .combine)
            .accessibilityLabel(current?.text ?? "Chapitre vide")
            .accessibilityValue("Page \(min(index + 1, units.count)) sur \(units.count)")
            .accessibilityAdjustableAction { direction in
                move(by: direction == .increment ? 1 : -1)
            }
        }
        .ignoresSafeArea()
    }

    private func focusedFont(for unit: FocusedReaderUnit) -> Font {
        let size = unit.kind == .heading2 ? preferences.fontSize + 10
            : unit.kind == .heading3 ? preferences.fontSize + 5
            : preferences.fontSize + 2
        let weight: Font.Weight = unit.kind == .heading2 || unit.kind == .heading3 ? .bold : .regular
        return .system(size: size, weight: weight, design: preferences.fontFamily == .serif ? .serif : .default)
    }

    private func move(by offset: Int) {
        guard !units.isEmpty else { return }
        let next = min(units.count - 1, max(0, index + offset))
        guard next != index else { return }
        withAnimation(.easeOut(duration: 0.16)) { onIndexChanged(next) }
    }
}
