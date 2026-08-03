import SwiftUI

struct DiscoverView: View {
    @Environment(AppModel.self) private var model
    @State private var query = ""
    @State private var discovery: SourceDiscovery?
    @State private var results: [SourceSearchResult] = []
    @State private var isLoadingDiscovery = true
    @State private var isSearching = false
    @State private var busyKey: String?
    @State private var errorMessage: String?
    @State private var notice: String?

    private var addedTitles: Set<String> {
        Set(model.library.map { normalizedTitle($0.series.title) })
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 30) {
                header
                searchField
                if let errorMessage {
                    Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
                if let notice {
                    Label(notice, systemImage: "checkmark.circle.fill")
                        .font(.footnote)
                        .foregroundStyle(.green)
                }
                if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    discoveryContent
                } else {
                    searchContent
                }
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 30)
        }
        .background(LyraDesign.background)
        .accessibilityIdentifier("discover-screen")
        .navigationBarHidden(true)
        .task { await loadDiscovery() }
        .task(id: query) { await searchIfNeeded() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                LyraWordmark(compact: true)
                Spacer()
                Button {
                    model.toggleAppearance()
                } label: {
                    Image(systemName: model.appearance == .dark ? "sun.max.fill" : "moon.fill")
                        .frame(width: 42, height: 42)
                        .background(LyraDesign.raised, in: Circle())
                }
                .accessibilityLabel("Changer l’apparence")
            }
            .padding(.top, 10)
            Text("NOVEL-FR")
                .font(.caption.weight(.black))
                .tracking(2)
                .foregroundStyle(LyraDesign.accent)
                .padding(.top, 12)
            Text("Trouvez votre prochaine obsession.")
                .font(.system(size: 38, weight: .black, design: .rounded))
            Text("Romans, light novels et web novels français, réunis dans un catalogue.")
                .font(.title3)
                .foregroundStyle(.secondary)
        }
    }

    private var searchField: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
            TextField("Rechercher un light novel…", text: $query)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .accessibilityIdentifier("native-search")
            if !query.isEmpty {
                Button { query = "" } label: { Image(systemName: "xmark.circle.fill") }
                    .foregroundStyle(.secondary)
                    .accessibilityLabel("Effacer la recherche")
            }
        }
        .padding(15)
        .background(LyraDesign.raised, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay { RoundedRectangle(cornerRadius: 16).stroke(LyraDesign.border) }
    }

    @ViewBuilder
    private var discoveryContent: some View {
        if isLoadingDiscovery {
            ProgressView("Préparation des sélections…")
                .frame(maxWidth: .infinity)
                .padding(.vertical, 50)
        } else if let discovery {
            DiscoverySectionView(
                title: "Les plus populaires",
                subtitle: "Les romans les plus lus par la communauté.",
                items: discovery.popular,
                ranked: true,
                addedTitles: addedTitles,
                busyKey: busyKey,
                onAdd: add
            )
            DiscoverySectionView(
                title: "Ajoutés récemment",
                subtitle: "Les derniers romans arrivés au catalogue.",
                items: discovery.recentlyAdded,
                addedTitles: addedTitles,
                busyKey: busyKey,
                onAdd: add
            )
            DiscoverySectionView(
                title: "Mis à jour récemment",
                subtitle: "Des histoires qui viennent de recevoir un chapitre.",
                items: discovery.recentlyUpdated,
                addedTitles: addedTitles,
                busyKey: busyKey,
                onAdd: add
            )
        }
    }

    @ViewBuilder
    private var searchContent: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Résultats").font(.title2.weight(.black))
                Spacer()
                Text(isSearching ? "Recherche…" : "\(results.count) trouvé\(results.count > 1 ? "s" : "")")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if isSearching {
                ProgressView().frame(maxWidth: .infinity).padding(30)
            } else if results.isEmpty && query.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2 {
                ContentUnavailableView.search(text: query)
            } else {
                ForEach(results) { item in
                    HStack(spacing: 14) {
                        Image(systemName: "text.book.closed.fill")
                            .font(.title2)
                            .foregroundStyle(LyraDesign.accent)
                            .frame(width: 48, height: 62)
                            .background(LyraDesign.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Novel-FR · Français")
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(.secondary)
                            Text(item.title).font(.headline)
                        }
                        Spacer()
                        addButton(key: item.key, title: item.title)
                    }
                    .padding(12)
                    .lyraCard()
                }
            }
        }
    }

    private func addButton(key: String, title: String) -> some View {
        let added = addedTitles.contains(normalizedTitle(title))
        return Button(busyKey == key ? "Ajout…" : added ? "Ajouté" : "Ajouter") {
            add(key, title)
        }
        .buttonStyle(.borderedProminent)
        .tint(LyraDesign.accent)
        .disabled(added || busyKey != nil)
    }

    private func loadDiscovery() async {
        guard let api = model.api else { return }
        isLoadingDiscovery = true
        defer { isLoadingDiscovery = false }
        do {
            discovery = try await api.discover()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func searchIfNeeded() async {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        notice = nil
        guard trimmed.count >= 2, let api = model.api else {
            results = []
            isSearching = false
            return
        }
        isSearching = true
        try? await Task.sleep(for: .milliseconds(350))
        guard !Task.isCancelled else { return }
        do {
            results = try await api.search(trimmed)
            errorMessage = nil
        } catch is CancellationError {
            return
        } catch {
            errorMessage = error.localizedDescription
            results = []
        }
        isSearching = false
    }

    private func add(_ key: String, _ title: String) {
        busyKey = key
        errorMessage = nil
        notice = nil
        Task {
            defer { busyKey = nil }
            do {
                try await model.addSeries(key: key)
                notice = "« \(title) » a été ajouté à votre bibliothèque."
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}

private struct DiscoverySectionView: View {
    let title: String
    let subtitle: String
    let items: [SourceBrowseResult]
    var ranked = false
    let addedTitles: Set<String>
    let busyKey: String?
    let onAdd: (String, String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(title).font(.title2.weight(.black))
            Text(subtitle).font(.subheadline).foregroundStyle(.secondary)
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 14) {
                    ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                        VStack(alignment: .leading, spacing: 10) {
                            ZStack(alignment: .bottomLeading) {
                                RemoteCoverView(url: item.coverImage, title: item.title)
                                    .frame(width: 150, height: 220)
                                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                                if ranked {
                                    Text(String(format: "%02d", index + 1))
                                        .font(.system(size: 34, weight: .black, design: .rounded))
                                        .foregroundStyle(.white)
                                        .shadow(radius: 4)
                                        .padding(10)
                                }
                            }
                            Text(item.title)
                                .font(.headline)
                                .lineLimit(2)
                                .frame(width: 150, alignment: .leading)
                            Button(addedTitles.contains(normalizedTitle(item.title)) ? "Ajouté" : "+ Ajouter") {
                                onAdd(item.key, item.title)
                            }
                            .buttonStyle(.bordered)
                            .tint(LyraDesign.accent)
                            .disabled(addedTitles.contains(normalizedTitle(item.title)) || busyKey != nil)
                        }
                    }
                }
            }
        }
    }
}

func normalizedTitle(_ value: String) -> String {
    value
        .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        .components(separatedBy: CharacterSet.alphanumerics.inverted)
        .joined()
}
