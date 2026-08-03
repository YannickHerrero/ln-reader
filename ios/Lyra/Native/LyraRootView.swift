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
                NativeMainView()
                    .sheet(isPresented: $model.showsServerConfiguration) {
                        ServerSetupView(allowsCancel: true)
                    }
            }
        }
        .lyraTheme(model.appearance)
        .task { model.start() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { model.applicationBecameActive() }
        }
    }
}
