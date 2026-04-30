// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "Outpost",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "Outpost",
            path: "Sources"
        ),
    ]
)
