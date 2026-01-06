// Import dependencies
import * as pdfjsLib from 'pdfjs-dist';
import lottie from 'lottie-web';
import '@dotlottie/player-component';

// Configure PDF.js worker (will be set by extension via global)
pdfjsLib.GlobalWorkerOptions.workerSrc = window.pdfWorkerSrc || '';

// HTML escaping function for security
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const assetsData = window.assetsData;
let allAssets = [];
let currentSelectedAssetIndex = -1;
let expandedFolders = new Set();
let filterText = '';
let imageObserver = null;
let pdfObserver = null;

// Loading state management
function showLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.classList.add('visible');
  }
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.classList.remove('visible');
  }
}

// Flatten items into assets array (including folders)
// Add unique ID to each asset for reliable indexing
function flattenItems(items, parentPath = '') {
  const assets = [];
  items.forEach(item => {
    if (item.type === 'folder') {
      const folderPath = parentPath ? `${parentPath}/${item.name}` : item.name;
      // Add folder itself
      assets.push({ ...item, _path: folderPath });
      assets.push(...flattenItems(item.children || [], folderPath));
    } else {
      const itemPath = parentPath ? `${parentPath}/${item.name}` : item.name;
      assets.push({ ...item, _path: itemPath });
    }
  });
  return assets;
}

allAssets = flattenItems(assetsData.items);

