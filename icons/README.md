# XCAssets Icons

Custom folder icons for .xcassets directories.

## How to Use

After installing the extension:

1. Open Command Palette (`Cmd+Shift+P`)
2. Type "File Icon Theme"
3. Select "Preferences: File Icon Theme"
4. Choose "XCAssets Icons"

This will show custom icons for common .xcassets folder names like:
- Assets.xcassets
- Images.xcassets
- Media.xcassets
- Resources.xcassets
- Icons.xcassets
- Colors.xcassets
- Stickers.xcassets

## Limitation

VSCode icon themes require exact folder name matches. If you have a custom-named .xcassets folder not in the list above, you can:

1. Add it to `icons/xcassets-icon-theme.json` under `folderNames` and `folderNamesExpanded`
2. Or use this theme alongside your preferred icon theme (some themes support layering)

## Icon Design

The icon shows a blue folder with SF Symbol "photo.on.rectangle.angled" (􀣵), representing asset catalogs and image sets.

**Note**: Uses SF Symbols font via SVG text. Works on macOS where SF Symbols font is available. Falls back gracefully on other platforms.
