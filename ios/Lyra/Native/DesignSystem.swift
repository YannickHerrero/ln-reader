import SwiftUI

enum LyraDesign {
    static let accent = Color(red: 0.93, green: 0.03, blue: 0.08)
    static let background = Color(uiColor: .systemBackground)
    static let raised = Color(uiColor: .secondarySystemBackground)
    static let muted = Color(uiColor: .secondaryLabel)
    static let border = Color(uiColor: .separator).opacity(0.45)
    static let cornerRadius: CGFloat = 22
}

struct LyraWordmark: View {
    var compact = false

    var body: some View {
        HStack(spacing: 10) {
            Text("Ly")
                .font(.system(size: compact ? 17 : 20, weight: .black, design: .rounded))
                .foregroundStyle(.white)
                .frame(width: compact ? 42 : 50, height: compact ? 42 : 50)
                .background(LyraDesign.accent, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .accessibilityHidden(true)
            if !compact {
                Text("Lyra")
                    .font(.title2.weight(.black))
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Lyra")
    }
}

struct LyraPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
            .background(LyraDesign.accent.opacity(configuration.isPressed ? 0.72 : 1), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}

struct LyraCardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(LyraDesign.raised, in: RoundedRectangle(cornerRadius: LyraDesign.cornerRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: LyraDesign.cornerRadius, style: .continuous)
                    .stroke(LyraDesign.border, lineWidth: 1)
            }
    }
}

extension View {
    func lyraCard() -> some View {
        modifier(LyraCardModifier())
    }
}
