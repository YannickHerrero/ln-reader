import XCTest

final class LyraUITests: XCTestCase {
    @MainActor
    func testLibrarySeriesAndAllReaderModes() throws {
        let app = launchApp()
        defer { app.terminate() }
        XCTAssertTrue(app.staticTexts["La Bibliothèque des étoiles"].firstMatch.exists)
        capture("01-library", app: app)

        let continueButton = element("continue-reading-primary", app: app)
        XCTAssertTrue(continueButton.waitForExistence(timeout: 3))
        continueButton.tap()
        XCTAssertTrue(app.buttons["Réglages de lecture"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["LECTURE CONTINUE"].exists)
        XCTAssertTrue(app.buttons["Supprimer le téléchargement"].exists)
        capture("02-continuous-reader", app: app)

        let narration = app.buttons["Démarrer la narration"]
        XCTAssertTrue(narration.waitForExistence(timeout: 3))
        narration.tap()
        XCTAssertTrue(element("audiobook-controls", app: app).waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Voix IA OpenAI'")).firstMatch.waitForExistence(timeout: 5))
        capture("02b-audiobook-controls", app: app)
        app.buttons["Arrêter la narration"].tap()

        app.buttons["Réglages de lecture"].tap()
        XCTAssertTrue(app.navigationBars["Réglages de lecture"].waitForExistence(timeout: 3))
        app.buttons["Paragraphe"].tap()
        app.buttons["Appliquer"].tap()
        let focused = element("focused-reader", app: app)
        XCTAssertTrue(focused.waitForExistence(timeout: 3))
        focused.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)).tap()
        XCTAssertEqual(element("focused-reader", app: app).label, "Première phrase. Deuxième phrase !")
        capture("03-paragraph-reader", app: app)

        app.buttons["Réglages de lecture"].tap()
        app.buttons["Phrase"].tap()
        app.buttons["Appliquer"].tap()
        XCTAssertTrue(element("focused-reader", app: app).waitForExistence(timeout: 3))
        XCTAssertEqual(element("focused-reader", app: app).label, "Première phrase.")
        element("focused-reader", app: app).coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)).tap()
        XCTAssertEqual(element("focused-reader", app: app).label, "Deuxième phrase !")
        capture("04-sentence-reader", app: app)

        app.buttons["Retour à la série"].tap()
        XCTAssertTrue(element("library-screen", app: app).waitForExistence(timeout: 3))
        element("library-series-card", app: app).tap()
        XCTAssertTrue(element("series-detail-screen", app: app).waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Volume 1"].exists)
        XCTAssertTrue(app.staticTexts["Volume 2"].exists)
        let volumeOne = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Volume 1'")).firstMatch
        XCTAssertTrue(volumeOne.exists)
        volumeOne.tap()
        XCTAssertTrue(app.staticTexts["Chapitre 2 · Le réveil"].waitForExistence(timeout: 3))
        capture("05-series-detail", app: app)
    }

    @MainActor
    func testCatppuccinAppearanceAcrossNativeSurfaces() throws {
        let app = launchApp(theme: "latte")
        defer { app.terminate() }

        let activateMocha = app.buttons["Activer Catppuccin Mocha"]
        XCTAssertTrue(activateMocha.waitForExistence(timeout: 3))
        capture("07-latte-library", app: app)
        activateMocha.tap()
        XCTAssertTrue(app.buttons["Activer Catppuccin Latte"].waitForExistence(timeout: 3))
        capture("08-mocha-library", app: app)

        element("continue-reading-primary", app: app).tap()
        XCTAssertTrue(app.buttons["Réglages de lecture"].waitForExistence(timeout: 5))
        capture("09-mocha-reader", app: app)
        app.buttons["Réglages de lecture"].tap()
        XCTAssertTrue(app.navigationBars["Réglages de lecture"].waitForExistence(timeout: 3))
        capture("10-mocha-reader-settings", app: app)
        app.buttons["Annuler"].tap()
        app.buttons["Retour à la série"].tap()
        XCTAssertTrue(element("library-screen", app: app).waitForExistence(timeout: 3))

        app.tabBars.buttons["Découvrir"].tap()
        XCTAssertTrue(element("discover-screen", app: app).waitForExistence(timeout: 5))
        capture("11-mocha-discovery", app: app)

        app.tabBars.buttons["Bibliothèque"].tap()
        element("library-series-card", app: app).tap()
        XCTAssertTrue(element("series-detail-screen", app: app).waitForExistence(timeout: 5))
        capture("12-mocha-series-detail", app: app)
    }

    @MainActor
    func testDiscoverySearchAndAddFlow() throws {
        let app = launchApp()
        defer { app.terminate() }
        app.tabBars.buttons["Découvrir"].tap()
        XCTAssertTrue(element("discover-screen", app: app).waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Les plus populaires"].exists)

        let search = app.textFields["native-search"]
        XCTAssertTrue(search.waitForExistence(timeout: 3))
        search.tap()
        search.typeText("catalogue")
        XCTAssertTrue(app.staticTexts["Le Roman du catalogue"].waitForExistence(timeout: 5))
        app.buttons["Ajouter"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'a été ajouté'")).firstMatch.waitForExistence(timeout: 5))
        if app.keyboards.firstMatch.exists {
            app.keyboards.buttons["return"].tap()
        }
        capture("06-discovery-added", app: app)

        app.tabBars.buttons["Bibliothèque"].tap()
        XCTAssertTrue(element("library-screen", app: app).waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Le Roman du catalogue"].waitForExistence(timeout: 3))
    }

    @MainActor
    private func launchApp(theme: String = "latte") -> XCUIApplication {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = [
            "--ui-testing", "--lyra-theme", theme,
            "-AppleLanguages", "(fr)", "-AppleLocale", "fr_FR",
        ]
        app.launch()
        XCTAssertTrue(element("library-screen", app: app).waitForExistence(timeout: 8))
        return app
    }

    @MainActor
    private func element(_ identifier: String, app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    @MainActor
    private func capture(_ name: String, app: XCUIApplication) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
