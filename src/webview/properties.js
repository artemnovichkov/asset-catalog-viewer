import { escapeHtml } from './utils.js';

// Constants
const ALL_DEVICES = [
  { id: 'iphone', label: 'iPhone' },
  { id: 'ipad', label: 'iPad' },
  { id: 'mac-catalyst', label: 'Mac Catalyst Scaled', indent: true },
  { id: 'car', label: 'CarPlay' },
  { id: 'vision', label: 'Apple Vision' },
  { id: 'watch', label: 'Apple Watch' },
  { id: 'tv', label: 'Apple TV' }
];

// Helper: collect idioms from items array
function collectIdioms(items, subtypeKey = 'subtype', idiomKey = 'idiom') {
  const idioms = new Set();
  items.forEach(item => {
    if (item[subtypeKey] === 'mac-catalyst') {
      idioms.add('mac-catalyst');
    } else {
      idioms.add(item[idiomKey] || 'universal');
    }
  });
  return idioms;
}

// Helper: generate devices HTML with checkboxes
function renderDevicesHtml(idioms) {
  const universalHtml = idioms.has('universal')
    ? '<div style="padding: 2px 0; margin-bottom: 4px;">☑ Universal</div>'
    : '';

  const devicesHtml = ALL_DEVICES.map(device => {
    const checked = idioms.has(device.id) ? '☑' : '☐';
    const indent = device.indent ? 'padding-left: 16px;' : '';
    return `<div style="padding: 2px 0; ${indent}">${checked} ${device.label}</div>`;
  }).join('');

  return universalHtml + devicesHtml;
}

// Helper: get appearances text from color items
function getAppearancesText(colorItems) {
  const hasLuminosity = new Set();
  const hasContrast = new Set();

  colorItems.forEach(item => {
    (item.appearances || []).forEach(app => {
      if (app.appearance === 'luminosity') hasLuminosity.add(app.value);
      else if (app.appearance === 'contrast') hasContrast.add(app.value);
    });
  });

  if (!hasLuminosity.has('light') && !hasLuminosity.has('dark') && !hasContrast.has('high')) {
    return 'None';
  }

  const parts = ['Any'];
  if (hasLuminosity.has('light')) parts.push('Light');
  if (hasLuminosity.has('dark')) parts.push('Dark');
  let text = parts.join(', ');
  if (hasContrast.has('high')) text += ' + High Contrast';
  return text;
}

// Helper: get gamut from color items
function getGamut(colorItems) {
  for (const item of colorItems) {
    if (item.color?.['color-space']) {
      return item.color['color-space'].toUpperCase();
    }
  }
  return 'Any';
}

// Helper: load image dimensions
async function loadImageDimensions(uri) {
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = uri;
    });
    return { width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    return { width: 0, height: 0 };
  }
}

// Helper: format image size text
function formatImageSize(width, height) {
  return width && height ? `${width} × ${height} pixels` : 'Unknown';
}

// Helper: property row HTML
function row(label, value, opts = {}) {
  const style = opts.alignTop ? ' style="align-items: flex-start;"' : '';
  const valueStyle = opts.flex ? ' style="flex: 1;"' : '';
  return `
    <div class="property-row"${style}>
      <span class="property-row-label">${label}</span>
      <div class="property-row-value"${valueStyle}>${value}</div>
    </div>`;
}

// Helper: name row with finder button
function nameRow(name, path) {
  return `
    <div class="property-row">
      <span class="property-row-label">Name</span>
      <div class="property-row-value" style="flex: 1;">${escapeHtml(name)}</div>
      <button class="finder-button" data-path="${path}">
        <i class="codicon codicon-folder-opened"></i>
      </button>
    </div>`;
}

// Helper: property section HTML
function section(title, content, opts = {}) {
  const style = opts.border
    ? ' style="border-top: 1px solid var(--vscode-panel-border); padding-top: 16px; margin-top: 16px;"'
    : '';
  return `
    <div class="property-section"${style}>
      <div class="property-title">${title}</div>
      ${content}
    </div>`;
}

// Helper: add finder button handler
function addFinderButtonHandler(panel, vscode) {
  const btn = panel.querySelector('.finder-button');
  if (btn) {
    btn.addEventListener('click', (e) => {
      const path = e.currentTarget.dataset.path;
      if (path) vscode.postMessage({ command: 'showInFinder', filePath: path });
    });
  }
}

// Helper: render to panel
function render(panel, html, vscode) {
  panel.innerHTML = html;
  addFinderButtonHandler(panel, vscode);
}

// Render color properties for specific variant
export function renderColorProperties(asset, colorIndex, vscode) {
  const panel = document.getElementById('propertiesPanel');
  const colorItem = asset.colors[colorIndex];
  const idioms = collectIdioms(asset.colors);

  const color = colorItem.color || {};
  const colorSpace = color['color-space'] || 'srgb';
  const components = color.components || {};

  let componentsHtml = '';
  if (components.red !== undefined) {
    const r = parseFloat(components.red);
    const g = parseFloat(components.green);
    const b = parseFloat(components.blue);
    const a = components.alpha !== undefined ? parseFloat(components.alpha) : 1;
    componentsHtml = row('Components', `R: ${r}, G: ${g}, B: ${b}, A: ${a}`);
  }

  const html = `
    ${section('Color Set', `
      ${nameRow(asset.name, asset.path)}
      <div class="property-row" style="align-items: flex-start;">
        <span class="property-row-label">Devices</span>
        <div style="font-size: 12px; line-height: 1.5;">${renderDevicesHtml(idioms)}</div>
      </div>
      ${row('Appearances', getAppearancesText(asset.colors))}
      ${row('Gamut', getGamut(asset.colors))}
    `)}
    ${section('Color', `
      ${row('Color Space', colorSpace)}
      ${componentsHtml}
    `, { border: true })}
  `;

  render(panel, html, vscode);
}

