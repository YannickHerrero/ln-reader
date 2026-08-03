import Foundation
import Observation
import SwiftUI
import UIKit

enum LyraAppearance: String, CaseIterable, Codable, Sendable {
    case light
    case dark

    var colorScheme: ColorScheme {
        self == .dark ? .dark : .light
    }

    var toggled: LyraAppearance {
        self == .dark ? .light : .dark
    }
}

@MainActor
@Observable
final class AppModel {
    private static let appearanceKey = "lyra.native.appearance"

    private let serverStore: ServerURLStore
    private let defaults: UserDefaults
    private let database: AppDatabase
    let store: LibraryStore

    var serverURL: URL?
    var api: (any LyraAPI)?
    var syncCoordinator: SyncCoordinator?
    var appearance: LyraAppearance
    var isConnecting = false
    var setupError: String?
    var showsServerConfiguration = false

    init(
        serverStore: ServerURLStore = .shared,
        defaults: UserDefaults = .standard,
        database: AppDatabase? = nil
    ) {
        let resolvedDatabase = database ?? Self.makeLiveDatabase()
        self.serverStore = serverStore
        self.defaults = defaults
        self.database = resolvedDatabase
        self.store = LibraryStore(database: resolvedDatabase)
        self.serverURL = serverStore.serverURL
        if let raw = defaults.string(forKey: Self.appearanceKey), let stored = LyraAppearance(rawValue: raw) {
            self.appearance = stored
        } else {
            self.appearance = UITraitCollection.current.userInterfaceStyle == .dark ? .dark : .light
        }
        if let serverURL {
            configureAPI(for: serverURL)
        }
    }

    func connect(to input: String) async {
        setupError = nil
        guard let url = ServerURLStore.normalizedURL(from: input) else {
            setupError = "Saisissez une adresse HTTPS valide."
            return
        }

        isConnecting = true
        defer { isConnecting = false }
        let client = APIClient(baseURL: url)
        do {
            _ = try await client.capabilities()
            serverStore.save(url)
            serverURL = url
            configureAPI(for: url, client: client)
            showsServerConfiguration = false
        } catch {
            setupError = error.localizedDescription
        }
    }

    func disconnect() {
        syncCoordinator?.stop()
        syncCoordinator = nil
        serverStore.clear()
        serverURL = nil
        api = nil
        setupError = nil
        showsServerConfiguration = false
    }

    func start() {
        syncCoordinator?.start()
    }

    func applicationBecameActive() {
        syncCoordinator?.applicationBecameActive()
    }

    func toggleAppearance() {
        appearance = appearance.toggled
        defaults.set(appearance.rawValue, forKey: Self.appearanceKey)
    }

    private func configureAPI(for url: URL, client: (any LyraAPI)? = nil) {
        syncCoordinator?.stop()
        let resolvedClient = client ?? APIClient(baseURL: url)
        api = resolvedClient
        let engine = SyncEngine(store: store, api: resolvedClient)
        syncCoordinator = SyncCoordinator(engine: engine, store: store)
        syncCoordinator?.start()
    }

    private static func makeLiveDatabase() -> AppDatabase {
        do {
            return try AppDatabase.live()
        } catch {
            fatalError("Unable to open Lyra database: \(error)")
        }
    }
}
