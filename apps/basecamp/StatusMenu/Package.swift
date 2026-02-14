// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "BasecampStatus",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "BasecampStatus",
            path: "Sources"
        ),
    ]
)
