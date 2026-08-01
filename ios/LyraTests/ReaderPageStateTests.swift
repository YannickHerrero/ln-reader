import XCTest
@testable import Lyra

final class ReaderPageStateTests: XCTestCase {
    func testParsesActiveFocusedReaderState() throws {
        let state = try XCTUnwrap(ReaderPageState(messageBody: ["active": true, "index": 3, "count": 8]))

        XCTAssertTrue(state.active)
        XCTAssertEqual(state.index, 3)
        XCTAssertEqual(state.count, 8)
    }

    func testParsesInactiveReaderState() {
        let state = ReaderPageState(messageBody: ["active": false, "index": 0, "count": 0])

        XCTAssertEqual(state?.active, false)
        XCTAssertEqual(state?.index, 0)
        XCTAssertEqual(state?.count, 0)
    }

    func testRejectsInvalidOrOutOfRangeState() {
        XCTAssertNil(ReaderPageState(messageBody: ["active": true, "index": 8, "count": 8]))
        XCTAssertNil(ReaderPageState(messageBody: ["active": true, "index": -1, "count": 8]))
        XCTAssertNil(ReaderPageState(messageBody: ["active": true, "index": 0.5, "count": 8]))
        XCTAssertNil(ReaderPageState(messageBody: ["active": true, "index": true, "count": 8]))
        XCTAssertNil(ReaderPageState(messageBody: ["active": "yes", "index": 0, "count": 8]))
    }
}
