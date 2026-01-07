// Entry point for webview
import '@dotlottie/player-component';

import {
  allAssets, currentSelectedAssetIndex, expandedFolders,
  setAllAssets, setFilterText, setExpandedFolders
} from './state.js';
import { flattenItems } from './assetData.js';
import { initResizers } from './resizer.js';
import { renderAssetList, toggleFolder } from './assetList.js';
import { selectAsset, deselectAsset, deselectVariant } from './selection.js';
import { startRename, getIsRenaming } from './rename.js';

// Initialize
const vscode = acquireVsCodeApi();
const assetsData = window.assetsData;

// Restore expanded folders from saved state
const savedState = vscode.getState();
if (savedState && savedState.expandedFolders) {
  setExpandedFolders(new Set(savedState.expandedFolders));
}

// Flatten assets for indexing
setAllAssets(flattenItems(assetsData.items));

(async () => {
  initResizers();
  await renderAssetList(assetsData, vscode);

  // Restore selection from saved state
  if (savedState && savedState.selectedAssetPath) {
    const idx = allAssets.findIndex(a => a._path === savedState.selectedAssetPath);
    if (idx >= 0) {
      selectAsset(idx, vscode);
      // Clear saved selection after restoring
      vscode.setState({ expandedFolders: savedState.expandedFolders });
    }
  }

  // Click on empty area deselects
  const assetList = document.getElementById('assetList');
  assetList.addEventListener('click', (e) => {
    if (e.target === assetList) {
      deselectAsset();
    }
  });

  // Click on preview empty area deselects variant
  const previewPanel = document.getElementById('previewPanel');
  previewPanel.addEventListener('click', (e) => {
    const target = e.target;
    if (target === previewPanel ||
        target.classList.contains('preview-container') ||
        target.classList.contains('preview-content') ||
        target.classList.contains('device-group') ||
        target.classList.contains('slot-grid')) {
      deselectVariant(vscode);
    }
  });

  // Quick Look with Space key
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      const selectedVariant = document.querySelector('.variant-item.selected');
      if (selectedVariant) {
        const fsPath = selectedVariant.dataset.imageFspath;
        if (fsPath) {
          vscode.postMessage({ command: 'quicklook', filePath: fsPath });
        }
      }
    }
  });

  // Delete selected asset
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.repeat) {
      if (e.target.tagName === 'INPUT' || getIsRenaming()) return;

      if (currentSelectedAssetIndex >= 0) {
        e.preventDefault();
        const asset = allAssets[currentSelectedAssetIndex];
        if (asset && asset.path) {
          vscode.postMessage({
            command: 'delete',
            filePath: asset.path,
            assetName: asset.name,
            assetType: asset.type
          });
        }
      }
    }
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;

    const keys = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter'];
    if (keys.includes(e.key)) {
      e.preventDefault();

      const visibleItems = Array.from(document.querySelectorAll('.asset-list-item'));
      if (visibleItems.length === 0) return;

      const currentIndex = currentSelectedAssetIndex;
      const currentElement = visibleItems.find(item => parseInt(item.dataset.index) === currentIndex);
      const currentVisibleIndex = visibleItems.indexOf(currentElement);

      if (e.key === 'ArrowDown') {
        if (currentVisibleIndex < visibleItems.length - 1) {
          const nextItem = visibleItems[currentVisibleIndex + 1];
          const nextIndex = parseInt(nextItem.dataset.index);
          selectAsset(nextIndex, vscode);
          nextItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else if (currentVisibleIndex === -1 && visibleItems.length > 0) {
          const firstItem = visibleItems[0];
          const firstIndex = parseInt(firstItem.dataset.index);
          selectAsset(firstIndex, vscode);
          firstItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      } else if (e.key === 'ArrowUp') {
        if (currentVisibleIndex > 0) {
          const prevItem = visibleItems[currentVisibleIndex - 1];
          const prevIndex = parseInt(prevItem.dataset.index);
          selectAsset(prevIndex, vscode);
          prevItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else if (currentVisibleIndex === -1 && visibleItems.length > 0) {
          const lastItem = visibleItems[visibleItems.length - 1];
          const lastIndex = parseInt(lastItem.dataset.index);
          selectAsset(lastIndex, vscode);
          lastItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      } else if (e.key === 'ArrowRight') {
        if (currentElement && currentElement.classList.contains('folder')) {
          const folderPath = currentElement.dataset.folderPath;
          if (!expandedFolders.has(folderPath)) {
            toggleFolder(folderPath, assetsData, vscode);
          } else {
            if (currentVisibleIndex < visibleItems.length - 1) {
              const nextItem = visibleItems[currentVisibleIndex + 1];
              const nextIndex = parseInt(nextItem.dataset.index);
              selectAsset(nextIndex, vscode);
              nextItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          }
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentElement) {
          if (currentElement.classList.contains('folder') && expandedFolders.has(currentElement.dataset.folderPath)) {
            toggleFolder(currentElement.dataset.folderPath, assetsData, vscode);
          } else {
            const parentContainer = currentElement.parentElement;
            if (parentContainer && parentContainer.classList.contains('folder-children')) {
              const parentPath = parentContainer.dataset.parentPath;
              const parentIndex = allAssets.findIndex(a => a._path === parentPath);
              if (parentIndex >= 0) {
                selectAsset(parentIndex, vscode);
                const parentElement = document.querySelector(`.asset-list-item[data-index="${parentIndex}"]`);
                if (parentElement) parentElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              }
            }
          }
        }
      } else if (e.key === 'Enter') {
        if (currentSelectedAssetIndex >= 0 && !getIsRenaming()) {
          startRename(currentSelectedAssetIndex, vscode);
        }
      }
    }
  });

  // Context menu
  const contextMenu = document.getElementById('contextMenu');
  let contextMenuTargetPath = '';

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

  document.addEventListener('click', () => {
    contextMenu.style.display = 'none';
  });

  document.getElementById('showInFinder').addEventListener('click', () => {
    if (contextMenuTargetPath) {
      vscode.postMessage({ command: 'showInFinder', filePath: contextMenuTargetPath });
    }
    contextMenu.style.display = 'none';
  });

  // Filter input
  const filterInput = document.getElementById('filterInput');
  filterInput.addEventListener('input', (e) => {
    setFilterText(e.target.value);
    renderAssetList(assetsData, vscode).then(() => {
      if (currentSelectedAssetIndex >= 0) {
        document.querySelectorAll('.asset-list-item').forEach((item) => {
          const itemIndex = item.dataset.index;
          item.classList.toggle('selected', itemIndex !== undefined && parseInt(itemIndex) === currentSelectedAssetIndex);
        });
      }
    });
  });
})();
