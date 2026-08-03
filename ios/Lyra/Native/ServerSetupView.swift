import SwiftUI

struct ServerSetupView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @Environment(\.lyraPalette) private var palette
    @FocusState private var fieldFocused: Bool
    @State private var input = ""

    let allowsCancel: Bool

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 26) {
                    LyraWordmark()
                        .padding(.top, 36)

                    VStack(spacing: 10) {
                        Text("Votre bibliothèque native")
                            .font(.system(.largeTitle, design: .rounded, weight: .black))
                            .multilineTextAlignment(.center)
                        Text("Connectez Lyra à votre serveur personnel pour retrouver votre bibliothèque et votre progression.")
                            .font(.body)
                            .foregroundStyle(palette.muted)
                            .multilineTextAlignment(.center)
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Adresse HTTPS du serveur")
                            .font(.headline)
                        TextField("https://appareil.tailnet.ts.net:8443", text: $input)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.URL)
                            .textContentType(.URL)
                            .submitLabel(.go)
                            .padding(14)
                            .foregroundStyle(palette.foreground)
                            .background(palette.background, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .overlay {
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .stroke(palette.border, lineWidth: 1)
                            }
                            .focused($fieldFocused)
                            .accessibilityIdentifier("server-url")
                            .onSubmit(connect)

                        if let error = model.setupError {
                            Text(error)
                                .font(.footnote)
                                .foregroundStyle(palette.red)
                                .accessibilityIdentifier("server-error")
                        }
                    }

                    Button(action: connect) {
                        HStack {
                            if model.isConnecting { ProgressView().tint(palette.onAccent) }
                            Text(model.isConnecting ? "Connexion…" : "Ouvrir Lyra")
                        }
                    }
                    .buttonStyle(LyraPrimaryButtonStyle())
                    .disabled(model.isConnecting || input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .accessibilityIdentifier("connect-server")
                }
                .padding(.horizontal, 26)
                .padding(.bottom, 36)
            }
            .scrollDismissesKeyboard(.interactively)
            .background { LyraBackground() }
            .foregroundStyle(palette.foreground)
            .navigationTitle(allowsCancel ? "Serveur" : "")
            .toolbarBackground(palette.surface.opacity(0.96), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if allowsCancel {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Annuler") { dismiss() }
                    }
                }
            }
            .onAppear {
                input = model.serverURL?.absoluteString ?? ""
                if input.isEmpty { fieldFocused = true }
            }
        }
    }

    private func connect() {
        Task {
            await model.connect(to: input)
            if model.serverURL != nil, allowsCancel { dismiss() }
        }
    }
}
