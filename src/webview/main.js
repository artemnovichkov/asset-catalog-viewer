// Entry point for webview
import '@dotlottie/player-component';

import {
  allAssets, currentSelectedAssetIndex, selectedIndices, expandedFolders,
  setAllAssets, setFilterText, setExpandedFolders
} from './state.js';
import { flattenItems, findItemByPath } from './assetData.js';
import { initResizers } from './resizer.js';
import { renderAssetList, toggleFolder } from './assetList.js';
import { selectAsset, deselectAsset, deselectVariant } from './selection.js';
import { startRename, getIsRenaming } from './rename.js';
import { componentTo255 } from './utils.js';

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

  // Delete selected assets or selected image variant
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.repeat) {
      if (e.target.tagName === 'INPUT' || getIsRenaming()) return;

      // Check if an image variant is selected in the preview panel
      const selectedVariant = document.querySelector('.variant-item.selected[data-image-filename]');
      if (selectedVariant && selectedVariant.dataset.imageFspath) {
        e.preventDefault();
        const asset = allAssets[currentSelectedAssetIndex];
        if (asset && asset.path) {
          // Save selection so it persists across refresh
          const state = vscode.getState() || {};
          vscode.setState({ ...state, selectedAssetPath: asset._path });
          vscode.postMessage({
            command: 'removeImageFromSet',
            assetPath: asset.path,
            filename: selectedVariant.dataset.imageFilename
          });
        }
        return;
      }

      if (selectedIndices.size > 0) {
        e.preventDefault();
        const paths = Array.from(selectedIndices)
          .map(idx => allAssets[idx])
          .filter(a => a && a.path)
          .map(a => a.path);

        if (paths.length > 0) {
          vscode.postMessage({
            command: 'deleteMultiple',
            filePaths: paths
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
      if (selectedIndices.size > 0) {
        document.querySelectorAll('.asset-list-item').forEach((item) => {
          const itemIndex = parseInt(item.dataset.index);
          item.classList.toggle('selected', !isNaN(itemIndex) && selectedIndices.has(itemIndex));
        });
      }
    });
  });

  // Add asset menu
  const addAssetButton = document.getElementById('addAssetButton');
  const addAssetMenu = document.getElementById('addAssetMenu');

  addAssetButton.addEventListener('click', (e) => {
    e.stopPropagation();
    addAssetMenu.classList.toggle('visible');
  });

  document.addEventListener('click', (e) => {
    if (!addAssetMenu.contains(e.target) && e.target !== addAssetButton) {
      addAssetMenu.classList.remove('visible');
    }
  });

  document.getElementById('addColorSet').addEventListener('click', () => {
    let targetFolderPath = null;
    if (currentSelectedAssetIndex >= 0) {
      const selected = allAssets[currentSelectedAssetIndex];
      if (selected.type === 'folder') {
        targetFolderPath = selected.path;
      }
    }
    vscode.postMessage({ command: 'addColorSet', targetFolderPath });
    addAssetMenu.classList.remove('visible');
  });

  document.getElementById('addImageSet').addEventListener('click', () => {
    let targetFolderPath = null;
    if (currentSelectedAssetIndex >= 0) {
      const selected = allAssets[currentSelectedAssetIndex];
      if (selected.type === 'folder') {
        targetFolderPath = selected.path;
      }
    }
    vscode.postMessage({ command: 'addImageSet', targetFolderPath });
    addAssetMenu.classList.remove('visible');
  });

  // Handle messages from extension
  window.addEventListener('message', (event) => {
    const message = event.data;
    if (message.command === 'imageSetCreated') {
      const newPath = message.path;
      const idx = allAssets.findIndex(a => a.path === newPath);
      if (idx >= 0) {
        selectAsset(idx, vscode);
      }
    } else if (message.command === 'colorSetCreated') {
      // Find and select the new colorset after refresh
      const newPath = message.path;
      const idx = allAssets.findIndex(a => a.path === newPath);
      if (idx >= 0) {
        selectAsset(idx, vscode);
      }
    } else if (message.command === 'colorUpdated') {
      // Update color in-place without full refresh
      const { colorSetPath, colorIndex, newColor } = message;
      const asset = allAssets.find(a => a.path === colorSetPath);
      if (asset && asset.type === 'color' && asset.colors[colorIndex]) {
        asset.colors[colorIndex].color = newColor;

        // Update color swatches in preview and left panel
        if (newColor.components) {
          const c = newColor.components;
          const r = componentTo255(c.red || '0');
          const g = componentTo255(c.green || '0');
          const b = componentTo255(c.blue || '0');
          const a = parseFloat(c.alpha || 1);
          const rgba = `rgba(${r}, ${g}, ${b}, ${a})`;
          const variantItem = document.querySelector(`.variant-item[data-color-index="${colorIndex}"]`);
          if (variantItem) {
            const colorSlot = variantItem.querySelector('.color-slot');
            if (colorSlot) colorSlot.style.backgroundColor = rgba;
          }
          const thumb = document.querySelector(`.asset-list-item[data-path="${colorSetPath}"] .asset-thumbnail`);
          if (thumb) thumb.style.backgroundColor = rgba;
        }

        // Re-render properties only for external updates (not inline editor)
        if (message.source !== 'inline') {
          const selectedVariant = document.querySelector('.variant-item.selected[data-color-index]');
          if (selectedVariant && parseInt(selectedVariant.dataset.colorIndex) === colorIndex) {
            import('./properties.js').then(({ renderColorProperties }) => {
              renderColorProperties(asset, colorIndex, vscode);
            });
          }
        }
      }
    } else if (message.command === 'namespaceUpdated') {
      // Update folder namespace state in-place
      const { folderPath, providesNamespace } = message;
      
      // Update in flat list
      const asset = allAssets.find(a => a.path === folderPath);
      if (asset && asset.type === 'folder') {
        asset.providesNamespace = providesNamespace;
      }

      // Update in source tree (crucial for re-flattening to work)
      const treeItem = findItemByPath(assetsData.items, folderPath);
      if (treeItem) {
        treeItem.providesNamespace = providesNamespace;
      }

      // Update the folder icon in left panel
      const folderItem = document.querySelector(`.asset-list-item.folder[data-path="${folderPath}"]`);
      if (folderItem) {
        if (providesNamespace) {
          folderItem.classList.add('provides-namespace');
        } else {
          folderItem.classList.remove('provides-namespace');
        }
      }

      // Re-flatten assets to update parentNamespace for all children
      setAllAssets(flattenItems(assetsData.items));

      // Re-render properties to update snippets
      if (currentSelectedAssetIndex >= 0) {
        import('./properties.js').then(({ renderProperties }) => {
          renderProperties(allAssets[currentSelectedAssetIndex], vscode);
        });
      }
    } else if (message.command === 'preservesVectorUpdated') {
      // Update image set preserves vector state in-place
      const { imageSetPath, preservesVector } = message;
      const asset = allAssets.find(a => a.path === imageSetPath);
      if (asset && asset.type === 'image') {
        asset.preservesVectorRepresentation = preservesVector;
      }
    } else if (message.command === 'renderAsUpdated') {
      // Update image set render as state in-place
      const { imageSetPath, renderAs } = message;
      const asset = allAssets.find(a => a.path === imageSetPath);
      if (asset && asset.type === 'image') {
        asset.templateRenderingIntent = renderAs === 'default' ? undefined : renderAs;
      }
    } else if (message.command === 'compressionUpdated') {
      // Update image set compression state in-place
      const { imageSetPath, compressionType } = message;
      const asset = allAssets.find(a => a.path === imageSetPath);
      if (asset && asset.type === 'image') {
        asset.compressionType = compressionType === 'inherited' ? undefined : compressionType;
      }
    }
  });
})();
