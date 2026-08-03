import XCTest
@testable import Lyra

final class NativeReaderTests: XCTestCase {
    func testCatppuccinAppearancesIncludeLegacyPersistenceValues() {
        XCTAssertEqual(LyraAppearance.allCases, [.latte, .mocha])
        XCTAssertEqual(LyraAppearance.latte.displayName, "Catppuccin Latte")
        XCTAssertEqual(LyraAppearance.mocha.displayName, "Catppuccin Mocha")
        XCTAssertEqual(LyraAppearance(persistedValue: "light"), .latte)
        XCTAssertEqual(LyraAppearance(persistedValue: "dark"), .mocha)
        XCTAssertEqual(LyraAppearance.latte.toggled, .mocha)
        XCTAssertEqual(LyraAppearance.mocha.toggled, .latte)
        XCTAssertNil(LyraAppearance(persistedValue: "unknown"))
    }

    func testReaderPreferencesNormalizeSupportedBounds() {
        let value = ReaderPreferences(
            fontSize: 60,
            lineHeight: 0.5,
            fontFamily: .sans,
            paper: .ivory,
            mode: .sentence
        ).normalized

        XCTAssertEqual(value.fontSize, 28)
        XCTAssertEqual(value.lineHeight, 1.4)
        XCTAssertEqual(value.fontFamily, .sans)
        XCTAssertEqual(value.paper, .ivory)
        XCTAssertEqual(value.mode, .sentence)
    }

    func testParagraphAndSentenceSegmentationPreserveStructuredText() {
        let blocks = [
            ChapterBlock(kind: .heading2, text: "Un titre"),
            ChapterBlock(kind: .paragraph, text: "Première phrase. Deuxième phrase !"),
            ChapterBlock(kind: .divider, text: ""),
            ChapterBlock(kind: .blockquote, text: "Une citation."),
        ]

        let paragraphs = readerUnits(blocks: blocks, mode: .paragraph)
        let sentences = readerUnits(blocks: blocks, mode: .sentence)

        XCTAssertEqual(paragraphs.map(\.text), ["Un titre", "Première phrase. Deuxième phrase !", "Une citation."])
        XCTAssertEqual(sentences.map(\.text), ["Un titre", "Première phrase.", "Deuxième phrase !", "Une citation."])
        XCTAssertEqual(sentences.map(\.index), Array(0..<4))
    }

    func testReaderTextNormalizationMatchesPWA() {
        XCTAssertEqual(normalizedReaderText("  Une\u{00A0}première\nligne\t réunie.  "), "Une première ligne réunie.")
    }

    func testSentenceSegmentationKeepsAbbreviationsDecimalsAndFrenchDialogueContinuations() {
        XCTAssertEqual(
            splitReaderSentences([
                "Mme. Layvin nota 3.14 points. Elle dit : « Parfait ! » Puis Dr. Kane sourit.",
            ]),
            [
                "Mme. Layvin nota 3.14 points.",
                "Elle dit : « Parfait ! » Puis Dr. Kane sourit.",
            ]
        )
    }

    func testSentenceSegmentationKeepsClosingQuotesWithTheirSentences() {
        XCTAssertEqual(
            splitReaderSentences(["Il dit: \"Bonjour.\" Elle hocha la tête."]),
            ["Il dit: \"Bonjour.\"", "Elle hocha la tête."]
        )
    }

    func testSentenceSegmentationKeepsQuotedDialogueTagsInsideSentences() {
        XCTAssertEqual(
            splitReaderSentences(["« Je vois... » dit-il. Elle partit."]),
            ["« Je vois... » dit-il.", "Elle partit."]
        )
    }

    func testSentenceSegmentationKeepsLowercaseEllipsisContinuations() {
        XCTAssertEqual(
            splitReaderSentences(["Je pensais... peut-être trop. Puis il bougea."]),
            ["Je pensais... peut-être trop.", "Puis il bougea."]
        )
    }

    func testSentenceSegmentationKeepsNarrativeContinuationsAfterFrenchDialogue() {
        XCTAssertEqual(
            splitReaderSentences(["« Haha… Surprise ! » J’ai levé les bras, en riant faiblement."]),
            ["« Haha… Surprise ! » J’ai levé les bras, en riant faiblement."]
        )
        XCTAssertEqual(
            splitReaderSentences(["« Kuu~ ! » Sylvie s’est précipitée vers moi."]),
            ["« Kuu~ ! » Sylvie s’est précipitée vers moi."]
        )
    }