// Render app icon variant properties
export async function renderAppIconVariantProperties(asset, filename, uri, size, scale, appearance, vscode) {
  const panel = document.getElementById('propertiesPanel');
  const { width, height } = await loadImageDimensions(uri);

  const platforms = [...new Set(asset.icons.map(i => i.platform).filter(Boolean))];
  const platformsList = platforms.join(', ') || 'iOS';

  const scaleOrAppearanceHtml = scale
    ? row('Scale', scale)
    : row('Appearance', appearance);

  const html = `
    ${section('App Icon', `
      ${nameRow(asset.name, asset.path)}
      ${row('Platforms', platformsList)}
    `)}
    ${section('Icon', `
      ${row('Size', size)}
      ${scaleOrAppearanceHtml}
      ${row('File Name', escapeHtml(filename))}
      ${row('Image Size', formatImageSize(width, height))}
    `, { border: true })}
  `;

  render(panel, html, vscode);
}

// Render image variant properties
export async function renderImageVariantProperties(asset, filename, uri, scale, vscode) {
  const panel = document.getElementById('propertiesPanel');
  const { width, height } = await loadImageDimensions(uri);
  const idioms = collectIdioms(asset.images);

  const uniqueScales = [...new Set(asset.images.map(i => i.scale))];
  const scalesText = uniqueScales.length <= 1 ? 'Single Scale' : 'Individual Scales';
  const renderAsText = asset.templateRenderingIntent === 'template' ? 'Template Image' :
    asset.templateRenderingIntent === 'original' ? 'Original Image' : 'Default';

  const html = `
    ${section('Image Set', `
      ${nameRow(asset.name, asset.path)}
      ${row('Render As', renderAsText)}
      <div class="property-row" style="align-items: flex-start;">
        <span class="property-row-label">Devices</span>
        <div style="font-size: 12px; line-height: 1.5;">${renderDevicesHtml(idioms)}</div>
      </div>
      ${row('Scales', scalesText)}
    `)}
    ${section('Image', `
      ${row('File Name', escapeHtml(filename))}
      ${row('Image Size', formatImageSize(width, height))}
      ${row('Color Space', 'sRGB IEC61966-2.1')}
    `, { border: true })}
  `;

  render(panel, html, vscode);
}

// Render general properties for asset
export function renderProperties(asset, vscode) {
  const panel = document.getElementById('propertiesPanel');
  let html = '';

  if (asset.type === 'image') {
    const idioms = collectIdioms(asset.images);
    const uniqueScales = [...new Set(asset.images.map(i => i.scale))];
    const scalesText = uniqueScales.length <= 1 ? 'Single Scale' : 'Individual Scales';
    const renderAsText = asset.templateRenderingIntent === 'template' ? 'Template Image' :
      asset.templateRenderingIntent === 'original' ? 'Original Image' : 'Default';

    html = section('Image Set', `
      ${nameRow(asset.name, asset.path)}
      ${row('Render As', renderAsText)}
      <div class="property-row" style="align-items: flex-start;">
        <span class="property-row-label">Devices</span>
        <div style="font-size: 12px; line-height: 1.5;">${renderDevicesHtml(idioms)}</div>
      </div>
      ${row('Scales', scalesText)}
    `);
  } else if (asset.type === 'appicon') {
    const platformSizes = { ios: new Set(), macos: new Set(), watchos: new Set() };

    asset.icons.forEach(icon => {
      let platform = icon.platform;
      if (!platform && icon.idiom === 'mac') platform = 'macos';
      if (!platform && icon.idiom === 'watch') platform = 'watchos';
      platform = platform || 'ios';
      if (platformSizes[platform] && icon.size) platformSizes[platform].add(icon.size);
    });

    const getPlatformValue = (platform, hasSingleSizeOption) => {
      const sizes = platformSizes[platform];
      if (sizes.size === 0) return 'None';
      if (hasSingleSizeOption && sizes.size === 1) return 'Single Size';
      return 'All Sizes';
    };

    html = section('App Icon', `
      ${nameRow(asset.name, asset.path)}
      ${row('iOS', getPlatformValue('ios', true))}
      ${row('macOS', getPlatformValue('macos', false))}
      ${row('watchOS', getPlatformValue('watchos', true))}
    `);
  } else if (asset.type === 'color') {
    const idioms = collectIdioms(asset.colors);

    html = section('Color Set', `
      ${nameRow(asset.name, asset.path)}
      <div class="property-row" style="align-items: flex-start;">
        <span class="property-row-label">Devices</span>
        <div style="font-size: 12px; line-height: 1.5;">${renderDevicesHtml(idioms)}</div>
      </div>
      ${row('Appearances', getAppearancesText(asset.colors))}
      ${row('Gamut', getGamut(asset.colors))}
    `);
  } else if (asset.type === 'data') {
    html = section('Data Set', nameRow(asset.name, asset.path));
  } else if (asset.type === 'folder') {
    html = section('Folder', nameRow(asset.name, asset.path));
  }

  render(panel, html, vscode);
}
