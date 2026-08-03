import XCTest
@testable import Lyra

final class NativePersistenceTests: XCTestCase {
    private let series = SourceSeries(
        key: "novelFr:/series/example/",
        title: "Example",
        sources: [SourceReference(source: .novelFr, key: "novelFr:/series/example/")],
        coverImage: "https://example.test/cover.jpg",
        author: "Auteur",
        description: "Résumé",
        genres: ["Fantasy"],
        status: "En cours",
        chapters: [
            SourceChapter(
                key: "novelFr:/chapter/1/",
                title: "Chapitre 1",
                number: 1,
                volume: 1,
                publishedAt: nil,
                releases: [SourceReference(source: .novelFr, key: "novelFr:/chapter/1/")]
            ),
        ]
    )

    func testMutationsPersistAndCoalesceSyncOperations() async throws {
        let store = LibraryStore(database: try AppDatabase.temporary(), now: { 100 })

        try await store.addOrUpdateSeries(series, cover: Data("cover".utf8))
        let storedTitles = try await store.allSeries().map(\.series.title)
        let chapterTitles = try await store.chapters(seriesKey: series.key).map(\.chapter.title)
        let cover = try await store.cover(seriesKey: series.key)
        let initialPendingCount = try await store.pendingCount()
        XCTAssertEqual(storedTitles, ["Example"])
        XCTAssertEqual(chapterTitles, ["Chapitre 1"])
        XCTAssertEqual(cover, Data("cover".utf8))
        XCTAssertEqual(initialPendingCount, 1)

        try await store.saveProgress(
            seriesKey: series.key,
            chapterKey: series.chapters[0].key,
            scrollRatio: 0.4
        )
        try await store.saveProgress(
            seriesKey: series.key,
            chapterKey: series.chapters[0].key,
            scrollRatio: 0.8,
            completed: true
        )
        let pendingCount = try await store.pendingCount()
        XCTAssertEqual(pendingCount, 2)
        let progress = try await store.progress(chapterKey: series.chapters[0].key)
        XCTAssertEqual(progress?.scrollRatio, 0.8)
        XCTAssertEqual(progress?.completed, true)

        let content = SourceChapterContent(
            key: series.chapters[0].key,
            title: "Chapitre 1",
            html: "<p>Texte</p>",
            blocks: [ChapterBlock(kind: .paragraph, text: "Texte")],
            source: .novelFr
        )
        try await store.download(seriesKey: series.key, content: content)
        let downloaded = try await store.downloadedContent(chapterKey: content.key)
        XCTAssertEqual(downloaded?.readableBlocks, content.blocks)
    }

    func testReconciliationPreservesDownloadsUntilSeriesIsRemoved() async throws {
        let store = LibraryStore(database: try AppDatabase.temporary(), now: { 200 })
        try await store.addOrUpdateSeries(series)
        try await store.download(
            seriesKey: series.key,
            content: SourceChapterContent(
                key: series.chapters[0].key,
                title: "Chapitre 1",
                html: "<p>Hors ligne</p>",
                blocks: [ChapterBlock(kind: .paragraph, text: "Hors ligne")],
                source: .novelFr
            )
        )
        let sent = try await store.pendingOperations().map { $0.record }
        try await store.reconcile(
            SyncState(
                revision: 1,
                series: [SyncedSeriesRecord(series: series, addedAt: 100, updatedAt: 100)],
                progress: []
            ),
            sent: sent
        )

        let retainedDownload = try await store.downloadedContent(chapterKey: series.chapters[0].key)
        let pendingCount = try await store.pendingCount()
        XCTAssertNotNil(retainedDownload)
        XCTAssertEqual(pendingCount, 0)

        try await store.reconcile(SyncState(revision: 2, series: [], progress: []), sent: [])
        let removedSeries = try await store.series(key: series.key)
        let removedDownload = try await store.downloadedContent(chapterKey: series.chapters[0].key)
        XCTAssertNil(removedSeries)
        XCTAssertNil(removedDownload)
    }
}
