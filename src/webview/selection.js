import { allAssets, currentSelectedAssetIndex, selectedIndices, setCurrentSelectedAssetIndex, setSelectedIndices } from './state.js';
import { renderPreview, renderMultiPreview } from './preview.js';
import { renderProperties } from './properties.js';

// Select asset by index
export function selectAsset(index, vscode, shiftKey = false, metaKey = false) {
  if (shiftKey && currentSelectedAssetIndex >= 0) {
    // Range selection with Shift
    const newSelection = new Set(selectedIndices);
    // Get visible items to respect hierarchy/filtering
    const visibleItems = Array.from(document.querySelectorAll('.asset-list-item'));
    const visibleIndices = visibleItems.map(item => parseInt(item.dataset.index)).filter(i => !isNaN(i));

    // Find range in visible items
    const startVisibleIdx = visibleIndices.indexOf(currentSelectedAssetIndex);
    const endVisibleIdx = visibleIndices.indexOf(index);

    if (startVisibleIdx >= 0 && endVisibleIdx >= 0) {
      const rangeStart = Math.min(startVisibleIdx, endVisibleIdx);
      const rangeEnd = Math.max(startVisibleIdx, endVisibleIdx);
      for (let i = rangeStart; i <= rangeEnd; i++) {
        newSelection.add(visibleIndices[i]);
      }
    }

    setSelectedIndices(newSelection);
    updateSelectionUI();
    renderMultiSelection(vscode);
  } else if (metaKey) {
    // Toggle selection with Cmd/Ctrl
    const newSelection = new Set(selectedIndices);
    if (newSelection.has(index)) {
      newSelection.delete(index);
      // Update anchor to another selected item if available
      if (newSelection.size > 0) {
        setCurrentSelectedAssetIndex(Array.from(newSelection)[newSelection.size - 1]);
      } else {
        setCurrentSelectedAssetIndex(-1);
      }
    } else {
      newSelection.add(index);
      setCurrentSelectedAssetIndex(index);
    }

    setSelectedIndices(newSelection);
    updateSelectionUI();
    renderMultiSelection(vscode);
  } else {
    // Single selection
    setCurrentSelectedAssetIndex(index);
    setSelectedIndices(new Set([index]));
    updateSelectionUI();

    const asset = allAssets[index];
    renderPreview(asset, vscode);
    renderProperties(asset, vscode);
  }
}

// Update selection UI
function updateSelectionUI() {
  document.querySelectorAll('.asset-list-item').forEach((item) => {
    const itemIndex = parseInt(item.dataset.index);
    item.classList.toggle('selected', !isNaN(itemIndex) && selectedIndices.has(itemIndex));
  });
}

// Render multi-selection preview
function renderMultiSelection(vscode) {
  const snippetsPanel = document.getElementById('snippetsPanel');

  if (selectedIndices.size === 0) {
    document.getElementById('previewPanel').innerHTML = '<div class="empty-state">No Selection</div>';
    document.getElementById('propertiesPanel').innerHTML = '<div class="empty-state">No asset selected</div>';
    if (snippetsPanel) snippetsPanel.innerHTML = '';
    return;
  }

  const assets = Array.from(selectedIndices)
    .map(idx => allAssets[idx])
    .filter(a => a && a.type !== 'folder');

  if (assets.length === 0) {
    // Only folders selected
    document.getElementById('previewPanel').innerHTML = '<div class="empty-state">Folders selected</div>';
    document.getElementById('propertiesPanel').innerHTML = '<div class="empty-state">Not Applicable</div>';
    if (snippetsPanel) snippetsPanel.innerHTML = '';
  } else if (assets.length === 1 && selectedIndices.size === 1) {
    renderPreview(assets[0], vscode);
    renderProperties(assets[0], vscode);
  } else {
    renderMultiPreview(assets, vscode);
    document.getElementById('propertiesPanel').innerHTML = '<div class="empty-state">Not Applicable</div>';
    if (snippetsPanel) snippetsPanel.innerHTML = '';
  }
}

// Deselect current asset
export function deselectAsset() {
  setCurrentSelectedAssetIndex(-1);
  setSelectedIndices(new Set());

  document.querySelectorAll('.asset-list-item').forEach(item => {
    item.classList.remove('selected');
  });

  document.getElementById('previewPanel').innerHTML = '<div class="empty-state">No Selection</div>';
  document.getElementById('propertiesPanel').innerHTML = '<div class="empty-state">No asset selected</div>';
  const snippetsPanel = document.getElementById('snippetsPanel');
  if (snippetsPanel) snippetsPanel.innerHTML = '';
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
