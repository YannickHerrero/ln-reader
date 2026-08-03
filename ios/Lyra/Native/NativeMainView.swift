import SwiftUI

struct NativeMainView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        TabView(selection: $model.selectedTab) {
            NavigationStack {
                LibraryView()
            }
            .tabItem { Label("Bibliothèque", systemImage: "books.vertical.fill") }
            .tag(0)

            NavigationStack {
                DiscoverView()
            }
            .tabItem { Label("Découvrir", systemImage: "sparkles") }
            .tag(1)
        }
        .tint(LyraDesign.accent)
    }
}
