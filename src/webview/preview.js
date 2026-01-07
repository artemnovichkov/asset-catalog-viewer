import { escapeHtml, getColorValue } from './utils.js';
import { renderPdfToCanvas } from './pdfRenderer.js';
import { initLottiePlayer, initDotLottiePlayer } from './lottiePlayer.js';
import { renderImageVariantProperties, renderAppIconVariantProperties, renderColorProperties } from './properties.js';

// Render preview panel
export async function renderPreview(asset, vscode) {
  const panel = document.getElementById('previewPanel');

  if (asset.type === 'image') {
    await renderImagePreview(asset, panel, vscode);
  } else if (asset.type === 'color') {
    renderColorPreview(asset, panel, vscode);
  } else if (asset.type === 'appicon') {
    renderAppIconPreview(asset, panel, vscode);
  } else if (asset.type === 'data') {
    renderDataPreview(asset, panel);
  }
}

async function renderImagePreview(asset, panel, vscode) {
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

      const isSingleUniversal = idiom === 'universal' &&
                               images.length === 1 &&
                               images[0].filename &&
                               !images[0].scale;

      let slotsHtml = '';

      if (isSingleUniversal) {
        const img = images[0];
        const isPdf = img.filename.toLowerCase().endsWith('.pdf');

        if (isPdf) {
          slotsHtml = `
            <div class="variant-item" data-image-filename="${img.filename}" data-image-uri="${img.uri}" data-image-fspath="${img.fsPath || ''}" data-image-scale="All" style="display: flex; flex-direction: column; align-items: center;">
              <div class="image-slot filled">
                <canvas style="max-width: 90px; max-height: 90px; position: relative; z-index: 1;"
                        data-pdf-url="${img.uri}"
                        data-preview-pdf="true"></canvas>
              </div>
              <div class="slot-label">All</div>
            </div>
          `;
        } else {
          slotsHtml = `
            <div class="variant-item" data-image-filename="${img.filename}" data-image-uri="${img.uri}" data-image-fspath="${img.fsPath || ''}" data-image-scale="All" style="display: flex; flex-direction: column; align-items: center;">
              <div class="image-slot filled">
                <img src="${img.uri}" alt="All" />
              </div>
              <div class="slot-label">All</div>
            </div>
          `;
        }
      } else {
        const scaleOrder = ['1x', '2x', '3x'];

        slotsHtml = scaleOrder.map(scale => {
          const img = images.find(i => i.scale === scale);
          const isPdf = img?.filename?.toLowerCase().endsWith('.pdf');

          if (img && img.filename) {
            if (isPdf) {
              return `
                <div class="variant-item" data-image-filename="${img.filename}" data-image-uri="${img.uri}" data-image-fspath="${img.fsPath || ''}" data-image-scale="${scale}" style="display: flex; flex-direction: column; align-items: center;">
                  <div class="image-slot filled">
                    <canvas style="max-width: 90px; max-height: 90px; position: relative; z-index: 1;"
                            data-pdf-url="${img.uri}"
                            data-preview-pdf="true"></canvas>
                  </div>
                  <div class="slot-label">${scale}</div>
                </div>
              `;
            } else {
              return `
                <div class="variant-item" data-image-filename="${img.filename}" data-image-uri="${img.uri}" data-image-fspath="${img.fsPath || ''}" data-image-scale="${scale}" style="display: flex; flex-direction: column; align-items: center;">
                  <div class="image-slot filled">
                    <img src="${img.uri}" alt="${scale}" />
                  </div>
                  <div class="slot-label">${scale}</div>
                </div>
              `;
            }
          } else {
            return `
              <div style="display: flex; flex-direction: column; align-items: center;">
                <div class="image-slot empty">
                  <span class="plus-icon">+</span>
                </div>
                <div class="slot-label">${scale}</div>
              </div>
            `;
          }
        }).join('');
      }

      return `
        <div class="device-group">
          <div class="slot-grid">${slotsHtml}</div>
          <div class="device-group-label">${deviceLabels[idiom]}</div>
        </div>
      `;
    }).join('');

  panel.innerHTML = `
    <div class="preview-container">
      <div class="preview-title">${escapeHtml(asset.name)}</div>
      <div class="preview-content" style="flex-direction: column; width: 100%;">
        ${groupsHtml}
      </div>
    </div>
  `;

  // Render PDF previews
  const pdfCanvases = panel.querySelectorAll('canvas[data-preview-pdf]');
  for (const canvas of pdfCanvases) {
    const pdfUrl = canvas.dataset.pdfUrl;
    await renderPdfToCanvas(pdfUrl, canvas, 1, 90, 90);
  }

  // Add click handlers for image slots
  panel.querySelectorAll('.variant-item[data-image-filename]').forEach(item => {
    item.addEventListener('click', async (e) => {
      panel.querySelectorAll('.variant-item[data-image-filename]').forEach(v => {
        v.classList.remove('selected');
      });
      item.classList.add('selected');

      const filename = item.dataset.imageFilename;
      const uri = item.dataset.imageUri;
      const scale = item.dataset.imageScale;

      await renderImageVariantProperties(asset, filename, uri, scale, vscode);
    });
  });
}

