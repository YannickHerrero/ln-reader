import Foundation

final class ServerURLStore: @unchecked Sendable {
    static let shared = ServerURLStore()

    private let defaults: UserDefaults
    private let key: String

    init(defaults: UserDefaults = .standard, key: String = "lyra.serverURL") {
        self.defaults = defaults
        self.key = key
    }

    var serverURL: URL? {
        guard let storedValue = defaults.string(forKey: key) else { return nil }
        return Self.normalizedURL(from: storedValue)
    }

    func save(_ url: URL) {
        defaults.set(url.absoluteString, forKey: key)
    }

    func clear() {
        defaults.removeObject(forKey: key)
    }

    static func normalizedURL(from input: String) -> URL? {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        let candidate = trimmed.contains("://") ? trimmed : "https://\(trimmed)"
        guard var components = URLComponents(string: candidate),
              let scheme = components.scheme?.lowercased(),
              let host = components.host,
              !host.isEmpty,
              components.user == nil,
              components.password == nil else {
            return nil
        }

        let isLocalHTTP = scheme == "http" && (host == "localhost" || host == "127.0.0.1")
        guard scheme == "https" || isLocalHTTP else { return nil }

        components.scheme = scheme
        components.fragment = nil
        if components.path.isEmpty {
            components.path = "/"
        }
        return components.url
    }
}
