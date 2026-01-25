import { escapeHtml, getColorValue } from './utils.js';
import { renderPdfToCanvas } from './pdfRenderer.js';
import { initLottiePlayer, initDotLottiePlayer } from './lottiePlayer.js';
import { renderImageVariantProperties, renderAppIconVariantProperties, renderColorProperties } from './properties.js';

// Shared device/platform labels
const DEVICE_LABELS = {
  universal: 'Universal', iphone: 'iPhone', ipad: 'iPad',
  'mac-catalyst': 'Mac Catalyst Scaled', mac: 'Mac', vision: 'Apple Vision',
  watch: 'Apple Watch', tv: 'Apple TV', car: 'CarPlay',
  ios: 'iOS', macos: 'macOS', watchos: 'watchOS', tvos: 'tvOS'
};

// Group items by key
function groupBy(items, keyFn) {
  return items.reduce((groups, item, idx) => {
    const key = keyFn(item);
    (groups[key] ||= []).push({ ...item, _idx: idx });
    return groups;
  }, {});
}

// Render empty slot
function emptySlot(label, type = 'image') {
  const slotClass = type === 'color' ? 'color-slot' : 'image-slot';
  return `
    <div class="slot-item">
      <div class="${slotClass} empty"><span class="plus-icon">+</span></div>
      <div class="slot-label">${label}</div>
    </div>`;
}

// Render preview container wrapper
function previewContainer(name, content) {
  return `
    <div class="preview-container">
      <div class="preview-title">${escapeHtml(name)}</div>
      <div class="preview-content" style="flex-direction: column; width: 100%;">
        ${content}
      </div>
    </div>`;
}

// Render device group
function deviceGroup(slotsHtml, label, extra = '') {
  return `
    <div class="device-group"${extra}>
      <div class="slot-grid">${slotsHtml}</div>
      <div class="device-group-label">${label}</div>
    </div>`;
}

// Setup click handlers for variant selection
function setupVariantClicks(panel, selector, dataAttr, handler) {
  panel.querySelectorAll(selector).forEach(item => {
    item.addEventListener('click', async () => {
      panel.querySelectorAll(selector).forEach(v => v.classList.remove('selected'));
      item.classList.add('selected');
      await handler(item.dataset);
    });
  });
}

// Render preview panel
export async function renderPreview(asset, vscode) {
  const panel = document.getElementById('previewPanel');

  if (asset.type === 'folder') {
    await renderFolderPreview(asset, panel, vscode);
  } else if (asset.type === 'image') {
    await renderImagePreview(asset, panel, vscode);
  } else if (asset.type === 'color') {
    renderColorPreview(asset, panel, vscode);
  } else if (asset.type === 'appicon') {
    renderAppIconPreview(asset, panel, vscode);
  } else if (asset.type === 'data') {
    renderDataPreview(asset, panel);
  }
}

// Render multi-selection preview (multiple assets)
export async function renderMultiPreview(assets, vscode) {
  const panel = document.getElementById('previewPanel');

  if (assets.length === 0) {
    panel.innerHTML = '<div class="empty-state">No assets selected</div>';
    return;
  }

  // Create container for all previews
  panel.innerHTML = `<div class="folder-previews-list"></div>`;
  const listContainer = panel.querySelector('.folder-previews-list');

  // Render each asset's full preview
  for (const asset of assets) {
    const childPanel = document.createElement('div');
    childPanel.className = 'folder-child-preview';
    listContainer.appendChild(childPanel);

    if (asset.type === 'image') {
      await renderImagePreviewInContainer(asset, childPanel, panel, vscode);
    } else if (asset.type === 'color') {
      renderColorPreviewInContainer(asset, childPanel, panel, vscode);
    } else if (asset.type === 'appicon') {
      renderAppIconPreviewInContainer(asset, childPanel, panel, vscode);
    } else if (asset.type === 'data') {
      renderDataPreviewInContainer(asset, childPanel);
    }
  }
}

