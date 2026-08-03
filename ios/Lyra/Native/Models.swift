import Foundation

enum SourceID: String, Codable, Sendable {
    case novelFr
}

struct SourceReference: Codable, Hashable, Sendable {
    let source: SourceID
    let key: String
}

struct SourceSearchResult: Codable, Hashable, Identifiable, Sendable {
    let key: String
    let title: String
    let sourceType: String
    let sources: [SourceReference]

    var id: String { key }
}

struct SourceBrowseResult: Codable, Hashable, Identifiable, Sendable {
    let key: String
    let title: String
    let coverImage: String?
    let sources: [SourceReference]

    var id: String { key }
}

struct SourceDiscovery: Codable, Hashable, Sendable {
    let popular: [SourceBrowseResult]
    let recentlyAdded: [SourceBrowseResult]
    let recentlyUpdated: [SourceBrowseResult]
}

struct SourceChapter: Codable, Hashable, Identifiable, Sendable {
    let key: String
    let title: String
    let number: Double?
    let volume: Double?
    let publishedAt: String?
    let releases: [SourceReference]

    var id: String { key }
}

struct SourceSeries: Codable, Hashable, Identifiable, Sendable {
    let key: String
    let title: String
    let sources: [SourceReference]
    let coverImage: String?
    let author: String?
    let description: String?
    let genres: [String]
    let status: String?
    let chapters: [SourceChapter]

    var id: String { key }
}

enum ChapterBlockKind: String, Codable, Hashable, Sendable {
    case paragraph
    case heading2
    case heading3
    case blockquote
    case listItem
    case divider
}

struct ChapterBlock: Codable, Hashable, Identifiable, Sendable {
    let kind: ChapterBlockKind
    let text: String

    var id: String { "\(kind.rawValue):\(text)" }
}

struct SourceChapterContent: Codable, Hashable, Sendable {
    let key: String
    let title: String
    let html: String
    let blocks: [ChapterBlock]?
    let source: SourceID

    var readableBlocks: [ChapterBlock] {
        if let blocks, !blocks.isEmpty { return blocks }
        let stripped = html
            .replacingOccurrences(of: "<br>", with: "\n", options: .caseInsensitive)
            .replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
            .replacingOccurrences(of: "&nbsp;", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return stripped.isEmpty ? [] : [ChapterBlock(kind: .paragraph, text: stripped)]
    }
}

enum AudiobookStatus: String, Codable, Sendable {
    case queued
    case generating
    case ready
    case failed
}

struct AudiobookSegment: Codable, Equatable, Sendable {
    let index: Int
    let url: String
    let progressStart: Double
    let progressEnd: Double
}

struct AudiobookManifest: Codable, Equatable, Sendable {
    let id: String
    let chapterKey: String
    let chapterTitle: String
    let contentHash: String
    let status: AudiobookStatus
    let provider: String
    let model: String
    let voice: String
    let format: String
    let generatedSegments: Int
    let totalSegments: Int
    let segments: [AudiobookSegment]
    let disclosure: String
    let error: String?
}

struct APICapabilities: Codable, Equatable, Sendable {
    let apiVersion: Int
    let features: [String]

    var supportsNativeApp: Bool {
        apiVersion == 1 && features.contains("sync") && features.contains("chapterBlocks")
    }

    var supportsAudiobooks: Bool {
        supportsNativeApp && features.contains("audiobook")
    }
}

struct APIErrorBody: Codable, Sendable {
    let error: String
}
