import Foundation
import Observation
import SwiftUI
import UIKit

@MainActor
@Observable
final class AppModel {
    private static let appearanceKey = "lyra.native.appearance"

    private let serverStore: ServerURLStore
    private let defaults: UserDefaults
    private let database: AppDatabase
    let store: LibraryStore
    let audiobookPlayer = AudiobookPlayer()

    var serverURL: URL?
    var api: (any LyraAPI)?
    var syncCoordinator: SyncCoordinator?
    var serverCapabilities: APICapabilities?
    var appearance: LyraAppearance
    var isConnecting = false
    var setupError: String?
    var showsServerConfiguration = false
    var selectedTab = 0
    var library: [StoredSeries] = []
    var continueReading: [ContinueReadingItem] = []
    var progressSummaries: [String: SeriesProgressSummary] = [:]
    var covers: [String: Data] = [:]
    var libraryError: String?
    var isLibraryLoading = true
    var migrationSummary: String?

    var supportsAudiobooks: Bool { serverCapabilities?.supportsAudiobooks == true }

    init(
        serverStore: ServerURLStore = .shared,
        defaults: UserDefaults = .standard,
        database: AppDatabase? = nil,
        client: (any LyraAPI)? = nil,
        synchronizationEnabled: Bool = true
    ) {
        let resolvedDatabase = database ?? Self.makeLiveDatabase()
        self.serverStore = serverStore
        self.defaults = defaults
        self.database = resolvedDatabase
        self.store = LibraryStore(database: resolvedDatabase)
        self.serverURL = serverStore.serverURL
        if let raw = defaults.string(forKey: Self.appearanceKey), let stored = LyraAppearance(persistedValue: raw) {
            self.appearance = stored
        } else {
            self.appearance = UITraitCollection.current.userInterfaceStyle == .dark ? .mocha : .latte
        }
        if let serverURL {
            if let client, !synchronizationEnabled {
                api = client
            } else {
                configureAPI(for: serverURL, client: client)
            }
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
            let capabilities = try await client.capabilities()
            serverStore.save(url)
            serverURL = url
            serverCapabilities = capabilities
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
        serverCapabilities = nil
        audiobookPlayer.stop()
        setupError = nil
        showsServerConfiguration = false
    }

    func start() {
        syncCoordinator?.start()
        Task {
            await reloadCapabilities()
            await reloadLibrary()
            await importWebMigrationIfNeeded()
        }
    }

    func applicationBecameActive() {
        syncCoordinator?.applicationBecameActive()
    }

    func toggleAppearance() {
        appearance = appearance.toggled
        defaults.set(appearance.rawValue, forKey: Self.appearanceKey)
    }

    func reloadLibrary() async {
        do {
            let values = try await store.allSeries()
            var summaries: [String: SeriesProgressSummary] = [:]
            var loadedCovers: [String: Data] = [:]
            for value in values {
                summaries[value.id] = try await store.seriesProgress(seriesKey: value.id)
                loadedCovers[value.id] = try await store.cover(seriesKey: value.id)
            }
            library = values
            continueReading = try await store.continueReading()
            progressSummaries = summaries
            covers = loadedCovers
            libraryError = nil
            isLibraryLoading = false
        } catch {
            libraryError = error.localizedDescription
            isLibraryLoading = false
        }
    }

    func addSeries(key: String) async throws {
        guard let api else { throw APIClientError.invalidServerURL }
        let series = try await api.series(key: key)
        let cover: Data? = if let coverURL = series.coverImage { try? await api.asset(url: coverURL) } else { nil }
        try await store.addOrUpdateSeries(series, cover: cover)
        await reloadLibrary()
        syncCoordinator?.localMutation()
    }

    func removeSeries(key: String) async throws {
        try await store.removeSeries(key: key)
        await reloadLibrary()
        syncCoordinator?.localMutation()
    }

    func refreshSeries(key: String) async throws {
        guard let api else { throw APIClientError.invalidServerURL }
        let series = try await api.series(key: key)
        let existingCover = try await store.cover(seriesKey: key)
        let cover = if existingCover == nil, let coverURL = series.coverImage {
            try? await api.asset(url: coverURL)
        } else {
            existingCover
        }
        try await store.addOrUpdateSeries(series, cover: cover)
        await reloadLibrary()
        syncCoordinator?.localMutation()
    }

    func toggleDownload(seriesKey: String, chapterKey: String) async throws {
        if try await store.downloadedContent(chapterKey: chapterKey) != nil {
            try await store.removeDownload(chapterKey: chapterKey)
        } else {
            guard let api else { throw APIClientError.invalidServerURL }
            let content = try await api.chapter(key: chapterKey)
            try await store.download(seriesKey: seriesKey, content: content)
        }
    }

    func saveProgress(seriesKey: String, chapterKey: String, ratio: Double, completed: Bool) async {
        do {
            try await store.saveProgress(
                seriesKey: seriesKey,
                chapterKey: chapterKey,
                scrollRatio: ratio,
                completed: completed
            )
            syncCoordinator?.localMutation()
        } catch {
            libraryError = error.localizedDescription
        }
    }

    private func reloadCapabilities() async {
        guard let api else {
            serverCapabilities = nil
            return
        }
        serverCapabilities = try? await api.capabilities()
    }

    private func importWebMigrationIfNeeded() async {
        do {
            guard let result = try await WebMigrationImporter(defaults: defaults).importIfNeeded(into: store),
                  !result.wasPending else { return }
            if let importedAppearance = result.appearance {
                appearance = importedAppearance
                defaults.set(importedAppearance.rawValue, forKey: Self.appearanceKey)
            }
            await reloadLibrary()
            if result.downloadCount > 0 || result.coverCount > 0 {
                migrationSummary = "Migration terminée · \(result.downloadCount) chapitre(s) hors ligne restauré(s)."
            }
        } catch {
            migrationSummary = "La migration locale devra être réessayée."
        }
    }

    private func configureAPI(for url: URL, client: (any LyraAPI)? = nil) {
        syncCoordinator?.stop()
        let resolvedClient = client ?? APIClient(baseURL: url)
        api = resolvedClient
        let engine = SyncEngine(store: store, api: resolvedClient)
        let coordinator = SyncCoordinator(engine: engine, store: store)
        coordinator.didSynchronize = { [weak self] in
            await self?.reloadLibrary()
            await self?.importWebMigrationIfNeeded()
        }
        syncCoordinator = coordinator
        coordinator.start()
    }

    private static func makeLiveDatabase() -> AppDatabase {
        do {
            return try AppDatabase.live()
        } catch {
            fatalError("Unable to open Lyra database: \(error)")
        }
    }
}