// Render folder preview with full child previews
async function renderFolderPreview(folder, panel, vscode) {
  const children = folder.children || [];

  if (children.length === 0) {
    panel.innerHTML = previewContainer(folder.name, '<div class="empty-state">Empty folder</div>');
    return;
  }

  // Filter to only renderable assets (not subfolders)
  const assets = children.filter(c => c.type !== 'folder');

  if (assets.length === 0) {
    panel.innerHTML = previewContainer(folder.name, '<div class="empty-state">No assets in folder</div>');
    return;
  }

  // Create container for all previews
  panel.innerHTML = `<div class="folder-previews-list"></div>`;
  const listContainer = panel.querySelector('.folder-previews-list');

  // Render each child's full preview
  for (const child of assets) {
    const childPanel = document.createElement('div');
    childPanel.className = 'folder-child-preview';
    listContainer.appendChild(childPanel);

    if (child.type === 'image') {
      await renderImagePreviewInContainer(child, childPanel, panel, vscode);
    } else if (child.type === 'color') {
      renderColorPreviewInContainer(child, childPanel, panel, vscode);
    } else if (child.type === 'appicon') {
      renderAppIconPreviewInContainer(child, childPanel, panel, vscode);
    } else if (child.type === 'data') {
      renderDataPreviewInContainer(child, childPanel);
    }
  }
}

// Helper functions to render previews in a specific container

async function renderImagePreviewInContainer(asset, container, mainPanel, vscode) {
  const idiomOrder = ['universal', 'iphone', 'ipad', 'mac-catalyst', 'mac', 'vision', 'watch', 'tv'];
  const idiomGroups = groupBy(asset.images, img => img.subtype === 'mac-catalyst' ? 'mac-catalyst' : img.idiom);

  const hasAppearances = asset.images.some(i => i.appearances && i.appearances.length > 0);
  const hasScales = asset.images.some(i => i.scale);

  const groupsHtml = idiomOrder
    .filter(idiom => idiomGroups[idiom])
    .map(idiom => {
      const images = idiomGroups[idiom];
      const isSingleUniversal = idiom === 'universal' && images.length === 1 && images[0].filename && !images[0].scale && !hasAppearances;

      let slotsHtml;
      if (isSingleUniversal) {
        slotsHtml = imageSlot(images[0], 'All');
      } else if (hasAppearances && hasScales) {
        const hasLight = images.some(i => i.appearances?.some(a => a.appearance === 'luminosity' && a.value === 'light'));
        const hasDark = images.some(i => i.appearances?.some(a => a.appearance === 'luminosity' && a.value === 'dark'));

        const appearances = [{ key: 'any', label: 'Any Appearance' }];
        if (hasLight) appearances.push({ key: 'light', label: 'Light' });
        if (hasDark) appearances.push({ key: 'dark', label: 'Dark' });

        const scales = ['1x', '2x', '3x'];

        slotsHtml = `<div class="appearance-scale-grid">${appearances.map(({ key, label }) => {
          const rowHtml = scales.map(scale => {
            const img = findImageByAppearance(images, key, scale);
            const slotLabel = `${scale}<br>${label}`;
            return img?.filename ? imageSlot(img, slotLabel) : emptySlot(slotLabel);
          }).join('');
          return `<div class="appearance-row">${rowHtml}</div>`;
        }).join('')}</div>`;
      } else if (hasAppearances) {
        const hasLight = images.some(i => i.appearances?.some(a => a.appearance === 'luminosity' && a.value === 'light'));
        const hasDark = images.some(i => i.appearances?.some(a => a.appearance === 'luminosity' && a.value === 'dark'));

        const appearances = [{ key: 'any', label: 'Any Appearance' }];
        if (hasLight) appearances.push({ key: 'light', label: 'Light' });
        if (hasDark) appearances.push({ key: 'dark', label: 'Dark' });

        slotsHtml = `<div class="appearance-stack">${appearances.map(({ key, label }) => {
          const img = findImageByAppearance(images, key);
          return img?.filename ? imageSlot(img, label) : emptySlot(label);
        }).join('')}</div>`;
      } else {
        slotsHtml = ['1x', '2x', '3x'].map(scale => {
          const img = images.find(i => i.scale === scale);
          return img?.filename ? imageSlot(img, scale) : emptySlot(scale);
        }).join('');
      }

      return deviceGroup(slotsHtml, DEVICE_LABELS[idiom]);
    }).join('');

  container.innerHTML = previewContainer(asset.name, groupsHtml);

  for (const canvas of container.querySelectorAll('canvas[data-preview-pdf]')) {
    await renderPdfToCanvas(canvas.dataset.pdfUrl, canvas, 1, 90, 90);
  }

  // Click handlers for variant selection
  container.querySelectorAll('.variant-item[data-image-filename]').forEach(item => {
    item.addEventListener('click', async () => {
      mainPanel.querySelectorAll('.variant-item').forEach(v => v.classList.remove('selected'));
      item.classList.add('selected');
      await renderImageVariantProperties(asset, item.dataset.imageFilename, item.dataset.imageUri, item.dataset.imageScale, vscode);
    });
  });
}

