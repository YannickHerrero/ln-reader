#if DEBUG
import SwiftUI

struct UITestBootstrapView: View {
    @Environment(AppModel.self) private var model
    @State private var ready = false
    @State private var error: String?

    var body: some View {
        Group {
            if ready {
                LyraRootView()
            } else if let error {
                ContentUnavailableView("Fixture indisponible", systemImage: "exclamationmark.triangle", description: Text(error))
            } else {
                ProgressView("Préparation de Lyra…")
            }
        }
        .task {
            guard !ready else { return }
            do {
                try await UITestFixture.seed(model.store)
                await model.reloadLibrary()
                ready = true
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}

actor UITestFixtureAPI: LyraAPI {
    func capabilities() async throws -> APICapabilities {
        APICapabilities(apiVersion: 1, features: ["sync", "chapterBlocks"])
    }

    func discover() async throws -> SourceDiscovery {
        SourceDiscovery(
            popular: [UITestFixture.browseLibrary, UITestFixture.browseCatalog],
            recentlyAdded: [UITestFixture.browseCatalog],
            recentlyUpdated: [UITestFixture.browseLibrary]
        )
    }

    func search(_ query: String) async throws -> [SourceSearchResult] {
        guard !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return [] }
        return [SourceSearchResult(
            key: UITestFixture.catalogSeries.key,
            title: UITestFixture.catalogSeries.title,
            sourceType: "lightNovel",
            sources: UITestFixture.catalogSeries.sources
        )]
    }

    func series(key: String) async throws -> SourceSeries {
        key == UITestFixture.catalogSeries.key ? UITestFixture.catalogSeries : UITestFixture.librarySeries
    }

    func chapter(key: String) async throws -> SourceChapterContent {
        UITestFixture.content(for: key)
    }

    func asset(url: String) async throws -> Data { Data() }
    func pullSync() async throws -> SyncState { SyncState(revision: 1, series: [], progress: []) }
    func pushSync(_ operations: [SyncOperation]) async throws -> SyncState { try await pullSync() }
}

enum UITestFixture {
    static let librarySeries = SourceSeries(
        key: "novelFr:/series/fixture/",
        title: "La Bibliothèque des étoiles",
        sources: [SourceReference(source: .novelFr, key: "novelFr:/series/fixture/")],
        coverImage: nil,
        author: "Aurore Test",
        description: "Une aventure déterministe utilisée pour vérifier toutes les expériences natives de Lyra.",
        genres: ["Fantasy", "Aventure"],
        status: "En cours",
        chapters: [
            chapter("novelFr:/chapter/3/", "Chapitre 3 · Les constellations", number: 3, volume: 2),
            chapter("novelFr:/chapter/2/", "Chapitre 2 · Le réveil", number: 2, volume: 1),
            chapter("novelFr:/chapter/1/", "Chapitre 1 · Le départ", number: 1, volume: 1),
        ]
    )

    static let catalogSeries = SourceSeries(
        key: "novelFr:/series/catalogue/",
        title: "Le Roman du catalogue",
        sources: [SourceReference(source: .novelFr, key: "novelFr:/series/catalogue/")],
        coverImage: nil,
        author: "Camille Catalogue",
        description: "Une série disponible à l’ajout depuis la découverte.",
        genres: ["Mystère"],
        status: "Terminé",
        chapters: [chapter("novelFr:/catalogue/1/", "Chapitre unique", number: 1, volume: nil)]
    )

    static let browseLibrary = SourceBrowseResult(
        key: librarySeries.key,
        title: librarySeries.title,
        coverImage: nil,
        sources: librarySeries.sources
    )
    static let browseCatalog = SourceBrowseResult(
        key: catalogSeries.key,
        title: catalogSeries.title,
        coverImage: nil,
        sources: catalogSeries.sources
    )

    static func seed(_ store: LibraryStore) async throws {
        try await store.addOrUpdateSeries(librarySeries)
        try await store.saveProgress(
            seriesKey: librarySeries.key,
            chapterKey: librarySeries.chapters[1].key,
            scrollRatio: 0
        )
        try await store.download(
            seriesKey: librarySeries.key,
            content: content(for: librarySeries.chapters[1].key)
        )
    }

    static func content(for key: String) -> SourceChapterContent {
        let title = (librarySeries.chapters + catalogSeries.chapters).first(where: { $0.key == key })?.title ?? "Chapitre"
        return SourceChapterContent(
            key: key,
            title: title,
            html: "<h2>Le ciel s’éveille</h2><p>Première phrase. Deuxième phrase !</p><blockquote>Une lumière persiste.</blockquote><ul><li>Regarder les étoiles</li></ul>",
            blocks: [
                ChapterBlock(kind: .heading2, text: "Le ciel s’éveille"),
                ChapterBlock(kind: .paragraph, text: "Première phrase. Deuxième phrase !"),
                ChapterBlock(kind: .blockquote, text: "Une lumière persiste."),
                ChapterBlock(kind: .listItem, text: "Regarder les étoiles"),
            ],
            source: .novelFr
        )
    }

    private static func chapter(_ key: String, _ title: String, number: Double, volume: Double?) -> SourceChapter {
        SourceChapter(
            key: key,
            title: title,
            number: number,
            volume: volume,
            publishedAt: "3 août 2026",
            releases: [SourceReference(source: .novelFr, key: key)]
        )
    }
}
#endif
