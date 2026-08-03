import Foundation
import GRDB

final class AppDatabase: @unchecked Sendable {
    let writer: DatabasePool

    init(path: String) throws {
        var configuration = Configuration()
        configuration.prepareDatabase { database in
            try database.execute(sql: "PRAGMA foreign_keys = ON")
            try database.execute(sql: "PRAGMA journal_mode = WAL")
            try database.execute(sql: "PRAGMA synchronous = NORMAL")
        }
        writer = try DatabasePool(path: path, configuration: configuration)
        try Self.migrator.migrate(writer)
    }

    static func live() throws -> AppDatabase {
        let root = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        ).appendingPathComponent("Lyra", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        return try AppDatabase(path: root.appendingPathComponent("lyra.sqlite").path)
    }

    static func temporary() throws -> AppDatabase {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("lyra-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return try AppDatabase(path: directory.appendingPathComponent("lyra.sqlite").path)
    }

    private static var migrator: DatabaseMigrator {
        var migrator = DatabaseMigrator()
        migrator.registerMigration("native-v1") { database in
            try database.create(table: "librarySeries") { table in
                table.column("key", .text).primaryKey()
                table.column("title", .text).notNull()
                table.column("sources", .blob).notNull()
                table.column("coverImage", .text)
                table.column("author", .text)
                table.column("summary", .text)
                table.column("genres", .blob).notNull()
                table.column("status", .text)
                table.column("addedAt", .integer).notNull().indexed()
                table.column("updatedAt", .integer).notNull()
            }
            try database.create(table: "chapters") { table in
                table.column("key", .text).primaryKey()
                table.column("seriesKey", .text).notNull().indexed()
                    .references("librarySeries", column: "key", onDelete: .cascade)
                table.column("title", .text).notNull()
                table.column("number", .double)
                table.column("volume", .double)
                table.column("publishedAt", .text)
                table.column("releases", .blob).notNull()
                table.column("position", .integer).notNull()
            }
            try database.create(table: "readingProgress") { table in
                table.column("chapterKey", .text).primaryKey()
                    .references("chapters", column: "key", onDelete: .cascade)
                table.column("seriesKey", .text).notNull().indexed()
                table.column("scrollRatio", .double).notNull()
                table.column("completed", .boolean).notNull()
                table.column("lastReadAt", .integer).notNull().indexed()
            }
            try database.create(table: "downloads") { table in
                table.column("chapterKey", .text).primaryKey()
                    .references("chapters", column: "key", onDelete: .cascade)
                table.column("seriesKey", .text).notNull().indexed()
                table.column("title", .text).notNull()
                table.column("html", .text).notNull()
                table.column("blocks", .blob).notNull()
                table.column("source", .text).notNull()
                table.column("downloadedAt", .integer).notNull()
            }
            try database.create(table: "covers") { table in
                table.column("seriesKey", .text).primaryKey()
                    .references("librarySeries", column: "key", onDelete: .cascade)
                table.column("data", .blob).notNull()
            }
            try database.create(table: "syncQueue") { table in
                table.column("entityKey", .text).primaryKey()
                table.column("seriesKey", .text).notNull().indexed()
                table.column("operation", .blob).notNull()
                table.column("queuedAt", .integer).notNull().indexed()
            }
            try database.create(table: "syncMetadata") { table in
                table.column("key", .text).primaryKey()
                table.column("value", .integer).notNull()
            }
        }
        return migrator
    }
}