function renderColorPreviewInContainer(asset, container, mainPanel, vscode) {
  const idiomGroups = groupBy(asset.colors, c => c.idiom || 'universal');

  const idiomHtml = Object.keys(idiomGroups).map(idiom => {
    const colors = idiomGroups[idiom];
    const hasLight = colors.some(c => c.appearances?.some(a => a.appearance === 'luminosity' && a.value === 'light'));
    const hasDark = colors.some(c => c.appearances?.some(a => a.appearance === 'luminosity' && a.value === 'dark'));

    const appearances = [{ key: 'any', label: 'Any Appearance' }];
    if (hasLight) appearances.push({ key: 'light', label: 'Light' });
    if (hasDark) appearances.push({ key: 'dark', label: 'Dark' });

    const slotsHtml = appearances.map(({ key, label }) => {
      const colorItem = findColorByAppearance(colors, key);
      const valid = colorItem?.color?.components;
      return valid ? colorSlot(colorItem, label) : emptySlot(label, 'color');
    }).join('');

    return deviceGroup(slotsHtml, DEVICE_LABELS[idiom] || idiom);
  }).join('');

  container.innerHTML = previewContainer(asset.name, idiomHtml);

  // Click handlers for color variant selection
  container.querySelectorAll('.variant-item[data-color-index]').forEach(item => {
    item.addEventListener('click', () => {
      mainPanel.querySelectorAll('.variant-item').forEach(v => v.classList.remove('selected'));
      item.classList.add('selected');
      renderColorProperties(asset, parseInt(item.dataset.colorIndex), vscode);
    });
  });
}

function renderAppIconPreviewInContainer(asset, container, mainPanel, vscode) {
  const platformOrder = ['ios', 'macos', 'watchos', 'tvos', 'universal', 'iphone', 'ipad', 'mac', 'watch', 'tv', 'car'];
  const platformGroups = groupBy(asset.icons, i => i.platform || i.idiom || 'other');

  Object.keys(platformGroups).forEach(k => {
    if (!platformOrder.includes(k)) platformOrder.push(k);
  });

  const contentHtml = platformOrder
    .filter(key => platformGroups[key])
    .map(key => {
      const sizeGroups = groupBy(platformGroups[key], i => i.size || 'unknown');

      const iconSlotsHtml = Object.keys(sizeGroups).map(size => {
        const variants = getIconVariants(sizeGroups[size]);
        const variantsHtml = variants.map(({ icon, label }) =>
          icon?.filename ? iconSlot(icon, label, size) : emptySlot(label)
        ).join('');

        const displaySize = `${size.split('x')[0]}pt`;
        const labelHtml = `
          <div class="device-group-label" style="border-top: 1px solid var(--vscode-panel-border) !important; padding-top: 5px; margin-top: 5px; line-height: 1.4;">
            <div style="font-weight: 600; color: var(--vscode-foreground);">${DEVICE_LABELS[key] || key}</div>
            <div style="font-weight: normal;">${displaySize}</div>
          </div>`;

        return `<div class="device-group" style="margin-bottom: 20px;"><div class="slot-grid">${variantsHtml}</div>${labelHtml}</div>`;
      }).join('');

      return `<div class="platform-group" style="width: 100%; margin-bottom: 30px;">${iconSlotsHtml}</div>`;
    }).join('');

  container.innerHTML = previewContainer(asset.name, contentHtml);

  // Click handlers for icon variant selection
  container.querySelectorAll('.variant-item[data-icon-filename]').forEach(item => {
    item.addEventListener('click', async () => {
      mainPanel.querySelectorAll('.variant-item').forEach(v => v.classList.remove('selected'));
      item.classList.add('selected');
      await renderAppIconVariantProperties(asset, item.dataset.iconFilename, item.dataset.iconUri, item.dataset.iconSize, item.dataset.iconScale, item.dataset.iconAppearance, vscode);
    });
  });
}