// Filter items recursively
function filterItems(items, searchText) {
  if (!searchText) return items;

  const lowerSearch = searchText.toLowerCase();

  return items.filter(item => {
    if (item.type === 'folder') {
      // Folder passes if it has any matching children
      const filteredChildren = filterItems(item.children || [], searchText);
      return filteredChildren.length > 0;
    } else {
      // Asset passes if name matches
      return item.name.toLowerCase().includes(lowerSearch);
    }
  }).map(item => {
    if (item.type === 'folder') {
      // Return folder with filtered children
      return {
        ...item,
        children: filterItems(item.children || [], searchText)
      };
    }
    return item;
  });
}

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
        document.body.style.setProperty('--left-width', `${leftWidth}px`);
      }
    } else if (currentResizer === 'right') {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 200 && newWidth <= 600) {
        rightWidth = newWidth;
        document.body.style.setProperty('--right-width', `${rightWidth}px`);
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
async function renderPdfToCanvas(pdfUrl, canvas, scale = 1, maxWidth = null, maxHeight = null) {
  try {
    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    // Get the natural viewport at scale 1 to calculate aspect ratio
    const naturalViewport = page.getViewport({ scale: 1 });
    const aspectRatio = naturalViewport.width / naturalViewport.height;

    // Get device pixel ratio for high-DPI displays
    const devicePixelRatio = window.devicePixelRatio || 1;
    const resolutionMultiplier = 2; // Render at 2x for better quality

    // Calculate the actual scale to use
    let actualScale = scale;
    if (maxWidth !== null && maxHeight !== null) {
      // Calculate scale to fit within max dimensions while maintaining aspect ratio
      const scaleX = maxWidth / naturalViewport.width;
      const scaleY = maxHeight / naturalViewport.height;
      const fitScale = Math.min(scaleX, scaleY);
      // Multiply by resolution multiplier for high-quality rendering
      actualScale = fitScale * resolutionMultiplier * devicePixelRatio;
    } else {
      // If no max dimensions, use the provided scale with multiplier
      actualScale = scale * resolutionMultiplier * devicePixelRatio;
    }

    const viewport = page.getViewport({ scale: actualScale });
    const context = canvas.getContext('2d');

    // Set canvas internal size to high resolution
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // Set canvas display size to the desired max dimensions while maintaining aspect ratio
    if (maxWidth !== null && maxHeight !== null) {
      const displayScale = Math.min(maxWidth / naturalViewport.width, maxHeight / naturalViewport.height);
      canvas.style.width = (naturalViewport.width * displayScale) + 'px';
      canvas.style.height = (naturalViewport.height * displayScale) + 'px';
    }

    var renderContext = {
      canvasContext: context,
      background: 'rgba(0,0,0,0)',
      viewport: viewport
    };

    await page.render(renderContext).promise;
    return true;
  } catch (error) {
    console.error('PDF render error:', error);
    return false;
  }
}

// Render asset list with hierarchy
async function renderAssetList() {
  showLoading();
  const listEl = document.getElementById('assetList');

  // Apply filter
  const filteredItems = filterItems(assetsData.items, filterText);

  function renderItems(items, depth = 0, parentPath = '') {
    let html = '';
    items.forEach((item, itemIdx) => {
      const itemPath = parentPath ? `${parentPath}/${item.name}` : item.name;
      const indent = depth * 16;
      
      // Find index in flattened allAssets array using path
      const assetIndex = allAssets.findIndex(a => a._path === itemPath);

      if (item.type === 'folder') {
        const isExpanded = expandedFolders.has(itemPath);
        const chevronClass = isExpanded ? 'expanded' : '';
        html += `
          <div class="asset-list-item folder" data-index="${assetIndex}" data-folder-path="${itemPath}" data-path="${item.path || ''}" style="padding-left: ${indent + 8}px;">
            <i class="codicon codicon-chevron-right folder-chevron ${chevronClass}"></i>
            <i class="codicon codicon-folder asset-icon"></i>
            <span>${escapeHtml(item.name)}</span>
          </div>
        `;
        if (isExpanded && item.children && item.children.length > 0) {
          html += `<div class="folder-children" data-parent-path="${itemPath}">`;
          html += renderItems(item.children, depth + 1, itemPath);
          html += `</div>`;
        }
      } else {
        let iconHtml = '';
        if (item.type === 'image' && item.images.length > 0) {
          const firstImage = item.images.find(img => img.filename);
          if (firstImage) {
            const isPdf = firstImage.filename.toLowerCase().endsWith('.pdf');
            if (isPdf) {
              iconHtml = `<div class="asset-thumbnail-container"><canvas class="asset-thumbnail-canvas" data-pdf-url="${firstImage.uri}" data-idx="${assetIndex}"></canvas></div>`;
            } else {
              iconHtml = `<img data-src="${firstImage.uri}" class="asset-thumbnail lazy-img" alt="${item.name}" />`;
            }
          } else {
            iconHtml = `<i class="codicon codicon-file-media asset-icon"></i>`;
          }
        } else if (item.type === 'color') {
          if (item.colors && item.colors.length > 0 && item.colors[0].color && item.colors[0].color.components) {
            const color = item.colors[0];
            const colorValue = getColorValue(color.color);
            iconHtml = `<div class="asset-thumbnail" style="background-color: ${colorValue}; border: 1px solid var(--vscode-panel-border);"></div>`;
          } else {
            iconHtml = `<div class="asset-thumbnail-placeholder"></div>`;
          }
        } else if (item.type === 'appicon') {
          const firstIcon = item.icons.find(icon => icon.filename);
          if (firstIcon) {
            iconHtml = `<img data-src="${firstIcon.uri}" class="asset-thumbnail lazy-img" alt="${item.name}" />`;
          } else {
            iconHtml = `<div class="asset-thumbnail-placeholder"></div>`;
          }
        } else {
          iconHtml = `<i class="codicon codicon-database asset-icon"></i>`;
        }

        html += `<div class="asset-list-item" data-index="${assetIndex}" data-path="${item.path || ''}" style="padding-left: ${indent + 24 + 8}px;">
          ${iconHtml}
          <span>${escapeHtml(item.name)}</span>
        </div>`;
      }
    });
    return html;
  }

  listEl.innerHTML = renderItems(filteredItems);

  // Disconnect previous observers
  if (imageObserver) imageObserver.disconnect();
  if (pdfObserver) pdfObserver.disconnect();

  // Lazy load images with IntersectionObserver
  const lazyImages = listEl.querySelectorAll('img.lazy-img');
  imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.classList.remove('lazy-img');
        imageObserver.unobserve(img);
      }
    });
  }, { rootMargin: '50px' });
  lazyImages.forEach(img => imageObserver.observe(img));

  // Lazy render PDF thumbnails with IntersectionObserver
  const pdfCanvases = listEl.querySelectorAll('canvas[data-pdf-url]');
  pdfObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const canvas = entry.target;
        const pdfUrl = canvas.dataset.pdfUrl;
        renderPdfToCanvas(pdfUrl, canvas, 1, 24, 24);
        pdfObserver.unobserve(canvas);
      }
    });
  }, { rootMargin: '50px' });
  pdfCanvases.forEach(canvas => pdfObserver.observe(canvas));

  // Add click handlers for folders
  listEl.querySelectorAll('.asset-list-item.folder').forEach(item => {
    // Chevron click -> Toggle
    const chevron = item.querySelector('.folder-chevron');
    if (chevron) {
      chevron.addEventListener('click', (e) => {
        const folderPath = item.dataset.folderPath;
        toggleFolder(folderPath);
        e.stopPropagation();
      });
    }

    // Row click -> Select
    item.addEventListener('click', (e) => {
      const idx = parseInt(item.dataset.index);
      selectAsset(idx);
    });
  });

  // Add click handlers for assets
  listEl.querySelectorAll('.asset-list-item:not(.folder)').forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.dataset.index);
      selectAsset(idx);
    });
  });

  hideLoading();
}

