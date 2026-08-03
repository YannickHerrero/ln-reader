import AVFoundation
import Foundation
import Observation

nonisolated enum AudiobookPlayerState: Equatable, Sendable {
    case idle
    case preparing
    case playing
    case paused
    case finished
    case failed
}

nonisolated func audiobookSegmentIndex(for progress: Double, segments: [AudiobookSegment]) -> Int {
    guard !segments.isEmpty else { return 0 }
    let normalized = min(1, max(0, progress))
    return segments.firstIndex(where: { normalized < $0.progressEnd }) ?? segments.count - 1
}

nonisolated func audiobookLocalProgress(_ progress: Double, segment: AudiobookSegment) -> Double {
    let length = segment.progressEnd - segment.progressStart
    guard length > 0 else { return 0 }
    return min(1, max(0, (progress - segment.progressStart) / length))
}

private enum AudiobookPlaybackError: LocalizedError {
    case generation(String)
    case unavailable

    var errorDescription: String? {
        switch self {
        case let .generation(message): message
        case .unavailable: "La narration n’est pas disponible pour ce chapitre."
        }
    }
}

@MainActor
@Observable
final class AudiobookPlayer {
    typealias ProgressHandler = @MainActor @Sendable (Double, Bool) async -> Void

    private(set) var state: AudiobookPlayerState = .idle
    private(set) var chapterKey: String?
    private(set) var chapterTitle: String?
    private(set) var manifest: AudiobookManifest?
    private(set) var generationProgress = 0.0
    private(set) var chapterProgress = 0.0
    private(set) var elapsed = 0.0
    private(set) var duration = 0.0
    private(set) var errorMessage: String?
    var playbackRate = 1.0

    @ObservationIgnored private let player = AVPlayer()
    @ObservationIgnored private var segmentURLs: [URL] = []
    @ObservationIgnored private var currentSegmentIndex = 0
    @ObservationIgnored private var preparationTask: Task<Void, Never>?
    @ObservationIgnored nonisolated(unsafe) private var timeObserver: Any?
    @ObservationIgnored nonisolated(unsafe) private var endObserver: NSObjectProtocol?
    @ObservationIgnored private var progressHandler: ProgressHandler?
    @ObservationIgnored private var lastReportedProgress = -1.0
    @ObservationIgnored private var lastReportedAt = Date.distantPast

