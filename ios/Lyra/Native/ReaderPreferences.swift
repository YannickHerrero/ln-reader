import Foundation
import SwiftUI

nonisolated enum ReaderMode: String, Codable, CaseIterable, Sendable {
    case continuous
    case paragraph
    case sentence

    var label: String {
        switch self {
        case .continuous: "Continue"
        case .paragraph: "Paragraphe"
        case .sentence: "Phrase"
        }
    }
}

nonisolated enum ReaderFontFamily: String, Codable, CaseIterable, Sendable {
    case serif
    case sans

    var label: String { self == .serif ? "Sérif" : "Sans sérif" }
}

nonisolated enum ReaderPaper: String, Codable, CaseIterable, Sendable {
    case auto
    case ivory
    case white
    case black
    case softDark

    var label: String {
        switch self {
        case .auto: "Auto"
        case .ivory: "Ivoire"
        case .white: "Blanc"
        case .black: "Noir"
        case .softDark: "Nuit douce"
        }
    }
}

nonisolated struct ReaderPreferences: Codable, Equatable, Sendable {
    var fontSize: Double
    var lineHeight: Double
    var fontFamily: ReaderFontFamily
    var paper: ReaderPaper
    var mode: ReaderMode

    static let defaults = ReaderPreferences(
        fontSize: 19,
        lineHeight: 1.8,
        fontFamily: .serif,
        paper: .auto,
        mode: .continuous
    )

    var normalized: ReaderPreferences {
        ReaderPreferences(
            fontSize: min(28, max(15, fontSize)).rounded(),
            lineHeight: (min(2.2, max(1.4, lineHeight)) * 10).rounded() / 10,
            fontFamily: fontFamily,
            paper: paper,
            mode: mode
        )
    }
}

@MainActor
struct ReaderPreferenceStore {
    static let key = "lyra.native.reader-preferences"
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func load() -> ReaderPreferences {
        guard let data = defaults.data(forKey: Self.key),
              let value = try? JSONDecoder().decode(ReaderPreferences.self, from: data) else {
            return .defaults
        }
        return value.normalized
    }

    func save(_ preferences: ReaderPreferences) {
        if let data = try? JSONEncoder().encode(preferences.normalized) {
            defaults.set(data, forKey: Self.key)
        }
    }
}

struct ReaderPalette {
    let background: Color
    let surface: Color
    let foreground: Color
    let secondary: Color
    let border: Color
    let accent: Color

    static func resolve(_ paper: ReaderPaper, appPalette: LyraPalette) -> ReaderPalette {
        switch paper {
        case .auto:
            ReaderPalette(
                background: appPalette.background,
                surface: appPalette.surface,
                foreground: appPalette.foreground,
                secondary: appPalette.muted,
                border: appPalette.border,
                accent: appPalette.accent
            )
        case .ivory:
            ReaderPalette(
                background: Color(red: 0.957, green: 0.937, blue: 0.894),
                surface: Color(red: 0.985, green: 0.972, blue: 0.94),
                foreground: Color(red: 0.16, green: 0.15, blue: 0.125),
                secondary: Color.black.opacity(0.55),
                border: Color.black.opacity(0.14),
                accent: appPalette.accent
            )
        case .white:
            ReaderPalette(
                background: .white,
                surface: Color(red: 0.965, green: 0.965, blue: 0.97),
                foreground: Color(red: 0.07, green: 0.07, blue: 0.075),
                secondary: Color.black.opacity(0.55),
                border: Color.black.opacity(0.12),
                accent: appPalette.accent
            )
        case .black:
            ReaderPalette(
                background: Color(red: 0.02, green: 0.02, blue: 0.024),
                surface: Color(red: 0.075, green: 0.075, blue: 0.085),
                foreground: .white,
                secondary: Color.white.opacity(0.6),
                border: Color.white.opacity(0.14),
                accent: appPalette.accent
            )
        case .softDark:
            ReaderPalette(
                background: Color(red: 0.067, green: 0.075, blue: 0.094),
                surface: Color(red: 0.105, green: 0.115, blue: 0.14),
                foreground: Color(red: 0.84, green: 0.84, blue: 0.86),
                secondary: Color.white.opacity(0.56),
                border: Color.white.opacity(0.14),
                accent: appPalette.accent
            )
        }
    }
}
