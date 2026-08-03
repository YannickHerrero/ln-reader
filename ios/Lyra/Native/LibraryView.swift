import SwiftUI

struct LibraryView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var pendingRemoval: StoredSeries?

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 26) {
                header
                if let summary = model.migrationSummary {
                    Label(summary, systemImage: "checkmark.circle.fill")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.green)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                hero
                if !model.continueReading.isEmpty { continueSection }
                librarySection
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 28)
        }
        .background(LyraDesign.background)
        .accessibilityIdentifier("library-screen")
        .refreshable {
            model.syncCoordinator?.requestSync()
            await model.reloadLibrary()
        }
        .navigationBarHidden(true)
        .alert("Retirer cette série ?", isPresented: Binding(
            get: { pendingRemoval != nil },
            set: { if !$0 { pendingRemoval = nil } }
        )) {
            Button("Annuler", role: .cancel) { pendingRemoval = nil }
            Button("Retirer", role: .destructive) {
                guard let item = pendingRemoval else { return }
                pendingRemoval = nil
                Task { try? await model.removeSeries(key: item.id) }
            }
        } message: {
            Text("La série, sa progression locale et ses téléchargements seront retirés de tous les appareils synchronisés.")
        }
        .task { await model.reloadLibrary() }
    }

    @ViewBuilder
    private var header: some View {
        if dynamicTypeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 10) {
                    LyraWordmark(compact: true)
                    Spacer()
                    headerActions
                }
                SyncStatusPill()
            }
            .padding(.top, 10)
        } else {
            HStack(spacing: 10) {
                LyraWordmark(compact: true)
                Spacer()
                SyncStatusPill()
                headerActions
            }
            .padding(.top, 10)
        }
    }

    private var headerActions: some View {
        HStack(spacing: 10) {
            Button {
                model.toggleAppearance()
            } label: {
                Image(systemName: model.appearance == .dark ? "sun.max.fill" : "moon.fill")
                    .font(.system(size: 18, weight: .semibold))
                    .frame(width: 40, height: 40)
                    .background(LyraDesign.raised, in: Circle())
            }
            .accessibilityLabel("Changer l’apparence")
            Button {
                model.showsServerConfiguration = true
            } label: {
                Image(systemName: "gearshape.fill")
                    .font(.system(size: 18, weight: .semibold))
                    .frame(width: 40, height: 40)
                    .background(LyraDesign.raised, in: Circle())
            }
            .accessibilityLabel("Configurer le serveur")
        }
    }

    @ViewBuilder
    private var hero: some View {
        if let featured = model.continueReading.first {
            NavigationLink {
                NativeReaderView(seriesKey: featured.series.id, chapterKey: featured.chapter.id)
            } label: {
                ZStack(alignment: .bottomLeading) {
                    CoverArtView(data: model.covers[featured.series.id], title: featured.series.series.title)
                        .frame(height: 360)
                    LinearGradient(colors: [.clear, .black.opacity(0.94)], startPoint: .top, endPoint: .bottom)
                    VStack(alignment: .leading, spacing: 12) {
                        Text("VOTRE LECTURE DU MOMENT")
                            .font(.caption.weight(.black))
                            .tracking(2)
                            .foregroundStyle(LyraDesign.accent)
                        Text(featured.series.series.title)
                            .font(.system(size: 34, weight: .black, design: .rounded))
                            .foregroundStyle(.white)
                            .multilineTextAlignment(.leading)
                        Text("Continuer · \(featured.chapter.chapter.title)")
                            .font(.headline)
                            .foregroundStyle(.white.opacity(0.82))
                    }
                    .padding(24)
                }
                .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("continue-reading-primary")
            .accessibilityLabel("Continuer \(featured.series.series.title), \(featured.chapter.chapter.title)")
        } else {
            VStack(alignment: .leading, spacing: 18) {
                Text("VOTRE BIBLIOTHÈQUE PERSONNELLE")
                    .font(.caption.weight(.black))
                    .tracking(2)
                    .foregroundStyle(LyraDesign.accent)
                Text("Toutes vos histoires.\nUn seul endroit.")
                    .font(.system(size: 41, weight: .black, design: .rounded))
                Text("Explorez des centaines de romans français et retrouvez votre progression sur tous vos appareils.")
                    .font(.title3)
                    .foregroundStyle(.secondary)
                Button("Découvrir le catalogue") { model.selectedTab = 1 }
                    .buttonStyle(LyraPrimaryButtonStyle())
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(24)
            .lyraCard()
        }
    }

    private var continueSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionTitle("Continuer", detail: "Reprenez là où vous vous êtes arrêté")
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 14) {
                    ForEach(model.continueReading) { item in
                        NavigationLink {
                            NativeReaderView(seriesKey: item.series.id, chapterKey: item.chapter.id)
                        } label: {
                            HStack(spacing: 12) {
                                CoverArtView(data: model.covers[item.series.id], title: item.series.series.title)
                                    .frame(width: 82, height: 110)
                                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                VStack(alignment: .leading, spacing: 6) {
                                    Text("REPRENDRE")
                                        .font(.caption2.weight(.black))
                                        .foregroundStyle(LyraDesign.accent)
                                    Text(item.series.series.title)
                                        .font(.headline)
                                        .lineLimit(3)
                                    Text(item.chapter.chapter.title)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(2)
                                }
                                .frame(width: 180, alignment: .leading)
                            }
                            .padding(12)
                            .lyraCard()
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var librarySection: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionTitle("Ma liste", detail: "\(model.library.count) série\(model.library.count > 1 ? "s" : "")")
            if model.isLibraryLoading {
                ProgressView("Chargement de votre bibliothèque…")
                    .frame(maxWidth: .infinity)
                    .padding(30)
            } else if let error = model.libraryError {
                ContentUnavailableView("Bibliothèque indisponible", systemImage: "exclamationmark.triangle", description: Text(error))
            } else if model.library.isEmpty {
                ContentUnavailableView {
                    Label("Votre liste est encore vide", systemImage: "books.vertical")
                } description: {
                    Text("Ajoutez un roman pour le retrouver ici.")
                } actions: {
                    Button("Explorer") { model.selectedTab = 1 }
                }
                .padding(.vertical, 36)
                .lyraCard()
            } else {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 14)], spacing: 18) {
                    ForEach(model.library) { item in
                        libraryCard(item)
                    }
                }
            }
        }
    }

    private func libraryCard(_ item: StoredSeries) -> some View {
        let summary = model.progressSummaries[item.id]
        let percent = summary?.chapterCount == 0
            ? 0
            : Double(summary?.completedCount ?? 0) / Double(summary?.chapterCount ?? 1)
        return ZStack(alignment: .topTrailing) {
            NavigationLink {
                SeriesDetailView(seriesKey: item.id)
            } label: {
                VStack(alignment: .leading, spacing: 10) {
                    CoverArtView(data: model.covers[item.id], title: item.series.title)
                        .aspectRatio(0.68, contentMode: .fit)
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                        .overlay(alignment: .bottom) {
                            GeometryReader { proxy in
                                Capsule()
                                    .fill(.white.opacity(0.3))
                                    .overlay(alignment: .leading) {
                                        Capsule().fill(LyraDesign.accent).frame(width: proxy.size.width * percent)
                                    }
                            }
                            .frame(height: 4)
                            .padding(8)
                        }
                    Text(item.series.title)
                        .font(.headline)
                        .lineLimit(2)
                    Text(item.series.genres.filter { $0.lowercased() != "novel" }.prefix(2).joined(separator: " · ").nonEmpty ?? "Roman")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("library-series-card")

            Button {
                pendingRemoval = item
            } label: {
                Image(systemName: "xmark")
                    .font(.caption.bold())
                    .foregroundStyle(.white)
                    .frame(width: 34, height: 34)
                    .background(.black.opacity(0.72), in: Circle())
            }
            .padding(7)
            .accessibilityLabel("Retirer \(item.series.title)")
        }
    }

    @ViewBuilder
    private func sectionTitle(_ title: String, detail: String) -> some View {
        if dynamicTypeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.title2.weight(.black))
                Text(detail).font(.caption).foregroundStyle(.secondary)
            }
        } else {
            HStack(alignment: .firstTextBaseline) {
                Text(title).font(.title2.weight(.black))
                Spacer()
                Text(detail).font(.caption).foregroundStyle(.secondary)
            }
        }
    }
}

private extension String {
    var nonEmpty: String? { isEmpty ? nil : self }
}

