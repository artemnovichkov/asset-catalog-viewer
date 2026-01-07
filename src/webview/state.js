// Shared state for webview
export let allAssets = [];
export let currentSelectedAssetIndex = -1;
export let expandedFolders = new Set();
export let filterText = '';
export let isRenaming = false;
export let leftWidth = 250;
export let rightWidth = 300;

// Setters
export const setAllAssets = (v) => { allAssets = v; };
export const setCurrentSelectedAssetIndex = (v) => { currentSelectedAssetIndex = v; };
export const setFilterText = (v) => { filterText = v; };
export const setIsRenaming = (v) => { isRenaming = v; };
export const setLeftWidth = (v) => { leftWidth = v; };
export const setRightWidth = (v) => { rightWidth = v; };
