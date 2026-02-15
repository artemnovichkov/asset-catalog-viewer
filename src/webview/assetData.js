// Flatten items into assets array (including folders)
// Add unique path to each asset for reliable indexing
export function flattenItems(items, parentPath = '', parentNamespace = '') {
  const assets = [];
  items.forEach(item => {
    const currentNamespace = item.providesNamespace
      ? (parentNamespace ? `${parentNamespace}.${item.name}` : item.name)
      : parentNamespace;

    if (item.type === 'folder') {
      const folderPath = parentPath ? `${parentPath}/${item.name}` : item.name;
      assets.push({ ...item, _path: folderPath, parentNamespace });
      assets.push(...flattenItems(item.children || [], folderPath, currentNamespace));
    } else {
      const itemPath = parentPath ? `${parentPath}/${item.name}` : item.name;
      assets.push({ ...item, _path: itemPath, parentNamespace });
    }
  });
  return assets;
}

// Filter items recursively by search text
export function filterItems(items, searchText) {
  if (!searchText) return items;

  const lowerSearch = searchText.toLowerCase();

  return items.filter(item => {
    if (item.type === 'folder') {
      const filteredChildren = filterItems(item.children || [], searchText);
      return filteredChildren.length > 0;
    } else {
      return item.name.toLowerCase().includes(lowerSearch);
    }
  }).map(item => {
    if (item.type === 'folder') {
      return {
        ...item,
        children: filterItems(item.children || [], searchText)
      };
    }
    return item;
  });
}

// Find item in tree by its filesystem path
export function findItemByPath(items, targetPath) {
  for (const item of items) {
    if (item.path === targetPath) return item;
    if (item.type === 'folder' && item.children) {
      const found = findItemByPath(item.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}
