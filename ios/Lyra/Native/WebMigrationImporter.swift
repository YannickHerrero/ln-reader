import Foundation

nonisolated struct WebMigrationArchive: Codable, Sendable {
    struct Preferences: Codable, Sendable {
        let reader: ReaderPreferences?
        let theme: String?
        let chapterOrder: String?
        let hideReadChapters: Bool
    }

    struct Download: Codable, Sendable {
        let chapterKey: String
        let seriesKey: String
        let downloadedAt: Int64
        let content: SourceChapterContent
    }

    struct Cover: Codable, Sendable {
        let seriesKey: String
        let mimeType: String
        let base64: String
    }

    let version: Int
    let exportedAt: Int64
    let origin: String
    let preferences: Preferences
    let downloads: [Download]
    let covers: [Cover]
}

nonisolated struct WebMigrationResult: Sendable {
    let downloadCount: Int
    let coverCount: Int
    let appearance: LyraAppearance?
    let wasPending: Bool
}

@MainActor
struct WebMigrationImporter {
    static let fileName = "lyra-web-migration-v1.json"
    static let completedKey = "lyra.native.web-migration-v1-completed"

    private let archiveURL: URL
    private let defaults: UserDefaults

    init(
        archiveURL: URL? = nil,
        defaults: UserDefaults = .standard,
        fileManager: FileManager = .default
    ) {
        if let archiveURL {
            self.archiveURL = archiveURL
        } else {
            let support = try? fileManager.url(
                for: .applicationSupportDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            )
            self.archiveURL = support?.appendingPathComponent(Self.fileName)
                ?? fileManager.temporaryDirectory.appendingPathComponent(Self.fileName)
        }
        self.defaults = defaults
    }

    func importIfNeeded(into store: LibraryStore) async throws -> WebMigrationResult? {
        guard !defaults.bool(forKey: Self.completedKey),
              FileManager.default.fileExists(atPath: archiveURL.path) else {
            return nil
        }

        let archive = try JSONDecoder().decode(WebMigrationArchive.self, from: Data(contentsOf: archiveURL))
        guard archive.version == 1 else { throw CocoaError(.fileReadCorruptFile) }

        let localSeries = try await store.allSeries()
        if localSeries.isEmpty && (!archive.downloads.isEmpty || !archive.covers.isEmpty) {
            return WebMigrationResult(downloadCount: 0, coverCount: 0, appearance: nil, wasPending: true)
        }

        let seriesKeys = Set(localSeries.map(\.id))
        var importedDownloads = 0
        var importedCovers = 0
        for download in archive.downloads where seriesKeys.contains(download.seriesKey) {
            guard try await store.chapter(key: download.chapterKey) != nil else { continue }
            try await store.download(seriesKey: download.seriesKey, content: download.content)
            importedDownloads += 1
        }
        for cover in archive.covers where seriesKeys.contains(cover.seriesKey) {
            guard let data = Data(base64Encoded: cover.base64) else { continue }
            try await store.saveCover(data, seriesKey: cover.seriesKey)
            importedCovers += 1
        }

        if let reader = archive.preferences.reader {
            ReaderPreferenceStore(defaults: defaults).save(reader)
        }
        if archive.preferences.chapterOrder == "ascending" || archive.preferences.chapterOrder == "descending" {
            defaults.set(archive.preferences.chapterOrder, forKey: "lyra.native.chapter-order")
        }
        defaults.set(archive.preferences.hideReadChapters, forKey: "lyra.native.hide-read")
        let appearance = archive.preferences.theme.flatMap(LyraAppearance.init(persistedValue:))
        defaults.set(true, forKey: Self.completedKey)
        return WebMigrationResult(
            downloadCount: importedDownloads,
            coverCount: importedCovers,
            appearance: appearance,
            wasPending: false
        )
    }
}