function renderDataPreviewInContainer(asset, container) {
  const dataItem = asset.data[0];

  // For lottie in folder view, show static player without controls
  if (dataItem?.isLottie && dataItem.uri) {
    container.innerHTML = `
      <div class="preview-container">
        <div class="preview-title">${escapeHtml(asset.name)}</div>
        <div class="preview-content" style="width: 100%; justify-content: center;">
          <dotlottie-player src="${dataItem.uri}" autoplay loop class="lottie-animation" style="max-width: 300px; max-height: 200px;"></dotlottie-player>
        </div>
      </div>`;
  } else if (dataItem?.isLottie && dataItem.content) {
    container.innerHTML = `
      <div class="preview-container">
        <div class="preview-title">${escapeHtml(asset.name)}</div>
        <div class="preview-content" style="width: 100%; justify-content: center;">
          <div style="color: var(--vscode-descriptionForeground);"><i class="codicon codicon-play-circle"></i> Lottie Animation</div>
        </div>
      </div>`;
  } else {
    let contentHtml;
    if (dataItem?.content) {
      const escaped = dataItem.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      contentHtml = `
        <div style="width: 100%; max-width: 800px;">
          <div style="margin-bottom: 12px; font-size: 13px; color: var(--vscode-descriptionForeground);">File: ${escapeHtml(dataItem.filename)}</div>
          <pre style="background-color: var(--vscode-textCodeBlock-background); border: 1px solid var(--vscode-panel-border); border-radius: 4px; padding: 16px; overflow: auto; max-height: 300px; font-family: var(--vscode-editor-font-family); font-size: 13px; line-height: 1.5; text-align: left;">${escaped}</pre>
        </div>`;
    } else if (dataItem?.filename) {
      contentHtml = `<div style="color: var(--vscode-descriptionForeground);">File: ${escapeHtml(dataItem.filename)}<br><em>(Binary or unreadable content)</em></div>`;
    } else {
      contentHtml = `<div class="preview-label">${dataItem ? asset.data.length + ' data items' : 'No data items'}</div>`;
    }
    container.innerHTML = `
      <div class="preview-container">
        <div class="preview-title">${escapeHtml(asset.name)}</div>
        <div class="preview-content" style="width: 100%;">${contentHtml}</div>
      </div>`;
  }
}

// Render image slot (PDF, HEIC, or regular)
function imageSlot(img, label) {
  const ext = img.filename.toLowerCase().split('.').pop();
  const data = `data-image-filename="${img.filename}" data-image-uri="${img.uri}" data-image-fspath="${img.fsPath || ''}" data-image-scale="${label}"`;

  let content;
  if (ext === 'pdf') {
    content = `<canvas style="max-width: 90px; max-height: 90px; position: relative; z-index: 1;" data-pdf-url="${img.uri}" data-preview-pdf="true"></canvas>`;
  } else if (ext === 'heic') {
    content = `<i class="codicon codicon-file-media"></i>`;
  } else {
    content = `<img src="${img.uri}" alt="${label}" />`;
  }

  const slotClass = ext === 'heic' ? 'image-slot filled heic-placeholder' : 'image-slot filled';
  return `
    <div class="variant-item" ${data} style="display: flex; flex-direction: column; align-items: center;">
      <div class="${slotClass}">${content}</div>
      <div class="slot-label">${label}</div>
    </div>`;
}

// Find image by appearance and optional scale
function findImageByAppearance(images, appearanceKey, scale = null) {
  return images.find(i => {
    const matchesAppearance = appearanceKey === 'any'
      ? (!i.appearances || i.appearances.length === 0)
      : i.appearances?.some(a => a.appearance === 'luminosity' && a.value === appearanceKey);
    const matchesScale = scale ? i.scale === scale : true;
    return matchesAppearance && matchesScale;
  });
}

