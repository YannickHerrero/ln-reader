import XCTest
@testable import Lyra

final class ServerURLStoreTests: XCTestCase {
    func testNormalizesTailnetHTTPSAddress() {
        XCTAssertEqual(
            ServerURLStore.normalizedURL(from: "reader.example.ts.net:8443")?.absoluteString,
            "https://reader.example.ts.net:8443/"
        )
    }

    func testAllowsLocalhostHTTPForSimulatorDevelopment() {
        XCTAssertEqual(
            ServerURLStore.normalizedURL(from: "http://localhost:4174")?.absoluteString,
            "http://localhost:4174/"
        )
    }

    func testRejectsInsecureRemoteAndCredentialedAddresses() {
        XCTAssertNil(ServerURLStore.normalizedURL(from: "http://100.64.0.1:4174"))
        XCTAssertNil(ServerURLStore.normalizedURL(from: "https://user:secret@example.com"))
        XCTAssertNil(ServerURLStore.normalizedURL(from: "not a host"))
    }

    func testPersistsNormalizedServerURL() throws {
        let suiteName = "ServerURLStoreTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let store = ServerURLStore(defaults: defaults, key: "server")
        let url = try XCTUnwrap(ServerURLStore.normalizedURL(from: "https://reader.example.ts.net"))

        store.save(url)

        XCTAssertEqual(store.serverURL, url)
    }
}
