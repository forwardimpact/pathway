import AppKit

let app = NSApplication.shared
let controller = StatusMenuController()
app.delegate = controller
app.run()