// Toggle folder expand/collapse
function toggleFolder(folderPath) {
  if (expandedFolders.has(folderPath)) {
    expandedFolders.delete(folderPath);
  } else {
    expandedFolders.add(folderPath);
  }
  renderAssetList().then(() => {
    // Re-apply selection after render
    if (currentSelectedAssetIndex >= 0) {
      document.querySelectorAll('.asset-list-item').forEach((item) => {
        const itemIndex = item.dataset.index;
        item.classList.toggle('selected', itemIndex !== undefined && parseInt(itemIndex) === currentSelectedAssetIndex);
      });
    }
  });
}

// Select asset
function selectAsset(index) {
  currentSelectedAssetIndex = index;
  // Update selection - use data-index attribute, not DOM order
  document.querySelectorAll('.asset-list-item').forEach((item) => {
    const itemIndex = item.dataset.index;
    item.classList.toggle('selected', itemIndex !== undefined && parseInt(itemIndex) === index);
  });

  const asset = allAssets[index];
  if (asset.type === 'folder') {
    document.getElementById('previewPanel').innerHTML = '<div class="empty-state">Folder</div>';
  } else {
    renderPreview(asset);
  }
  renderProperties(asset);
}

// Deselect asset
function deselectAsset() {
  currentSelectedAssetIndex = -1;
  // Remove selection from all items
  document.querySelectorAll('.asset-list-item').forEach(item => {
    item.classList.remove('selected');
  });
  // Show empty state
  document.getElementById('previewPanel').innerHTML = '<div class="empty-state">No Selection</div>';
  document.getElementById('propertiesPanel').innerHTML = '<div class="empty-state">No asset selected</div>';
}

