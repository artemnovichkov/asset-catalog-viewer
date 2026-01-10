# Technology Stack

## Core
- **TypeScript:** The primary programming language for the extension logic.
- **VS Code Extension API:** Used for interacting with the editor, managing commands, and creating webviews.

## Frontend (Webview)
- **HTML/CSS/JavaScript:** Standard web technologies for the viewer UI.
- **esbuild:** Used for bundling and minifying the webview's JavaScript and CSS.

## Specialized Libraries
- **Lottie:** Used for high-quality animation previews (`lottie-web` and `@dotlottie/player-component`).
- **PDF.js:** Used for rendering PDF vector assets (`pdfjs-dist`).
- **Codicons:** VS Code's standard icon library (`@vscode/codicons`).

## Development & Tooling
- **Build Tools:** `tsc` (TypeScript Compiler) and `esbuild`.
- **Linting:** `eslint` for maintaining code quality.
- **Testing:** `mocha` and `@vscode/test-cli` for running extension tests.
