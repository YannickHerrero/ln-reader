import SwiftUI

struct LyraPalette: Sendable {
    let background: Color
    let surface: Color
    let foreground: Color
    let muted: Color
    let border: Color
    let accent: Color
    let onAccent: Color
    let raised: Color
    let overlay: Color
    let blue: Color
    let green: Color
    let peach: Color
    let red: Color
    let mauve: Color
}

enum LyraColors {
    enum Latte {
        static let background = Color(red: 0.937255, green: 0.945098, blue: 0.960784)
        static let surface = Color(red: 1, green: 1, blue: 1)
        static let foreground = Color(red: 0.298039, green: 0.309804, blue: 0.411765)
        static let muted = Color(red: 0.549020, green: 0.560784, blue: 0.631373)
        static let border = Color(red: 0.862745, green: 0.878431, blue: 0.909804)
        static let accent = Color(red: 0.447059, green: 0.529412, blue: 0.992157)
        static let onAccent = Color(red: 0.066667, green: 0.066667, blue: 0.105882)
        static let raised = Color(red: 0.901961, green: 0.913725, blue: 0.937255)
        static let overlay = Color(red: 0.8, green: 0.815686, blue: 0.854902)
        static let blue = Color(red: 0.117647, green: 0.4, blue: 0.960784)
        static let green = Color(red: 0.25098, green: 0.627451, blue: 0.168627)
        static let peach = Color(red: 0.996078, green: 0.392157, blue: 0.043137)
        static let red = Color(red: 0.823529, green: 0.058824, blue: 0.223529)
        static let mauve = Color(red: 0.533333, green: 0.223529, blue: 0.937255)
    }

    enum Mocha {
        static let background = Color(red: 0.066667, green: 0.066667, blue: 0.105882)
        static let surface = Color(red: 0.117647, green: 0.117647, blue: 0.180392)
        static let foreground = Color(red: 0.803922, green: 0.839216, blue: 0.956863)
        static let muted = Color(red: 0.65098, green: 0.678431, blue: 0.784314)
        static let border = Color(red: 0.192157, green: 0.196078, blue: 0.266667)
        static let accent = Color(red: 0.705882, green: 0.745098, blue: 0.996078)
        static let onAccent = Color(red: 0.066667, green: 0.066667, blue: 0.105882)
        static let raised = Color(red: 0.094118, green: 0.094118, blue: 0.145098)
        static let overlay = Color(red: 0.270588, green: 0.278431, blue: 0.352941)
        static let blue = Color(red: 0.537255, green: 0.705882, blue: 0.980392)
        static let green = Color(red: 0.65098, green: 0.890196, blue: 0.631373)
        static let peach = Color(red: 0.980392, green: 0.701961, blue: 0.529412)
        static let red = Color(red: 0.952941, green: 0.545098, blue: 0.658824)
        static let mauve = Color(red: 0.796078, green: 0.65098, blue: 0.968627)
    }
}

enum LyraAppearance: String, CaseIterable, Codable, Sendable {
    case latte
    case mocha

    init?(persistedValue: String) {
        switch persistedValue {
        case Self.latte.rawValue, "light": self = .latte
        case Self.mocha.rawValue, "dark": self = .mocha
        default: return nil
        }
    }

    var palette: LyraPalette {
        switch self {
        case .latte:
            LyraPalette(
                background: LyraColors.Latte.background,
                surface: LyraColors.Latte.surface,
                foreground: LyraColors.Latte.foreground,
                muted: LyraColors.Latte.muted,
                border: LyraColors.Latte.border,
                accent: LyraColors.Latte.accent,
                onAccent: LyraColors.Latte.onAccent,
                raised: LyraColors.Latte.raised,
                overlay: LyraColors.Latte.overlay,
                blue: LyraColors.Latte.blue,
                green: LyraColors.Latte.green,
                peach: LyraColors.Latte.peach,
                red: LyraColors.Latte.red,
                mauve: LyraColors.Latte.mauve
            )
        case .mocha:
            LyraPalette(
                background: LyraColors.Mocha.background,
                surface: LyraColors.Mocha.surface,
                foreground: LyraColors.Mocha.foreground,
                muted: LyraColors.Mocha.muted,
                border: LyraColors.Mocha.border,
                accent: LyraColors.Mocha.accent,
                onAccent: LyraColors.Mocha.onAccent,
                raised: LyraColors.Mocha.raised,
                overlay: LyraColors.Mocha.overlay,
                blue: LyraColors.Mocha.blue,
                green: LyraColors.Mocha.green,
                peach: LyraColors.Mocha.peach,
                red: LyraColors.Mocha.red,
                mauve: LyraColors.Mocha.mauve
            )
        }
    }

