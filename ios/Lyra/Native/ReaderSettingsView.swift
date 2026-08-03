import SwiftUI

struct ReaderSettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.lyraPalette) private var palette
    @State private var draft: ReaderPreferences
    let onSave: (ReaderPreferences) -> Void

    init(preferences: ReaderPreferences, onSave: @escaping (ReaderPreferences) -> Void) {
        _draft = State(initialValue: preferences)
        self.onSave = onSave
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Mode de lecture") {
                    Picker("Mode", selection: $draft.mode) {
                        ForEach(ReaderMode.allCases, id: \.self) { mode in
                            Text(mode.label).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                }
                .listRowBackground(palette.surface)

                Section("Texte") {
                    Picker("Police", selection: $draft.fontFamily) {
                        ForEach(ReaderFontFamily.allCases, id: \.self) { family in
                            Text(family.label).tag(family)
                        }
                    }
                    .pickerStyle(.segmented)
                    LabeledContent("Taille", value: "\(Int(draft.fontSize)) pt")
                    Slider(value: $draft.fontSize, in: 15...28, step: 1)
                        .tint(palette.accent)
                    LabeledContent("Interligne", value: draft.lineHeight.formatted(.number.precision(.fractionLength(1))))
                    Slider(value: $draft.lineHeight, in: 1.4...2.2, step: 0.1)
                        .tint(palette.accent)
                }
                .listRowBackground(palette.surface)

                Section("Papier") {
                    ForEach(ReaderPaper.allCases, id: \.self) { paper in
                        Button {
                            draft.paper = paper
                        } label: {
                            HStack {
                                Circle()
                                    .fill(paperPreview(paper))
                                    .frame(width: 28, height: 28)
                                    .overlay(Circle().stroke(palette.border))
                                Text(paper.label).foregroundStyle(palette.foreground)
                                Spacer()
                                if draft.paper == paper {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(palette.accent)
                                }
                            }
                        }
                    }
                }
                .listRowBackground(palette.surface)
            }
            .scrollContentBackground(.hidden)
            .background { LyraBackground() }
            .foregroundStyle(palette.foreground)
            .navigationTitle("Réglages de lecture")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(palette.surface.opacity(0.96), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Appliquer") {
                        onSave(draft.normalized)
                        dismiss()
                    }
                    .fontWeight(.bold)
                }
            }
        }
    }

    private func paperPreview(_ paper: ReaderPaper) -> Color {
        switch paper {
        case .auto: palette.background
        case .ivory: Color(red: 0.957, green: 0.937, blue: 0.894)
        case .white: .white
        case .black: .black
        case .softDark: Color(red: 0.067, green: 0.075, blue: 0.094)
        }
    }
}
