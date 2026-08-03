import Foundation

struct SyncedSeriesRecord: Codable, Equatable, Sendable {
    let series: SourceSeries
    let addedAt: Int64
    let updatedAt: Int64
}

struct ReadingProgress: Codable, Equatable, Identifiable, Sendable {
    let chapterKey: String
    let seriesKey: String
    let scrollRatio: Double
    let completed: Bool
    let lastReadAt: Int64

    var id: String { chapterKey }
}

enum SyncOperation: Codable, Equatable, Sendable {
    case upsertSeries(operationID: String, changedAt: Int64, record: SyncedSeriesRecord)
    case removeSeries(operationID: String, seriesKey: String, changedAt: Int64)
    case saveProgress(operationID: String, record: ReadingProgress)

    private enum CodingKeys: String, CodingKey {
        case operationId
        case type
        case changedAt
        case record
        case seriesKey
    }

    private enum OperationType: String, Codable {
        case upsertSeries = "upsert-series"
        case removeSeries = "remove-series"
        case saveProgress = "save-progress"
    }

    var operationID: String {
        switch self {
        case let .upsertSeries(operationID, _, _),
             let .removeSeries(operationID, _, _),
             let .saveProgress(operationID, _):
            operationID
        }
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(OperationType.self, forKey: .type)
        let operationID = try container.decode(String.self, forKey: .operationId)
        switch type {
        case .upsertSeries:
            self = try .upsertSeries(
                operationID: operationID,
                changedAt: container.decode(Int64.self, forKey: .changedAt),
                record: container.decode(SyncedSeriesRecord.self, forKey: .record)
            )
        case .removeSeries:
            self = try .removeSeries(
                operationID: operationID,
                seriesKey: container.decode(String.self, forKey: .seriesKey),
                changedAt: container.decode(Int64.self, forKey: .changedAt)
            )
        case .saveProgress:
            self = try .saveProgress(
                operationID: operationID,
                record: container.decode(ReadingProgress.self, forKey: .record)
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(operationID, forKey: .operationId)
        switch self {
        case let .upsertSeries(_, changedAt, record):
            try container.encode(OperationType.upsertSeries, forKey: .type)
            try container.encode(changedAt, forKey: .changedAt)
            try container.encode(record, forKey: .record)
        case let .removeSeries(_, seriesKey, changedAt):
            try container.encode(OperationType.removeSeries, forKey: .type)
            try container.encode(seriesKey, forKey: .seriesKey)
            try container.encode(changedAt, forKey: .changedAt)
        case let .saveProgress(_, record):
            try container.encode(OperationType.saveProgress, forKey: .type)
            try container.encode(record, forKey: .record)
        }
    }
}

struct SyncRequest: Codable, Sendable {
    let operations: [SyncOperation]
}

struct SyncState: Codable, Equatable, Sendable {
    let revision: Int64
    let series: [SyncedSeriesRecord]
    let progress: [ReadingProgress]
}
