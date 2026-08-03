import Foundation
import GRDB

struct LibrarySeriesRecord: Codable, FetchableRecord, PersistableRecord, TableRecord, Identifiable, Sendable {
    static let databaseTableName = "librarySeries"

    let key: String
    let title: String
    let sources: Data
    let coverImage: String?
    let author: String?
    let summary: String?
    let genres: Data
    let status: String?
    let addedAt: Int64
    let updatedAt: Int64

    var id: String { key }
}

struct ChapterRecord: Codable, FetchableRecord, PersistableRecord, TableRecord, Identifiable, Sendable {
    static let databaseTableName = "chapters"

    let key: String
    let seriesKey: String
    let title: String
    let number: Double?
    let volume: Double?
    let publishedAt: String?
    let releases: Data
    let position: Int

    var id: String { key }
}

struct ReadingProgressRecord: Codable, FetchableRecord, PersistableRecord, TableRecord, Sendable {
    static let databaseTableName = "readingProgress"

    let chapterKey: String
    let seriesKey: String
    let scrollRatio: Double
    let completed: Bool
    let lastReadAt: Int64
}

struct DownloadRecord: Codable, FetchableRecord, PersistableRecord, TableRecord, Sendable {
    static let databaseTableName = "downloads"

    let chapterKey: String
    let seriesKey: String
    let title: String
    let html: String
    let blocks: Data
    let source: String
    let downloadedAt: Int64
}

struct CoverRecord: Codable, FetchableRecord, PersistableRecord, TableRecord, Sendable {
    static let databaseTableName = "covers"

    let seriesKey: String
    let data: Data
}

struct SyncQueueRecord: Codable, FetchableRecord, PersistableRecord, TableRecord, Sendable {
    static let databaseTableName = "syncQueue"

    let entityKey: String
    let seriesKey: String
    let operation: Data
    let queuedAt: Int64
}

struct SyncMetadataRecord: Codable, FetchableRecord, PersistableRecord, TableRecord, Sendable {
    static let databaseTableName = "syncMetadata"

    let key: String
    let value: Int64
}

struct StoredSeries: Identifiable, Hashable, Sendable {
    let series: SourceSeries
    let addedAt: Int64
    let updatedAt: Int64

    var id: String { series.key }
}

struct StoredChapter: Identifiable, Hashable, Sendable {
    let chapter: SourceChapter
    let seriesKey: String
    let position: Int

    var id: String { chapter.key }
}

struct ContinueReadingItem: Identifiable, Hashable, Sendable {
    let series: StoredSeries
    let chapter: StoredChapter
    let lastReadAt: Int64

    var id: String { series.id }
}

struct SeriesProgressSummary: Equatable, Sendable {
    let current: ReadingProgress?
    let completedCount: Int
    let chapterCount: Int
}
