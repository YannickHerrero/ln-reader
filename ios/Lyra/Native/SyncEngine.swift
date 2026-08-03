import Foundation

actor SyncEngine {
    private let store: LibraryStore
    private let api: any LyraAPI

    init(store: LibraryStore, api: any LyraAPI) {
        self.store = store
        self.api = api
    }

    func synchronize() async throws -> SyncState {
        let queued = try await store.pendingOperations()
        let state = if queued.isEmpty {
            try await api.pullSync()
        } else {
            try await api.pushSync(queued.map { $0.operation })
        }
        try await store.reconcile(state, sent: queued.map { $0.record })
        await hydrateMissingCovers(state)
        return state
    }

    private func hydrateMissingCovers(_ state: SyncState) async {
        for record in state.series {
            let series = record.series
            guard let coverURL = series.coverImage,
                  (try? await store.cover(seriesKey: series.key)) == nil else { continue }
            if let data = try? await api.asset(url: coverURL) {
                try? await store.saveCover(data, seriesKey: series.key)
            }
        }
    }
}
