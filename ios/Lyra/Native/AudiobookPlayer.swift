import AVFoundation
import Foundation
import MediaPlayer
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
    @ObservationIgnored nonisolated(unsafe) private var interruptionObserver: NSObjectProtocol?
    @ObservationIgnored nonisolated(unsafe) private var routeObserver: NSObjectProtocol?
    @ObservationIgnored nonisolated(unsafe) private var remoteCommandTargets: [(MPRemoteCommand, Any)] = []
    @ObservationIgnored private var progressHandler: ProgressHandler?
    @ObservationIgnored private var lastReportedProgress = -1.0
    @ObservationIgnored private var lastReportedAt = Date.distantPast
    @ObservationIgnored private var wasPlayingBeforeInterruption = false

    init() {
        timeObserver = player.addPeriodicTimeObserver(
            forInterval: CMTime(seconds: 0.5, preferredTimescale: 600),
            queue: .main
        ) { [weak self] time in
            Task { @MainActor [weak self] in self?.updateProgress(time) }
        }
        interruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance(),
            queue: .main
        ) { [weak self] notification in
            let type = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
            let options = notification.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt
            Task { @MainActor [weak self] in self?.handleInterruption(type: type, options: options) }
        }
        routeObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.routeChangeNotification,
            object: AVAudioSession.sharedInstance(),
            queue: .main
        ) { [weak self] notification in
            let reason = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt
            Task { @MainActor [weak self] in self?.handleRouteChange(reason: reason) }
        }
        configureRemoteCommands()
    }

    deinit {
        if let timeObserver { player.removeTimeObserver(timeObserver) }
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
        if let interruptionObserver { NotificationCenter.default.removeObserver(interruptionObserver) }
        if let routeObserver { NotificationCenter.default.removeObserver(routeObserver) }
        for (command, target) in remoteCommandTargets { command.removeTarget(target) }
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
            pause()
            reportProgress(force: true, completed: false)
        case .paused:
            play()
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
        updateNowPlaying()
    }

    func skip(by seconds: Double) {
        guard state == .playing || state == .paused else { return }
        let autoplay = state == .playing
        let target = elapsed + seconds
        if target < 0, currentSegmentIndex > 0 {
            preparationTask = Task { [weak self] in
                guard let self else { return }
                do {
                    try await beginSegment(
                        index: currentSegmentIndex - 1,
                        localProgress: 1,
                        autoplay: autoplay
                    )
                } catch {
                    fail(error)
                }
            }
            return
        }
        if duration > 0, target > duration, currentSegmentIndex + 1 < segmentURLs.count {
            preparationTask = Task { [weak self] in
                guard let self else { return }
                do {
                    try await beginSegment(
                        index: currentSegmentIndex + 1,
                        localProgress: 0,
                        autoplay: autoplay
                    )
                } catch {
                    fail(error)
                }
            }
            return
        }
        seekCurrentSegment(to: target)
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
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
            self.endObserver = nil
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        MPNowPlayingInfoCenter.default().playbackState = .stopped
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
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
        try configureAudioSession()
        currentSegmentIndex = index
        duration = loadedDuration.seconds.isFinite ? max(0, loadedDuration.seconds) : 0
        elapsed = duration * min(1, max(0, localProgress))
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in self?.itemDidFinish() }
        }
        player.replaceCurrentItem(with: item)
        if elapsed > 0 {
            await player.seek(
                to: CMTime(seconds: elapsed, preferredTimescale: 600),
                toleranceBefore: .zero,
                toleranceAfter: .zero
            )
        }
        if autoplay {
            play()
        } else {
            pause()
        }
    }

    private func itemDidFinish() {
        guard currentSegmentIndex + 1 < segmentURLs.count else {
            chapterProgress = 1
            elapsed = duration
            state = .finished
            updateNowPlaying()
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
        updateNowPlaying()
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

    private func configureAudioSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(
            .playback,
            mode: .spokenAudio,
            options: [.allowAirPlay, .allowBluetoothA2DP]
        )
        try session.setActive(true)
    }

    private func play() {
        try? AVAudioSession.sharedInstance().setActive(true)
        player.play()
        player.rate = Float(playbackRate)
        state = .playing
        updateNowPlaying()
    }

    private func pause() {
        player.pause()
        if state != .finished { state = .paused }
        updateNowPlaying()
    }

    private func seekCurrentSegment(to seconds: Double) {
        guard duration > 0 else { return }
        elapsed = min(duration, max(0, seconds))
        player.seek(
            to: CMTime(seconds: elapsed, preferredTimescale: 600),
            toleranceBefore: .zero,
            toleranceAfter: .zero
        )
        updateProgress(CMTime(seconds: elapsed, preferredTimescale: 600))
    }

    private func configureRemoteCommands() {
        let center = MPRemoteCommandCenter.shared()
        center.playCommand.isEnabled = true
        center.pauseCommand.isEnabled = true
        center.togglePlayPauseCommand.isEnabled = true
        center.stopCommand.isEnabled = true
        center.skipBackwardCommand.isEnabled = true
        center.skipForwardCommand.isEnabled = true
        center.changePlaybackPositionCommand.isEnabled = true
        center.skipBackwardCommand.preferredIntervals = [15]
        center.skipForwardCommand.preferredIntervals = [15]

        remoteCommandTargets.append((center.playCommand, center.playCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                if state == .paused || state == .finished { togglePlayback() }
            }
            return .success
        }))
        remoteCommandTargets.append((center.pauseCommand, center.pauseCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self, state == .playing else { return }
                togglePlayback()
            }
            return .success
        }))
        remoteCommandTargets.append((center.togglePlayPauseCommand, center.togglePlayPauseCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in self?.togglePlayback() }
            return .success
        }))
        remoteCommandTargets.append((center.stopCommand, center.stopCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in self?.stop() }
            return .success
        }))
        remoteCommandTargets.append((center.skipBackwardCommand, center.skipBackwardCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in self?.skip(by: -15) }
            return .success
        }))
        remoteCommandTargets.append((center.skipForwardCommand, center.skipForwardCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in self?.skip(by: 15) }
            return .success
        }))
        remoteCommandTargets.append((center.changePlaybackPositionCommand, center.changePlaybackPositionCommand.addTarget { [weak self] event in
            let position = (event as? MPChangePlaybackPositionCommandEvent)?.positionTime
            Task { @MainActor [weak self] in
                guard let position else { return }
                self?.seekCurrentSegment(to: position)
            }
            return .success
        }))
    }

    private func handleInterruption(type: UInt?, options: UInt?) {
        guard let type, let interruption = AVAudioSession.InterruptionType(rawValue: type) else { return }
        switch interruption {
        case .began:
            wasPlayingBeforeInterruption = state == .playing
            if state == .playing { pause() }
        case .ended:
            let shouldResume = options.map(AVAudioSession.InterruptionOptions.init(rawValue:))?.contains(.shouldResume) == true
            if wasPlayingBeforeInterruption && shouldResume { play() }
            wasPlayingBeforeInterruption = false
        @unknown default:
            break
        }
    }

    private func handleRouteChange(reason: UInt?) {
        guard let reason,
              AVAudioSession.RouteChangeReason(rawValue: reason) == .oldDeviceUnavailable,
              state == .playing else { return }
        pause()
        reportProgress(force: true, completed: false)
    }

    private func updateNowPlaying() {
        guard let chapterTitle else { return }
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: chapterTitle,
            MPMediaItemPropertyAlbumTitle: "Lyra · Livre audio",
            MPMediaItemPropertyArtist: "Voix IA OpenAI",
            MPNowPlayingInfoPropertyMediaType: MPNowPlayingInfoMediaType.audio.rawValue,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: elapsed,
            MPNowPlayingInfoPropertyPlaybackRate: state == .playing ? playbackRate : 0,
            MPNowPlayingInfoPropertyDefaultPlaybackRate: playbackRate,
        ]
        if duration > 0 { info[MPMediaItemPropertyPlaybackDuration] = duration }
        if let manifest {
            info[MPNowPlayingInfoPropertyExternalContentIdentifier] = manifest.id
            info[MPMediaItemPropertyAlbumTrackNumber] = currentSegmentIndex + 1
            info[MPMediaItemPropertyAlbumTrackCount] = manifest.totalSegments
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        MPNowPlayingInfoCenter.default().playbackState = state == .playing ? .playing : .paused
    }

    private func fail(_ error: Error) {
        player.pause()
        state = .failed
        errorMessage = error.localizedDescription
        updateNowPlaying()
    }
}