async function renderImagePreview(asset, panel, vscode) {
  const idiomOrder = ['universal', 'iphone', 'ipad', 'mac-catalyst', 'mac', 'vision', 'watch', 'tv'];
  const idiomGroups = groupBy(asset.images, img => img.subtype === 'mac-catalyst' ? 'mac-catalyst' : img.idiom);

  // Check if images use appearances and/or scales
  const hasAppearances = asset.images.some(i => i.appearances && i.appearances.length > 0);
  const hasScales = asset.images.some(i => i.scale);

  const groupsHtml = idiomOrder
    .filter(idiom => idiomGroups[idiom])
    .map(idiom => {
      const images = idiomGroups[idiom];
      const isSingleUniversal = idiom === 'universal' && images.length === 1 && images[0].filename && !images[0].scale && !hasAppearances;

      let slotsHtml;
      if (isSingleUniversal) {
        slotsHtml = imageSlot(images[0], 'All');
      } else if (hasAppearances && hasScales) {
        // Grid: rows = appearances, columns = scales
        const hasLight = images.some(i => i.appearances?.some(a => a.appearance === 'luminosity' && a.value === 'light'));
        const hasDark = images.some(i => i.appearances?.some(a => a.appearance === 'luminosity' && a.value === 'dark'));

        const appearances = [{ key: 'any', label: 'Any Appearance' }];
        if (hasLight) appearances.push({ key: 'light', label: 'Light' });
        if (hasDark) appearances.push({ key: 'dark', label: 'Dark' });

        const scales = ['1x', '2x', '3x'];

        slotsHtml = `<div class="appearance-scale-grid">${appearances.map(({ key, label }) => {
          const rowHtml = scales.map(scale => {
            const img = findImageByAppearance(images, key, scale);
            const slotLabel = `${scale}<br>${label}`;
            return img?.filename ? imageSlot(img, slotLabel) : emptySlot(slotLabel);
          }).join('');
          return `<div class="appearance-row">${rowHtml}</div>`;
        }).join('')}</div>`;
      } else if (hasAppearances) {
        // Appearance-only (no scales) - vertical stack
        const hasLight = images.some(i => i.appearances?.some(a => a.appearance === 'luminosity' && a.value === 'light'));
        const hasDark = images.some(i => i.appearances?.some(a => a.appearance === 'luminosity' && a.value === 'dark'));

        const appearances = [{ key: 'any', label: 'Any Appearance' }];
        if (hasLight) appearances.push({ key: 'light', label: 'Light' });
        if (hasDark) appearances.push({ key: 'dark', label: 'Dark' });

        slotsHtml = `<div class="appearance-stack">${appearances.map(({ key, label }) => {
          const img = findImageByAppearance(images, key);
          return img?.filename ? imageSlot(img, label) : emptySlot(label);
        }).join('')}</div>`;
      } else {
        // Scale-based images (@1x, @2x, @3x)
        slotsHtml = ['1x', '2x', '3x'].map(scale => {
          const img = images.find(i => i.scale === scale);
          return img?.filename ? imageSlot(img, scale) : emptySlot(scale);
        }).join('');
      }

      return deviceGroup(slotsHtml, DEVICE_LABELS[idiom]);
    }).join('');

  panel.innerHTML = previewContainer(asset.name, groupsHtml);

  // Render PDF previews
  for (const canvas of panel.querySelectorAll('canvas[data-preview-pdf]')) {
    await renderPdfToCanvas(canvas.dataset.pdfUrl, canvas, 1, 90, 90);
  }

  // Click handlers
  setupVariantClicks(panel, '.variant-item[data-image-filename]', 'image', async (data) => {
    await renderImageVariantProperties(asset, data.imageFilename, data.imageUri, data.imageScale, vscode);
  });
}

// Color slot helper
function colorSlot(colorItem, label) {
  const colorValue = getColorValue(colorItem.color);
  return `
    <div class="variant-item" data-color-index="${colorItem._idx}" style="display: flex; flex-direction: column; align-items: center;">
      <div class="color-slot filled" style="background-color: ${colorValue};"></div>
      <div class="slot-label">${label}</div>
    </div>`;
}