// Deselect variant (image/color) within current asset
function deselectVariant() {
  if (currentSelectedAssetIndex >= 0) {
    const panel = document.getElementById('previewPanel');
    // Remove selection from all variants
    panel.querySelectorAll('.variant-item').forEach(v => {
      v.classList.remove('selected');
    });
    // Show general asset properties
    const asset = allAssets[currentSelectedAssetIndex];
    renderProperties(asset);
  }
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
          // Standard scale slots (1x, 2x, 3x)
          const scaleOrder = ['1x', '2x', '3x'];

          slotsHtml = scaleOrder.map(scale => {
            const img = images.find(i => i.scale === scale);
            const isPdf = img?.filename?.toLowerCase().endsWith('.pdf');

            if (img && img.filename) {
              // Filled slot
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
              // Empty slot
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
        const hasValidColor = colorItem.color && colorItem.color.components;
        const colorValue = hasValidColor ? getColorValue(colorItem.color) : '';
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
  } else if (asset.type === 'appicon') {
    // Group icons by size and appearance
    const sizeGroups = {};

    asset.icons.forEach(icon => {
      const sizeKey = icon.size || 'unknown';
      if (!sizeGroups[sizeKey]) {
        sizeGroups[sizeKey] = [];
      }
      sizeGroups[sizeKey].push(icon);
    });

    // Generate slots for each size
    const iconSlotsHtml = Object.keys(sizeGroups).map(size => {
      const icons = sizeGroups[size];

      // Find default, dark, and tinted variants
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
        // Remove selection from all icon variants
        panel.querySelectorAll('.variant-item[data-icon-filename]').forEach(v => {
          v.classList.remove('selected');
        });
        // Select this variant
        item.classList.add('selected');

        const filename = item.dataset.iconFilename;
        const uri = item.dataset.iconUri;
        const size = item.dataset.iconSize;
        const appearance = item.dataset.iconAppearance;

        await renderAppIconVariantProperties(asset, filename, uri, size, appearance);
      });
    });
  } else if (asset.type === 'data') {
    // Check if it's a Lottie animation
    const dataItem = asset.data.length > 0 ? asset.data[0] : null;

    if (dataItem && dataItem.isLottie && dataItem.content) {
      // Render JSON Lottie player (with custom controls)
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

      // Initialize Lottie player
      initLottiePlayer(dataItem.content);
    } else if (dataItem && dataItem.isLottie && dataItem.uri) {
      // Render .lottie file player (binary format) with custom controls
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

      // Initialize dotlottie player controls
      initDotLottiePlayer();
    } else {
      // Show file content if available
      let contentHtml = '';
      if (dataItem) {
        if (dataItem.content) {
          // Escape HTML and show as code
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
    return `<div style="padding: 2px 0; ${indent}">${checked} ${device.label}</div>`;
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

    componentsHtml = `
      <div class="property-value">R: ${r}, G: ${g}, B: ${b}, A: ${a}</div>
    `;
  }

  panel.innerHTML = `
    <div class="property-section">
      <div class="property-title">Color Set</div>
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 12px;">
        Name
      </div>
      <div class="property-value-with-button">
        <div class="property-value" style="flex: 1; margin-bottom: 0;">${escapeHtml(asset.name)}</div>
        <button class="finder-button" data-path="${asset.path}">
          <i class="codicon codicon-folder-opened"></i>
        </button>
      </div>
    </div>
    <div class="property-section">
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">
        Devices
      </div>
      <div style="font-size: 12px; line-height: 1.5;">
        ${universalHtml}
        ${devicesHtml}
      </div>
    </div>
    <div class="property-section">
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">
        Appearances
      </div>
      <div class="property-value">${appearancesText}</div>
    </div>
    <div class="property-section">
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">
        Gamut
      </div>
      <div class="property-value">${gamut}</div>
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
      <div class="property-value">${colorSpace}</div>
    </div>
    <div class="property-section">
      <div class="property-title">Components</div>
      ${componentsHtml}
    </div>
  `;

  // Add click handler for finder button
  panel.querySelector('.finder-button').addEventListener('click', (e) => {
    const button = e.currentTarget;
    const path = button.dataset.path;
    if (path) {
      vscode.postMessage({ command: 'showInFinder', filePath: path });
    }
  });
}

// Render app icon variant properties
async function renderAppIconVariantProperties(asset, filename, uri, size, appearance) {
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
    ? `${imageWidth} × ${imageHeight} pixels`
    : 'Unknown';

  // Collect platforms
  const platforms = new Set();
  asset.icons.forEach(icon => {
    if (icon.platform) {
      platforms.add(icon.platform);
    }
  });

  const platformsList = Array.from(platforms).join(', ');

  panel.innerHTML = `
    <div class="property-section">
      <div class="property-title">Name</div>
      <div class="property-value-with-button">
        <div class="property-value" style="flex: 1; margin-bottom: 0;">${escapeHtml(asset.name)}</div>
        <button class="finder-button" data-path="${asset.path}">
          <i class="codicon codicon-folder-opened"></i>
        </button>
      </div>
    </div>
    <div class="property-section">
      <div class="property-title">Type</div>
      <div class="property-value">App Icon Set</div>
    </div>
    <div class="property-section">
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">
        Platforms
      </div>
      <div class="property-value">${platformsList || 'iOS'}</div>
    </div>
    <div class="property-section" style="border-top: 1px solid var(--vscode-panel-border); padding-top: 16px; margin-top: 16px;">
      <div class="property-title">Icon</div>
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; margin-top: 12px;">
        Size
      </div>
      <div class="property-value">${size}</div>
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; margin-top: 12px;">
        Appearance
      </div>
      <div class="property-value">${appearance}</div>
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; margin-top: 12px;">
        File Name
      </div>
      <div class="property-value">${escapeHtml(filename)}</div>
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; margin-top: 12px;">
        Image Size
      </div>
      <div class="property-value">${imageSizeText}</div>
    </div>
  `;

  // Add click handler for finder button
  panel.querySelector('.finder-button').addEventListener('click', (e) => {
    const button = e.currentTarget;
    const path = button.dataset.path;
    if (path) {
      vscode.postMessage({ command: 'showInFinder', filePath: path });
    }
  });
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
    ? `${imageWidth} × ${imageHeight} pixels`
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
    return `<div style="padding: 2px 0; ${indent}">${checked} ${device.label}</div>`;
  }).join('');

  const universalHtml = idioms.has('universal')
    ? '<div style="padding: 2px 0; margin-bottom: 4px;">☑ Universal</div>'
    : '';

  const scales = [...new Set(asset.images.map(i => i.scale))].join(', ');

  panel.innerHTML = `
    <div class="property-section">
      <div class="property-title">Name</div>
      <div class="property-value-with-button">
        <div class="property-value" style="flex: 1; margin-bottom: 0;">${escapeHtml(asset.name)}</div>
        <button class="finder-button" data-path="${asset.path}">
          <i class="codicon codicon-folder-opened"></i>
        </button>
      </div>
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
        ${universalHtml}
        ${devicesHtml}
      </div>
    </div>
    <div class="property-section">
      <div class="property-title">Scales</div>
      <div class="property-value">${scales}</div>
    </div>
    <div class="property-section" style="border-top: 1px solid var(--vscode-panel-border); padding-top: 16px; margin-top: 16px;">
      <div class="property-title">Image</div>
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; margin-top: 12px;">
        File Name
      </div>
      <div class="property-value">${escapeHtml(filename)}</div>
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; margin-top: 12px;">
        Compression
      </div>
      <div class="property-value">Inherited (Automatic)</div>
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; margin-top: 12px;">
        Image Size
      </div>
      <div class="property-value">${imageSizeText}</div>
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; margin-top: 12px;">
        Color Space
      </div>
      <div class="property-value">sRGB IEC61966-2.1</div>
    </div>
  `;

  // Add click handler for finder button
  panel.querySelector('.finder-button').addEventListener('click', (e) => {
    const button = e.currentTarget;
    const path = button.dataset.path;
    if (path) {
      vscode.postMessage({ command: 'showInFinder', filePath: path });
    }
  });
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
      return `<div style="padding: 2px 0; ${indent}">${checked} ${device.label}</div>`;
    }).join('');

    const universalHtml = idioms.has('universal')
      ? '<div style="padding: 2px 0; margin-bottom: 4px;">☑ Universal</div>'
      : '';

    const scales = [...new Set(asset.images.map(i => i.scale))].join(', ');

    panel.innerHTML = `
      <div class="property-section">
        <div class="property-title">Name</div>
        <div class="property-value-with-button">
          <div class="property-value" style="flex: 1; margin-bottom: 0;">${escapeHtml(asset.name)}</div>
          <button class="finder-button" data-path="${asset.path}">
            <i class="codicon codicon-folder-opened"></i>
          </button>
        </div>
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
          ${universalHtml}
          ${devicesHtml}
        </div>
      </div>
      <div class="property-section">
        <div class="property-title">Scales</div>
        <div class="property-value">${scales}</div>
      </div>
    `;

    // Add click handler for finder button
    panel.querySelector('.finder-button').addEventListener('click', (e) => {
      const button = e.currentTarget;
      const path = button.dataset.path;
      if (path) {
        vscode.postMessage({ command: 'showInFinder', filePath: path });
      }
    });
  } else if (asset.type === 'appicon') {
    // Collect platforms and sizes
    const platforms = new Set();
    const sizes = new Set();

    asset.icons.forEach(icon => {
      if (icon.platform) {
        platforms.add(icon.platform);
      }
      if (icon.size) {
        sizes.add(icon.size);
      }
    });

    const platformsList = Array.from(platforms).join(', ');
    const sizesList = Array.from(sizes).join(', ');

    panel.innerHTML = `
      <div class="property-section">
        <div class="property-title">Name</div>
        <div class="property-value-with-button">
          <div class="property-value" style="flex: 1; margin-bottom: 0;">${escapeHtml(asset.name)}</div>
          <button class="finder-button" data-path="${asset.path}">
            <i class="codicon codicon-folder-opened"></i>
          </button>
        </div>
      </div>
      <div class="property-section">
        <div class="property-title">Type</div>
        <div class="property-value">App Icon Set</div>
      </div>
      <div class="property-section">
        <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">
          Platforms
        </div>
        <div class="property-value">${platformsList || 'iOS'}</div>
      </div>
      <div class="property-section">
        <div class="property-title">Sizes</div>
        <div class="property-value">${sizesList}</div>
      </div>
    `;

    // Add click handler for finder button
    panel.querySelector('.finder-button').addEventListener('click', (e) => {
      const button = e.currentTarget;
      const path = button.dataset.path;
      if (path) {
        vscode.postMessage({ command: 'showInFinder', filePath: path });
      }
    });
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
      return `<div style="padding: 2px 0; ${indent}">${checked} ${device.label}</div>`;
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

    panel.innerHTML = `
      <div class="property-section">
        <div class="property-title">Color Set</div>
        <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 12px;">
          Name
        </div>
        <div class="property-value-with-button">
          <div class="property-value" style="flex: 1; margin-bottom: 0;">${escapeHtml(asset.name)}</div>
          <button class="finder-button" data-path="${asset.path}">
            <i class="codicon codicon-folder-opened"></i>
          </button>
        </div>
      </div>
      <div class="property-section">
        <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">
          Devices
        </div>
        <div style="font-size: 12px; line-height: 1.5;">
          ${universalHtml}
          ${devicesHtml}
        </div>
      </div>
      <div class="property-section">
        <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">
          Appearances
        </div>
        <div class="property-value">${appearancesText}</div>
      </div>
      <div class="property-section">
        <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">
          Gamut
        </div>
        <div class="property-value">${gamut}</div>
      </div>
    `;

    // Add click handler for finder button
    panel.querySelector('.finder-button').addEventListener('click', (e) => {
      const button = e.currentTarget;
      const path = button.dataset.path;
      if (path) {
        vscode.postMessage({ command: 'showInFinder', filePath: path });
      }
    });
  } else if (asset.type === 'data') {
    panel.innerHTML = `
      <div class="property-section">
        <div class="property-title">Name</div>
        <div class="property-value-with-button">
          <div class="property-value" style="flex: 1; margin-bottom: 0;">${escapeHtml(asset.name)}</div>
          <button class="finder-button" data-path="${asset.path}">
            <i class="codicon codicon-folder-opened"></i>
          </button>
        </div>
      </div>
    `;

    // Add click handler for finder button
    panel.querySelector('.finder-button').addEventListener('click', (e) => {
      const button = e.currentTarget;
      const path = button.dataset.path;
      if (path) {
        vscode.postMessage({ command: 'showInFinder', filePath: path });
      }
    });
  } else if (asset.type === 'folder') {
    panel.innerHTML = `
      <div class="property-section">
        <div class="property-title">Name</div>
        <div class="property-value-with-button">
          <div class="property-value" style="flex: 1; margin-bottom: 0;">${escapeHtml(asset.name)}</div>
          <button class="finder-button" data-path="${asset.path}">
            <i class="codicon codicon-folder-opened"></i>
          </button>
        </div>
      </div>
      <div class="property-section">
        <div class="property-title">Type</div>
        <div class="property-value">Folder</div>
      </div>
    `;

    // Add click handler for finder button
    panel.querySelector('.finder-button').addEventListener('click', (e) => {
      const button = e.currentTarget;
      const path = button.dataset.path;
      if (path) {
        vscode.postMessage({ command: 'showInFinder', filePath: path });
      }
    });
  }
}

