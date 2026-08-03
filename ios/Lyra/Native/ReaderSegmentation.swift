import Foundation

nonisolated struct FocusedReaderUnit: Identifiable, Equatable, Sendable {
    let index: Int
    let text: String
    let kind: ChapterBlockKind

    var id: Int { index }
}

nonisolated func readerUnits(blocks: [ChapterBlock], mode: ReaderMode) -> [FocusedReaderUnit] {
    let readable = blocks.compactMap { block -> (String, ChapterBlockKind)? in
        guard block.kind != .divider else { return nil }
        let text = normalizedReaderText(block.text)
        return text.isEmpty ? nil : (text, block.kind)
    }
    guard mode == .sentence else {
        return readable.enumerated().map { index, value in
            FocusedReaderUnit(index: index, text: value.0, kind: value.1)
        }
    }

    let sentences = readable.flatMap { text, kind in
        splitReaderSentences([text]).map { ($0, kind) }
    }
    return sentences.enumerated().map { index, value in
        FocusedReaderUnit(index: index, text: value.0, kind: value.1)
    }
}

// Keep this algorithm in parity with src/reader/segmentation.ts.
nonisolated func splitReaderSentences(_ paragraphs: [String]) -> [String] {
    let sentences = paragraphs.flatMap(splitParagraphSentences)
    return sentences.isEmpty ? paragraphs : sentences
}

private nonisolated func splitParagraphSentences(_ paragraph: String) -> [String] {
    var sentences: [String] = []
    let characters = Array(paragraph.unicodeScalars)
    var current = ""
    var index = 0

    while index < characters.count {
        let character = characters[index]
        current.unicodeScalars.append(character)

        if isSentenceTerminal(character), shouldSplitSentence(current, characters, index) {
            while index + 1 < characters.count {
                let next = characters[index + 1]
                if isClosingPunctuation(next)
                    || (current.unicodeScalars.last?.value == 0x00BB && isSentenceTerminal(next))
                    || (isReaderWhitespace(next) && nextNonWhitespaceIsClosingPunctuation(characters, index + 1)) {
                    current.unicodeScalars.append(next)
                    index += 1
                } else {
                    break
                }
            }

            let sentence = normalizedReaderText(current)
            if !sentence.isEmpty { sentences.append(sentence) }
            current.removeAll(keepingCapacity: true)
        }
        index += 1
    }

    let remaining = normalizedReaderText(current)
    if !remaining.isEmpty { sentences.append(remaining) }
    return sentences
}

private nonisolated func shouldSplitSentence(
    _ current: String,
    _ characters: [Unicode.Scalar],
    _ index: Int
) -> Bool {
    let character = characters[index]
    if character.value == 0x002E,
       isDecimalPoint(characters, index) || endsWithAbbreviation(current) {
        return false
    }
    if isSentenceTerminal(scalar(in: characters, at: index + 1)) { return false }

    if hasUnclosedFrenchQuote(current) {
        var cursor = index + 1
        while isSentenceTerminal(scalar(in: characters, at: cursor)) { cursor += 1 }
        while isReaderWhitespace(scalar(in: characters, at: cursor)) { cursor += 1 }
        if !isClosingPunctuation(scalar(in: characters, at: cursor)) { return false }
        while isClosingPunctuation(scalar(in: characters, at: cursor)) { cursor += 1 }
        while isSentenceTerminal(scalar(in: characters, at: cursor)) { cursor += 1 }
        while isReaderWhitespace(scalar(in: characters, at: cursor)) { cursor += 1 }
        if let next = scalar(in: characters, at: cursor), next.value != 0x00AB { return false }
    }

    var cursor = index + 1
    while isSentenceTerminal(scalar(in: characters, at: cursor)) { cursor += 1 }

    var sawSpacing = false
    while isReaderWhitespace(scalar(in: characters, at: cursor)) {
        sawSpacing = true
        cursor += 1
    }
    while isClosingPunctuation(scalar(in: characters, at: cursor)) { cursor += 1 }
    while isReaderWhitespace(scalar(in: characters, at: cursor)) {
        sawSpacing = true
        cursor += 1
    }

    guard let next = scalar(in: characters, at: cursor) else { return true }
    if next.properties.generalCategory == .lowercaseLetter { return false }
    return sawSpacing
}

