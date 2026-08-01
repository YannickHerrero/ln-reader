import UIKit
import WebKit

final class ReaderViewController: UIViewController {
    private let serverStore = ServerURLStore.shared
    private let cameraController = ReaderCameraController()
    private var serverURL: URL?
    private var webView: WKWebView!
    private var configurationView: ServerConfigurationView?
    private var messageProxy: WeakScriptMessageHandler?

    private lazy var configurationButton: UIButton = {
        var configuration = UIButton.Configuration.gray()
        configuration.image = UIImage(systemName: "gearshape.fill")
        configuration.cornerStyle = .capsule
        let button = UIButton(configuration: configuration)
        button.accessibilityLabel = "Configurer le serveur"
        button.addTarget(self, action: #selector(showConfiguration), for: .touchUpInside)
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        cameraController.delegate = self
        configureWebView()
        configureLifecycleObservers()

        if let storedURL = serverStore.serverURL {
            load(storedURL)
        } else {
            presentConfiguration(currentURL: nil)
        }
    }

    deinit {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "lyraReader")
        NotificationCenter.default.removeObserver(self)
    }

    private func configureWebView() {
        let contentController = WKUserContentController()
        let proxy = WeakScriptMessageHandler(delegate: self)
        contentController.add(proxy, name: "lyraReader")
        messageProxy = proxy

        let configuration = WKWebViewConfiguration()
        configuration.applicationNameForUserAgent = "Lyra/1.0"
        configuration.websiteDataStore = .default()
        configuration.userContentController = contentController

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        view.addSubview(configurationButton)
        self.webView = webView

        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            configurationButton.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -14),
            configurationButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -14),
            configurationButton.widthAnchor.constraint(equalToConstant: 44),
            configurationButton.heightAnchor.constraint(equalToConstant: 44),
        ])
    }

    private func configureLifecycleObservers() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(applicationDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(applicationWillEnterForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
    }

    private func load(_ url: URL) {
        serverURL = url
        serverStore.save(url)
        configurationView?.removeFromSuperview()
        configurationView = nil
        configurationButton.isHidden = false
        webView.load(URLRequest(url: url))
    }

    @objc private func showConfiguration() {
        cameraController.update(inactiveReaderState)
        presentConfiguration(currentURL: serverURL)
    }

    private func presentConfiguration(currentURL: URL?, error: String? = nil) {
        configurationView?.removeFromSuperview()
        let configurationView = ServerConfigurationView(currentURL: currentURL)
        configurationView.translatesAutoresizingMaskIntoConstraints = false
        configurationView.onConnect = { [weak self] url in
            self?.load(url)
        }
        configurationView.onCancel = { [weak self, weak configurationView] in
            configurationView?.removeFromSuperview()
            self?.configurationView = nil
            self?.configurationButton.isHidden = false
        }
        if let error {
            configurationView.showError(error)
        }
        view.addSubview(configurationView)
        NSLayoutConstraint.activate([
            configurationView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            configurationView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            configurationView.topAnchor.constraint(equalTo: view.topAnchor),
            configurationView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        self.configurationView = configurationView
        configurationButton.isHidden = true
    }

    private var inactiveReaderState: ReaderPageState {
        ReaderPageState(messageBody: ["active": false, "index": 0, "count": 0])!
    }

    private func isMessageFromConfiguredServer(_ message: WKScriptMessage) -> Bool {
        guard message.frameInfo.isMainFrame,
              let serverURL,
              let expectedScheme = serverURL.scheme,
              let expectedHost = serverURL.host else {
            return false
        }

        let origin = message.frameInfo.securityOrigin
        let defaultPort = expectedScheme == "https" ? 443 : 80
        return origin.protocol == expectedScheme
            && origin.host == expectedHost
            && origin.port == (serverURL.port ?? defaultPort)
    }

    @objc private func applicationDidEnterBackground() {
        cameraController.suspend()
    }

    @objc private func applicationWillEnterForeground() {
        cameraController.resumeIfNeeded()
    }
}

extension ReaderViewController: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "lyraReader",
              isMessageFromConfiguredServer(message),
              let state = ReaderPageState(messageBody: message.body) else {
            return
        }
        configurationButton.isHidden = state.active
        cameraController.update(state)
    }
}

extension ReaderViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation?, withError error: Error) {
        presentConfiguration(
            currentURL: serverURL,
            error: "Connexion impossible. Vérifiez que le serveur et Tailscale sont disponibles."
        )
    }
}

extension ReaderViewController: ReaderCameraControllerDelegate {
    func readerCameraController(_ controller: ReaderCameraController, didSelectPage index: Int) {
        let script = "window.dispatchEvent(new CustomEvent('lyra:set-page',{detail:{index:\(index)}}));"
        webView.evaluateJavaScript(script)
    }
}

private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    private weak var delegate: WKScriptMessageHandler?

    init(delegate: WKScriptMessageHandler) {
        self.delegate = delegate
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        delegate?.userContentController(userContentController, didReceive: message)
    }
}
