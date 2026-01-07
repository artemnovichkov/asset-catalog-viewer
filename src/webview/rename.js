import { allAssets, isRenaming, setIsRenaming } from './state.js';

// Start rename mode for an asset
export function startRename(index, vscode) {
  if (isRenaming) return;
  setIsRenaming(true);

  const asset = allAssets[index];
  const listItem = document.querySelector(`.asset-list-item[data-index="${index}"]`);
  if (!listItem) {
    setIsRenaming(false);
    return;
  }

  const nameSpan = listItem.querySelector('span');
  if (!nameSpan) {
    setIsRenaming(false);
    return;
  }

  const currentName = asset.name;

  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentName;
  input.className = 'rename-input';
  input.style.cssText = `
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-focusBorder);
    padding: 2px 4px;
    font-size: inherit;
    font-family: inherit;
    outline: none;
    width: 100%;
    box-sizing: border-box;
  `;

  nameSpan.replaceWith(input);
  input.focus();
  input.select();

  const finishRename = (save) => {
    if (!isRenaming) return;
    setIsRenaming(false);

    const newName = input.value.trim();

    if (save && newName && newName !== currentName) {
      vscode.postMessage({
        command: 'rename',
        oldPath: asset.path,
        oldName: currentName,
        newName: newName,
        assetType: asset.type
      });
    } else {
      const newSpan = document.createElement('span');
      newSpan.textContent = currentName;
      input.replaceWith(newSpan);
    }
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      finishRename(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      finishRename(false);
    }
  });

  input.addEventListener('blur', () => {
    setTimeout(() => finishRename(true), 100);
  });
}

// Check if currently renaming
export function getIsRenaming() {
  return isRenaming;
}