    func testSentenceSegmentationKeepsTrailingPeriodAfterFrenchQuote() {
        XCTAssertEqual(
            splitReaderSentences(["Elle demanda : « Ça va papa ? ». Vincent répondit."]),
            ["Elle demanda : « Ça va papa ? ».", "Vincent répondit."]
        )
    }

    func testSentenceSegmentationKeepsFrenchQuoteCloserAfterLineBreak() {
        XCTAssertEqual(
            splitReaderSentences(["« C’est fou.\n» « Quoi ?! » s’écria Tabitha."]),
            ["« C’est fou. »", "« Quoi ?! » s’écria Tabitha."]
        )
    }

    func testSentenceSegmentationKeepsPunctuationClustersAndParagraphBoundaries() {
        XCTAssertEqual(
            splitReaderSentences(["Vraiment ?! Oui…", "Nouveau paragraphe."]),
            ["Vraiment ?!", "Oui…", "Nouveau paragraphe."]
        )
    }

    func testFocusedProgressConversionsAreStable() {
        XCTAssertEqual(ratioForUnit(index: 2, count: 5), 0.5)
        XCTAssertEqual(unitIndex(for: 0.5, count: 5), 2)
        XCTAssertEqual(ratioForUnit(index: 0, count: 1), 1)
        XCTAssertEqual(unitIndex(for: 3, count: 5), 4)
    }

    @MainActor
    func testImportsMigrationArchiveIntoNativeStoresAndPreferences() async throws {
        let database = try AppDatabase.temporary()
        let store = LibraryStore(database: database, now: { 500 })
        let series = Self.series
        try await store.addOrUpdateSeries(series)
        let content = SourceChapterContent(
            key: series.chapters[0].key,
            title: "Chapitre 1",
            html: "<p>Hors ligne</p>",
            blocks: [ChapterBlock(kind: .paragraph, text: "Hors ligne")],
            source: .novelFr
        )
        let archive = WebMigrationArchive(
            version: 1,
            exportedAt: 400,
            origin: "https://example.test",
            preferences: .init(
                reader: ReaderPreferences(fontSize: 22, lineHeight: 1.9, fontFamily: .sans, paper: .ivory, mode: .paragraph),
                theme: "light",
                chapterOrder: "ascending",
                hideReadChapters: true
            ),
            downloads: [.init(chapterKey: content.key, seriesKey: series.key, downloadedAt: 300, content: content)],
            covers: [.init(seriesKey: series.key, mimeType: "image/test", base64: Data("cover".utf8).base64EncodedString())]
        )
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try JSONEncoder().encode(archive).write(to: url)
        defer { try? FileManager.default.removeItem(at: url) }
        let suite = "NativeReaderTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }

        let result = try await WebMigrationImporter(archiveURL: url, defaults: defaults).importIfNeeded(into: store)

        let downloaded = try await store.downloadedContent(chapterKey: content.key)
        let cover = try await store.cover(seriesKey: series.key)
        XCTAssertEqual(result?.downloadCount, 1)
        XCTAssertEqual(result?.coverCount, 1)
        XCTAssertEqual(result?.appearance, .latte)
        XCTAssertEqual(downloaded?.readableBlocks, content.blocks)
        XCTAssertEqual(cover, Data("cover".utf8))
        XCTAssertEqual(ReaderPreferenceStore(defaults: defaults).load().mode, .paragraph)
        XCTAssertEqual(defaults.string(forKey: "lyra.native.chapter-order"), "ascending")
        XCTAssertTrue(defaults.bool(forKey: "lyra.native.hide-read"))
        XCTAssertTrue(defaults.bool(forKey: WebMigrationImporter.completedKey))
    }

    private static let series = SourceSeries(
        key: "novelFr:/series/example/",
        title: "Example",
        sources: [SourceReference(source: .novelFr, key: "novelFr:/series/example/")],
        coverImage: nil,
        author: nil,
        description: nil,
        genres: [],
        status: nil,
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
}