    var colorScheme: ColorScheme { self == .latte ? .light : .dark }
    var displayName: String { self == .latte ? "Catppuccin Latte" : "Catppuccin Mocha" }
    var toggled: LyraAppearance { self == .latte ? .mocha : .latte }
}

enum LyraDesign {
    static let cornerRadius: CGFloat = 22
    static let minimumTarget: CGFloat = 44
}

private struct LyraThemeKey: EnvironmentKey {
    static let defaultValue = LyraAppearance.latte
}

extension EnvironmentValues {
    var lyraTheme: LyraAppearance {
        get { self[LyraThemeKey.self] }
        set { self[LyraThemeKey.self] = newValue }
    }

    var lyraPalette: LyraPalette { lyraTheme.palette }
}

extension View {
    func lyraTheme(_ theme: LyraAppearance) -> some View {
        environment(\.lyraTheme, theme)
            .preferredColorScheme(theme.colorScheme)
            .tint(theme.palette.accent)
    }
}

struct LyraBackground: View {
    @Environment(\.lyraPalette) private var palette

    var body: some View {
        palette.background
            .overlay(alignment: .topLeading) {
                RadialGradient(
                    colors: [palette.accent.opacity(0.15), .clear],
                    center: .topLeading,
                    startRadius: 0,
                    endRadius: 430
                )
            }
            .ignoresSafeArea()
    }
}

struct LyraWordmark: View {
    @Environment(\.lyraPalette) private var palette
    var compact = false

    var body: some View {
        HStack(spacing: 10) {
            Text("Ly")
                .font(.system(size: compact ? 17 : 20, weight: .black, design: .rounded))
                .foregroundStyle(palette.onAccent)
                .frame(width: compact ? 42 : 50, height: compact ? 42 : 50)
                .background(palette.accent, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .shadow(color: palette.accent.opacity(0.22), radius: 12, y: 8)
                .accessibilityHidden(true)
            if !compact {
                Text("Lyra")
                    .font(.title2.weight(.black))
                    .foregroundStyle(palette.foreground)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Lyra")
    }
}

struct LyraPrimaryButtonStyle: ButtonStyle {
    @Environment(\.lyraPalette) private var palette
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(palette.onAccent)
            .frame(maxWidth: .infinity, minHeight: LyraDesign.minimumTarget)
            .padding(.horizontal, 18)
            .background(
                palette.accent.opacity(isEnabled ? (configuration.isPressed ? 0.78 : 1) : 0.6),
                in: RoundedRectangle(cornerRadius: 14, style: .continuous)
            )
            .shadow(color: palette.accent.opacity(isEnabled ? 0.24 : 0), radius: 14, y: 9)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.2), value: configuration.isPressed)
    }
}

struct LyraCardModifier: ViewModifier {
    @Environment(\.lyraPalette) private var palette

    func body(content: Content) -> some View {
        content
            .background(palette.surface.opacity(0.94))
            .clipShape(RoundedRectangle(cornerRadius: LyraDesign.cornerRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: LyraDesign.cornerRadius, style: .continuous)
                    .stroke(palette.border.opacity(0.82), lineWidth: 1)
            }
            .shadow(color: palette.foreground.opacity(0.08), radius: 24, y: 14)
    }
}

extension View {
    func lyraCard() -> some View {
        modifier(LyraCardModifier())
    }
}
