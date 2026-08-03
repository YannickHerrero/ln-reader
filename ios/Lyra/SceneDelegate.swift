import SwiftUI
import UIKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var appModel: AppModel?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = scene as? UIWindowScene else { return }

        let model: AppModel
        let rootView: AnyView
#if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--ui-testing") {
            let suite = "LyraUITestFixture.\(UUID().uuidString)"
            let defaults = UserDefaults(suiteName: suite) ?? .standard
            defaults.set("https://fixture.test", forKey: "lyra.serverURL")
            defaults.set(LyraAppearance.latte.rawValue, forKey: "lyra.native.appearance")
            ReaderPreferenceStore().save(.defaults)
            let serverStore = ServerURLStore(defaults: defaults)
            let database = try! AppDatabase.temporary()
            model = AppModel(
                serverStore: serverStore,
                defaults: defaults,
                database: database,
                client: UITestFixtureAPI(),
                synchronizationEnabled: false
            )
            rootView = AnyView(UITestBootstrapView().environment(model))
        } else {
            model = AppModel()
            rootView = AnyView(LyraRootView().environment(model))
        }
#else
        model = AppModel()
        rootView = AnyView(LyraRootView().environment(model))
#endif

        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = UIHostingController(rootView: rootView)
        window.makeKeyAndVisible()
        appModel = model
        self.window = window
    }
}
