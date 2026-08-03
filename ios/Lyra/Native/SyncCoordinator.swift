@preconcurrency import Network
import Foundation
import Observation

enum NativeSyncPhase: String, Sendable {
    case idle
    case syncing
    case synced
    case offline
    case error
}

@MainActor
@Observable
final class SyncCoordinator {
    private let engine: SyncEngine
    private let store: LibraryStore
    private let monitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "com.yannickherrero.lyra.network")

    private var started = false
    private var running = false
    private var rerunRequested = false
    private var scheduledTask: Task<Void, Never>?
    private var periodicTask: Task<Void, Never>?
    private var retryTask: Task<Void, Never>?
    private var retrySeconds: UInt64 = 5

    var phase: NativeSyncPhase = .idle
    var pendingCount = 0
    var lastSyncedAt: Date?
    var errorMessage: String?
    var didSynchronize: (@MainActor () async -> Void)?

    init(engine: SyncEngine, store: LibraryStore) {
        self.engine = engine
        self.store = store
    }

    func start() {
        guard !started else { return }
        started = true
        monitor.pathUpdateHandler = { [weak self] path in
            let available = path.status == .satisfied
            Task { @MainActor [weak self] in
                guard let self else { return }
                if available { self.requestSync() }
                else { self.phase = .offline }
            }
        }
        monitor.start(queue: monitorQueue)
        periodicTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(30))
                guard !Task.isCancelled else { return }
                await self?.run()
            }
        }
        requestSync()
    }

    func stop() {
        started = false
        monitor.cancel()
        scheduledTask?.cancel()
        periodicTask?.cancel()
        retryTask?.cancel()
    }

    func requestSync(after delay: Duration = .zero) {
        guard started else { return }
        scheduledTask?.cancel()
        scheduledTask = Task { [weak self] in
            if delay > .zero { try? await Task.sleep(for: delay) }
            guard !Task.isCancelled else { return }
            await self?.run()
        }
    }

    func localMutation() {
        requestSync(after: .milliseconds(500))
    }

    func applicationBecameActive() {
        requestSync()
    }

    private func run() async {
        if running {
            rerunRequested = true
            return
        }
        running = true
        rerunRequested = false
        retryTask?.cancel()
        retryTask = nil

        do {
            pendingCount = try await store.pendingCount()
            phase = .syncing
            errorMessage = nil
            _ = try await engine.synchronize()
            pendingCount = try await store.pendingCount()
            phase = .synced
            lastSyncedAt = Date()
            retrySeconds = 5
            await didSynchronize?()
        } catch {
            pendingCount = (try? await store.pendingCount()) ?? pendingCount
            phase = monitor.currentPath.status == .satisfied ? .error : .offline
            errorMessage = error.localizedDescription
            if started {
                let delay = retrySeconds
                retrySeconds = min(retrySeconds * 2, 60)
                retryTask = Task { [weak self] in
                    try? await Task.sleep(for: .seconds(delay))
                    guard !Task.isCancelled else { return }
                    await self?.run()
                }
            }
        }

        running = false
        if rerunRequested { requestSync() }
    }
}