// Lottie player state
let currentLottieAnimation = null;

// Initialize Lottie player
function initLottiePlayer(jsonContent) {
  // Destroy previous animation if exists
  if (currentLottieAnimation) {
    currentLottieAnimation.destroy();
    currentLottieAnimation = null;
  }

  const container = document.getElementById('lottieAnimation');
  const playBtn = document.getElementById('lottiePlayBtn');
  const progressSlider = document.getElementById('lottieProgress');
  const currentTimeEl = document.getElementById('lottieCurrentTime');
  const durationEl = document.getElementById('lottieDuration');
  const speedSelect = document.getElementById('lottieSpeed');
  const loopBtn = document.getElementById('lottieLoopBtn');

  if (!container) return;

  // Parse animation data
  let animationData;
  try {
    animationData = JSON.parse(jsonContent);
  } catch (e) {
    console.error('Failed to parse Lottie JSON:', e);
    return;
  }

  // Create animation
  const anim = lottie.loadAnimation({
    container: container,
    renderer: 'svg',
    loop: true,
    autoplay: true,
    animationData: animationData
  });

  currentLottieAnimation = anim;

  const frameRate = animationData.fr || 30;
  const totalFrames = anim.totalFrames;
  const durationSec = totalFrames / frameRate;

  // Format time as M:SS
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  durationEl.textContent = formatTime(durationSec);

  // Update progress on each frame (skip for single-frame animations)
  if (totalFrames > 1) {
    anim.addEventListener('enterFrame', () => {
      const currentFrame = anim.currentFrame;
      const progress = (currentFrame / totalFrames) * 100;
      progressSlider.value = progress;

      const currentSec = currentFrame / frameRate;
      currentTimeEl.textContent = formatTime(currentSec);
    });
  }

  // Play/Pause button
  let isPlaying = true;
  playBtn.addEventListener('click', () => {
    if (isPlaying) {
      anim.pause();
      playBtn.innerHTML = '<i class="codicon codicon-play"></i>';
    } else {
      anim.play();
      playBtn.innerHTML = '<i class="codicon codicon-debug-pause"></i>';
    }
    isPlaying = !isPlaying;
  });

  // Progress slider seek
  progressSlider.addEventListener('input', (e) => {
    const progress = parseFloat(e.target.value);
    const frame = (progress / 100) * totalFrames;
    anim.goToAndStop(frame, true);
    if (isPlaying) {
      anim.play();
    }
  });

  // Speed selector
  speedSelect.addEventListener('change', (e) => {
    const speed = parseFloat(e.target.value);
    anim.setSpeed(speed);
  });

  // Loop toggle
  let isLooping = true;
  loopBtn.addEventListener('click', () => {
    isLooping = !isLooping;
    anim.loop = isLooping;
    loopBtn.classList.toggle('active', isLooping);
    // Update icon based on loop state
    const icon = loopBtn.querySelector('i');
    if (isLooping) {
      icon.className = 'codicon codicon-sync';
    } else {
      icon.className = 'codicon codicon-sync-ignored';
    }
  });
}

