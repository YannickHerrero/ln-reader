import UIKit

final class ServerConfigurationView: UIView {
    var onConnect: ((URL) -> Void)?
    var onCancel: (() -> Void)?

    private let urlField = UITextField()
    private let errorLabel = UILabel()
    private let cancelButton = UIButton(type: .system)

    init(currentURL: URL?) {
        super.init(frame: .zero)
        configure(currentURL: currentURL)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func showError(_ message: String) {
        errorLabel.text = message
        errorLabel.isHidden = false
    }

    private func configure(currentURL: URL?) {
        backgroundColor = .systemBackground

        let symbol = UIImageView(image: UIImage(systemName: "book.closed.fill"))
        symbol.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 48, weight: .medium)
        symbol.tintColor = UIColor(red: 0.34, green: 0.43, blue: 0.95, alpha: 1)
        symbol.contentMode = .scaleAspectFit

        let titleLabel = UILabel()
        titleLabel.text = "Lyra"
        titleLabel.font = .systemFont(ofSize: 38, weight: .bold)
        titleLabel.textAlignment = .center

        let subtitleLabel = UILabel()
        subtitleLabel.text = "Connectez l’app à votre serveur de lecture personnel."
        subtitleLabel.font = .preferredFont(forTextStyle: .body)
        subtitleLabel.textColor = .secondaryLabel
        subtitleLabel.textAlignment = .center
        subtitleLabel.numberOfLines = 0

        let fieldLabel = UILabel()
        fieldLabel.text = "Adresse HTTPS du serveur"
        fieldLabel.font = .preferredFont(forTextStyle: .headline)

        urlField.text = currentURL?.absoluteString
        urlField.placeholder = "https://appareil.tailnet.ts.net:8443"
        urlField.keyboardType = .URL
        urlField.textContentType = .URL
        urlField.autocapitalizationType = .none
        urlField.autocorrectionType = .no
        urlField.clearButtonMode = .whileEditing
        urlField.borderStyle = .roundedRect
        urlField.accessibilityLabel = "Adresse du serveur"
        urlField.addTarget(self, action: #selector(fieldDidChange), for: .editingChanged)

        errorLabel.font = .preferredFont(forTextStyle: .footnote)
        errorLabel.textColor = .systemRed
        errorLabel.numberOfLines = 0
        errorLabel.isHidden = true

        var connectConfiguration = UIButton.Configuration.filled()
        connectConfiguration.title = "Ouvrir Lyra"
        connectConfiguration.cornerStyle = .large
        connectConfiguration.baseBackgroundColor = UIColor(red: 0.34, green: 0.43, blue: 0.95, alpha: 1)
        let connectButton = UIButton(configuration: connectConfiguration)
        connectButton.addTarget(self, action: #selector(connect), for: .touchUpInside)
        connectButton.accessibilityIdentifier = "connect-server"

        cancelButton.setTitle("Annuler", for: .normal)
        cancelButton.isHidden = currentURL == nil
        cancelButton.addTarget(self, action: #selector(cancel), for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [
            symbol,
            titleLabel,
            subtitleLabel,
            fieldLabel,
            urlField,
            errorLabel,
            connectButton,
            cancelButton,
        ])
        stack.axis = .vertical
        stack.spacing = 14
        stack.setCustomSpacing(8, after: symbol)
        stack.setCustomSpacing(28, after: subtitleLabel)
        stack.setCustomSpacing(6, after: fieldLabel)
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        NSLayoutConstraint.activate([
            symbol.heightAnchor.constraint(equalToConstant: 68),
            connectButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 50),
            stack.leadingAnchor.constraint(equalTo: safeAreaLayoutGuide.leadingAnchor, constant: 28),
            stack.trailingAnchor.constraint(equalTo: safeAreaLayoutGuide.trailingAnchor, constant: -28),
            stack.centerYAnchor.constraint(equalTo: safeAreaLayoutGuide.centerYAnchor),
        ])
    }

    @objc private func fieldDidChange() {
        errorLabel.isHidden = true
    }

    @objc private func connect() {
        guard let url = ServerURLStore.normalizedURL(from: urlField.text ?? "") else {
            showError("Saisissez une adresse HTTPS valide.")
            return
        }
        urlField.resignFirstResponder()
        onConnect?(url)
    }

    @objc private func cancel() {
        urlField.resignFirstResponder()
        onCancel?()
    }
}
