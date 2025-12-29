# Phase-Based Refactoring Plan: xcassets VSCode Extension

## Executive Summary
Refactor xcassets extension addressing critical/medium issues across security, robustness, type safety, maintainability. Organized into 5 phases, prioritizing security fixes first.

**Total Effort**: 19-26 hours (5 phases)
**Primary File**: src/xcassetsViewer.ts (2243 lines)

---

## Phase 0: Critical Security Fixes (MUST DO FIRST)
**Priority**: CRITICAL | **Effort**: 4-6 hrs | **Risk**: High if skipped

### Tasks

#### 0.1 Add HTML Escaping Function
**File**: src/xcassetsViewer.ts
**Location**: Add helper function at top of class
```typescript
private escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```

#### 0.2 Escape All Asset Names in HTML
**File**: src/xcassetsViewer.ts
**Lines**: 309, 896, 942, 1225, 1160, 1265, 1417, 1630
- Wrap all `${asset.name}` with `${this.escapeHtml(asset.name)}`
- Apply to folder names, image names, color names, data names
- Test w/ asset named `<script>alert('xss')</script>.imageset`

#### 0.3 Add Path Validation for Process Spawning
**File**: src/xcassetsViewer.ts
**Lines**: 26-33
```typescript
panel.webview.onDidReceiveMessage(message => {
  const { spawn } = require('child_process');

  // Validate path
  if (!message.filePath) return;
  const resolved = path.resolve(message.filePath);
  const catalogResolved = path.resolve(xcassetsPath);
  if (!resolved.startsWith(catalogResolved)) {
    vscode.window.showErrorMessage('Invalid file path');
    return;
  }

  if (message.command === 'quicklook') {
    spawn('qlmanage', ['-p', resolved], { detached: true, stdio: 'ignore' }).unref();
  } else if (message.command === 'showInFinder') {
    spawn('open', ['-R', resolved], { detached: true, stdio: 'ignore' }).unref();
  }
});
```

#### 0.4 Add Content Security Policy
**File**: src/xcassetsViewer.ts
**Lines**: 12-21 (webview options)
```typescript
const panel = vscode.window.createWebviewPanel(
  'xcassetsViewer',
  catalogName,
  vscode.ViewColumn.One,
  {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [uri],
    enableCommandUris: true
  }
);
```

**Lines**: 304+ (in HTML generation)
Add CSP meta tag in <head>:
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none';
               style-src ${webview.cspSource} 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com;
               script-src ${webview.cspSource} 'unsafe-inline' https://cdnjs.cloudflare.com;
               img-src ${webview.cspSource} data:;
               font-src ${webview.cspSource} https://unpkg.com;">
```

#### 0.5 Pin External CDN Versions
**File**: src/xcassetsViewer.ts
**Line**: 310-311
```html
<!-- Change from -->
<link href="https://unpkg.com/@vscode/codicons@latest/dist/codicon.css" rel="stylesheet" />
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>

<!-- To -->
<link href="https://unpkg.com/@vscode/codicons@0.0.35/dist/codicon.css" rel="stylesheet" />
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
        integrity="sha512-..." crossorigin="anonymous"></script>
