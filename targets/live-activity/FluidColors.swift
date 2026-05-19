import SwiftUI

/// Palette aquatique partagée — alignée sur l'app principale.
/// Bg gradient = bleu nuit profond → bleu lagon.
enum FluidPalette {
  static let deepNight = Color(red: 0.0, green: 0.055, blue: 0.094)   // #000E18
  static let lagoon    = Color(red: 0.039, green: 0.13, blue: 0.22)
  static let jellyLime = Color(red: 0.682, green: 0.937, blue: 0.302) // #AEEF4D
  static let aqua      = Color(red: 0.392, green: 0.745, blue: 1.0)   // #64BEFF
  static let heart     = Color(red: 1.0, green: 0.23, blue: 0.19)     // #FF3B30
}

extension Color {
  /// Parse "#RRGGBB" → SwiftUI Color. Fallback à `FluidPalette.jellyLime`
  /// si la string est malformée — pas de crash en runtime côté widget.
  init(hex: String, fallback: Color = FluidPalette.jellyLime) {
    var clean = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if clean.hasPrefix("#") { clean.removeFirst() }
    guard clean.count == 6, let v = UInt32(clean, radix: 16) else {
      self = fallback
      return
    }
    let r = Double((v >> 16) & 0xFF) / 255.0
    let g = Double((v >>  8) & 0xFF) / 255.0
    let b = Double( v        & 0xFF) / 255.0
    self.init(red: r, green: g, blue: b)
  }
}
