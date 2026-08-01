import CoreFoundation
import Foundation

struct ReaderPageState: Equatable {
    let active: Bool
    let index: Int
    let count: Int

    init?(messageBody: Any) {
        guard let message = messageBody as? [String: Any],
              let active = message["active"] as? Bool,
              let index = Self.integer(from: message["index"]),
              let count = Self.integer(from: message["count"]),
              index >= 0,
              count >= 0,
              (!active || (count > 0 && index < count)) else {
            return nil
        }

        self.active = active
        self.index = index
        self.count = count
    }

    private static func integer(from value: Any?) -> Int? {
        guard let number = value as? NSNumber,
              CFGetTypeID(number) != CFBooleanGetTypeID() else {
            return nil
        }
        let double = number.doubleValue
        guard double.isFinite,
              double.rounded(.towardZero) == double,
              double >= Double(Int.min),
              double <= Double(Int.max) else {
            return nil
        }
        return Int(double)
    }
}