// Find color by appearance
function findColorByAppearance(colors, key) {
  if (key === 'any') return colors.find(c => !c.appearances || c.appearances.length === 0);
  return colors.find(c => c.appearances?.some(a => a.appearance === 'luminosity' && a.value === key));
}

function renderColorPreview(asset, panel, vscode) {
  const idiomGroups = groupBy(asset.colors, c => c.idiom || 'universal');

  const idiomHtml = Object.keys(idiomGroups).map(idiom => {
    const colors = idiomGroups[idiom];
    const hasLight = colors.some(c => c.appearances?.some(a => a.appearance === 'luminosity' && a.value === 'light'));
    const hasDark = colors.some(c => c.appearances?.some(a => a.appearance === 'luminosity' && a.value === 'dark'));

    const appearances = [{ key: 'any', label: 'Any Appearance' }];
    if (hasLight) appearances.push({ key: 'light', label: 'Light' });
    if (hasDark) appearances.push({ key: 'dark', label: 'Dark' });

    const slotsHtml = appearances.map(({ key, label }) => {
      const colorItem = findColorByAppearance(colors, key);
      const valid = colorItem?.color?.components;
      return valid ? colorSlot(colorItem, label) : emptySlot(label, 'color');
    }).join('');

    return deviceGroup(slotsHtml, DEVICE_LABELS[idiom] || idiom);
  }).join('');

  panel.innerHTML = previewContainer(asset.name, idiomHtml);

  setupVariantClicks(panel, '.variant-item[data-color-index]', 'color', (data) => {
    renderColorProperties(asset, parseInt(data.colorIndex), vscode);
  });
}

// Icon slot helper
function iconSlot(icon, label, size) {
  const data = `data-icon-filename="${icon.filename}" data-icon-uri="${icon.uri}" data-icon-fspath="${icon.fsPath || ''}" data-icon-size="${size}" data-icon-scale="${icon.scale || ''}" data-icon-appearance="${label}"`;
  return `
    <div class="variant-item" ${data} style="display: flex; flex-direction: column; align-items: center;">
      <div class="image-slot filled">
        <img src="${icon.uri}" alt="${label}" style="max-width: 90px; max-height: 90px;" />
      </div>
      <div class="slot-label">${label}</div>
    </div>`;
}

// Get icon variants (macOS: by scale, iOS: by appearance)
function getIconVariants(sizeIcons) {
  const hasScale = sizeIcons.some(i => i.scale);
  if (hasScale) {
    return ['1x', '2x', '3x']
      .map(scale => ({ icon: sizeIcons.find(i => i.scale === scale), label: scale }))
      .filter(v => v.icon);
  }
  const variants = [{ icon: sizeIcons.find(i => !i.appearances?.length), label: 'Any' }];
  const dark = sizeIcons.find(i => i.appearances?.some(a => a.value === 'dark'));
  const tinted = sizeIcons.find(i => i.appearances?.some(a => a.value === 'tinted'));
  if (dark) variants.push({ icon: dark, label: 'Dark' });
  if (tinted) variants.push({ icon: tinted, label: 'Tinted' });
  return variants;
}

function renderAppIconPreview(asset, panel, vscode) {
  const platformOrder = ['ios', 'macos', 'watchos', 'tvos', 'universal', 'iphone', 'ipad', 'mac', 'watch', 'tv', 'car'];
  const platformGroups = groupBy(asset.icons, i => i.platform || i.idiom || 'other');

  // Add unknown platforms
  Object.keys(platformGroups).forEach(k => {
    if (!platformOrder.includes(k)) platformOrder.push(k);
  });

  const contentHtml = platformOrder
    .filter(key => platformGroups[key])
    .map(key => {
      const sizeGroups = groupBy(platformGroups[key], i => i.size || 'unknown');

      const iconSlotsHtml = Object.keys(sizeGroups).map(size => {
        const variants = getIconVariants(sizeGroups[size]);
        const variantsHtml = variants.map(({ icon, label }) =>
          icon?.filename ? iconSlot(icon, label, size) : emptySlot(label)
        ).join('');

        const displaySize = `${size.split('x')[0]}pt`;
        const labelHtml = `
          <div class="device-group-label" style="border-top: 1px solid var(--vscode-panel-border) !important; padding-top: 5px; margin-top: 5px; line-height: 1.4;">
            <div style="font-weight: 600; color: var(--vscode-foreground);">${DEVICE_LABELS[key] || key}</div>
            <div style="font-weight: normal;">${displaySize}</div>
          </div>`;

        return `<div class="device-group" style="margin-bottom: 20px;"><div class="slot-grid">${variantsHtml}</div>${labelHtml}</div>`;
      }).join('');

      return `<div class="platform-group" style="width: 100%; margin-bottom: 30px;">${iconSlotsHtml}</div>`;
    }).join('');

  panel.innerHTML = previewContainer(asset.name, contentHtml);

  setupVariantClicks(panel, '.variant-item[data-icon-filename]', 'icon', async (data) => {
    await renderAppIconVariantProperties(asset, data.iconFilename, data.iconUri, data.iconSize, data.iconScale, data.iconAppearance, vscode);
  });
}