// Initialize DotLottie player (.lottie files)
function initDotLottiePlayer() {
  const player = document.getElementById('dotLottiePlayer');
  const playBtn = document.getElementById('lottiePlayBtn');
  const progressSlider = document.getElementById('lottieProgress');
  const currentTimeEl = document.getElementById('lottieCurrentTime');
  const durationEl = document.getElementById('lottieDuration');
  const speedSelect = document.getElementById('lottieSpeed');
  const loopBtn = document.getElementById('lottieLoopBtn');

  if (!player) return;

  // Format time as M:SS
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  let isPlaying = true;
  let isLooping = true;
  let totalFrames = 0;
  let frameRate = 30;

  // Wait for player to be ready
  player.addEventListener('ready', () => {
    const lottie = player.getLottie();
    if (lottie) {
      totalFrames = lottie.totalFrames;
      frameRate = lottie.frameRate || 30;
      const durationSec = totalFrames / frameRate;
      durationEl.textContent = formatTime(durationSec);
    }
  });

  // Update progress on each frame (skip for single-frame animations)
  player.addEventListener('frame', (e) => {
    const currentFrame = e.detail.frame;
    if (totalFrames > 1) {
      const progress = (currentFrame / totalFrames) * 100;
      progressSlider.value = progress;
      const currentSec = currentFrame / frameRate;
      currentTimeEl.textContent = formatTime(currentSec);
    }
  });

  // Play/Pause button
  playBtn.addEventListener('click', () => {
    if (isPlaying) {
      player.pause();
      playBtn.innerHTML = '<i class="codicon codicon-play"></i>';
    } else {
      player.play();
      playBtn.innerHTML = '<i class="codicon codicon-debug-pause"></i>';
    }
    isPlaying = !isPlaying;
  });

  // Progress slider seek
  progressSlider.addEventListener('input', (e) => {
    const progress = parseFloat(e.target.value);
    const frame = (progress / 100) * totalFrames;
    player.seek(frame);
    if (!isPlaying) {
      player.pause();
    }
  });

  // Speed selector
  speedSelect.addEventListener('change', (e) => {
    const speed = parseFloat(e.target.value);
    player.setSpeed(speed);
  });

  // Loop toggle
  loopBtn.addEventListener('click', () => {
    isLooping = !isLooping;
    player.setLooping(isLooping);
    loopBtn.classList.toggle('active', isLooping);
    const icon = loopBtn.querySelector('i');
    if (isLooping) {
      icon.className = 'codicon codicon-sync';
    } else {
      icon.className = 'codicon codicon-sync-ignored';
    }
  });
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
    return `rgb(${r}, ${g}, ${b})`;
  }

  return '#000000';
}

