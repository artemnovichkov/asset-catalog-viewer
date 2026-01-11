import { allAssets, expandedFolders, filterText, currentSelectedAssetIndex } from './state.js';
import { filterItems } from './assetData.js';
import { escapeHtml, getColorValue, showLoading, hideLoading, formatFileSize } from './utils.js';
import { renderPdfToCanvas } from './pdfRenderer.js';
import { selectAsset } from './selection.js';
import { startRename } from './rename.js';

let imageObserver = null;
let pdfObserver = null;

// Render asset list with hierarchy
export async function renderAssetList(assetsData, vscode) {
  showLoading();
  const listEl = document.getElementById('assetList');

  const filteredItems = filterItems(assetsData.items, filterText);

  function renderItems(items, depth = 0, parentPath = '') {
    let html = '';
    items.forEach((item) => {
      const itemPath = parentPath ? `${parentPath}/${item.name}` : item.name;
      const indent = depth * 16;

      const assetIndex = allAssets.findIndex(a => a._path === itemPath);

      if (item.type === 'folder') {
        const isExpanded = expandedFolders.has(itemPath);
        const chevronClass = isExpanded ? 'expanded' : '';
        const namespaceClass = item.providesNamespace ? ' provides-namespace' : '';
        html += `
          <div class="asset-list-item folder${namespaceClass}" data-index="${assetIndex}" data-folder-path="${itemPath}" data-path="${item.path || ''}" style="padding-left: ${indent + 8}px;" title="${escapeHtml(item.name)}">
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
            const isHeic = firstImage.filename.toLowerCase().endsWith('.heic');
            if (isPdf) {
              iconHtml = `<div class="asset-thumbnail-container"><canvas class="asset-thumbnail-canvas" data-pdf-url="${firstImage.uri}" data-idx="${assetIndex}"></canvas></div>`;
            } else if (isHeic) {
              iconHtml = `<i class="codicon codicon-file-media asset-icon"></i>`;
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
          iconHtml = `<i class="codicon codicon-file asset-icon"></i>`;
        }

        let warningHtml = '';
        if (item.size && assetsData.config && assetsData.config.largeAssetThreshold) {
          const sizeKb = item.size / 1024;
          if (sizeKb > assetsData.config.largeAssetThreshold) {
            warningHtml = `
              <div class="large-asset-warning" title="Large Asset: ${formatFileSize(item.size)} (Threshold: ${assetsData.config.largeAssetThreshold} KB)">
                <i class="codicon codicon-warning"></i>
              </div>
            `;
          }
        }

        html += `<div class="asset-list-item" data-index="${assetIndex}" data-path="${item.path || ''}" style="padding-left: ${indent + 24 + 8}px;" title="${escapeHtml(item.name)}">
          ${iconHtml}
          <span>${escapeHtml(item.name)}</span>
          ${warningHtml}
        </div>`;
      }
    });
    return html;
  }

  listEl.innerHTML = renderItems(filteredItems);

  // Disconnect previous observers
  if (imageObserver) imageObserver.disconnect();
  if (pdfObserver) pdfObserver.disconnect();

  // Lazy load images
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

  // Lazy render PDF thumbnails
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
    const chevron = item.querySelector('.folder-chevron');
    if (chevron) {
      chevron.addEventListener('click', (e) => {
        const folderPath = item.dataset.folderPath;
        toggleFolder(folderPath, assetsData, vscode);
        e.stopPropagation();
      });
    }

    item.addEventListener('click', (e) => {
      const idx = parseInt(item.dataset.index);
      selectAsset(idx, vscode);
    });

    item.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const idx = parseInt(item.dataset.index);
      startRename(idx, vscode);
    });
  });

  // Add click handlers for assets
  listEl.querySelectorAll('.asset-list-item:not(.folder)').forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.dataset.index);
      selectAsset(idx, vscode);
    });

    item.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const idx = parseInt(item.dataset.index);
      startRename(idx, vscode);
    });
  });

  hideLoading();
}

// Toggle folder expand/collapse
export function toggleFolder(folderPath, assetsData, vscode) {
  if (expandedFolders.has(folderPath)) {
    expandedFolders.delete(folderPath);
  } else {
    expandedFolders.add(folderPath);
  }
  // Save expanded folders state
  vscode.setState({ expandedFolders: Array.from(expandedFolders) });
  renderAssetList(assetsData, vscode).then(() => {
    if (currentSelectedAssetIndex >= 0) {
      document.querySelectorAll('.asset-list-item').forEach((item) => {
        const itemIndex = item.dataset.index;
        item.classList.toggle('selected', itemIndex !== undefined && parseInt(itemIndex) === currentSelectedAssetIndex);
      });
    }
  });
}