```

### Acceptance Criteria
- [ ] XSS test w/ malicious asset name fails safely
- [ ] Path traversal attempt blocked
- [ ] CSP violations logged in devtools
- [ ] Extension loads with pinned CDN versions

---

## Phase 1: Error Handling & Robustness
**Priority**: HIGH | **Effort**: 3-4 hrs | **Dependencies**: Phase 0

### Tasks

#### 1.1 Wrap JSON.parse in Try-Catch
**File**: src/xcassetsViewer.ts
**Lines**: 120-148 (parseImageSet)

Replace:
```typescript
const contents = JSON.parse(await fs.promises.readFile(contentsPath, 'utf8'));
```

With:
```typescript
let contents;
try {
  contents = JSON.parse(await fs.promises.readFile(contentsPath, 'utf8'));
} catch (error) {
  vscode.window.showErrorMessage(
    `Failed to parse ${path.basename(imageSetPath)}: ${error.message}`
  );
  return null;
}
```

Apply to:
- Line 126: parseImageSet
- Line 156: parseAppIconSet
- Line 187: parseColorSet
- Line 203: parseDataSet

#### 1.2 Add Logging for Parse Failures
**File**: src/xcassetsViewer.ts
**Lines**: 64-72, 74-82, 84-92, 94-102

Before each `if (imageSet/colorSet/etc) {`:
```typescript
const imageSet = await this.parseImageSet(entryPath);
if (!imageSet) {
  console.warn(`Failed to parse imageset: ${entryPath}`);
} else {
  items.push({...});
}
```

#### 1.3 Add Path Traversal Protection
**File**: src/xcassetsViewer.ts
**Lines**: 45-118 (parseDirectory)

Add depth limit and symlink check:
```typescript
private async parseDirectory(dirPath: string, depth: number = 0, rootPath?: string): Promise<AssetItem[]> {
  if (depth > 10) {
    console.warn(`Max depth exceeded: ${dirPath}`);
    return [];
  }

  const root = rootPath || dirPath;
  const items: AssetItem[] = [];

  let entries;
  try {
    entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    vscode.window.showErrorMessage(`Cannot read directory: ${dirPath}`);
    return [];
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) {
      continue;
    }

    const entryPath = path.join(dirPath, entry.name);
    const resolved = path.resolve(entryPath);

    // Prevent path traversal via symlinks
    if (!resolved.startsWith(path.resolve(root))) {
      console.warn(`Skipping path outside catalog: ${resolved}`);
      continue;
    }

    // ... rest of parsing logic
    // Pass depth + 1 to recursive calls
    const children = await this.parseDirectory(entryPath, depth + 1, root);
  }
}
```

#### 1.4 Validate File Existence for Image References
**File**: src/xcassetsViewer.ts
**Lines**: 120-148, 150-179

```typescript
for (const image of contents.images || []) {
  const imagePath = image.filename
    ? path.join(imageSetPath, image.filename)
    : undefined;

  // Validate file exists
  if (imagePath && !fs.existsSync(imagePath)) {
    console.warn(`Referenced image missing: ${imagePath}`);
  }

  images.push({
    filename: image.filename || '',
    scale: image.scale,
    idiom: image.idiom || 'universal',
    subtype: image.subtype,
    path: imagePath || '',
  });
}
```

### Acceptance Criteria
- [ ] Malformed JSON shows error notification, doesn't crash
- [ ] Deep nested folders (>10 levels) handled gracefully
- [ ] Symlinks outside catalog rejected
- [ ] Missing image files logged but don't break rendering

---

## Phase 2: Type Safety & Code Quality
**Priority**: MEDIUM | **Effort**: 4-5 hrs | **Dependencies**: Phase 1

### Tasks

#### 2.1 Create Typed Interfaces for Contents.json
**File**: src/xcassetsViewer.ts
**Location**: After existing interfaces (before class)

```typescript
// Contents.json schema types
interface ImageContents {
  images?: Array<{
    filename?: string;
    scale?: string;
    idiom?: string;
    subtype?: string;
  }>;
}

interface ColorContents {
  colors?: Array<{
    idiom: string;
    color?: {
      'color-space': string;
      components: {
        red?: string;
        green?: string;
        blue?: string;
        alpha?: string;
      };
    };
    appearances?: Array<{
      appearance: string;
      value: string;
    }>;
  }>;
}

interface AppIconContents {
  images?: Array<{
    filename?: string;
    size?: string;
    idiom?: string;
    platform?: string;
    appearances?: Array<{
      appearance: string;
      value: string;
    }>;
  }>;
}

interface DataContents {
  data?: Array<{
    filename?: string;
    idiom?: string;
  }>;
}
```

#### 2.2 Replace `any` with Proper Types
**File**: src/xcassetsViewer.ts

**Line 244**: Change convertItems return type:
```typescript
private convertItems(items: AssetItem[]): ConvertedAssetItem[] {
  // ...
}

