import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class XCAssetsViewer {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async openXCAssets(uri: vscode.Uri): Promise<void> {
    const xcassetsPath = uri.fsPath;
    const catalogName = path.basename(xcassetsPath);

    const panel = vscode.window.createWebviewPanel(
      'xcassetsViewer',
      catalogName,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [uri]
      }
    );

    const assets = await this.parseXCAssets(xcassetsPath);
    panel.webview.html = this.getHtmlForWebview(panel.webview, assets, xcassetsPath);
  }

  private async parseXCAssets(xcassetsPath: string): Promise<AssetCatalog> {
    const catalog: AssetCatalog = {
      name: path.basename(xcassetsPath),
      imageSets: [],
      colorSets: [],
      dataSets: [],
    };

    const entries = await fs.promises.readdir(xcassetsPath, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const entryPath = path.join(xcassetsPath, entry.name);

      if (entry.name.endsWith('.imageset')) {
        const imageSet = await this.parseImageSet(entryPath);
        if (imageSet) {
          catalog.imageSets.push(imageSet);
        }
      } else if (entry.name.endsWith('.colorset')) {
        const colorSet = await this.parseColorSet(entryPath);
        if (colorSet) {
          catalog.colorSets.push(colorSet);
        }
      } else if (entry.name.endsWith('.dataset')) {
        const dataSet = await this.parseDataSet(entryPath);
        if (dataSet) {
          catalog.dataSets.push(dataSet);
        }
      }
    }

    return catalog;
  }

  private async parseImageSet(imageSetPath: string): Promise<ImageSet | null> {
    const contentsPath = path.join(imageSetPath, 'Contents.json');
    if (!fs.existsSync(contentsPath)) {
      return null;
    }

    const contents = JSON.parse(
      await fs.promises.readFile(contentsPath, 'utf8')
    );
    const images: ImageVariant[] = [];

    for (const image of contents.images || []) {
      if (image.filename) {
        const imagePath = path.join(imageSetPath, image.filename);
        images.push({
          filename: image.filename,
          scale: image.scale || '1x',
          idiom: image.idiom || 'universal',
          path: imagePath,
        });
      }
    }

    return {
      name: path.basename(imageSetPath, '.imageset'),
      images,
    };
  }

  private async parseColorSet(colorSetPath: string): Promise<ColorSet | null> {
    const contentsPath = path.join(colorSetPath, 'Contents.json');
    if (!fs.existsSync(contentsPath)) {
      return null;
    }

    const contents = JSON.parse(
      await fs.promises.readFile(contentsPath, 'utf8')
    );

    return {
      name: path.basename(colorSetPath, '.colorset'),
      colors: contents.colors || [],
    };
  }

  private async parseDataSet(dataSetPath: string): Promise<DataSet | null> {
    const contentsPath = path.join(dataSetPath, 'Contents.json');
    if (!fs.existsSync(contentsPath)) {
      return null;
    }

    const contents = JSON.parse(
      await fs.promises.readFile(contentsPath, 'utf8')
    );

    return {
      name: path.basename(dataSetPath, '.dataset'),
      data: contents.data || [],
    };
  }

  private getHtmlForWebview(
    webview: vscode.Webview,
    catalog: AssetCatalog,
    xcassetsPath: string
  ): string {
    // Prepare asset data with image URIs
    const assetsData = {
      imageSets: catalog.imageSets.map(imageSet => ({
        name: imageSet.name,
        type: 'image',
        images: imageSet.images.map(img => ({
          ...img,
          uri: webview.asWebviewUri(vscode.Uri.file(img.path)).toString()
        }))
      })),
      colorSets: catalog.colorSets.map(colorSet => ({
        name: colorSet.name,
        type: 'color',
        colors: colorSet.colors
      })),
      dataSets: catalog.dataSets.map(dataSet => ({
        name: dataSet.name,
        type: 'data',
        data: dataSet.data
      }))
    };

    const assetsJson = JSON.stringify(assetsData);

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${catalog.name}</title>
        <link rel="stylesheet" href="https://unpkg.com/@vscode/codicons@latest/dist/codicon.css">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            display: grid;
            grid-template-columns: 250px 1fr 300px;
            height: 100vh;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            font-family: var(--vscode-font-family);
            font-size: 13px;
          }

          /* Left Panel - Asset List */
          .left-panel {
            background-color: var(--vscode-sideBar-background);
            border-right: 1px solid var(--vscode-panel-border);
            overflow-y: auto;
          }
          .asset-list-item {
            padding: 8px 12px;
            cursor: pointer;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .asset-list-item:hover {
            background-color: var(--vscode-list-hoverBackground);
          }
          .asset-list-item.selected {
            background-color: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
          }
          .asset-icon {
            font-size: 16px;
            flex-shrink: 0;
          }
          .asset-thumbnail {
            width: 32px;
            height: 32px;
            flex-shrink: 0;
            object-fit: contain;
            border-radius: 2px;
          }

          /* Middle Panel - Preview */
          .middle-panel {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px;
            overflow: auto;
          }
          .preview-container {
            text-align: center;
          }
          .preview-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 40px;
            color: var(--vscode-foreground);
          }
          .preview-content {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
            justify-content: center;
          }
          .preview-item {
            text-align: center;
          }
          .preview-item img {
            max-width: 200px;
            max-height: 200px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
          }
          .color-preview {
            width: 120px;
            height: 120px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            margin: 0 auto;
          }
          .preview-label {
            margin-top: 10px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
          }

          /* Right Panel - Properties */
          .right-panel {
            background-color: var(--vscode-sideBar-background);
            border-left: 1px solid var(--vscode-panel-border);
            padding: 20px;
            overflow-y: auto;
          }
          .property-section {
            margin-bottom: 20px;
          }
          .property-title {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
          }
          .property-value {
            padding: 6px 8px;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            margin-bottom: 8px;
            font-size: 12px;
          }
          .property-list {
            list-style: none;
          }
          .property-list li {
            padding: 4px 0;
            font-size: 12px;
          }
          .empty-state {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            padding: 40px 20px;
          }
        </style>
      </head>
      <body>
        <div class="left-panel" id="assetList"></div>
        <div class="middle-panel" id="previewPanel">
          <div class="empty-state">Select an asset to preview</div>
        </div>
        <div class="right-panel" id="propertiesPanel">
          <div class="empty-state">No asset selected</div>
        </div>

        <script>
          const assetsData = ${assetsJson};
          let allAssets = [];

          // Combine all assets
          allAssets = [
            ...assetsData.imageSets,
            ...assetsData.colorSets,
            ...assetsData.dataSets
          ];

          // Render asset list
          function renderAssetList() {
            const listEl = document.getElementById('assetList');
            listEl.innerHTML = allAssets.map((asset, idx) => {
              let iconHtml = '';
              if (asset.type === 'image' && asset.images.length > 0) {
                iconHtml = \`<img src="\${asset.images[0].uri}" class="asset-thumbnail" alt="\${asset.name}" />\`;
              } else {
                const iconClass = asset.type === 'color' ? 'codicon-symbol-color' : 'codicon-database';
                iconHtml = \`<i class="codicon \${iconClass} asset-icon"></i>\`;
              }
              return \`<div class="asset-list-item" data-index="\${idx}">
                \${iconHtml}
                <span>\${asset.name}</span>
              </div>\`;
            }).join('');

            // Add click handlers
            listEl.querySelectorAll('.asset-list-item').forEach(item => {
              item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.index);
                selectAsset(idx);
              });
            });
          }

          // Select asset
          function selectAsset(index) {
            // Update selection
            document.querySelectorAll('.asset-list-item').forEach((item, idx) => {
              item.classList.toggle('selected', idx === index);
            });

            const asset = allAssets[index];
            renderPreview(asset);
            renderProperties(asset);
          }

          // Render preview
          function renderPreview(asset) {
            const panel = document.getElementById('previewPanel');

            if (asset.type === 'image') {
              const imagesHtml = asset.images.map(img => \`
                <div class="preview-item">
                  <img src="\${img.uri}" alt="\${img.filename}" />
                  <div class="preview-label">\${img.scale} - \${img.idiom}</div>
                </div>
              \`).join('');

              panel.innerHTML = \`
                <div class="preview-container">
                  <div class="preview-title">\${asset.name}</div>
                  <div class="preview-content">\${imagesHtml}</div>
                </div>
              \`;
            } else if (asset.type === 'color') {
              const color = asset.colors[0] || {};
              const colorValue = getColorValue(color.color);
              const appearance = color.appearances?.[0]?.value || 'any';

              panel.innerHTML = \`
                <div class="preview-container">
                  <div class="preview-title">\${asset.name}</div>
                  <div class="preview-content">
                    <div class="preview-item">
                      <div class="color-preview" style="background-color: \${colorValue}"></div>
                      <div class="preview-label">\${appearance}</div>
                    </div>
                  </div>
                </div>
              \`;
            } else if (asset.type === 'data') {
              panel.innerHTML = \`
                <div class="preview-container">
                  <div class="preview-title">\${asset.name}</div>
                  <div class="preview-content">
                    <div class="preview-label">\${asset.data.length} data items</div>
                  </div>
                </div>
              \`;
            }
          }

          // Render properties
          function renderProperties(asset) {
            const panel = document.getElementById('propertiesPanel');

            if (asset.type === 'image') {
              const devices = [...new Set(asset.images.map(i => i.idiom))].join(', ');
              const scales = [...new Set(asset.images.map(i => i.scale))].join(', ');

              panel.innerHTML = \`
                <div class="property-section">
                  <div class="property-title">Name</div>
                  <div class="property-value">\${asset.name}</div>
                </div>
                <div class="property-section">
                  <div class="property-title">Type</div>
                  <div class="property-value">Image Set</div>
                </div>
                <div class="property-section">
                  <div class="property-title">Devices</div>
                  <div class="property-value">\${devices}</div>
                </div>
                <div class="property-section">
                  <div class="property-title">Scales</div>
                  <div class="property-value">\${scales}</div>
                </div>
              \`;
            } else if (asset.type === 'color') {
              const color = asset.colors[0] || {};
              const appearances = color.appearances?.map(a => a.value).join(', ') || 'None';
              const gamut = color.color?.['color-space'] || 'sRGB';

              panel.innerHTML = \`
                <div class="property-section">
                  <div class="property-title">Name</div>
                  <div class="property-value">\${asset.name}</div>
                </div>
                <div class="property-section">
                  <div class="property-title">Type</div>
                  <div class="property-value">Color Set</div>
                </div>
                <div class="property-section">
                  <div class="property-title">Devices</div>
                  <div class="property-value">Universal</div>
                </div>
                <div class="property-section">
                  <div class="property-title">Appearances</div>
                  <div class="property-value">\${appearances}</div>
                </div>
                <div class="property-section">
                  <div class="property-title">Gamut</div>
                  <div class="property-value">\${gamut}</div>
                </div>
              \`;
            } else if (asset.type === 'data') {
              panel.innerHTML = \`
                <div class="property-section">
                  <div class="property-title">Name</div>
                  <div class="property-value">\${asset.name}</div>
                </div>
                <div class="property-section">
                  <div class="property-title">Type</div>
                  <div class="property-value">Data Set</div>
                </div>
                <div class="property-section">
                  <div class="property-title">Items</div>
                  <div class="property-value">\${asset.data.length}</div>
                </div>
              \`;
            }
          }

          // Get color value from color object
          function getColorValue(color) {
            if (!color) return '#000000';
            const components = color.components;
            if (!components) return '#000000';

            if (components.red !== undefined) {
              const r = Math.round(parseFloat(components.red) * 255);
              const g = Math.round(parseFloat(components.green) * 255);
              const b = Math.round(parseFloat(components.blue) * 255);
              return \`rgb(\${r}, \${g}, \${b})\`;
            }

            return '#000000';
          }

          // Initialize
          renderAssetList();
          if (allAssets.length > 0) {
            selectAsset(0);
          }
        </script>
      </body>
      </html>`;
  }

  private getColorValue(color: any): string {
    if (!color) {
      return '#000000';
    }

    const components = color.components;
    if (!components) {
      return '#000000';
    }

    if (components.red !== undefined) {
      const r = Math.round(parseFloat(components.red) * 255);
      const g = Math.round(parseFloat(components.green) * 255);
      const b = Math.round(parseFloat(components.blue) * 255);
      return `rgb(${r}, ${g}, ${b})`;
    }

    return '#000000';
  }
}

interface AssetCatalog {
  name: string;
  imageSets: ImageSet[];
  colorSets: ColorSet[];
  dataSets: DataSet[];
}

interface ImageSet {
  name: string;
  images: ImageVariant[];
}

interface ImageVariant {
  filename: string;
  scale: string;
  idiom: string;
  path: string;
}

interface ColorSet {
  name: string;
  colors: any[];
}

interface DataSet {
  name: string;
  data: any[];
}
