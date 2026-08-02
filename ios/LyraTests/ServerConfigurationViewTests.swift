import UIKit
import XCTest
@testable import Lyra

@MainActor
final class ServerConfigurationViewTests: XCTestCase {
    func testBackgroundTapDismissesTheURLKeyboard() throws {
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
        let host = UIViewController()
        let configurationView = ServerConfigurationView(currentURL: nil)
        configurationView.frame = window.bounds
        host.view.addSubview(configurationView)
        window.rootViewController = host
        window.makeKeyAndVisible()
        configurationView.layoutIfNeeded()

        let urlField = try XCTUnwrap(findSubview(in: configurationView, ofType: UITextField.self))
        XCTAssertTrue(urlField.becomeFirstResponder())
        XCTAssertTrue(urlField.isFirstResponder)

        configurationView.dismissKeyboard()

        XCTAssertFalse(urlField.isFirstResponder)
        window.isHidden = true
    }

    func testBackgroundRecognizerPreservesURLFieldTouches() throws {
        let configurationView = ServerConfigurationView(currentURL: nil)
        let urlField = try XCTUnwrap(findSubview(in: configurationView, ofType: UITextField.self))
        let fieldChild = UIView()
        urlField.addSubview(fieldChild)
        let recognizer = try XCTUnwrap(configurationView.gestureRecognizers?.first)

        XCTAssertFalse(recognizer.cancelsTouchesInView)
        XCTAssertTrue(recognizer.delegate === configurationView)
        XCTAssertFalse(configurationView.shouldDismissKeyboard(for: urlField))
        XCTAssertFalse(configurationView.shouldDismissKeyboard(for: fieldChild))
        XCTAssertTrue(configurationView.shouldDismissKeyboard(for: configurationView))
    }

    private func findSubview<T: UIView>(in view: UIView, ofType type: T.Type) -> T? {
        if let match = view as? T {
            return match
        }
        return view.subviews.lazy.compactMap { self.findSubview(in: $0, ofType: type) }.first
    }
}
