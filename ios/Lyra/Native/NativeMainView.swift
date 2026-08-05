import SwiftUI

struct NativeMainView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.lyraPalette) private var palette

    var body: some View {
        @Bindable var model = model
        TabView(selection: $model.selectedTab) {
            NavigationStack {
                LibraryView()
                    .navigationDestination(for: NativeReaderRoute.self) { route in
                        NativeReaderView(seriesKey: route.seriesKey, chapterKey: route.chapterKey)
                    }
            }
            .tabItem { Label("Bibliothèque", systemImage: "books.vertical.fill") }
            .tag(0)

            NavigationStack {
                DiscoverView()
                    .navigationDestination(for: NativeReaderRoute.self) { route in
                        NativeReaderView(seriesKey: route.seriesKey, chapterKey: route.chapterKey)
                    }
            }
            .tabItem { Label("Découvrir", systemImage: "sparkles") }
            .tag(1)
        }
        .tint(palette.accent)
        .toolbarBackground(palette.surface.opacity(0.96), for: .tabBar)
        .toolbarBackground(.visible, for: .tabBar)
    }
}