// Initialize
const vscode = acquireVsCodeApi();

(async () => {
  initResizers();
  await renderAssetList();

  // Add click handler to left panel to deselect on empty area click
  const assetList = document.getElementById('assetList');
  assetList.addEventListener('click', (e) => {
    const target = e.target;
    // Check if clicked directly on the list container (empty space)
    if (target === assetList) {
      deselectAsset();
    }
  });

  // Add click handler to deselect variant on empty area click
  const previewPanel = document.getElementById('previewPanel');
  previewPanel.addEventListener('click', (e) => {
    const target = e.target;
    // Check if clicked on empty/container areas (not on variants or their children)
    if (target === previewPanel ||
        target.classList.contains('preview-container') ||
        target.classList.contains('preview-content') ||
        target.classList.contains('device-group') ||
        target.classList.contains('slot-grid')) {
      deselectVariant();
    }
  });

  // Quick Look with Space key
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();

      // Check if variant selected
      const selectedVariant = document.querySelector('.variant-item.selected');
      if (selectedVariant) {
        const fsPath = selectedVariant.dataset.imageFspath;
        if (fsPath) {
          vscode.postMessage({ command: 'quicklook', filePath: fsPath });
        }
      }
    }
  });

  // Keyboard navigation for asset list
  document.addEventListener('keydown', (e) => {
    // Only handle arrow keys and Enter when not in input field
    if (e.target.tagName === 'INPUT') return;

    const keys = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter'];
    if (keys.includes(e.key)) {
      e.preventDefault();

      // Get all visible items (folders and assets)
      const visibleItems = Array.from(document.querySelectorAll('.asset-list-item'));
      if (visibleItems.length === 0) return;

      const currentIndex = currentSelectedAssetIndex;
      const currentElement = visibleItems.find(item => parseInt(item.dataset.index) === currentIndex);
      const currentVisibleIndex = visibleItems.indexOf(currentElement);

      if (e.key === 'ArrowDown') {
        if (currentVisibleIndex < visibleItems.length - 1) {
          const nextItem = visibleItems[currentVisibleIndex + 1];
          const nextIndex = parseInt(nextItem.dataset.index);
          selectAsset(nextIndex);
          nextItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else if (currentVisibleIndex === -1 && visibleItems.length > 0) {
          // No selection, select first
          const firstItem = visibleItems[0];
          const firstIndex = parseInt(firstItem.dataset.index);
          selectAsset(firstIndex);
          firstItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      } else if (e.key === 'ArrowUp') {
        if (currentVisibleIndex > 0) {
          const prevItem = visibleItems[currentVisibleIndex - 1];
          const prevIndex = parseInt(prevItem.dataset.index);
          selectAsset(prevIndex);
          prevItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else if (currentVisibleIndex === -1 && visibleItems.length > 0) {
          // No selection, select last
          const lastItem = visibleItems[visibleItems.length - 1];
          const lastIndex = parseInt(lastItem.dataset.index);
          selectAsset(lastIndex);
          lastItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      } else if (e.key === 'ArrowRight') {
        if (currentElement && currentElement.classList.contains('folder')) {
          const folderPath = currentElement.dataset.folderPath;
          if (!expandedFolders.has(folderPath)) {
            // Collapsed -> Expand
            toggleFolder(folderPath);
          } else {
            // Expanded -> Select first child (next visible item)
            if (currentVisibleIndex < visibleItems.length - 1) {
              const nextItem = visibleItems[currentVisibleIndex + 1];
              const nextIndex = parseInt(nextItem.dataset.index);
              selectAsset(nextIndex);
              nextItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          }
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentElement) {
          if (currentElement.classList.contains('folder') && expandedFolders.has(currentElement.dataset.folderPath)) {
            // Expanded -> Collapse
            toggleFolder(currentElement.dataset.folderPath);
          } else {
            // Go to parent
            // Check if we are inside a folder-children container
            // The structure is: div.asset-list-item (sibling) div.folder-children (containing us)
            // Actually, folder-children is a sibling of the parent folder item.
            // But we are inside folder-children.
            const parentContainer = currentElement.parentElement;
            if (parentContainer && parentContainer.classList.contains('folder-children')) {
              const parentPath = parentContainer.dataset.parentPath;
              const parentIndex = allAssets.findIndex(a => a._path === parentPath);
              if (parentIndex >= 0) {
                selectAsset(parentIndex);
                const parentElement = document.querySelector(`.asset-list-item[data-index="${parentIndex}"]`);
                if (parentElement) parentElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              }
            }
          }
        }
      } else if (e.key === 'Enter') {
        // Enter doesn't do anything special for now
      }
    }
  });

  // Context menu handling
  const contextMenu = document.getElementById('contextMenu');
  let contextMenuTargetPath = '';

  // Show context menu on right-click
  assetList.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const target = e.target.closest('.asset-list-item');
    if (target && target.dataset.path) {
      contextMenuTargetPath = target.dataset.path;
      contextMenu.style.display = 'block';
      contextMenu.style.left = e.clientX + 'px';
      contextMenu.style.top = e.clientY + 'px';
    }
  });

  // Hide context menu on click elsewhere
  document.addEventListener('click', () => {
    contextMenu.style.display = 'none';
  });

  // Handle "Show in Finder" click
  document.getElementById('showInFinder').addEventListener('click', () => {
    if (contextMenuTargetPath) {
      vscode.postMessage({ command: 'showInFinder', filePath: contextMenuTargetPath });
    }
    contextMenu.style.display = 'none';
  });

  // Filter input handler
  const filterInput = document.getElementById('filterInput');
  filterInput.addEventListener('input', (e) => {
    filterText = e.target.value;
    renderAssetList().then(() => {
      // Re-apply selection after filter
      if (currentSelectedAssetIndex >= 0) {
        document.querySelectorAll('.asset-list-item').forEach((item) => {
          const itemIndex = item.dataset.index;
          item.classList.toggle('selected', itemIndex !== undefined && parseInt(itemIndex) === currentSelectedAssetIndex);
        });
      }
    });
  });
})();
