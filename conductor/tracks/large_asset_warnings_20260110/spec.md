# Specification: Large Asset Warnings

## Overview
This track introduces a feature to help developers identify potentially problematic assets in their Apple asset catalogs. The extension will monitor the file size of assets and display a warning if they exceed a user-configurable threshold.

## Functional Requirements
- **Threshold Detection:** The extension must calculate the file size of assets (including all scale variants and data files) and compare it against a threshold.
- **Visual Warnings:** Display a warning icon (⚠️) in the Asset List (left panel) next to any asset that exceeds the threshold.
- **Configurable Threshold:**
    - Provide a new VS Code configuration setting: `xcassetsViewer.largeAssetThreshold`.
    - Default value: `500` (representing Kilobytes).
    - Support global and per-workspace overrides.
- **Size Details:** When a warning is triggered, provide information about the actual file size (e.g., in a tooltip or the inspector panel).

## Non-Functional Requirements
- **Performance:** Scanning for file sizes should be efficient and not significantly delay the loading of the Asset Catalog.
- **Responsiveness:** Changes to the threshold setting should be reflected in the UI immediately.

## Acceptance Criteria
- [ ] A warning icon appears next to assets larger than the defined threshold in the sidebar.
- [ ] The threshold can be changed via VS Code settings.
- [ ] The UI updates correctly when the threshold setting is modified.
- [ ] Tooltips or the inspector panel show the specific size that triggered the warning.

## Out of Scope
- Warnings based on image dimensions (pixels).
- Specific optimization suggestions or automated compression tools.
- Silencing warnings for individual assets.
