# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development

```bash
npm install              # Install dependencies
npm run compile          # Build TypeScript to out/
npm run watch            # Watch mode for development
npm run lint             # ESLint
npm test                 # Run tests
npm run vscode:prepublish # Production build
```

Press F5 in VSCode to launch Extension Development Host for testing.

## Architecture

VSCode extension for viewing .xcassets directories (Xcode asset catalogs).

### Core Components

**src/extension.ts** - Entry point, registers command `xcassetsViewer.openViewer`

**src/xcassetsViewer.ts** - Main viewer implementation
- `XCAssetsViewer` class creates webview panels
- `openXCAssets()` - Creates webview panel for .xcassets directory
- `parseXCAssets()` - Recursively scans .xcassets directory for .imageset, .colorset, .dataset
- `parseImageSet()` - Reads Contents.json, extracts image variants (@1x, @2x, @3x)
- `parseColorSet()` - Reads Contents.json, extracts color definitions (light/dark mode)
- `parseDataSet()` - Reads Contents.json for data assets
- `getHtmlForWebview()` - Generates HTML with VSCode theming, displays assets in grid

### Viewer Flow

1. User right-clicks .xcassets directory in Explorer
2. Selects "Open XCAssets Viewer" from context menu
3. Command `xcassetsViewer.openViewer` triggered with directory URI
4. Extension creates webview panel with directory name as title
5. Extension parses .xcassets structure from filesystem
6. Webview displays 3-panel Xcode-like layout:
   - **Left panel**: List of all assets (images, colors, data) with icons
   - **Middle panel**: Preview of selected asset (images with all scales, color swatches, etc.)
   - **Right panel**: Properties/metadata (name, type, devices, appearances, gamut, etc.)

### Asset Catalog Structure

```
Assets.xcassets/
├── AppIcon.appiconset/
│   └── Contents.json
├── Image.imageset/
│   ├── Contents.json
│   ├── image@1x.png
│   ├── image@2x.png
│   └── image@3x.png
└── Color.colorset/
    └── Contents.json
```

Each asset type has Contents.json describing variants. Extension reads these JSON files and referenced image files.

### Webview Layout

**3-panel grid layout** mimicking Xcode:
- CSS Grid: `250px | 1fr | 300px`
- Left panel: asset list, clickable items, selection state
- Middle panel: centered preview content, varies by asset type
- Right panel: property inspector showing metadata

**JavaScript interactivity**:
- All assets serialized as JSON and embedded in HTML
- Click handlers on asset list items trigger selection
- Selection updates both preview and properties panels dynamically
- Asset data includes webview URIs for images (via `webview.asWebviewUri()`)

**Styling**:
- VSCode CSS variables for theming (dark/light mode compatible)
- Checkerboard background for image transparency
- Images shown with scale (@1x/@2x/@3x) and idiom labels
- Colors rendered as swatches with RGB extraction from components

## Key Files

- package.json - Extension manifest, defines command and context menu for .xcassets directories
- tsconfig.json - TypeScript config, outputs to `out/`
- .vscode/launch.json - Debug configs for extension host and tests

## Testing

1. Press F5 to launch Extension Development Host
2. Right-click any .xcassets directory in Explorer
3. Select "Open XCAssets Viewer" from context menu
4. Webview panel opens showing assets