// Lottie controls HTML
function lottieControls() {
  return `
    <div class="lottie-controls">
      <button class="lottie-btn" id="lottiePlayBtn" title="Play/Pause"><i class="codicon codicon-debug-pause"></i></button>
      <div class="lottie-progress-group">
        <span class="lottie-time" id="lottieCurrentTime">0:00</span>
        <input type="range" class="lottie-progress" id="lottieProgress" min="0" max="100" value="0" />
        <span class="lottie-time" id="lottieDuration">0:00</span>
      </div>
      <select class="lottie-speed-select" id="lottieSpeed" title="Playback Speed">
        <option value="0.5">0.5x</option><option value="1" selected>1x</option>
        <option value="1.5">1.5x</option><option value="2">2x</option><option value="2.5">2.5x</option>
      </select>
      <button class="lottie-btn active" id="lottieLoopBtn" title="Loop"><i class="codicon codicon-sync"></i></button>
    </div>`;
}

// Lottie player wrapper
function lottiePlayer(name, playerHtml) {
  return `
    <div class="preview-container">
      <div class="preview-title">${escapeHtml(name)}</div>
      <div class="preview-content" style="width: 100%; justify-content: center;">
        <div class="lottie-player-container">${playerHtml}${lottieControls()}</div>
      </div>
    </div>`;
}

function renderDataPreview(asset, panel) {
  const dataItem = asset.data[0];

  if (dataItem?.isLottie && dataItem.content) {
    panel.innerHTML = lottiePlayer(asset.name, '<div id="lottieAnimation" class="lottie-animation"></div>');
    initLottiePlayer(dataItem.content);
  } else if (dataItem?.isLottie && dataItem.uri) {
    panel.innerHTML = lottiePlayer(asset.name, `<dotlottie-player id="dotLottiePlayer" src="${dataItem.uri}" autoplay loop class="lottie-animation"></dotlottie-player>`);
    initDotLottiePlayer();
  } else {
    let contentHtml;
    if (dataItem?.content) {
      const escaped = dataItem.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      contentHtml = `
        <div style="width: 100%; max-width: 800px;">
          <div style="margin-bottom: 12px; font-size: 13px; color: var(--vscode-descriptionForeground);">File: ${escapeHtml(dataItem.filename)}</div>
          <pre style="background-color: var(--vscode-textCodeBlock-background); border: 1px solid var(--vscode-panel-border); border-radius: 4px; padding: 16px; overflow: auto; max-height: 600px; font-family: var(--vscode-editor-font-family); font-size: 13px; line-height: 1.5; text-align: left;">${escaped}</pre>
        </div>`;
    } else if (dataItem?.filename) {
      contentHtml = `<div style="color: var(--vscode-descriptionForeground);">File: ${escapeHtml(dataItem.filename)}<br><em>(Binary or unreadable content)</em></div>`;
    } else {
      contentHtml = `<div class="preview-label">${dataItem ? asset.data.length + ' data items' : 'No data items'}</div>`;
    }
    panel.innerHTML = `
      <div class="preview-container">
        <div class="preview-title">${escapeHtml(asset.name)}</div>
        <div class="preview-content" style="width: 100%;">${contentHtml}</div>
      </div>`;
  }
}
