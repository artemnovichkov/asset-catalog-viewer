import { allAssets, currentSelectedAssetIndex, setCurrentSelectedAssetIndex } from './state.js';
import { renderPreview } from './preview.js';
import { renderProperties } from './properties.js';

// Select asset by index
export function selectAsset(index, vscode) {
  setCurrentSelectedAssetIndex(index);

  document.querySelectorAll('.asset-list-item').forEach((item) => {
    const itemIndex = item.dataset.index;
    item.classList.toggle('selected', itemIndex !== undefined && parseInt(itemIndex) === index);
  });

  const asset = allAssets[index];
  if (asset.type === 'folder') {
    document.getElementById('previewPanel').innerHTML = '<div class="empty-state">Folder</div>';
  } else {
    renderPreview(asset, vscode);
  }
  renderProperties(asset, vscode);
}

// Deselect current asset
export function deselectAsset() {
  setCurrentSelectedAssetIndex(-1);

  document.querySelectorAll('.asset-list-item').forEach(item => {
    item.classList.remove('selected');
  });

  document.getElementById('previewPanel').innerHTML = '<div class="empty-state">No Selection</div>';
  document.getElementById('propertiesPanel').innerHTML = '<div class="empty-state">No asset selected</div>';
}

// Deselect variant within current asset
export function deselectVariant(vscode) {
  const idx = currentSelectedAssetIndex;
  if (idx >= 0) {
    const panel = document.getElementById('previewPanel');
    panel.querySelectorAll('.variant-item').forEach(v => {
      v.classList.remove('selected');
    });

    const asset = allAssets[idx];
    renderProperties(asset, vscode);
  }
}
