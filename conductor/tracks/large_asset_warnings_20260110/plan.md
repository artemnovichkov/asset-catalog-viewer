# Plan: Large Asset Warnings

## Phase 1: Infrastructure & Configuration [checkpoint: d7b1fbd]
- [x] **Task 1: Add Extension Setting** <!-- 5463e71 -->
    - Update `package.json` to include the `xcassetsViewer.largeAssetThreshold` setting with a default value of 500.
- [x] **Task 2: Pass Configuration to Webview** <!-- ca65125 -->
    - Update `src/xcassetsViewer.ts` to read the threshold setting and include it in the initial state sent to the webview.
    - Listen for configuration changes and post a message to the webview when the threshold is updated.
- [x] **Task: Conductor - User Manual Verification 'Infrastructure & Configuration' (Protocol in workflow.md)****

## Phase 2: Data Model & Parsing [checkpoint: 581db74]
- [x] **Task 1: Calculate Asset Sizes** <!-- 3e9d45e -->
    - Modify `src/parsers/assetParser.ts` to calculate the total file size (in bytes or KB) for each asset (summing up its variants).
    - Update the `Asset` type definition in `src/types.ts` to include a `size` property.
- [x] **Task 2: Send Size Data to Webview** <!-- 87b23fa -->
    - Ensure the parsed asset data sent to the webview includes the new `size` property.
- [x] **Task: Conductor - User Manual Verification 'Data Model & Parsing' (Protocol in workflow.md)****

## Phase 3: UI Implementation
- [x] **Task 1: Display Warning Icon in Asset List** <!-- 6dbe060 -->
    - Update `src/webview/assetList.js` to compare the asset size against the threshold.
    - Render a warning icon (⚠️) next to the asset name if the threshold is exceeded.
- [x] **Task 2: Show Size Information** <!-- 6b5f049, 3e95000 -->
    - Add a tooltip to the warning icon showing the actual size.
    - Update `src/webview/properties.js` to highlight the size in the inspector panel when it exceeds the threshold. (Reverted size row per user request)
- [x] **Task: Conductor - User Manual Verification 'UI Implementation' (Protocol in workflow.md)****