type ConvertedAssetItem =
  | { type: 'folder'; name: string; path: string; children: ConvertedAssetItem[] }
  | { type: 'image'; name: string; path: string; images: ConvertedImageVariant[] }
  | { type: 'color'; name: string; path: string; colors: ColorDefinition[] }
  | { type: 'data'; name: string; path: string; data: ConvertedDataItem[] }
  | { type: 'appicon'; name: string; path: string; icons: ConvertedAppIconVariant[] };
```

**Line 2215**: Type ColorSet.colors:
```typescript
interface ColorSet {
  name: string;
  colors: ColorDefinition[];
}

interface ColorDefinition {
  idiom: string;
  color?: ColorComponents;
  appearances?: AppearanceVariant[];
}

interface ColorComponents {
  'color-space': string;
  components: {
    red?: string;
    green?: string;
    blue?: string;
    alpha?: string;
  };
}
```

**Line 2240**: Type AppIconVariant.appearances:
```typescript
interface AppIconVariant {
  filename: string;
  size?: string;
  idiom: string;
  platform?: string;
  appearances: AppearanceVariant[];
  path: string;
}

interface AppearanceVariant {
  appearance: string;
  value: string;
}
```

#### 2.3 Add Type Assertions for JSON Parsing
**File**: src/xcassetsViewer.ts
**Lines**: 126, 156, 187, 203

```typescript
// parseImageSet
const contents = JSON.parse(
  await fs.promises.readFile(contentsPath, 'utf8')
) as ImageContents;

// Validate structure
if (!contents.images || !Array.isArray(contents.images)) {
  console.warn(`Invalid imageset structure: ${imageSetPath}`);
  return null;
}
```

Apply similar validation to all parse methods.

### Acceptance Criteria
- [ ] No `any` types in codebase (except unavoidable cases)
- [ ] TypeScript compilation with strict mode passes
- [ ] Invalid JSON structure caught during validation
- [ ] IDE autocomplete works for all parsed structures

---

## Phase 3: Code Organization & Modularity
**Priority**: MEDIUM | **Effort**: 6-8 hrs | **Dependencies**: Phase 2

### Tasks

#### 3.1 Extract HTML Template to Separate File
**File**: src/webview/template.html (NEW)
**Move**: Lines 304-2160 from xcassetsViewer.ts

Create templating system using placeholders:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  {{CSP}}
  {{STYLES}}
  <title>{{TITLE}}</title>
</head>
<body>
  {{BODY}}
  {{SCRIPTS}}
</body>
</html>
```

#### 3.2 Extract CSS to Separate File
**File**: src/webview/styles.css (NEW)
**Move**: All <style> content from template

Update xcassetsViewer.ts to read and inject:
```typescript
private getHtmlForWebview(...): string {
  const cssPath = path.join(this.context.extensionPath, 'src', 'webview', 'styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  // ...
}
```

#### 3.3 Extract JavaScript to Separate File
**File**: src/webview/script.js (NEW)
**Move**: All <script> content from template

Use webview.asWebviewUri() for proper loading:
```typescript
const scriptUri = webview.asWebviewUri(
  vscode.Uri.file(path.join(this.context.extensionPath, 'src', 'webview', 'script.js'))
);
```

#### 3.4 Create Constants Module
**File**: src/constants.ts (NEW)

```typescript
export const DEVICE_NAMES: Record<string, string> = {
  'iphone': 'iPhone',
  'ipad': 'iPad',
  'mac': 'Mac',
  'watch': 'Apple Watch',
  'tv': 'Apple TV',
  'car': 'CarPlay',
  'vision': 'Vision Pro'
};

export const IDIOM_LABELS: Record<string, string> = {
  'universal': 'Universal',
  'iphone': 'iPhone',
  // ... etc
};

export const SCALE_LABELS: Record<string, string> = {
  '1x': '@1x',
  '2x': '@2x',
  '3x': '@3x'
};

```

Import in xcassetsViewer.ts:
```typescript
import { DEVICE_NAMES, IDIOM_LABELS } from './constants';
```

#### 3.5 Split Parsing Logic into Separate Module
**File**: src/parsers/assetParser.ts (NEW)

Move parsing methods:
- parseDirectory
- parseImageSet
- parseAppIconSet
- parseColorSet
- parseDataSet

