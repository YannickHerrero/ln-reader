import UIKit
import WebKit

final class ReaderViewController: UIViewController {
    private let serverStore = ServerURLStore.shared
    private var serverURL: URL?
    private var webView: WKWebView!
    private var configurationView: ServerConfigurationView?

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
        configureWebView()

        if let storedURL = serverStore.serverURL {
            load(storedURL)
        } else {
            presentConfiguration(currentURL: nil)
        }
    }

    private func configureWebView() {
        let configuration = WKWebViewConfiguration()
        configuration.applicationNameForUserAgent = "Lyra/1.0"
        configuration.websiteDataStore = .default()

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

    private func load(_ url: URL) {
        serverURL = url
        serverStore.save(url)
        configurationView?.removeFromSuperview()
        configurationView = nil
        configurationButton.isHidden = false
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
