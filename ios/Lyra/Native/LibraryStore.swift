import Foundation
import GRDB

actor LibraryStore {
    static let bootstrapKey = "server-sync-bootstrap-v1"
    static let revisionKey = "server-sync-revision"
    static let lastSyncedAtKey = "server-sync-last-synced-at"

    private let database: AppDatabase
    private let now: @Sendable () -> Int64

    init(database: AppDatabase, now: @escaping @Sendable () -> Int64 = LibraryStore.currentMilliseconds) {
        self.database = database
        self.now = now
    }

    static func currentMilliseconds() -> Int64 {
        Int64((Date().timeIntervalSince1970 * 1_000).rounded())
    }

    func allSeries() throws -> [StoredSeries] {
        try database.writer.read { database in
            try LibrarySeriesRecord
                .order(Column("addedAt").desc)
                .fetchAll(database)
                .map(Self.storedSeries)
        }
    }

    func series(key: String) throws -> StoredSeries? {
        try database.writer.read { database in
            try LibrarySeriesRecord.fetchOne(database, key: key).map(Self.storedSeries)
        }
    }

    func chapters(seriesKey: String) throws -> [StoredChapter] {
        try database.writer.read { database in
            try ChapterRecord
                .filter(Column("seriesKey") == seriesKey)
                .order(Column("position"))
                .fetchAll(database)
                .map(Self.storedChapter)
        }
    }

    func chapter(key: String) throws -> StoredChapter? {
        try database.writer.read { database in
            try ChapterRecord.fetchOne(database, key: key).map(Self.storedChapter)
        }
    }

    func progress(chapterKey: String) throws -> ReadingProgress? {
        try database.writer.read { database in
            try ReadingProgressRecord.fetchOne(database, key: chapterKey).map(Self.progress)
        }
    }

    func progress(seriesKey: String) throws -> [ReadingProgress] {
        try database.writer.read { database in
            try ReadingProgressRecord
                .filter(Column("seriesKey") == seriesKey)
                .fetchAll(database)
                .map(Self.progress)
        }
    }

    func seriesProgress(seriesKey: String) throws -> SeriesProgressSummary {
        try database.writer.read { database in
            let values = try ReadingProgressRecord
                .filter(Column("seriesKey") == seriesKey)
                .fetchAll(database)
                .map(Self.progress)
            let chapterCount = try ChapterRecord.filter(Column("seriesKey") == seriesKey).fetchCount(database)
            return SeriesProgressSummary(
                current: values.max(by: { $0.lastReadAt < $1.lastReadAt }),
                completedCount: values.filter(\.completed).count,
                chapterCount: chapterCount
            )
        }
    }

    func continueReading(limit: Int = 4) throws -> [ContinueReadingItem] {
        try database.writer.read { database in
            let recent = try ReadingProgressRecord
                .order(Column("lastReadAt").desc)
                .fetchAll(database)
            var seen = Set<String>()
            var result: [ContinueReadingItem] = []
            for value in recent where seen.insert(value.seriesKey).inserted {
                guard let seriesRow = try LibrarySeriesRecord.fetchOne(database, key: value.seriesKey),
                      var chapterRow = try ChapterRecord.fetchOne(database, key: value.chapterKey) else { continue }
                if value.completed {
                    if chapterRow.position == 0 { continue }
                    if let next = try ChapterRecord
                        .filter(Column("seriesKey") == value.seriesKey && Column("position") == chapterRow.position - 1)
                        .fetchOne(database) {
                        chapterRow = next
                    }
                }
                result.append(ContinueReadingItem(
                    series: try Self.storedSeries(seriesRow),
                    chapter: try Self.storedChapter(chapterRow),
                    lastReadAt: value.lastReadAt
                ))
                if result.count >= limit { break }
            }
            return result
        }
    }

    func cover(seriesKey: String) throws -> Data? {
        try database.writer.read { database in
            try CoverRecord.fetchOne(database, key: seriesKey)?.data
        }
    }

    func saveCover(_ data: Data, seriesKey: String) throws {
        try database.writer.write { database in
            try CoverRecord(seriesKey: seriesKey, data: data).save(database)
        }
    }

    func downloadedChapterKeys(seriesKey: String) throws -> Set<String> {
        try database.writer.read { database in
            Set(try String.fetchAll(
                database,
                sql: "SELECT chapterKey FROM downloads WHERE seriesKey = ?",
                arguments: [seriesKey]
            ))
        }
    }

    func downloadedContent(chapterKey: String) throws -> SourceChapterContent? {
        try database.writer.read { database in
            guard let row = try DownloadRecord.fetchOne(database, key: chapterKey) else { return nil }
            return SourceChapterContent(
                key: row.chapterKey,
                title: row.title,
                html: row.html,
                blocks: try Self.decode([ChapterBlock].self, from: row.blocks),
                source: SourceID(rawValue: row.source) ?? .novelFr
            )
        }
    }

    func addOrUpdateSeries(_ series: SourceSeries, cover: Data? = nil) throws {
        let timestamp = now()
        try database.writer.write { database in
            let existing = try LibrarySeriesRecord.fetchOne(database, key: series.key)
            let synced = SyncedSeriesRecord(
                series: series,
                addedAt: existing?.addedAt ?? timestamp,
                updatedAt: timestamp
            )
            try Self.applySeries(synced, to: database)
            if let cover { try CoverRecord(seriesKey: series.key, data: cover).save(database) }
            let operation = SyncOperation.upsertSeries(
                operationID: UUID().uuidString,
                changedAt: timestamp,
                record: synced
            )
            try Self.queue(operation, entityKey: Self.seriesEntityKey(series.key), seriesKey: series.key, at: timestamp, in: database)
        }
    }

    func removeSeries(key: String) throws {
        let timestamp = now()
        try database.writer.write { database in
            _ = try LibrarySeriesRecord.deleteOne(database, key: key)
            _ = try SyncQueueRecord.filter(Column("seriesKey") == key).deleteAll(database)
            let operation = SyncOperation.removeSeries(
                operationID: UUID().uuidString,
                seriesKey: key,
                changedAt: timestamp
            )
            try Self.queue(operation, entityKey: Self.seriesEntityKey(key), seriesKey: key, at: timestamp, in: database)
        }
    }

    func saveProgress(
        seriesKey: String,
        chapterKey: String,
        scrollRatio: Double,
        completed: Bool = false
    ) throws {
        let timestamp = now()
        try database.writer.write { database in
            guard try ChapterRecord.fetchOne(database, key: chapterKey) != nil else { return }
            let previous = try ReadingProgressRecord.fetchOne(database, key: chapterKey)
            let progress = ReadingProgress(
                chapterKey: chapterKey,
                seriesKey: seriesKey,
                scrollRatio: min(1, max(0, scrollRatio)),
                completed: completed || previous?.completed == true,
                lastReadAt: timestamp
            )
            try Self.progressRecord(progress).save(database)
            try Self.queue(
                .saveProgress(operationID: UUID().uuidString, record: progress),
                entityKey: Self.progressEntityKey(chapterKey),
                seriesKey: seriesKey,
                at: timestamp,
                in: database
            )
        }
    }

    func download(seriesKey: String, content: SourceChapterContent) throws {
        let row = DownloadRecord(
            chapterKey: content.key,
            seriesKey: seriesKey,
            title: content.title,
            html: content.html,
            blocks: try Self.encode(content.readableBlocks),
            source: content.source.rawValue,
            downloadedAt: now()
        )
        try database.writer.write { database in try row.save(database) }
    }

    func removeDownload(chapterKey: String) throws {
        try database.writer.write { database in
            _ = try DownloadRecord.deleteOne(database, key: chapterKey)
        }
    }

    func pendingOperations() throws -> [(record: SyncQueueRecord, operation: SyncOperation)] {
        try database.writer.read { database in
            try SyncQueueRecord.order(Column("queuedAt")).fetchAll(database).map { record in
                (record, try Self.decode(SyncOperation.self, from: record.operation))
            }
        }
    }

    func pendingCount() throws -> Int {
        try database.writer.read { database in try SyncQueueRecord.fetchCount(database) }
    }

    func metadata(key: String) throws -> Int64? {
        try database.writer.read { database in try SyncMetadataRecord.fetchOne(database, key: key)?.value }
    }

    func reconcile(_ state: SyncState, sent: [SyncQueueRecord]) throws {
        let timestamp = now()
        try database.writer.write { database in
            for record in sent {
                if let current = try SyncQueueRecord.fetchOne(database, key: record.entityKey),
                   try Self.decode(SyncOperation.self, from: current.operation).operationID
                    == Self.decode(SyncOperation.self, from: record.operation).operationID {
                    _ = try SyncQueueRecord.deleteOne(database, key: record.entityKey)
                }
            }

            let currentRevision = try SyncMetadataRecord.fetchOne(database, key: Self.revisionKey)?.value ?? 0
            if state.revision < currentRevision { return }
            if state.revision == currentRevision && sent.isEmpty {
                try SyncMetadataRecord(key: Self.lastSyncedAtKey, value: timestamp).save(database)
                return
            }

            let remaining = try SyncQueueRecord.fetchAll(database)
            let protectedSeries = Set(remaining.compactMap { row -> String? in
                guard let operation = try? Self.decode(SyncOperation.self, from: row.operation) else { return row.seriesKey }
                if case .saveProgress = operation { return nil }
                return row.seriesKey
            })
            let protectedProgress = Set(remaining.compactMap { row -> String? in
                guard let operation = try? Self.decode(SyncOperation.self, from: row.operation),
                      case .saveProgress = operation else { return nil }
                return row.entityKey
            })
            let serverSeriesKeys = Set(state.series.map(\.series.key))
            let serverProgressKeys = Set(state.progress.map(\.chapterKey))

            for record in state.series where !protectedSeries.contains(record.series.key) {
                try Self.applySeries(record, to: database)
            }

            let localKeys = try String.fetchAll(database, sql: "SELECT key FROM librarySeries")
            for key in localKeys where !serverSeriesKeys.contains(key) && !protectedSeries.contains(key) {
                _ = try LibrarySeriesRecord.deleteOne(database, key: key)
                _ = try SyncQueueRecord.filter(Column("seriesKey") == key).deleteAll(database)
            }

            for progress in state.progress
            where !protectedSeries.contains(progress.seriesKey)
                && !protectedProgress.contains(Self.progressEntityKey(progress.chapterKey)) {
                if try ChapterRecord.fetchOne(database, key: progress.chapterKey) != nil {
                    try Self.progressRecord(progress).save(database)
                }
            }

            let localProgress = try ReadingProgressRecord.fetchAll(database)
            for progress in localProgress
            where !serverProgressKeys.contains(progress.chapterKey)
                && !protectedSeries.contains(progress.seriesKey)
                && !protectedProgress.contains(Self.progressEntityKey(progress.chapterKey)) {
                _ = try ReadingProgressRecord.deleteOne(database, key: progress.chapterKey)
            }

            try SyncMetadataRecord(key: Self.revisionKey, value: state.revision).save(database)
            try SyncMetadataRecord(key: Self.lastSyncedAtKey, value: timestamp).save(database)
            try SyncMetadataRecord(key: Self.bootstrapKey, value: 1).save(database)
        }
    }

    private static func applySeries(_ record: SyncedSeriesRecord, to database: Database) throws {
        let series = record.series
        let row = LibrarySeriesRecord(
            key: series.key,
            title: series.title,
            sources: try encode(series.sources),
            coverImage: series.coverImage,
            author: series.author,
            summary: series.description,
            genres: try encode(series.genres),
            status: series.status,
            addedAt: record.addedAt,
            updatedAt: record.updatedAt
        )
        try row.save(database)

        let existingKeys = Set(try String.fetchAll(
            database,
            sql: "SELECT key FROM chapters WHERE seriesKey = ?",
            arguments: [series.key]
        ))
        let incomingKeys = Set(series.chapters.map(\.key))
        for staleKey in existingKeys.subtracting(incomingKeys) {
            _ = try ChapterRecord.deleteOne(database, key: staleKey)
            _ = try SyncQueueRecord.deleteOne(database, key: progressEntityKey(staleKey))
        }
        for (position, chapter) in series.chapters.enumerated() {
            let chapterRow = ChapterRecord(
                key: chapter.key,
                seriesKey: series.key,
                title: chapter.title,
                number: chapter.number,
                volume: chapter.volume,
                publishedAt: chapter.publishedAt,
                releases: try encode(chapter.releases),
                position: position
            )
            try chapterRow.save(database)
        }
    }

    private static func queue(
        _ operation: SyncOperation,
        entityKey: String,
        seriesKey: String,
        at timestamp: Int64,
        in database: Database
    ) throws {
        try SyncQueueRecord(
            entityKey: entityKey,
            seriesKey: seriesKey,
            operation: try encode(operation),
            queuedAt: timestamp
        ).save(database)
    }

    private static func storedSeries(_ row: LibrarySeriesRecord) throws -> StoredSeries {
        StoredSeries(
            series: SourceSeries(
                key: row.key,
                title: row.title,
                sources: try decode([SourceReference].self, from: row.sources),
                coverImage: row.coverImage,
                author: row.author,
                description: row.summary,
                genres: try decode([String].self, from: row.genres),
                status: row.status,
                chapters: []
            ),
            addedAt: row.addedAt,
            updatedAt: row.updatedAt
        )
    }

    private static func storedChapter(_ row: ChapterRecord) throws -> StoredChapter {
        StoredChapter(
            chapter: SourceChapter(
                key: row.key,
                title: row.title,
                number: row.number,
                volume: row.volume,
                publishedAt: row.publishedAt,
                releases: try decode([SourceReference].self, from: row.releases)
            ),
            seriesKey: row.seriesKey,
            position: row.position
        )
    }

    private static func progress(_ row: ReadingProgressRecord) -> ReadingProgress {
        ReadingProgress(
            chapterKey: row.chapterKey,
            seriesKey: row.seriesKey,
            scrollRatio: row.scrollRatio,
            completed: row.completed,
            lastReadAt: row.lastReadAt
        )
    }

    private static func progressRecord(_ value: ReadingProgress) -> ReadingProgressRecord {
        ReadingProgressRecord(
            chapterKey: value.chapterKey,
            seriesKey: value.seriesKey,
            scrollRatio: value.scrollRatio,
            completed: value.completed,
            lastReadAt: value.lastReadAt
        )
    }

    private static func seriesEntityKey(_ key: String) -> String { "series:\(key)" }
    private static func progressEntityKey(_ key: String) -> String { "progress:\(key)" }

    private static func encode<Value: Encodable>(_ value: Value) throws -> Data {
        try JSONEncoder().encode(value)
    }

    private static func decode<Value: Decodable>(_ type: Value.Type, from data: Data) throws -> Value {
        try JSONDecoder().decode(type, from: data)
    }
}
