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
      const imagePath = image.filename
        ? path.join(imageSetPath, image.filename)
        : undefined;
      images.push({
        filename: image.filename || '',
        scale: image.scale,
        idiom: image.idiom || 'universal',
        subtype: image.subtype,
        path: imagePath || '',
      });
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
          uri: img.path ? webview.asWebviewUri(vscode.Uri.file(img.path)).toString() : ''
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
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            display: grid;
            grid-template-columns: var(--left-width, 250px) 4px 1fr 4px var(--right-width, 300px);
            height: 100vh;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            font-family: var(--vscode-font-family);
            font-size: 13px;
          }
          .resizer {
            background-color: var(--vscode-panel-border);
            cursor: col-resize;
            position: relative;
          }
          .resizer:hover {
            background-color: var(--vscode-focusBorder);
          }
          .resizer.dragging {
            background-color: var(--vscode-focusBorder);
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
          .asset-thumbnail-canvas {
            width: 32px;
            height: 32px;
            flex-shrink: 0;
            border-radius: 2px;
            background: white;
          }

          /* Middle Panel - Preview */
          .middle-panel {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
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
          .device-group {
            width: 100%;
            margin-bottom: 30px;
          }
          .device-group-label {
            text-align: center;
            font-size: 13px;
            font-weight: 500;
            color: var(--vscode-descriptionForeground);
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
          }
          .device-group:first-child .device-group-label {
            border-top: none;
            margin-top: 0;
            padding-top: 0;
          }
          .slot-grid {
            display: flex;
            gap: 40px;
            justify-content: center;
            margin-bottom: 20px;
          }
          .image-slot {
            width: 90px;
            height: 90px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--vscode-editor-background);
            border-radius: 4px;
            position: relative;
          }
          .image-slot.empty {
            border: 2px dashed var(--vscode-panel-border);
          }
          .image-slot.filled {
            border: none;
          }
          .image-slot img {
            max-width: 90px;
            max-height: 90px;
            object-fit: contain;
            position: relative;
            z-index: 1;
          }
          .image-slot .plus-icon {
            font-size: 24px;
            color: var(--vscode-descriptionForeground);
            opacity: 0.5;
          }
          .slot-label {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            text-align: center;
            width: 90px;
          }
          .color-preview {
            width: 90px;
            height: 90px;
            border: 3px solid #666;
            border-radius: 8px;
            margin: 0 auto;
            padding: 4px;
            background-clip: content-box;
          }
          .variant-item {
            border: 2px solid transparent;
            border-radius: 6px;
            overflow: hidden;
            cursor: pointer;
          }
          .variant-item.selected {
            border-color: var(--vscode-focusBorder);
          }
          .variant-item .color-preview {
            margin: 4px auto 0 auto;
          }
          .variant-item .preview-label,
          .variant-item .slot-label {
            margin: 4px 0 0 0;
            padding: 4px 8px;
          }
          .variant-item.selected .preview-label,
          .variant-item.selected .slot-label {
            background-color: var(--vscode-focusBorder);
            color: white;
            font-weight: 600;
          }
          .pdf-preview-canvas {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            background: white;
            max-width: 100%;
            height: auto;
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
        <div class="resizer" id="leftResizer"></div>
        <div class="middle-panel" id="previewPanel">
          <div class="empty-state">Select an asset to preview</div>
        </div>
        <div class="resizer" id="rightResizer"></div>
        <div class="right-panel" id="propertiesPanel">
          <div class="empty-state">No asset selected</div>
        </div>

        <script>
          // Configure PDF.js
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

          const assetsData = ${assetsJson};
          let allAssets = [];

          // Combine all assets
          allAssets = [
            ...assetsData.imageSets,
            ...assetsData.colorSets,
            ...assetsData.dataSets
          ];

          // Resizer functionality
          let leftWidth = 250;
          let rightWidth = 300;

          function initResizers() {
            const leftResizer = document.getElementById('leftResizer');
            const rightResizer = document.getElementById('rightResizer');

            let isResizing = false;
            let currentResizer = null;

            leftResizer.addEventListener('mousedown', (e) => {
              isResizing = true;
              currentResizer = 'left';
              leftResizer.classList.add('dragging');
              e.preventDefault();
            });

            rightResizer.addEventListener('mousedown', (e) => {
              isResizing = true;
              currentResizer = 'right';
              rightResizer.classList.add('dragging');
              e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
              if (!isResizing) return;

              if (currentResizer === 'left') {
                const newWidth = e.clientX;
                if (newWidth >= 150 && newWidth <= 500) {
                  leftWidth = newWidth;
                  document.body.style.setProperty('--left-width', \`\${leftWidth}px\`);
                }
              } else if (currentResizer === 'right') {
                const newWidth = window.innerWidth - e.clientX;
                if (newWidth >= 200 && newWidth <= 600) {
                  rightWidth = newWidth;
                  document.body.style.setProperty('--right-width', \`\${rightWidth}px\`);
                }
              }
            });

            document.addEventListener('mouseup', () => {
              if (isResizing) {
                isResizing = false;
                leftResizer.classList.remove('dragging');
                rightResizer.classList.remove('dragging');
                currentResizer = null;
              }
            });
          }

          // Helper: Render PDF to canvas
          async function renderPdfToCanvas(pdfUrl, canvas, scale = 1) {
            try {
              const loadingTask = pdfjsLib.getDocument(pdfUrl);
              const pdf = await loadingTask.promise;
              const page = await pdf.getPage(1);
              const viewport = page.getViewport({ scale });
              const context = canvas.getContext('2d');
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              await page.render({ canvasContext: context, viewport }).promise;
              return true;
            } catch (error) {
              console.error('PDF render error:', error);
              return false;
            }
          }

          // Render asset list
          async function renderAssetList() {
            const listEl = document.getElementById('assetList');
            listEl.innerHTML = allAssets.map((asset, idx) => {
              let iconHtml = '';
              if (asset.type === 'image' && asset.images.length > 0) {
                const firstImage = asset.images.find(img => img.filename);
                if (firstImage) {
                  const isPdf = firstImage.filename.toLowerCase().endsWith('.pdf');
                  if (isPdf) {
                    iconHtml = \`<canvas class="asset-thumbnail-canvas" data-pdf-url="\${firstImage.uri}" data-idx="\${idx}"></canvas>\`;
                  } else {
                    iconHtml = \`<img src="\${firstImage.uri}" class="asset-thumbnail" alt="\${asset.name}" />\`;
                  }
                } else {
                  iconHtml = \`<i class="codicon codicon-file-media asset-icon"></i>\`;
                }
              } else if (asset.type === 'color') {
                const color = asset.colors[0] || {};
                const colorValue = getColorValue(color.color);
                iconHtml = \`<div class="asset-thumbnail" style="background-color: \${colorValue}; border: 1px solid var(--vscode-panel-border);"></div>\`;
              } else {
                iconHtml = \`<i class="codicon codicon-database asset-icon"></i>\`;
              }
              return \`<div class="asset-list-item" data-index="\${idx}">
                \${iconHtml}
                <span>\${asset.name}</span>
              </div>\`;
            }).join('');

            // Render PDF thumbnails
            const pdfCanvases = listEl.querySelectorAll('canvas[data-pdf-url]');
            for (const canvas of pdfCanvases) {
              const pdfUrl = canvas.dataset.pdfUrl;
              await renderPdfToCanvas(pdfUrl, canvas, 0.2);
            }

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
          async function renderPreview(asset) {
            const panel = document.getElementById('previewPanel');

            if (asset.type === 'image') {
              // Group images by idiom
              const idiomGroups = {};
              const idiomOrder = ['universal', 'iphone', 'ipad', 'mac-catalyst', 'mac', 'vision', 'watch', 'tv'];

              asset.images.forEach(img => {
                let idiomKey = img.idiom;
                if (img.subtype === 'mac-catalyst') {
                  idiomKey = 'mac-catalyst';
                }
                if (!idiomGroups[idiomKey]) {
                  idiomGroups[idiomKey] = [];
                }
                idiomGroups[idiomKey].push(img);
              });

              // Generate HTML for each idiom group
              const deviceLabels = {
                'universal': 'Universal',
                'iphone': 'iPhone',
                'ipad': 'iPad',
                'mac-catalyst': 'Mac Catalyst Scaled',
                'mac': 'Mac',
                'vision': 'Apple Vision',
                'watch': 'Apple Watch',
                'tv': 'Apple TV'
              };

              const groupsHtml = idiomOrder
                .filter(idiom => idiomGroups[idiom])
                .map(idiom => {
                  const images = idiomGroups[idiom];

                  // Check if this is a single universal image without scale info
                  const isSingleUniversal = idiom === 'universal' &&
                                           images.length === 1 &&
                                           images[0].filename &&
                                           !images[0].scale;

                  let slotsHtml = '';

                  if (isSingleUniversal) {
                    // Single image labeled "All"
                    const img = images[0];
                    const isPdf = img.filename.toLowerCase().endsWith('.pdf');

                    if (isPdf) {
                      slotsHtml = \`
                        <div class="variant-item" data-image-filename="\${img.filename}" data-image-uri="\${img.uri}" data-image-scale="All" style="display: flex; flex-direction: column; align-items: center;">
                          <div class="image-slot filled">
                            <canvas style="max-width: 90px; max-height: 90px; position: relative; z-index: 1;"
                                    data-pdf-url="\${img.uri}"
                                    data-preview-pdf="true"></canvas>
                          </div>
                          <div class="slot-label">All</div>
                        </div>
                      \`;
                    } else {
                      slotsHtml = \`
                        <div class="variant-item" data-image-filename="\${img.filename}" data-image-uri="\${img.uri}" data-image-scale="All" style="display: flex; flex-direction: column; align-items: center;">
                          <div class="image-slot filled">
                            <img src="\${img.uri}" alt="All" />
                          </div>
                          <div class="slot-label">All</div>
                        </div>
                      \`;
                    }
                  } else {
                    // Standard scale slots (1x, 2x, 3x)
                    const scaleOrder = ['1x', '2x', '3x'];

                    slotsHtml = scaleOrder.map(scale => {
                      const img = images.find(i => i.scale === scale);
                      const isPdf = img?.filename?.toLowerCase().endsWith('.pdf');

                      if (img && img.filename) {
                        // Filled slot
                        if (isPdf) {
                          return \`
                            <div class="variant-item" data-image-filename="\${img.filename}" data-image-uri="\${img.uri}" data-image-scale="\${scale}" style="display: flex; flex-direction: column; align-items: center;">
                              <div class="image-slot filled">
                                <canvas style="max-width: 90px; max-height: 90px; position: relative; z-index: 1;"
                                        data-pdf-url="\${img.uri}"
                                        data-preview-pdf="true"></canvas>
                              </div>
                              <div class="slot-label">\${scale}</div>
                            </div>
                          \`;
                        } else {
                          return \`
                            <div class="variant-item" data-image-filename="\${img.filename}" data-image-uri="\${img.uri}" data-image-scale="\${scale}" style="display: flex; flex-direction: column; align-items: center;">
                              <div class="image-slot filled">
                                <img src="\${img.uri}" alt="\${scale}" />
                              </div>
                              <div class="slot-label">\${scale}</div>
                            </div>
                          \`;
                        }
                      } else {
                        // Empty slot
                        return \`
                          <div style="display: flex; flex-direction: column; align-items: center;">
                            <div class="image-slot empty">
                              <span class="plus-icon">+</span>
                            </div>
                            <div class="slot-label">\${scale}</div>
                          </div>
                        \`;
                      }
                    }).join('');
                  }

                  return \`
                    <div class="device-group">
                      <div class="slot-grid">\${slotsHtml}</div>
                      <div class="device-group-label">\${deviceLabels[idiom]}</div>
                    </div>
                  \`;
                }).join('');

              panel.innerHTML = \`
                <div class="preview-container">
                  <div class="preview-title">\${asset.name}</div>
                  <div class="preview-content" style="flex-direction: column; width: 100%;">
                    \${groupsHtml}
                  </div>
                </div>
              \`;

              // Render PDF previews
              const pdfCanvases = panel.querySelectorAll('canvas[data-preview-pdf]');
              for (const canvas of pdfCanvases) {
                const pdfUrl = canvas.dataset.pdfUrl;
                await renderPdfToCanvas(pdfUrl, canvas, 0.5);
              }

              // Add click handlers for image slots
              panel.querySelectorAll('.variant-item[data-image-filename]').forEach(item => {
                item.addEventListener('click', async (e) => {
                  // Remove selection from all image variants
                  panel.querySelectorAll('.variant-item[data-image-filename]').forEach(v => {
                    v.classList.remove('selected');
                  });
                  // Select this variant
                  item.classList.add('selected');

                  const filename = item.dataset.imageFilename;
                  const uri = item.dataset.imageUri;
                  const scale = item.dataset.imageScale;

                  await renderImageVariantProperties(asset, filename, uri, scale);
                });
              });
            } else if (asset.type === 'color') {
              // Group colors by idiom (mac-catalyst goes under ipad)
              const idiomGroups = {};
              asset.colors.forEach((colorItem, idx) => {
                const idiom = colorItem.idiom || 'universal';
                if (!idiomGroups[idiom]) {
                  idiomGroups[idiom] = [];
                }
                idiomGroups[idiom].push({ ...colorItem, colorIndex: idx });
              });

              // Generate HTML for each idiom group
              const idiomHtml = Object.keys(idiomGroups).map(idiom => {
                const colors = idiomGroups[idiom];
                const colorsHtml = colors.map(colorItem => {
                  const colorValue = getColorValue(colorItem.color);
                  const appearances = colorItem.appearances || [];
                  const luminosity = appearances.find(a => a.appearance === 'luminosity');
                  const contrast = appearances.find(a => a.appearance === 'contrast');

                  let label1 = luminosity?.value === 'dark' ? 'Dark' : 'Any Appearance';

                  // Only show contrast if it's high
                  const labelParts = [label1];
                  if (contrast?.value === 'high') {
                    labelParts.push('High Contrast');
                  }

                  // Show "Mac Catalyst Scaled" prefix for mac-catalyst items
                  if (colorItem.subtype === 'mac-catalyst') {
                    labelParts[0] = 'Mac Catalyst Scaled<br>' + labelParts[0];
                  }

                  const label = labelParts.join('<br>');

                  return \`
                    <div class="preview-item variant-item" data-color-index="\${colorItem.colorIndex}">
                      <div class="color-preview" style="background-color: \${colorValue}"></div>
                      <div class="preview-label">\${label}</div>
                    </div>
                  \`;
                }).join('');

                const idiomTitles = {
                  'universal': 'Universal',
                  'iphone': 'iPhone',
                  'ipad': 'iPad',
                  'mac': 'Mac',
                  'tv': 'Apple TV',
                  'watch': 'Apple Watch',
                  'car': 'CarPlay',
                  'vision': 'Apple Vision',
                  'Mac Catalyst Scaled': 'Mac Catalyst Scaled'
                };
                const idiomTitle = idiomTitles[idiom] || idiom;
                return \`
                  <div style="width: 100%; margin-bottom: 30px;">
                    <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 15px; justify-content: center;">
                      \${colorsHtml}
                    </div>
                    <div style="border-top: 1px solid var(--vscode-panel-border); padding-top: 10px;">
                      <div style="font-size: 14px; font-weight: 500; color: var(--vscode-descriptionForeground);">\${idiomTitle}</div>
                    </div>
                  </div>
                \`;
              }).join('');

              panel.innerHTML = \`
                <div class="preview-container">
                  <div class="preview-title">\${asset.name}</div>
                  <div class="preview-content" style="flex-direction: column; align-items: flex-start; width: 100%;">
                    \${idiomHtml}
                  </div>
                </div>
              \`;

              // Add click handlers for color variants
              panel.querySelectorAll('.variant-item[data-color-index]').forEach(item => {
                item.addEventListener('click', (e) => {
                  // Remove selection from all color variants
                  panel.querySelectorAll('.variant-item[data-color-index]').forEach(v => {
                    v.classList.remove('selected');
                  });
                  // Select this variant
                  item.classList.add('selected');

                  const colorIndex = parseInt(item.dataset.colorIndex);
                  renderColorProperties(asset, colorIndex);
                });
              });
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

          // Render color properties for specific variant
          function renderColorProperties(asset, colorIndex) {
            const panel = document.getElementById('propertiesPanel');
            const colorItem = asset.colors[colorIndex];

            // Collect unique idioms and appearances
            const idioms = new Set();
            const hasLuminosity = new Set();
            const hasContrast = new Set();
            let gamut = 'Any';

            asset.colors.forEach(item => {
              if (item.subtype === 'mac-catalyst') {
                idioms.add('mac-catalyst');
              } else {
                idioms.add(item.idiom || 'universal');
              }

              if (item.color?.['color-space']) {
                gamut = item.color['color-space'].toUpperCase();
              }

              const appearances = item.appearances || [];
              appearances.forEach(app => {
                if (app.appearance === 'luminosity') {
                  hasLuminosity.add(app.value);
                } else if (app.appearance === 'contrast') {
                  hasContrast.add(app.value);
                }
              });
            });

            // Device checkboxes
            const allDevices = [
              { id: 'iphone', label: 'iPhone' },
              { id: 'ipad', label: 'iPad' },
              { id: 'mac-catalyst', label: 'Mac Catalyst Scaled' },
              { id: 'car', label: 'CarPlay' },
              { id: 'vision', label: 'Apple Vision' },
              { id: 'watch', label: 'Apple Watch' },
              { id: 'tv', label: 'Apple TV' }
            ];

            const devicesHtml = allDevices.map(device => {
              const checked = idioms.has(device.id) ? '☑' : '☐';
              const indent = device.id === 'mac-catalyst' ? 'padding-left: 16px;' : '';
              return \`<div style="padding: 2px 0; \${indent}">\${checked} \${device.label}</div>\`;
            }).join('');

            // Appearances
            let appearancesText = 'None';
            if (hasLuminosity.has('dark') || hasContrast.has('high')) {
              const parts = [];
              if (hasLuminosity.has('dark')) parts.push('Any, Dark');
              if (hasContrast.has('high')) parts.push('High Contrast');
              appearancesText = parts.join(', ');
            }

            const universalHtml = idioms.has('universal')
              ? '<div style="padding: 2px 0; margin-bottom: 4px;">☑ Universal</div>'
              : '';

            // Get color space and components for selected variant
            const color = colorItem.color || {};
            const colorSpace = color['color-space'] || 'srgb';
            const components = color.components || {};

            // Format components
            let componentsHtml = '';
            if (components.red !== undefined) {
              const r = parseFloat(components.red);
              const g = parseFloat(components.green);
              const b = parseFloat(components.blue);
              const a = components.alpha !== undefined ? parseFloat(components.alpha) : 1;

              componentsHtml = \`
                <div class="property-value">R: \${r}, G: \${g}, B: \${b}, A: \${a}</div>
              \`;
            }

            panel.innerHTML = \`
              <div class="property-section">
                <div class="property-title">Color Set</div>
                <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 12px;">
                  Name
                </div>
                <div class="property-value">\${asset.name}</div>
              </div>
              <div class="property-section">
                <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">
                  Devices
                </div>
                <div style="font-size: 12px; line-height: 1.5;">
                  \${universalHtml}
                  \${devicesHtml}
                </div>
              </div>
              <div class="property-section">
                <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">
                  Appearances
                </div>
                <div class="property-value">\${appearancesText}</div>
              </div>
              <div class="property-section">
                <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">
                  Gamut
                </div>
                <div class="property-value">\${gamut}</div>
              </div>
              <div class="property-section">
                <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">
                  Direction
                </div>
                <div class="property-value">Fixed</div>
              </div>
              <div class="property-section">
                <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">
                  Width Class
                </div>
                <div class="property-value">Any</div>
              </div>
              <div class="property-section">
                <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">
                  Height Class
                </div>
                <div class="property-value">Any</div>
              </div>
              <div class="property-section">
                <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">
                  Memory
                </div>
                <div class="property-value">None</div>
              </div>
              <div class="property-section">
                <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">
                  Graphics
                </div>
                <div class="property-value">None</div>
              </div>
              <div class="property-section">
                <div class="property-title">Color Space</div>
                <div class="property-value">\${colorSpace}</div>
              </div>
              <div class="property-section">
                <div class="property-title">Components</div>
                \${componentsHtml}
              </div>
            \`;
          }

          // Render image variant properties
          async function renderImageVariantProperties(asset, filename, uri, scale) {
            const panel = document.getElementById('propertiesPanel');

            // Get image dimensions
            let imageWidth = 0;
            let imageHeight = 0;
            try {
              const img = new Image();
              await new Promise((resolve, reject) => {
                img.onload = () => {
                  imageWidth = img.naturalWidth;
                  imageHeight = img.naturalHeight;
                  resolve();
                };
                img.onerror = reject;
                img.src = uri;
              });
            } catch (e) {
              console.error('Failed to load image:', e);
            }

            const imageSizeText = imageWidth && imageHeight
              ? \`\${imageWidth} × \${imageHeight} pixels\`
              : 'Unknown';

            // Collect general imageset properties
            const idioms = new Set();
            asset.images.forEach(img => {
              if (img.subtype === 'mac-catalyst') {
                idioms.add('mac-catalyst');
              } else {
                idioms.add(img.idiom || 'universal');
              }
            });

            // Device checkboxes
            const allDevices = [
              { id: 'iphone', label: 'iPhone' },
              { id: 'ipad', label: 'iPad' },
              { id: 'mac-catalyst', label: 'Mac Catalyst Scaled' },
              { id: 'car', label: 'CarPlay' },
              { id: 'vision', label: 'Apple Vision' },
              { id: 'watch', label: 'Apple Watch' },
              { id: 'tv', label: 'Apple TV' }
            ];

            const devicesHtml = allDevices.map(device => {
              const checked = idioms.has(device.id) ? '☑' : '☐';
              const indent = device.id === 'mac-catalyst' ? 'padding-left: 16px;' : '';
              return \`<div style="padding: 2px 0; \${indent}">\${checked} \${device.label}</div>\`;
            }).join('');

            const universalHtml = idioms.has('universal')
              ? '<div style="padding: 2px 0; margin-bottom: 4px;">☑ Universal</div>'
              : '';

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
                <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">
                  Devices
                </div>
                <div style="font-size: 12px; line-height: 1.5;">
                  \${universalHtml}
                  \${devicesHtml}
                </div>
              </div>
              <div class="property-section">
                <div class="property-title">Scales</div>
                <div class="property-value">\${scales}</div>
              </div>
              <div class="property-section" style="border-top: 1px solid var(--vscode-panel-border); padding-top: 16px; margin-top: 16px;">
                <div class="property-title">Image</div>
                <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; margin-top: 12px;">
                  File Name
                </div>
                <div class="property-value">\${filename}</div>
                <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; margin-top: 12px;">
                  Compression
                </div>
                <div class="property-value">Inherited (Automatic)</div>
                <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; margin-top: 12px;">
                  Image Size
                </div>
                <div class="property-value">\${imageSizeText}</div>
                <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; margin-top: 12px;">
                  Color Space
                </div>
                <div class="property-value">sRGB IEC61966-2.1</div>
              </div>
            \`;
          }

          // Render properties
          function renderProperties(asset) {
            const panel = document.getElementById('propertiesPanel');

            if (asset.type === 'image') {
              // Collect unique idioms
              const idioms = new Set();
              asset.images.forEach(img => {
                if (img.subtype === 'mac-catalyst') {
                  idioms.add('mac-catalyst');
                } else {
                  idioms.add(img.idiom || 'universal');
                }
              });

              // Device checkboxes
              const allDevices = [
                { id: 'iphone', label: 'iPhone' },
                { id: 'ipad', label: 'iPad' },
                { id: 'mac-catalyst', label: 'Mac Catalyst Scaled' },
                { id: 'car', label: 'CarPlay' },
                { id: 'vision', label: 'Apple Vision' },
                { id: 'watch', label: 'Apple Watch' },
                { id: 'tv', label: 'Apple TV' }
              ];

              const devicesHtml = allDevices.map(device => {
                const checked = idioms.has(device.id) ? '☑' : '☐';
                const indent = device.id === 'mac-catalyst' ? 'padding-left: 16px;' : '';
                return \`<div style="padding: 2px 0; \${indent}">\${checked} \${device.label}</div>\`;
              }).join('');

              const universalHtml = idioms.has('universal')
                ? '<div style="padding: 2px 0; margin-bottom: 4px;">☑ Universal</div>'
                : '';

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
                  <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">
                    Devices
                  </div>
                  <div style="font-size: 12px; line-height: 1.5;">
                    \${universalHtml}
                    \${devicesHtml}
                  </div>
                </div>
                <div class="property-section">
                  <div class="property-title">Scales</div>
                  <div class="property-value">\${scales}</div>
                </div>
              \`;
            } else if (asset.type === 'color') {
              // Collect unique idioms and appearances for general properties
              const idioms = new Set();
              const hasLuminosity = new Set();
              const hasContrast = new Set();
              let gamut = 'Any';

              asset.colors.forEach(item => {
                if (item.subtype === 'mac-catalyst') {
                  idioms.add('mac-catalyst');
                } else {
                  idioms.add(item.idiom || 'universal');
                }

                if (item.color?.['color-space']) {
                  gamut = item.color['color-space'].toUpperCase();
                }

                const appearances = item.appearances || [];
                appearances.forEach(app => {
                  if (app.appearance === 'luminosity') {
                    hasLuminosity.add(app.value);
                  } else if (app.appearance === 'contrast') {
                    hasContrast.add(app.value);
                  }
                });
              });

              // Device checkboxes
              const allDevices = [
                { id: 'iphone', label: 'iPhone' },
                { id: 'ipad', label: 'iPad' },
                { id: 'mac-catalyst', label: 'Mac Catalyst Scaled' },
                { id: 'car', label: 'CarPlay' },
                { id: 'vision', label: 'Apple Vision' },
                { id: 'watch', label: 'Apple Watch' },
                { id: 'tv', label: 'Apple TV' }
              ];

              const devicesHtml = allDevices.map(device => {
                const checked = idioms.has(device.id) ? '☑' : '☐';
                const indent = device.id === 'mac-catalyst' ? 'padding-left: 16px;' : '';
                return \`<div style="padding: 2px 0; \${indent}">\${checked} \${device.label}</div>\`;
              }).join('');

              // Appearances
              let appearancesText = 'None';
              if (hasLuminosity.has('dark') || hasContrast.has('high')) {
                const parts = [];
                if (hasLuminosity.has('dark')) parts.push('Any, Dark');
                if (hasContrast.has('high')) parts.push('High Contrast');
                appearancesText = parts.join(', ');
              }

              const universalHtml = idioms.has('universal')
                ? '<div style="padding: 2px 0; margin-bottom: 4px;">☑ Universal</div>'
                : '';

              panel.innerHTML = \`
                <div class="property-section">
                  <div class="property-title">Color Set</div>
                  <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 12px;">
                    Name
                  </div>
                  <div class="property-value">\${asset.name}</div>
                </div>
                <div class="property-section">
                  <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">
                    Devices
                  </div>
                  <div style="font-size: 12px; line-height: 1.5;">
                    \${universalHtml}
                    \${devicesHtml}
                  </div>
                </div>
                <div class="property-section">
                  <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">
                    Appearances
                  </div>
                  <div class="property-value">\${appearancesText}</div>
                </div>
                <div class="property-section">
                  <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">
                    Gamut
                  </div>
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
              // Check if values are normalized (0-1) or already in 0-255 range
              const redVal = parseFloat(components.red);
              const greenVal = parseFloat(components.green);
              const blueVal = parseFloat(components.blue);

              const r = redVal > 1 ? Math.round(redVal) : Math.round(redVal * 255);
              const g = greenVal > 1 ? Math.round(greenVal) : Math.round(greenVal * 255);
              const b = blueVal > 1 ? Math.round(blueVal) : Math.round(blueVal * 255);
              return \`rgb(\${r}, \${g}, \${b})\`;
            }

            return '#000000';
          }

          // Initialize
          (async () => {
            initResizers();
            await renderAssetList();
            if (allAssets.length > 0) {
              selectAsset(0);
            }
          })();
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
  scale?: string;
  idiom: string;
  subtype?: string;
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
