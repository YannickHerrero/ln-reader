import UIKit
import WebKit

final class ReaderViewController: UIViewController {
    private let serverStore = ServerURLStore.shared
    private let migrationStore = MigrationArchiveStore()
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

    private lazy var migrationLabel: UILabel = {
        let label = UILabel()
        label.text = "Migration en cours…"
        label.font = .preferredFont(forTextStyle: .caption1)
        label.textColor = .secondaryLabel
        label.textAlignment = .center
        label.backgroundColor = UIColor.secondarySystemBackground.withAlphaComponent(0.94)
        label.layer.cornerRadius = 13
        label.clipsToBounds = true
        label.accessibilityIdentifier = "migration-status"
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        configureWebView()

        if let storedURL = serverStore.serverURL {
            load(storedURL)
        } else {
            presentConfiguration(currentURL: nil)
        }
    }

    deinit {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "lyraMigration")
    }

    private func configureWebView() {
        let contentController = WKUserContentController()
        let proxy = WeakScriptMessageHandler(delegate: self)
        contentController.add(proxy, name: "lyraMigration")
        contentController.addUserScript(WKUserScript(
            source: MigrationExportScript.source,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        ))
        messageProxy = proxy

        let configuration = WKWebViewConfiguration()
        configuration.applicationNameForUserAgent = "Lyra/1.0 Migration"
        configuration.websiteDataStore = .default()
        configuration.userContentController = contentController

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        view.addSubview(configurationButton)
        view.addSubview(migrationLabel)
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
            migrationLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            migrationLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
            migrationLabel.heightAnchor.constraint(equalToConstant: 26),
            migrationLabel.widthAnchor.constraint(greaterThanOrEqualToConstant: 190),
        ])
    }

    private func load(_ url: URL) {
        serverURL = url
        serverStore.save(url)
        configurationView?.removeFromSuperview()
        configurationView = nil
        configurationButton.isHidden = false
        migrationLabel.isHidden = false
        migrationLabel.text = "Migration en cours…"
        migrationLabel.textColor = .secondaryLabel
        webView.load(URLRequest(url: url))
    }

    @objc private func showConfiguration() {
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
        migrationLabel.isHidden = true
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
}

extension ReaderViewController: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "lyraMigration",
              isMessageFromConfiguredServer(message),
              let json = message.body as? String else {
            return
        }

        do {
            _ = try migrationStore.save(json: json)
            migrationLabel.text = "Migration prête ✓"
            migrationLabel.textColor = .systemGreen
            UIAccessibility.post(notification: .announcement, argument: "Vos données sont prêtes pour Lyra native")
        } catch {
            migrationLabel.text = "Migration à réessayer"
            migrationLabel.textColor = .systemRed
        }
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

private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    private weak var delegate: WKScriptMessageHandler?

    init(delegate: WKScriptMessageHandler) {
        self.delegate = delegate
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        delegate?.userContentController(userContentController, didReceive: message)
    }
}
