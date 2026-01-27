# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.11.1] - 2026-01-27

### Added
- Interactive "Render As" picker for image sets (Default/Original Image/Template Image)

## [0.10.0] - 2026-01-26

### Added
- Interactive "Provides Namespace" checkbox for folders
- Interactive "Preserve Vector Data" checkbox for image sets

## [0.9.0] - 2026-01-25

### Added
- Preview for folders
- Color picker
- Color adding
- Selection for previews from folder

### Changed
- Base logic
- Selection logic
- Gamut property

### Fixed
- Color picker bug where it automatically changes color on open
- Deletion for multiple selected sets

## [0.8.0] - 2026-01-12

### Added
- Compression property for image sets

### Changed
- Icon appearances

### Fixed
- Icon preview layout

## [0.7.2] - 2026-01-11

### Added
- Namespace support for folders

### Fixed
- Show empty folders
- Fix scroll for long names

## [0.7.1] - 2026-01-11

### Added
- Dataset snippet support

### Changed
- Documentation updates

## [0.7.0] - 2026-01-11

### Added
- SwiftUI Code Snippets: Ready-to-use resource accessors (e.g., `Color(.brand)`) with one-click copy for Color and Image sets

## [0.6.0] - 2026-01-10

### Added
- Large Asset Detection: Visual warnings for assets exceeding a configurable size threshold
- `assetCatalogViewer.largeAssetThreshold` configuration setting

## [0.5.2] - 2026-01-10

### Added
- Add resizing property

### Removed
- Remove unused code

## [0.5.1] - 2026-01-09

### Changed
- Relayout center and right panels
- Remove compression
- Update scales for icons
- Update right panel title

### Fixed
- Fix macOS icon scales
- Fix file order

## [0.5.0] - 2026-01-08

### Added
- Add watchOS App Icons support
- Add HEIC placeholder (file-media icon)
- Add separate scroll for panels

### Changed
- Improve AppIcon preview with platform name and size in points

### Fixed
- Fix App Icon variants conditional display

## [0.4.0] - 2026-01-07

### Added
- Add deletion of selected item
- Add file system changes sync
- Add asset and folder renaming
- Add folder selection

### Changed
- Save state after reloading
- Refactor main.js module

### Fixed
- Fix color appearance

## [0.3.1] - 2026-01-06

### Fixed
- Reduced extension size from 13MB to 2.7MB (minification, exclude source maps)

## [0.3.0] - 2026-01-06

### Added
- Add dotlottie preview support

### Changed
- Improve speed of asset rendering
- Refactor webview with esbuild bundling

## [0.2.0] - 2026-01-05

### Added
- Add Lottie preview support

## [0.1.2] - 2025-12-29

### Fixed
- Fix template ignore

## [0.1.1] - 2025-12-29

### Fixed
- Remove artifacts from bundle

## [0.1.0] - 2025-12-29

### Added
- Implement base logic for Assert Catalog preview
