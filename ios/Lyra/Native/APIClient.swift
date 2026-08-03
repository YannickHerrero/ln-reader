import Foundation

protocol LyraAPI: Sendable {
    func capabilities() async throws -> APICapabilities
    func discover() async throws -> SourceDiscovery
    func search(_ query: String) async throws -> [SourceSearchResult]
    func series(key: String) async throws -> SourceSeries
    func chapter(key: String) async throws -> SourceChapterContent
    func asset(url: String) async throws -> Data
    func pullSync() async throws -> SyncState
    func pushSync(_ operations: [SyncOperation]) async throws -> SyncState
}

enum APIClientError: LocalizedError, Equatable {
    case invalidServerURL
    case invalidResponse
    case incompatibleServer
    case server(status: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .invalidServerURL:
            "L’adresse du serveur est invalide."
        case .invalidResponse:
            "Le serveur a renvoyé une réponse invalide."
        case .incompatibleServer:
            "Ce serveur ne prend pas en charge l’application native Lyra."
        case let .server(_, message):
            message
        }
    }
}

actor APIClient: LyraAPI {
    let baseURL: URL
    private let session: URLSession
    private let decoder: JSONDecoder

    init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
        self.decoder = JSONDecoder()
    }

    func capabilities() async throws -> APICapabilities {
        let value: APICapabilities = try await get(path: "/api/capabilities", cachePolicy: .reloadIgnoringLocalCacheData)
        guard value.supportsNativeApp else { throw APIClientError.incompatibleServer }
        return value
    }

    func discover() async throws -> SourceDiscovery {
        try await get(path: "/api/source/discover", cachePolicy: .returnCacheDataElseLoad)
    }

    func search(_ query: String) async throws -> [SourceSearchResult] {
        try await get(path: "/api/source/search", query: [URLQueryItem(name: "q", value: query)])
    }

    func series(key: String) async throws -> SourceSeries {
        try await get(path: "/api/source/series", query: [URLQueryItem(name: "key", value: key)])
    }

    func chapter(key: String) async throws -> SourceChapterContent {
        try await get(
            path: "/api/source/chapter",
            query: [URLQueryItem(name: "key", value: key)],
            cachePolicy: .reloadIgnoringLocalCacheData
        )
    }

    func asset(url: String) async throws -> Data {
        let request = try makeRequest(
            path: "/api/source/asset",
            query: [URLQueryItem(name: "url", value: url)],
            cachePolicy: .returnCacheDataElseLoad
        )
        return try await send(request)
    }

    func pullSync() async throws -> SyncState {
        try await get(path: "/api/sync", cachePolicy: .reloadIgnoringLocalCacheData)
    }

    func pushSync(_ operations: [SyncOperation]) async throws -> SyncState {
        var request = try makeRequest(
            path: "/api/sync",
            query: [],
            cachePolicy: .reloadIgnoringLocalCacheData
        )
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(SyncRequest(operations: operations))
        let data = try await send(request)
        do {
            return try decoder.decode(SyncState.self, from: data)
        } catch {
            throw APIClientError.invalidResponse
        }
    }

    private func get<Value: Decodable>(
        path: String,
        query: [URLQueryItem] = [],
        cachePolicy: URLRequest.CachePolicy = .useProtocolCachePolicy
    ) async throws -> Value {
        let data = try await send(makeRequest(path: path, query: query, cachePolicy: cachePolicy))
        do {
            return try decoder.decode(Value.self, from: data)
        } catch {
            throw APIClientError.invalidResponse
        }
    }

    private func makeRequest(
        path: String,
        query: [URLQueryItem],
        cachePolicy: URLRequest.CachePolicy
    ) throws -> URLRequest {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            throw APIClientError.invalidServerURL
        }
        components.path = path
        components.queryItems = query.isEmpty ? nil : query
        guard let url = components.url else { throw APIClientError.invalidServerURL }
        var request = URLRequest(url: url, cachePolicy: cachePolicy, timeoutInterval: 30)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        return request
    }

    private func send(_ request: URLRequest) async throws -> Data {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIClientError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            let message = (try? decoder.decode(APIErrorBody.self, from: data).error)
                ?? "Le serveur est indisponible."
            throw APIClientError.server(status: http.statusCode, message: message)
        }
        return data
    }
}
