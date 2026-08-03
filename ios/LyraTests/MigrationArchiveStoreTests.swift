import XCTest
@testable import Lyra

final class MigrationArchiveStoreTests: XCTestCase {
    private var directory: URL!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directory)
    }

    func testWritesValidatedArchiveAtomically() throws {
        let store = MigrationArchiveStore(directory: directory)
        let json = #"{"version":1,"downloads":[],"covers":[],"preferences":{"theme":"dark"}}"#

        let url = try store.save(json: json)

        XCTAssertEqual(url.lastPathComponent, "lyra-web-migration-v1.json")
        XCTAssertEqual(try String(contentsOf: url, encoding: .utf8), json)
    }

    func testRejectsFailedOrUnsupportedArchivesWithoutOverwriting() throws {
        let store = MigrationArchiveStore(directory: directory)
        let original = #"{"version":1,"downloads":[],"covers":[]}"#
        let url = try store.save(json: original)

        XCTAssertThrowsError(try store.save(json: #"{"version":2,"downloads":[],"covers":[]}"#))
        XCTAssertThrowsError(try store.save(json: #"{"version":1,"error":"no database","downloads":[],"covers":[]}"#))
        XCTAssertEqual(try String(contentsOf: url, encoding: .utf8), original)
    }
}
