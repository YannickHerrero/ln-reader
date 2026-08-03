import SwiftUI

struct LyraRootView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        @Bindable var model = model
        Group {
            if model.serverURL == nil {
                ServerSetupView(allowsCancel: false)
            } else {
                NativeHomePlaceholder()
                    .sheet(isPresented: $model.showsServerConfiguration) {
                        ServerSetupView(allowsCancel: true)
                    }
            }
        }
        .preferredColorScheme(model.appearance.colorScheme)
        .tint(LyraDesign.accent)
        .task { model.start() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { model.applicationBecameActive() }
        }
    }
}

private struct NativeHomePlaceholder: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                HStack {
                    LyraWordmark(compact: true)
                    Spacer()
                    Button {
                        model.toggleAppearance()
                    } label: {
                        Image(systemName: model.appearance == .dark ? "sun.max.fill" : "moon.fill")
                            .frame(width: 44, height: 44)
                            .background(LyraDesign.raised, in: Circle())
                    }
                    .accessibilityLabel("Changer l’apparence")
                    Button {
                        model.showsServerConfiguration = true
                    } label: {
                        Image(systemName: "gearshape.fill")
                            .frame(width: 44, height: 44)
                            .background(LyraDesign.raised, in: Circle())
                    }
                    .accessibilityLabel("Configurer le serveur")
                }

                VStack(alignment: .leading, spacing: 18) {
                    Text("VOTRE BIBLIOTHÈQUE PERSONNELLE")
                        .font(.caption.weight(.black))
                        .tracking(2)
                        .foregroundStyle(LyraDesign.accent)
                    Text("Toutes vos histoires.\nUn seul endroit.")
                        .font(.system(size: 43, weight: .black, design: .rounded))
                        .minimumScaleFactor(0.72)
                    Text("La nouvelle expérience Lyra est entièrement native. Votre bibliothèque apparaîtra ici après la synchronisation.")
                        .font(.title3)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(24)
                .lyraCard()

                ProgressView("Préparation de votre bibliothèque…")
                    .frame(maxWidth: .infinity)
                    .padding(28)
                    .lyraCard()
            }
            .padding(20)
        }
        .background(LyraDesign.background)
    }
}