    init() {
        timeObserver = player.addPeriodicTimeObserver(
            forInterval: CMTime(seconds: 0.5, preferredTimescale: 600),
            queue: .main
        ) { [weak self] time in
            Task { @MainActor [weak self] in self?.updateProgress(time) }
        }
        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in self?.itemDidFinish() }
        }
    }

    deinit {
        if let timeObserver { player.removeTimeObserver(timeObserver) }
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
    }

    var isActive: Bool {
        state != .idle && state != .failed
    }

    var isPlaying: Bool {
        state == .playing
    }

    func isCurrent(chapterKey: String) -> Bool {
        self.chapterKey == chapterKey && state != .idle
    }

    func prepareAndPlay(
        chapterKey: String,
        chapterTitle: String,
        startProgress: Double,
        api: any LyraAPI,
        onProgress: @escaping ProgressHandler
    ) {
        stop()
        self.chapterKey = chapterKey
        self.chapterTitle = chapterTitle
        self.chapterProgress = min(1, max(0, startProgress))
        self.progressHandler = onProgress
        state = .preparing
        errorMessage = nil

        preparationTask = Task { [weak self] in
            guard let self else { return }
            do {
                var nextManifest = try await api.requestAudiobook(chapterKey: chapterKey)
                for _ in 0..<600 where nextManifest.status == .queued || nextManifest.status == .generating {
                    try Task.checkCancellation()
                    updateGenerationProgress(nextManifest)
                    try await Task.sleep(for: .seconds(1))
                    nextManifest = try await api.audiobook(id: nextManifest.id)
                }
                guard nextManifest.status == .ready else {
                    throw AudiobookPlaybackError.generation(
                        nextManifest.error ?? "La génération OpenAI n’a pas pu être terminée."
                    )
                }
                updateGenerationProgress(nextManifest)
                var urls: [URL] = []
                for segment in nextManifest.segments {
                    urls.append(try await api.audiobookSegmentURL(path: segment.url))
                }
                try Task.checkCancellation()
                guard !urls.isEmpty else { throw AudiobookPlaybackError.unavailable }
                manifest = nextManifest
                segmentURLs = urls
                let index = audiobookSegmentIndex(for: chapterProgress, segments: nextManifest.segments)
                let localProgress = audiobookLocalProgress(chapterProgress, segment: nextManifest.segments[index])
                try await beginSegment(index: index, localProgress: localProgress, autoplay: true)
            } catch is CancellationError {
                return
            } catch {
                fail(error)
            }
        }
    }

    func togglePlayback() {
        switch state {
        case .playing:
            player.pause()
            state = .paused
            reportProgress(force: true, completed: false)
        case .paused:
            player.play()
            player.rate = Float(playbackRate)
            state = .playing
        case .finished:
            preparationTask = Task { [weak self] in
                guard let self else { return }
                do {
                    chapterProgress = 0
                    try await beginSegment(index: 0, localProgress: 0, autoplay: true)
                } catch {
                    fail(error)
                }
            }
        case .idle, .preparing, .failed:
            break
        }
    }

    func setPlaybackRate(_ rate: Double) {
        playbackRate = min(2, max(0.75, rate))
        if state == .playing { player.rate = Float(playbackRate) }
    }

    func stop() {
        preparationTask?.cancel()
        preparationTask = nil
        player.pause()
        player.replaceCurrentItem(with: nil)
        state = .idle
        chapterKey = nil
        chapterTitle = nil
        manifest = nil
        segmentURLs = []
        currentSegmentIndex = 0
        generationProgress = 0
        chapterProgress = 0
        elapsed = 0
        duration = 0
        errorMessage = nil
        progressHandler = nil
        lastReportedProgress = -1
        lastReportedAt = .distantPast
    }

    private func updateGenerationProgress(_ manifest: AudiobookManifest) {
        self.manifest = manifest
        generationProgress = manifest.totalSegments > 0
            ? Double(manifest.generatedSegments) / Double(manifest.totalSegments)
            : 0
    }

    private func beginSegment(index: Int, localProgress: Double, autoplay: Bool) async throws {
        guard segmentURLs.indices.contains(index) else { throw AudiobookPlaybackError.unavailable }
        let asset = AVURLAsset(url: segmentURLs[index])
        let loadedDuration = try await asset.load(.duration)
        try Task.checkCancellation()
        let item = AVPlayerItem(asset: asset)
        currentSegmentIndex = index
        duration = loadedDuration.seconds.isFinite ? max(0, loadedDuration.seconds) : 0
        elapsed = duration * min(1, max(0, localProgress))
        player.replaceCurrentItem(with: item)
        if elapsed > 0 {
            await player.seek(
                to: CMTime(seconds: elapsed, preferredTimescale: 600),
                toleranceBefore: .zero,
                toleranceAfter: .zero
            )
        }
        if autoplay {
            player.play()
            player.rate = Float(playbackRate)
            state = .playing
        } else {
            state = .paused
        }
    }

    private func itemDidFinish() {
        guard currentSegmentIndex + 1 < segmentURLs.count else {
            chapterProgress = 1
            elapsed = duration
            state = .finished
            reportProgress(force: true, completed: true)
            return
        }
        let nextIndex = currentSegmentIndex + 1
        reportProgress(force: true, completed: false)
        preparationTask = Task { [weak self] in
            guard let self else { return }
            do {
                try await beginSegment(index: nextIndex, localProgress: 0, autoplay: true)
            } catch {
                fail(error)
            }
        }
    }

    private func updateProgress(_ time: CMTime) {
        guard let manifest, manifest.segments.indices.contains(currentSegmentIndex) else { return }
        let seconds = time.seconds.isFinite ? max(0, time.seconds) : 0
        elapsed = seconds
        if duration <= 0, let itemDuration = player.currentItem?.duration.seconds, itemDuration.isFinite {
            duration = max(0, itemDuration)
        }
        let localProgress = duration > 0 ? min(1, elapsed / duration) : 0
        let segment = manifest.segments[currentSegmentIndex]
        chapterProgress = segment.progressStart
            + (segment.progressEnd - segment.progressStart) * localProgress
        if state == .playing { reportProgress(force: false, completed: false) }
    }

    private func reportProgress(force: Bool, completed: Bool) {
        guard let progressHandler else { return }
        let now = Date()
        guard force
                || abs(chapterProgress - lastReportedProgress) >= 0.01
                || now.timeIntervalSince(lastReportedAt) >= 5 else { return }
        lastReportedProgress = chapterProgress
        lastReportedAt = now
        let progress = chapterProgress
        Task { await progressHandler(progress, completed) }
    }

    private func fail(_ error: Error) {
        player.pause()
        state = .failed
        errorMessage = error.localizedDescription
    }
}
