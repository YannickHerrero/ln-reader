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

    var serverURL: URL?
    var api: (any LyraAPI)?
    var appearance: LyraAppearance
    var isConnecting = false
    var setupError: String?
    var showsServerConfiguration = false

    init(
        serverStore: ServerURLStore = .shared,
        defaults: UserDefaults = .standard
    ) {
        self.serverStore = serverStore
        self.defaults = defaults
        self.serverURL = serverStore.serverURL
        if let raw = defaults.string(forKey: Self.appearanceKey), let stored = LyraAppearance(rawValue: raw) {
            self.appearance = stored
        } else {
            self.appearance = UITraitCollection.current.userInterfaceStyle == .dark ? .dark : .light
        }
        if let serverURL {
            self.api = APIClient(baseURL: serverURL)
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
            api = client
            showsServerConfiguration = false
        } catch {
            setupError = error.localizedDescription
        }
    }

    func disconnect() {
        serverStore.clear()
        serverURL = nil
        api = nil
        setupError = nil
        showsServerConfiguration = false
    }

    func toggleAppearance() {
        appearance = appearance.toggled
        defaults.set(appearance.rawValue, forKey: Self.appearanceKey)
    }
}
