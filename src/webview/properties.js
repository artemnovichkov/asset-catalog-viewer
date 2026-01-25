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

// Helper: get appearances text from items with appearances array
function getAppearancesText(items) {
  const hasLuminosity = new Set();
  const hasContrast = new Set();

  items.forEach(item => {
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

// Helper: get gamut from color items (checks for display-gamut appearances)
function getGamut(colorItems) {
  for (const item of colorItems) {
    const appearances = item.appearances || [];
    for (const app of appearances) {
      if (app.appearance === 'display-gamut' && app.value === 'display-p3') {
        return 'Display P3';
      }
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
  const rowClass = opts.alignTop ? 'property-row align-top' : 'property-row';
  const valueStyle = opts.flex ? ' style="flex: 1;"' : '';
  return `
    <div class="${rowClass}">
      <span class="property-row-label">${label}</span>
      <div class="property-row-value"${valueStyle}>${value}</div>
    </div>`;
}

// Helper: name row with finder button
function nameRow(name, path) {
  return `
    <div class="property-row align-top">
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

// Helper: convert string to camelCase (e.g. "brand-color" -> "brandColor", "My Icon" -> "myIcon")
function toCamelCase(str) {
  return str
    .replace(/[^a-zA-Z0-9]/g, ' ') // Replace non-alphanumeric with space
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, '');
}

// Helper: render SwiftUI snippets
function renderSnippets(asset) {
  const snippetsPanel = document.getElementById('snippetsPanel');
  if (!snippetsPanel) return;

  const templates = window.assetsData?.config?.templates;
  if (!templates) {
    snippetsPanel.innerHTML = '';
    return;
  }

  let template = '';
  if (asset.type === 'color') {
    template = templates.color;
  } else if (asset.type === 'image') {
    template = templates.image;
  } else if (asset.type === 'data') {
    template = templates.data;
  }

  if (!template) {
    snippetsPanel.innerHTML = '';
    return;
  }

  let name = asset.name;
  let processedName;

  if (asset.type === 'data') {
    processedName = name;
  } else {
    // Remove suffixes like "Color", "Icon", "Image" (case-insensitive) for colors and images
    name = name.replace(/(?:Color|Icon|Image)$/i, '');
    processedName = toCamelCase(name);
  }

  const code = template.replace('{name}', processedName);

  snippetsPanel.innerHTML = `
    <div class="snippets-section">
      <div class="property-title">SwiftUI Code Snippets</div>
      <div class="snippet-container">
        <code class="snippet-code">${escapeHtml(code)}</code>
        <button class="copy-button" id="copySnippetBtn" title="Copy to clipboard" data-code="${escapeHtml(code)}">
          <i class="codicon codicon-copy"></i>
        </button>
      </div>
    </div>
  `;

  // Add click handler for copy button
  const copyBtn = document.getElementById('copySnippetBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const codeToCopy = copyBtn.dataset.code;
      if (codeToCopy) {
        navigator.clipboard.writeText(codeToCopy).then(() => {
          // Visual feedback
          copyBtn.classList.add('copied');
          const originalIcon = copyBtn.innerHTML;
          copyBtn.innerHTML = '<i class="codicon codicon-check"></i>';
          setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.innerHTML = originalIcon;
          }, 2000);
        });
      }
    });
  }
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
      <div class="property-row align-top">
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
  renderSnippets(asset);
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
  renderSnippets(asset);
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
  const preservesVectorCheckbox = asset.preservesVectorRepresentation ? '☑' : '☐';

  const html = `
    ${section('Image Set', `
      ${nameRow(asset.name, asset.path)}
      ${row('Render As', renderAsText)}
      ${row('Compression', getCompressionText(asset.compressionType))}
      <div class="property-row align-top">
        <span class="property-row-label">Resizing</span>
        <div style="font-size: 12px; line-height: 1.5;">
          <div style="padding: 2px 0;">${preservesVectorCheckbox} Preserve Vector Data</div>
        </div>
      </div>
      <div class="property-row align-top">
        <span class="property-row-label">Devices</span>
        <div style="font-size: 12px; line-height: 1.5;">${renderDevicesHtml(idioms)}</div>
      </div>
      ${row('Appearances', getAppearancesText(asset.images))}
      ${row('Scales', scalesText)}
    `)}
    ${section('Image', `
      ${row('File Name', escapeHtml(filename))}
      ${row('Image Size', formatImageSize(width, height))}
      ${row('Color Space', 'sRGB IEC61966-2.1')}
    `, { border: true })}
  `;

  render(panel, html, vscode);
  renderSnippets(asset);
}

// Helper: get compression text
function getCompressionText(compressionType) {
  switch (compressionType) {
    case 'automatic': return 'Automatic';
    case 'lossless': return 'Lossless';
    case 'lossy': return 'Basic';
    case 'gpu-optimized-best': return 'GPU Best Quality';
    case 'gpu-optimized-smallest': return 'GPU Smallest Size';
    default: return 'Inherited (Automatic)';
  }
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
    const preservesVectorCheckbox = asset.preservesVectorRepresentation ? '☑' : '☐';

    html = section('Image Set', `
      ${nameRow(asset.name, asset.path)}
      ${row('Render As', renderAsText)}
      ${row('Compression', getCompressionText(asset.compressionType))}
      <div class="property-row align-top">
        <span class="property-row-label">Resizing</span>
        <div style="font-size: 12px; line-height: 1.5;">
          <div style="padding: 2px 0;">${preservesVectorCheckbox} Preserve Vector Data</div>
        </div>
      </div>
      <div class="property-row align-top">
        <span class="property-row-label">Devices</span>
        <div style="font-size: 12px; line-height: 1.5;">${renderDevicesHtml(idioms)}</div>
      </div>
      ${row('Appearances', getAppearancesText(asset.images))}
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
      <div class="property-row align-top">
        <span class="property-row-label">Devices</span>
        <div style="font-size: 12px; line-height: 1.5;">${renderDevicesHtml(idioms)}</div>
      </div>
      ${row('Appearances', getAppearancesText(asset.colors))}
      ${row('Gamut', getGamut(asset.colors))}
    `);
  } else if (asset.type === 'data') {
    html = section('Data Set', nameRow(asset.name, asset.path));
  } else if (asset.type === 'folder') {
    const checked = asset.providesNamespace ? '☑' : '☐';
    html = section('Folder', `
      ${nameRow(asset.name, asset.path)}
      <div class="property-row align-top">
        <span class="property-row-label">Namespace</span>
        <div style="font-size: 12px; line-height: 1.5; padding: 2px 0;">
           ${checked} Provides Namespace
        </div>
      </div>
    `);
  }

  render(panel, html, vscode);
  renderSnippets(asset);
}