Export as class:
```typescript
export class AssetParser {
  async parse(xcassetsPath: string): Promise<AssetCatalog> {
    // ...
  }

  private async parseDirectory(...): Promise<AssetItem[]> {
    // ...
  }
  // ... etc
}
```

Update xcassetsViewer.ts:
```typescript
import { AssetParser } from './parsers/assetParser';

async openXCAssets(uri: vscode.Uri): Promise<void> {
  const parser = new AssetParser();
  const assets = await parser.parse(xcassetsPath);
  // ...
}
```

#### 3.6 Extract Property Rendering Logic
**File**: src/webview/script.js

Create reusable renderer functions:
```javascript
class PropertyRenderer {
  static renderImageProperties(variant) { /* ... */ }
  static renderColorProperties(color) { /* ... */ }
  static renderAppIconProperties(icon) { /* ... */ }
  static renderCommonProperties(asset) { /* ... */ }
}
```

Replace duplicated code with renderer calls.

### Acceptance Criteria
- [ ] HTML/CSS/JS in separate files with syntax highlighting
- [ ] No magic strings - all constants imported
- [ ] Parser logic separated from webview logic
- [ ] File count increased but total complexity reduced
- [ ] Extension still functions identically

---

## Phase 4: Accessibility & Polish
**Priority**: LOW-MEDIUM | **Effort**: 2-3 hrs | **Dependencies**: Phase 3

### Tasks

#### 4.1 Add Keyboard Navigation
**File**: src/webview/script.js

```javascript
// Arrow key navigation in asset list
document.addEventListener('keydown', (e) => {
  const selected = document.querySelector('.asset-item.selected');
  if (!selected) return;

  let next;
  if (e.key === 'ArrowDown') {
    next = selected.nextElementSibling;
  } else if (e.key === 'ArrowUp') {
    next = selected.previousElementSibling;
  } else if (e.key === 'Enter') {
    selected.click();
    return;
  }

  if (next && next.classList.contains('asset-item')) {
    selectAsset(next.dataset.index);
    next.scrollIntoView({ block: 'nearest' });
  }
});
```

#### 4.2 Add Focus Indicators
**File**: src/webview/styles.css

```css
.asset-item:focus,
.asset-item:focus-visible {
  outline: 2px solid var(--vscode-focusBorder);
  outline-offset: -2px;
}

button:focus-visible {
  outline: 2px solid var(--vscode-focusBorder);
}
```

#### 4.3 Add Loading States
**File**: src/webview/template.html

```html
<div id="loading" style="display: none;">
  <div class="spinner" role="status" aria-live="polite">
    <span class="sr-only">Loading assets...</span>
  </div>
</div>
```

**File**: src/webview/script.js

```javascript
function showLoading() {
  document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}
```

### Acceptance Criteria
- [ ] All interactive elements keyboard accessible
- [ ] Focus indicators visible and clear
- [ ] Loading states shown for async operations

---

## Implementation Order

1. **Phase 0** (CRITICAL) - 4-6 hrs
2. **Phase 1** (HIGH) - 3-4 hrs
3. **Phase 2** (MEDIUM) - 4-5 hrs
4. **Phase 3** (MEDIUM) - 6-8 hrs
5. **Phase 4** (LOW-MEDIUM) - 2-3 hrs

**Total Core Effort**: 19-26 hours

---

## Risk Mitigation

- **Backward Compatibility**: Each phase maintains existing API
- **Testing**: Test after each phase before proceeding
- **Rollback**: Use git branches for each phase
- **Incremental**: Each phase independently valuable

---

## Success Metrics

- [ ] Zero security vulnerabilities (Phase 0)
- [ ] No unhandled errors in production (Phase 1)
- [ ] TypeScript strict mode enabled (Phase 2)
- [ ] Files <500 lines each (Phase 3)
- [ ] Keyboard navigation functional (Phase 4)

---

## Unresolved Questions

1. Should support nested group folders? (Affects Phase 1 recursion logic)
2. Version pin strategy for external deps? (Affects Phase 0.5 CDN decisions)
3. Bundle external dependencies or use CDN? (Affects Phase 0.5 and Phase 3)
4. Target VSCode version range? (Affects API usage)