function renderColorPreview(asset, panel, vscode) {
  const idiomGroups = {};
  asset.colors.forEach((colorItem, idx) => {
    const idiom = colorItem.idiom || 'universal';
    if (!idiomGroups[idiom]) {
      idiomGroups[idiom] = [];
    }
    idiomGroups[idiom].push({ ...colorItem, colorIndex: idx });
  });

  const idiomHtml = Object.keys(idiomGroups).map(idiom => {
    const colors = idiomGroups[idiom];
    const colorsHtml = colors.map(colorItem => {
      const hasValidColor = colorItem.color && colorItem.color.components;
      const colorValue = hasValidColor ? getColorValue(colorItem.color) : '';
      const appearances = colorItem.appearances || [];
      const luminosity = appearances.find(a => a.appearance === 'luminosity');
      const contrast = appearances.find(a => a.appearance === 'contrast');

      let label1 = luminosity?.value === 'dark' ? 'Dark' : 'Any Appearance';

      const labelParts = [label1];
      if (contrast?.value === 'high') {
        labelParts.push('High Contrast');
      }

      if (colorItem.subtype === 'mac-catalyst') {
        labelParts[0] = 'Mac Catalyst Scaled<br>' + labelParts[0];
      }

      const label = labelParts.join('<br>');

      const colorPreviewHtml = hasValidColor
        ? `<div class="color-preview" style="background-color: ${colorValue}"></div>`
        : `<div class="color-preview-placeholder"></div>`;

      return `
        <div class="preview-item variant-item" data-color-index="${colorItem.colorIndex}">
          ${colorPreviewHtml}
          <div class="preview-label">${label}</div>
        </div>
      `;
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
    return `
      <div style="width: 100%; margin-bottom: 30px;">
        <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 15px; justify-content: center;">
          ${colorsHtml}
        </div>
        <div style="border-top: 1px solid var(--vscode-panel-border); padding-top: 10px;">
          <div style="font-size: 14px; font-weight: 500; color: var(--vscode-descriptionForeground);">${idiomTitle}</div>
        </div>
      </div>
    `;
  }).join('');

  panel.innerHTML = `
    <div class="preview-container">
      <div class="preview-title">${escapeHtml(asset.name)}</div>
      <div class="preview-content" style="flex-direction: column; align-items: flex-start; width: 100%;">
        ${idiomHtml}
      </div>
    </div>
  `;

  // Add click handlers for color variants
  panel.querySelectorAll('.variant-item[data-color-index]').forEach(item => {
    item.addEventListener('click', (e) => {
      panel.querySelectorAll('.variant-item[data-color-index]').forEach(v => {
        v.classList.remove('selected');
      });
      item.classList.add('selected');

      const colorIndex = parseInt(item.dataset.colorIndex);
      renderColorProperties(asset, colorIndex, vscode);
    });
  });
}

function renderAppIconPreview(asset, panel, vscode) {
  const sizeGroups = {};

  asset.icons.forEach(icon => {
    const sizeKey = icon.size || 'unknown';
    if (!sizeGroups[sizeKey]) {
      sizeGroups[sizeKey] = [];
    }
    sizeGroups[sizeKey].push(icon);
  });

  const iconSlotsHtml = Object.keys(sizeGroups).map(size => {
    const icons = sizeGroups[size];

    const defaultIcon = icons.find(i => !i.appearances || i.appearances.length === 0);
    const darkIcon = icons.find(i => i.appearances?.some(a => a.value === 'dark'));
    const tintedIcon = icons.find(i => i.appearances?.some(a => a.value === 'tinted'));

    const variants = [
      { icon: defaultIcon, label: 'Any' },
      { icon: darkIcon, label: 'Dark' },
      { icon: tintedIcon, label: 'Tinted' }
    ];

    const variantsHtml = variants.map(({ icon, label }) => {
      if (icon && icon.filename) {
        return `
          <div class="variant-item" data-icon-filename="${icon.filename}" data-icon-uri="${icon.uri}" data-icon-fspath="${icon.fsPath || ''}" data-icon-size="${size}" data-icon-appearance="${label}" style="display: flex; flex-direction: column; align-items: center;">
            <div class="image-slot filled">
              <img src="${icon.uri}" alt="${label}" style="max-width: 90px; max-height: 90px;" />
            </div>
            <div class="slot-label">${label}</div>
          </div>
        `;
      } else {
        return `
          <div style="display: flex; flex-direction: column; align-items: center;">
            <div class="image-slot empty">
              <span class="plus-icon">+</span>
            </div>
            <div class="slot-label">${label}</div>
          </div>
        `;
      }
    }).join('');

    return `
      <div class="device-group">
        <div class="slot-grid">${variantsHtml}</div>
        <div class="device-group-label">${size}</div>
      </div>
    `;
  }).join('');

  panel.innerHTML = `
    <div class="preview-container">
      <div class="preview-title">${escapeHtml(asset.name)}</div>
      <div class="preview-content" style="flex-direction: column; width: 100%;">
        ${iconSlotsHtml}
      </div>
    </div>
  `;

  // Add click handlers for icon slots
  panel.querySelectorAll('.variant-item[data-icon-filename]').forEach(item => {
    item.addEventListener('click', async (e) => {
      panel.querySelectorAll('.variant-item[data-icon-filename]').forEach(v => {
        v.classList.remove('selected');
      });
      item.classList.add('selected');

      const filename = item.dataset.iconFilename;
      const uri = item.dataset.iconUri;
      const size = item.dataset.iconSize;
      const appearance = item.dataset.iconAppearance;

      await renderAppIconVariantProperties(asset, filename, uri, size, appearance, vscode);
    });
  });
}

function renderDataPreview(asset, panel) {
  const dataItem = asset.data.length > 0 ? asset.data[0] : null;

  if (dataItem && dataItem.isLottie && dataItem.content) {
    // JSON Lottie
    panel.innerHTML = `
      <div class="preview-container">
        <div class="preview-title">${escapeHtml(asset.name)}</div>
        <div class="preview-content" style="width: 100%; justify-content: center;">
          <div class="lottie-player-container">
            <div id="lottieAnimation" class="lottie-animation"></div>
            <div class="lottie-controls">
              <button class="lottie-btn" id="lottiePlayBtn" title="Play/Pause">
                <i class="codicon codicon-debug-pause"></i>
              </button>
              <div class="lottie-progress-group">
                <span class="lottie-time" id="lottieCurrentTime">0:00</span>
                <input type="range" class="lottie-progress" id="lottieProgress" min="0" max="100" value="0" />
                <span class="lottie-time" id="lottieDuration">0:00</span>
              </div>
              <select class="lottie-speed-select" id="lottieSpeed" title="Playback Speed">
                <option value="0.5">0.5x</option>
                <option value="1" selected>1x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
                <option value="2.5">2.5x</option>
              </select>
              <button class="lottie-btn active" id="lottieLoopBtn" title="Loop">
                <i class="codicon codicon-sync"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    initLottiePlayer(dataItem.content);
  } else if (dataItem && dataItem.isLottie && dataItem.uri) {
    // Binary .lottie file
    panel.innerHTML = `
      <div class="preview-container">
        <div class="preview-title">${escapeHtml(asset.name)}</div>
        <div class="preview-content" style="width: 100%; justify-content: center;">
          <div class="lottie-player-container">
            <dotlottie-player
              id="dotLottiePlayer"
              src="${dataItem.uri}"
              autoplay
              loop
              class="lottie-animation">
            </dotlottie-player>
            <div class="lottie-controls">
              <button class="lottie-btn" id="lottiePlayBtn" title="Play/Pause">
                <i class="codicon codicon-debug-pause"></i>
              </button>
              <div class="lottie-progress-group">
                <span class="lottie-time" id="lottieCurrentTime">0:00</span>
                <input type="range" class="lottie-progress" id="lottieProgress" min="0" max="100" value="0" />
                <span class="lottie-time" id="lottieDuration">0:00</span>
              </div>
              <select class="lottie-speed-select" id="lottieSpeed" title="Playback Speed">
                <option value="0.5">0.5x</option>
                <option value="1" selected>1x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
                <option value="2.5">2.5x</option>
              </select>
              <button class="lottie-btn active" id="lottieLoopBtn" title="Loop">
                <i class="codicon codicon-sync"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    initDotLottiePlayer();
  } else {
    // Show file content
    let contentHtml = '';
    if (dataItem) {
      if (dataItem.content) {
        const escapedContent = dataItem.content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

        contentHtml = `
          <div style="width: 100%; max-width: 800px;">
            <div style="margin-bottom: 12px; font-size: 13px; color: var(--vscode-descriptionForeground);">
              File: ${escapeHtml(dataItem.filename)}
            </div>
            <pre style="
              background-color: var(--vscode-textCodeBlock-background);
              border: 1px solid var(--vscode-panel-border);
              border-radius: 4px;
              padding: 16px;
              overflow: auto;
              max-height: 600px;
              font-family: var(--vscode-editor-font-family);
              font-size: 13px;
              line-height: 1.5;
              text-align: left;
            ">${escapedContent}</pre>
          </div>
        `;
      } else if (dataItem.filename) {
        contentHtml = `
          <div style="color: var(--vscode-descriptionForeground);">
            File: ${escapeHtml(dataItem.filename)}<br>
            <em>(Binary or unreadable content)</em>
          </div>
        `;
      } else {
        contentHtml = `<div class="preview-label">${asset.data.length} data items</div>`;
      }
    } else {
      contentHtml = `<div class="preview-label">No data items</div>`;
    }

    panel.innerHTML = `
      <div class="preview-container">
        <div class="preview-title">${escapeHtml(asset.name)}</div>
        <div class="preview-content" style="width: 100%;">
          ${contentHtml}
        </div>
      </div>
    `;
  }
}
