# Plan: SwiftUI Resource Accessor Samples

## Phase 1: Foundation & Data Model
- [x] Task: Define Snippet Templates d62b31e
    - Define constants for the SwiftUI snippet templates in `src/constants.ts` or a new utility file.
- [ ] Task: Extend Asset Types
    - Ensure the internal asset data structures correctly identify `.colorset` and `.imageset` for the webview.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Foundation & Data Model' (Protocol in workflow.md)

## Phase 2: Webview UI Implementation
- [ ] Task: Update HTML Template
    - Add a "Code Snippets" container to the properties panel in `src/webview/template.html`.
- [ ] Task: Style the Snippets Section
    - Add CSS rules in `src/webview/styles.css` for the snippet container and copy button.
- [ ] Task: Implement Snippet Rendering Logic
    - Update `src/webview/properties.js` (or relevant script) to generate and display the SwiftUI snippet when an asset is selected.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Webview UI Implementation' (Protocol in workflow.md)

## Phase 3: Interactivity & Copy Logic
- [ ] Task: Implement Copy to Clipboard
    - Add event listeners and logic in `src/webview/utils.js` or `src/webview/properties.js` to handle clicking the copy button.
- [ ] Task: Add Copy Feedback UI
    - Implement a visual confirmation (e.g., tooltip or button text change) when a snippet is copied.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Interactivity & Copy Logic' (Protocol in workflow.md)

## Phase 4: Finalization
- [ ] Task: End-to-End Testing
    - Verify all asset types and ensure snippets only appear for Colors and Images.
- [ ] Task: Code Cleanup & Documentation
    - Ensure all changes follow project conventions and are well-documented.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Finalization' (Protocol in workflow.md)
