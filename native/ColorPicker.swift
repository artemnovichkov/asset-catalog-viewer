import AppKit
import Foundation

class ColorPickerDelegate: NSObject, NSWindowDelegate {
    var initialColor: NSColor
    var lastOutputColor: String = ""
    var colorPanel: NSColorPanel!

    init(initialColor: NSColor) {
        self.initialColor = initialColor
        self.lastOutputColor = colorToJSON(initialColor)
        super.init()
    }

    func showPanel() {
        colorPanel = NSColorPanel.shared
        colorPanel.setTarget(self)
        colorPanel.setAction(#selector(colorChanged(_:)))
        colorPanel.color = initialColor
        colorPanel.isContinuous = true
        colorPanel.showsAlpha = true
        colorPanel.delegate = self
        colorPanel.makeKeyAndOrderFront(nil)

        NSApp.activate(ignoringOtherApps: true)
    }

    @objc func colorChanged(_ sender: NSColorPanel) {
        let json = colorToJSON(sender.color)
        // Only output if color changed
        if json != lastOutputColor {
            lastOutputColor = json
            print(json)
            fflush(stdout)
        }
    }

    func windowWillClose(_ notification: Notification) {
        print("__CLOSED__")
        fflush(stdout)
        NSApp.stop(nil)
    }
}

func parseColor(_ hex: String) -> NSColor {
    var hexString = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if hexString.hasPrefix("#") {
        hexString = String(hexString.dropFirst())
    }

    var rgb: UInt64 = 0
    Scanner(string: hexString).scanHexInt64(&rgb)

    let r = CGFloat((rgb >> 24) & 0xFF) / 255.0
    let g = CGFloat((rgb >> 16) & 0xFF) / 255.0
    let b = CGFloat((rgb >> 8) & 0xFF) / 255.0
    let a = CGFloat(rgb & 0xFF) / 255.0

    return NSColor(displayP3Red: r, green: g, blue: b, alpha: a)
}

func colorToJSON(_ color: NSColor) -> String {
    guard let p3Color = color.usingColorSpace(.displayP3) else {
        return "{}"
    }

    let red = String(format: "%.3f", p3Color.redComponent)
    let green = String(format: "%.3f", p3Color.greenComponent)
    let blue = String(format: "%.3f", p3Color.blueComponent)
    let alpha = String(format: "%.3f", p3Color.alphaComponent)

    return """
    {"color-space":"display-p3","components":{"alpha":"\(alpha)","blue":"\(blue)","green":"\(green)","red":"\(red)"}}
    """
}

// Main
let app = NSApplication.shared
app.setActivationPolicy(.accessory)

// Parse initial color from args (hex format: RRGGBBAA)
var initialColor = NSColor.white
if CommandLine.arguments.count > 1 {
    initialColor = parseColor(CommandLine.arguments[1])
}

let delegate = ColorPickerDelegate(initialColor: initialColor)
delegate.showPanel()

app.run()
