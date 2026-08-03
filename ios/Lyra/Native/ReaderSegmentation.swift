import Foundation
import NaturalLanguage

nonisolated struct FocusedReaderUnit: Identifiable, Equatable, Sendable {
    let index: Int
    let text: String
    let kind: ChapterBlockKind

    var id: Int { index }
}

nonisolated func readerUnits(blocks: [ChapterBlock], mode: ReaderMode) -> [FocusedReaderUnit] {
    let readable = blocks.filter { $0.kind != .divider && !$0.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    guard mode == .sentence else {
        return readable.enumerated().map { index, block in
            FocusedReaderUnit(index: index, text: normalizedReaderText(block.text), kind: block.kind)
        }
    }

    let sentences = readable.flatMap { block -> [(String, ChapterBlockKind)] in
        let text = normalizedReaderText(block.text)
        let tokenizer = NLTokenizer(unit: .sentence)
        tokenizer.setLanguage(.french)
        tokenizer.string = text
        var values: [(String, ChapterBlockKind)] = []
        tokenizer.enumerateTokens(in: text.startIndex..<text.endIndex) { range, _ in
            let sentence = normalizedReaderText(String(text[range]))
            if !sentence.isEmpty { values.append((sentence, block.kind)) }
            return true
        }
        return values.isEmpty ? [(text, block.kind)] : values
    }
    return sentences.enumerated().map { index, value in
        FocusedReaderUnit(index: index, text: value.0, kind: value.1)
    }
}

nonisolated func normalizedReaderText(_ text: String) -> String {
    text
        .replacingOccurrences(of: "\u{00a0}", with: " ")
        .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
        .trimmingCharacters(in: .whitespacesAndNewlines)
}

nonisolated func ratioForUnit(index: Int, count: Int) -> Double {
    let maximum = max(0, count - 1)
    guard maximum > 0 else { return 1 }
    return Double(min(maximum, max(0, index))) / Double(maximum)
}

nonisolated func unitIndex(for ratio: Double, count: Int) -> Int {
    let maximum = max(0, count - 1)
    return min(maximum, Int((min(1, max(0, ratio)) * Double(maximum)).rounded()))
}
