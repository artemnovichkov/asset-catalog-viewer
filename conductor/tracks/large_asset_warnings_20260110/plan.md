# Plan: Large Asset Warnings

## Phase 1: Infrastructure & Configuration
- [x] **Task 1: Add Extension Setting** <!-- 5463e71 -->
    - Update `package.json` to include the `xcassetsViewer.largeAssetThreshold` setting with a default value of 500.
- [ ] **Task 2: Pass Configuration to Webview**
    - Update `src/xcassetsViewer.ts` to read the threshold setting and include it in the initial state sent to the webview.
    - Listen for configuration changes and post a message to the webview when the threshold is updated.
- [ ] **Task: Conductor - User Manual Verification 'Infrastructure & Configuration' (Protocol in workflow.md)**

## Phase 2: Data Model & Parsing
- [ ] **Task 1: Calculate Asset Sizes**
    - Modify `src/parsers/assetParser.ts` to calculate the total file size (in bytes or KB) for each asset (summing up its variants).
    - Update the `Asset` type definition in `src/types.ts` to include a `size` property.
- [ ] **Task 2: Send Size Data to Webview**
    - Ensure the parsed asset data sent to the webview includes the new `size` property.
- [ ] **Task: Conductor - User Manual Verification 'Data Model & Parsing' (Protocol in workflow.md)**

## Phase 3: UI Implementation
- [ ] **Task 1: Display Warning Icon in Asset List**
    - Update `src/webview/assetList.js` to compare the asset size against the threshold.
    - Render a warning icon (⚠️) next to the asset name if the threshold is exceeded.
- [ ] **Task 2: Show Size Information**
    - Add a tooltip to the warning icon showing the actual size.
    - Update `src/webview/properties.js` to highlight the size in the inspector panel when it exceeds the threshold.
- [ ] **Task: Conductor - User Manual Verification 'UI Implementation' (Protocol in workflow.md)**
