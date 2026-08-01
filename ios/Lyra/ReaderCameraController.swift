import AVFoundation
import Foundation

protocol ReaderCameraControllerDelegate: AnyObject {
    func readerCameraController(_ controller: ReaderCameraController, didSelectPage index: Int)
}

final class ReaderCameraController: NSObject {
    weak var delegate: ReaderCameraControllerDelegate?

    private let session = AVCaptureSession()
    private let sessionQueue = DispatchQueue(label: "com.yannickherrero.lyra.camera")
    private var configured = false
    private var requestedState: ReaderPageState?
    private var pageSlider: AVCaptureSlider?
    private var pageCount = 0
    private var pageIndex = 0

    func update(_ state: ReaderPageState) {
        sessionQueue.async { [weak self] in
            guard let self else { return }
            self.requestedState = state
            guard state.active, state.count > 1 else {
                self.deactivate()
                return
            }
            self.authorizeAndActivate()
        }
    }

    func suspend() {
        sessionQueue.async { [weak self] in
            guard let self, self.session.isRunning else { return }
            self.session.stopRunning()
        }
    }

    func resumeIfNeeded() {
        sessionQueue.async { [weak self] in
            guard let self,
                  let state = self.requestedState,
                  state.active,
                  state.count > 1 else { return }
            self.authorizeAndActivate()
        }
    }

    private func authorizeAndActivate() {
#if targetEnvironment(simulator)
        return
#else
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            activateRequestedState()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                guard granted else { return }
                self?.sessionQueue.async { self?.activateRequestedState() }
            }
        case .denied, .restricted:
            return
        @unknown default:
            return
        }
#endif
    }

    private func activateRequestedState() {
        guard let state = requestedState, state.active, state.count > 1 else { return }
        guard configureSessionIfNeeded() else { return }
        updatePageControl(for: state)
        if !session.isRunning {
            session.startRunning()
        }
    }

    private func configureSessionIfNeeded() -> Bool {
        if configured { return true }
        guard session.supportsControls,
              let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let input = try? AVCaptureDeviceInput(device: camera) else {
            return false
        }

        let photoOutput = AVCapturePhotoOutput()
        session.beginConfiguration()
        session.sessionPreset = .low
        guard session.canAddInput(input), session.canAddOutput(photoOutput) else {
            session.commitConfiguration()
            return false
        }
        session.addInput(input)
        session.addOutput(photoOutput)
        session.setControlsDelegate(self, queue: sessionQueue)
        session.commitConfiguration()

        reduceCameraFrameRate(camera)
        configured = true
        return true
    }

    private func reduceCameraFrameRate(_ camera: AVCaptureDevice) {
        guard let lowestRateRange = camera.activeFormat.videoSupportedFrameRateRanges.min(by: {
            $0.minFrameRate < $1.minFrameRate
        }) else { return }
        do {
            try camera.lockForConfiguration()
            camera.activeVideoMinFrameDuration = lowestRateRange.maxFrameDuration
            camera.activeVideoMaxFrameDuration = lowestRateRange.maxFrameDuration
            camera.unlockForConfiguration()
        } catch {
            return
        }
    }

    private func updatePageControl(for state: ReaderPageState) {
        pageIndex = state.index
        guard state.count != pageCount || pageSlider == nil else {
            pageSlider?.value = Float(state.index)
            return
        }

        if let pageSlider {
            session.removeControl(pageSlider)
        }

        pageCount = state.count
        let slider = AVCaptureSlider(
            __localizedTitle: "Page",
            symbolName: "book",
            minValue: 0,
            maxValue: Float(state.count - 1),
            step: 1
        )
        slider.localizedValueFormat = "%@"
        slider.value = Float(state.index)
        slider.setActionQueue(sessionQueue) { [weak self] (value: Float) in
            guard let self else { return }
            let selectedIndex = Int(value.rounded())
            guard selectedIndex != self.pageIndex else { return }
            self.pageIndex = selectedIndex
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                self.delegate?.readerCameraController(self, didSelectPage: selectedIndex)
            }
        }

        guard session.canAddControl(slider) else { return }
        session.addControl(slider)
        pageSlider = slider
    }

    private func deactivate() {
        if let pageSlider {
            session.removeControl(pageSlider)
            self.pageSlider = nil
        }
        pageCount = 0
        pageIndex = 0
        if session.isRunning {
            session.stopRunning()
        }
    }
}

extension ReaderCameraController: AVCaptureSessionControlsDelegate {
    func sessionControlsDidBecomeActive(_ session: AVCaptureSession) {}

    func sessionControlsWillEnterFullscreenAppearance(_ session: AVCaptureSession) {}

    func sessionControlsWillExitFullscreenAppearance(_ session: AVCaptureSession) {}

    func sessionControlsDidBecomeInactive(_ session: AVCaptureSession) {}
}
