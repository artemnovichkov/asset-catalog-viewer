# Specification: SwiftUI Resource Accessor Samples

## Overview
This feature introduces a "Code Snippets" section in the Asset Catalog Viewer's Properties panel. It provides developers with ready-to-use SwiftUI code snippets for Color Sets and Image Sets, utilizing the modern resource static accessors introduced in Xcode 15.

## Functional Requirements
- **Target Assets:** Support `.colorset` (Color Sets) and `.imageset` (Image Sets).
- **Location:** Display snippets in the right-hand Properties/Inspector panel, positioned below existing asset attributes.
- **Snippet Format:** Use Xcode 15+ static accessors:
    - For Colors: `Color(.<asset_name>)`
    - For Images: `Image(.<asset_name>)`
- **Copy Functionality:**
    - Provide a dedicated "Copy" button next to each code snippet.
    - Copying should place the exact code string into the user's system clipboard.
    - Provide visual feedback (e.g., a temporary "Copied!" state or icon change) upon successful copying.

## Non-Functional Requirements
- **Performance:** Snippet generation and rendering should be near-instantaneous when an asset is selected.
- **UI Consistency:** The "Code Snippets" section and "Copy" button should match the existing VS Code / Xcode-inspired aesthetic of the extension.

## Acceptance Criteria
- [ ] Selecting a Color Set displays `Color(.assetName)` in the Properties panel.
- [ ] Selecting an Image Set displays `Image(.assetName)` in the Properties panel.
- [ ] Clicking the Copy button copies the snippet to the clipboard.
- [ ] The feature is only active for Color Sets and Image Sets (not App Icons, Data Sets, etc.).

## Out of Scope
- Support for legacy string-based initializers (e.g., `Image("name")`).
- Support for 3rd party resource generators (SwiftGen, R.swift).
- Support for App Icons or other asset types.
