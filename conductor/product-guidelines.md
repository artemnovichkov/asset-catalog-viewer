# Product Guidelines

## Tone and Voice
- **Professional and Native:** The extension should use terminology and styling that feels familiar to Apple platform developers. Documentation and UI labels should align with Xcode conventions and Apple's Human Interface Guidelines where appropriate.

## Visual Identity
- **Hybrid Design System:** 
    - **Structural Elements:** Use VS Code's native components, panels, scrollbars, and theming system to ensure the extension feels like an integrated part of the editor.
    - **Content Styling:** The asset previews, hierarchical lists, and inspector panels should be styled to mimic the look and feel of Xcode's asset catalog viewer to provide a familiar experience.
- **Iconography:** Utilize VS Code's standard **Codicons** library for UI actions and navigation to maintain consistency with the editor's visual language.

## Interaction Principles
- **Immediate Feedback:** All user interactions, such as selecting an asset or renaming a folder, must provide instant visual feedback to ensure the interface feels responsive and "snappy."
- **Visual Continuity:** Implement subtle transitions and maintain consistent layouts when switching between assets to help users stay oriented.
- **Keyboard Efficiency:** Support standard keyboard shortcuts from both Xcode (e.g., `Space` for Quick Look) and VS Code (e.g., `Enter` for Rename) to maximize productivity.

## Error Handling and Validation
- **Graceful Degradation:** If an asset is missing or its configuration (e.g., `Contents.json`) is invalid, the UI should display a clear placeholder or error state for that specific item without impacting the functionality of the rest of the viewer.