private nonisolated func scalar(in characters: [Unicode.Scalar], at index: Int) -> Unicode.Scalar? {
    characters.indices.contains(index) ? characters[index] : nil
}

private nonisolated func isSentenceTerminal(_ character: Unicode.Scalar?) -> Bool {
    guard let character else { return false }
    switch character.value {
    case 0x002E, 0x0021, 0x003F, 0x2026, 0x3002, 0xFF01, 0xFF1F:
        return true
    default:
        return false
    }
}

private nonisolated func isClosingPunctuation(_ character: Unicode.Scalar?) -> Bool {
    guard let character else { return false }
    switch character.value {
    case 0x0022, 0x0027, 0x201D, 0x2019, 0x00BB, 0x300D, 0x300F,
         0x0029, 0xFF09, 0x005D, 0x007D:
        return true
    default:
        return false
    }
}

private nonisolated func isReaderWhitespace(_ character: Unicode.Scalar?) -> Bool {
    guard let character else { return false }
    switch character.value {
    case 0x0009...0x000D, 0x0020, 0x00A0, 0x1680, 0x2000...0x200A,
         0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF:
        return true
    default:
        return false
    }
}

private nonisolated func nextNonWhitespaceIsClosingPunctuation(
    _ characters: [Unicode.Scalar],
    _ start: Int
) -> Bool {
    var cursor = start
    while isReaderWhitespace(scalar(in: characters, at: cursor)) { cursor += 1 }
    return isClosingPunctuation(scalar(in: characters, at: cursor))
}

private nonisolated func isDecimalPoint(_ characters: [Unicode.Scalar], _ index: Int) -> Bool {
    guard index > 0, index + 1 < characters.count else { return false }
    return isASCIIDigit(characters[index - 1]) && isASCIIDigit(characters[index + 1])
}

private nonisolated func isASCIIDigit(_ character: Unicode.Scalar) -> Bool {
    (0x0030...0x0039).contains(character.value)
}

private nonisolated func endsWithAbbreviation(_ current: String) -> Bool {
    let characters = Array(current.unicodeScalars)
    var end = characters.count
    while end > 0, isReaderWhitespace(characters[end - 1]) { end -= 1 }
    while end > 0, characters[end - 1].value == 0x002E { end -= 1 }

    var start = end
    while start > 0, !isReaderWhitespace(characters[start - 1]) { start -= 1 }
    while start < end, !isLetter(characters[start]) { start += 1 }
    while end > start, !isLetter(characters[end - 1]) { end -= 1 }

    var token = ""
    for character in characters[start..<end] { token.unicodeScalars.append(character) }
    switch token.lowercased() {
    case "m", "mr", "mrs", "ms", "mme", "mlle", "dr", "prof", "st", "ste":
        return true
    default:
        return false
    }
}

private nonisolated func isLetter(_ character: Unicode.Scalar) -> Bool {
    switch character.properties.generalCategory {
    case .uppercaseLetter, .lowercaseLetter, .titlecaseLetter, .modifierLetter, .otherLetter:
        return true
    default:
        return false
    }
}

private nonisolated func hasUnclosedFrenchQuote(_ current: String) -> Bool {
    var openings = 0
    var closings = 0
    for character in current.unicodeScalars {
        if character.value == 0x00AB { openings += 1 }
        if character.value == 0x00BB { closings += 1 }
    }
    return openings > closings
}

nonisolated func normalizedReaderText(_ text: String) -> String {
    var normalized = ""
    var pendingSpace = false

    for character in text.unicodeScalars {
        if isReaderWhitespace(character) {
            pendingSpace = !normalized.isEmpty
        } else {
            if pendingSpace { normalized.unicodeScalars.append(Unicode.Scalar(0x0020)!) }
            normalized.unicodeScalars.append(character)
            pendingSpace = false
        }
    }
    return normalized
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
