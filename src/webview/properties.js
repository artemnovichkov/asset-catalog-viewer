import { escapeHtml, getColorValue } from './utils.js';

// Render color properties for specific variant
export function renderColorProperties(asset, colorIndex, vscode) {
  const panel = document.getElementById('propertiesPanel');
  const colorItem = asset.colors[colorIndex];

  const idioms = new Set();
  const hasLuminosity = new Set();
  const hasContrast = new Set();
  let gamut = 'Any';

  asset.colors.forEach(item => {
    if (item.subtype === 'mac-catalyst') {
      idioms.add('mac-catalyst');
    } else {
      idioms.add(item.idiom || 'universal');
    }

    if (item.color?.['color-space']) {
      gamut = item.color['color-space'].toUpperCase();
    }

    const appearances = item.appearances || [];
    appearances.forEach(app => {
      if (app.appearance === 'luminosity') {
        hasLuminosity.add(app.value);
      } else if (app.appearance === 'contrast') {
        hasContrast.add(app.value);
      }
    });
  });

  const allDevices = [
    { id: 'iphone', label: 'iPhone' },
    { id: 'ipad', label: 'iPad' },
    { id: 'mac-catalyst', label: 'Mac Catalyst Scaled' },
    { id: 'car', label: 'CarPlay' },
    { id: 'vision', label: 'Apple Vision' },
    { id: 'watch', label: 'Apple Watch' },
    { id: 'tv', label: 'Apple TV' }
  ];

  const devicesHtml = allDevices.map(device => {
    const checked = idioms.has(device.id) ? '☑' : '☐';
    const indent = device.id === 'mac-catalyst' ? 'padding-left: 16px;' : '';
    return `<div style="padding: 2px 0; ${indent}">${checked} ${device.label}</div>`;
  }).join('');

  let appearancesText = 'None';
  if (hasLuminosity.has('light') || hasLuminosity.has('dark') || hasContrast.has('high')) {
    const parts = ['Any'];
    if (hasLuminosity.has('light')) parts.push('Light');
    if (hasLuminosity.has('dark')) parts.push('Dark');
    appearancesText = parts.join(', ');
    if (hasContrast.has('high')) {
      appearancesText += ' + High Contrast';
    }
  }

  const universalHtml = idioms.has('universal')
    ? '<div style="padding: 2px 0; margin-bottom: 4px;">☑ Universal</div>'
    : '';

  const color = colorItem.color || {};
  const colorSpace = color['color-space'] || 'srgb';
  const components = color.components || {};

  let componentsHtml = '';
  if (components.red !== undefined) {
    const r = parseFloat(components.red);
    const g = parseFloat(components.green);
    const b = parseFloat(components.blue);
    const a = components.alpha !== undefined ? parseFloat(components.alpha) : 1;
    componentsHtml = `<div class="property-row-value">R: ${r}, G: ${g}, B: ${b}, A: ${a}</div>`;
  }

  panel.innerHTML = `
    <div class="property-section">
      <div class="property-title">Color Set</div>
      <div class="property-row">
        <span class="property-row-label">Name</span>
        <div class="property-row-value" style="flex: 1;">${escapeHtml(asset.name)}</div>
        <button class="finder-button" data-path="${asset.path}">
          <i class="codicon codicon-folder-opened"></i>
        </button>
      </div>
      <div class="property-row" style="align-items: flex-start;">
        <span class="property-row-label">Devices</span>
        <div style="font-size: 12px; line-height: 1.5;">
          ${universalHtml}
          ${devicesHtml}
        </div>
      </div>
      <div class="property-row">
        <span class="property-row-label">Appearances</span>
        <div class="property-row-value">${appearancesText}</div>
      </div>
      <div class="property-row">
        <span class="property-row-label">Gamut</span>
        <div class="property-row-value">${gamut}</div>
      </div>
    </div>
    <div class="property-section">
      <div class="property-title">Color</div>
      <div class="property-row">
        <span class="property-row-label">Color Space</span>
        <div class="property-row-value">${colorSpace}</div>
      </div>
      ${componentsHtml ? `<div class="property-row">
        <span class="property-row-label">Components</span>
        ${componentsHtml}
      </div>` : ''}
    </div>
  `;

  addFinderButtonHandler(panel, vscode);
}

// Render app icon variant properties
export async function renderAppIconVariantProperties(asset, filename, uri, size, scale, appearance, vscode) {
  const panel = document.getElementById('propertiesPanel');

  let imageWidth = 0;
  let imageHeight = 0;
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = () => {
        imageWidth = img.naturalWidth;
        imageHeight = img.naturalHeight;
        resolve();
      };
      img.onerror = reject;
      img.src = uri;
    });
  } catch (e) {
    console.error('Failed to load image:', e);
  }

  const imageSizeText = imageWidth && imageHeight
    ? `${imageWidth} × ${imageHeight} pixels`
    : 'Unknown';

  const platforms = new Set();
  asset.icons.forEach(icon => {
    if (icon.platform) {
      platforms.add(icon.platform);
    }
  });

  const platformsList = Array.from(platforms).join(', ');

  // Show Scale for macOS icons, Appearance for iOS icons
  const scaleOrAppearanceHtml = scale
    ? `<div class="property-row">
        <span class="property-row-label">Scale</span>
        <div class="property-row-value">${scale}</div>
      </div>`
    : `<div class="property-row">
        <span class="property-row-label">Appearance</span>
        <div class="property-row-value">${appearance}</div>
      </div>`;

  panel.innerHTML = `
    <div class="property-section">
      <div class="property-title">App Icon</div>
      <div class="property-row">
        <span class="property-row-label">Name</span>
        <div class="property-row-value" style="flex: 1;">${escapeHtml(asset.name)}</div>
        <button class="finder-button" data-path="${asset.path}">
          <i class="codicon codicon-folder-opened"></i>
        </button>
      </div>
      <div class="property-row">
        <span class="property-row-label">Platforms</span>
        <div class="property-row-value">${platformsList || 'iOS'}</div>
      </div>
    </div>
    <div class="property-section" style="border-top: 1px solid var(--vscode-panel-border); padding-top: 16px; margin-top: 16px;">
      <div class="property-title">Icon</div>
      <div class="property-row">
        <span class="property-row-label">Size</span>
        <div class="property-row-value">${size}</div>
      </div>
      ${scaleOrAppearanceHtml}
      <div class="property-row">
        <span class="property-row-label">File Name</span>
        <div class="property-row-value">${escapeHtml(filename)}</div>
      </div>
      <div class="property-row">
        <span class="property-row-label">Image Size</span>
        <div class="property-row-value">${imageSizeText}</div>
      </div>
    </div>
  `;

  addFinderButtonHandler(panel, vscode);
}

// Render image variant properties
export async function renderImageVariantProperties(asset, filename, uri, scale, vscode) {
  const panel = document.getElementById('propertiesPanel');

  let imageWidth = 0;
  let imageHeight = 0;
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = () => {
        imageWidth = img.naturalWidth;
        imageHeight = img.naturalHeight;
        resolve();
      };
      img.onerror = reject;
      img.src = uri;
    });
  } catch (e) {
    console.error('Failed to load image:', e);
  }

  const imageSizeText = imageWidth && imageHeight
    ? `${imageWidth} × ${imageHeight} pixels`
    : 'Unknown';

  const idioms = new Set();
  asset.images.forEach(img => {
    if (img.subtype === 'mac-catalyst') {
      idioms.add('mac-catalyst');
    } else {
      idioms.add(img.idiom || 'universal');
    }
  });

  const allDevices = [
    { id: 'iphone', label: 'iPhone' },
    { id: 'ipad', label: 'iPad' },
    { id: 'mac-catalyst', label: 'Mac Catalyst Scaled' },
    { id: 'car', label: 'CarPlay' },
    { id: 'vision', label: 'Apple Vision' },
    { id: 'watch', label: 'Apple Watch' },
    { id: 'tv', label: 'Apple TV' }
  ];

  const devicesHtml = allDevices.map(device => {
    const checked = idioms.has(device.id) ? '☑' : '☐';
    const indent = device.id === 'mac-catalyst' ? 'padding-left: 16px;' : '';
    return `<div style="padding: 2px 0; ${indent}">${checked} ${device.label}</div>`;
  }).join('');

  const universalHtml = idioms.has('universal')
    ? '<div style="padding: 2px 0; margin-bottom: 4px;">☑ Universal</div>'
    : '';

  const uniqueScales = [...new Set(asset.images.map(i => i.scale))];
  const scalesText = uniqueScales.length <= 1 ? 'Single Scale' : 'Individual Scales';

  const renderAsText = asset.templateRenderingIntent === 'template' ? 'Template Image' :
    asset.templateRenderingIntent === 'original' ? 'Original Image' : 'Default';

  panel.innerHTML = `
    <div class="property-section">
      <div class="property-title">Image Set</div>
      <div class="property-row">
        <span class="property-row-label">Name</span>
        <div class="property-row-value" style="flex: 1;">${escapeHtml(asset.name)}</div>
        <button class="finder-button" data-path="${asset.path}">
          <i class="codicon codicon-folder-opened"></i>
        </button>
      </div>
      <div class="property-row">
        <span class="property-row-label">Render As</span>
        <div class="property-row-value">${renderAsText}</div>
      </div>
      <div class="property-row" style="align-items: flex-start;">
        <span class="property-row-label">Devices</span>
        <div style="font-size: 12px; line-height: 1.5;">
          ${universalHtml}
          ${devicesHtml}
        </div>
      </div>
      <div class="property-row">
        <span class="property-row-label">Scales</span>
        <div class="property-row-value">${scalesText}</div>
      </div>
    </div>
    <div class="property-section" style="border-top: 1px solid var(--vscode-panel-border); padding-top: 16px; margin-top: 16px;">
      <div class="property-title">Image</div>
      <div class="property-row">
        <span class="property-row-label">File Name</span>
        <div class="property-row-value">${escapeHtml(filename)}</div>
      </div>
      <div class="property-row">
        <span class="property-row-label">Image Size</span>
        <div class="property-row-value">${imageSizeText}</div>
      </div>
      <div class="property-row">
        <span class="property-row-label">Color Space</span>
        <div class="property-row-value">sRGB IEC61966-2.1</div>
      </div>
    </div>
  `;

  addFinderButtonHandler(panel, vscode);
}

// Render general properties for asset
export function renderProperties(asset, vscode) {
  const panel = document.getElementById('propertiesPanel');

  if (asset.type === 'image') {
    const idioms = new Set();
    asset.images.forEach(img => {
      if (img.subtype === 'mac-catalyst') {
        idioms.add('mac-catalyst');
      } else {
        idioms.add(img.idiom || 'universal');
      }
    });

    const allDevices = [
      { id: 'iphone', label: 'iPhone' },
      { id: 'ipad', label: 'iPad' },
      { id: 'mac-catalyst', label: 'Mac Catalyst Scaled' },
      { id: 'car', label: 'CarPlay' },
      { id: 'vision', label: 'Apple Vision' },
      { id: 'watch', label: 'Apple Watch' },
      { id: 'tv', label: 'Apple TV' }
    ];

    const devicesHtml = allDevices.map(device => {
      const checked = idioms.has(device.id) ? '☑' : '☐';
      const indent = device.id === 'mac-catalyst' ? 'padding-left: 16px;' : '';
      return `<div style="padding: 2px 0; ${indent}">${checked} ${device.label}</div>`;
    }).join('');

    const universalHtml = idioms.has('universal')
      ? '<div style="padding: 2px 0; margin-bottom: 4px;">☑ Universal</div>'
      : '';

    const uniqueScales = [...new Set(asset.images.map(i => i.scale))];
    const scalesText = uniqueScales.length <= 1 ? 'Single Scale' : 'Individual Scales';

    const renderAsText = asset.templateRenderingIntent === 'template' ? 'Template Image' :
      asset.templateRenderingIntent === 'original' ? 'Original Image' : 'Default';

    panel.innerHTML = `
      <div class="property-section">
        <div class="property-title">Image Set</div>
        <div class="property-row">
          <span class="property-row-label">Name</span>
          <div class="property-row-value" style="flex: 1;">${escapeHtml(asset.name)}</div>
          <button class="finder-button" data-path="${asset.path}">
            <i class="codicon codicon-folder-opened"></i>
          </button>
        </div>
        <div class="property-row">
          <span class="property-row-label">Render As</span>
          <div class="property-row-value">${renderAsText}</div>
        </div>
        <div class="property-row" style="align-items: flex-start;">
          <span class="property-row-label">Devices</span>
          <div style="font-size: 12px; line-height: 1.5;">
            ${universalHtml}
            ${devicesHtml}
          </div>
        </div>
        <div class="property-row">
          <span class="property-row-label">Scales</span>
          <div class="property-row-value">${scalesText}</div>
        </div>
      </div>
    `;

    addFinderButtonHandler(panel, vscode);
  } else if (asset.type === 'appicon') {
    const platformSizes = { ios: new Set(), macos: new Set(), watchos: new Set() };

    asset.icons.forEach(icon => {
      let platform = icon.platform;
      // macOS icons use idiom: "mac" without platform field
      if (!platform && icon.idiom === 'mac') {
        platform = 'macos';
      }
      // watchOS icons use idiom: "watch" without platform field
      if (!platform && icon.idiom === 'watch') {
        platform = 'watchos';
      }
      platform = platform || 'ios';
      if (platformSizes[platform] && icon.size) {
        platformSizes[platform].add(icon.size);
      }
    });

    const getPlatformValue = (platform, hasSingleSizeOption) => {
      const sizes = platformSizes[platform];
      if (sizes.size === 0) return 'None';
      if (hasSingleSizeOption && sizes.size === 1) return 'Single Size';
      return 'All Sizes';
    };

    const iosValue = getPlatformValue('ios', true);
    const macosValue = getPlatformValue('macos', false);
    const watchosValue = getPlatformValue('watchos', true);

    panel.innerHTML = `
      <div class="property-section">
        <div class="property-title">App Icon</div>
        <div class="property-row">
          <span class="property-row-label">Name</span>
          <div class="property-row-value" style="flex: 1;">${escapeHtml(asset.name)}</div>
          <button class="finder-button" data-path="${asset.path}">
            <i class="codicon codicon-folder-opened"></i>
          </button>
        </div>
        <div class="property-row">
          <span class="property-row-label">iOS</span>
          <div class="property-row-value">${iosValue}</div>
        </div>
        <div class="property-row">
          <span class="property-row-label">macOS</span>
          <div class="property-row-value">${macosValue}</div>
        </div>
        <div class="property-row">
          <span class="property-row-label">watchOS</span>
          <div class="property-row-value">${watchosValue}</div>
        </div>
      </div>
    `;

    addFinderButtonHandler(panel, vscode);
  } else if (asset.type === 'color') {
    const idioms = new Set();
    const hasLuminosity = new Set();
    const hasContrast = new Set();
    let gamut = 'Any';

    asset.colors.forEach(item => {
      if (item.subtype === 'mac-catalyst') {
        idioms.add('mac-catalyst');
      } else {
        idioms.add(item.idiom || 'universal');
      }

      if (item.color?.['color-space']) {
        gamut = item.color['color-space'].toUpperCase();
      }

      const appearances = item.appearances || [];
      appearances.forEach(app => {
        if (app.appearance === 'luminosity') {
          hasLuminosity.add(app.value);
        } else if (app.appearance === 'contrast') {
          hasContrast.add(app.value);
        }
      });
    });

    const allDevices = [
      { id: 'iphone', label: 'iPhone' },
      { id: 'ipad', label: 'iPad' },
      { id: 'mac-catalyst', label: 'Mac Catalyst Scaled' },
      { id: 'car', label: 'CarPlay' },
      { id: 'vision', label: 'Apple Vision' },
      { id: 'watch', label: 'Apple Watch' },
      { id: 'tv', label: 'Apple TV' }
    ];

    const devicesHtml = allDevices.map(device => {
      const checked = idioms.has(device.id) ? '☑' : '☐';
      const indent = device.id === 'mac-catalyst' ? 'padding-left: 16px;' : '';
      return `<div style="padding: 2px 0; ${indent}">${checked} ${device.label}</div>`;
    }).join('');

    let appearancesText = 'None';
    if (hasLuminosity.has('light') || hasLuminosity.has('dark') || hasContrast.has('high')) {
      const parts = ['Any'];
      if (hasLuminosity.has('light')) parts.push('Light');
      if (hasLuminosity.has('dark')) parts.push('Dark');
      appearancesText = parts.join(', ');
      if (hasContrast.has('high')) {
        appearancesText += ' + High Contrast';
      }
    }

    const universalHtml = idioms.has('universal')
      ? '<div style="padding: 2px 0; margin-bottom: 4px;">☑ Universal</div>'
      : '';

    panel.innerHTML = `
      <div class="property-section">
        <div class="property-title">Color Set</div>
        <div class="property-row">
          <span class="property-row-label">Name</span>
          <div class="property-row-value" style="flex: 1;">${escapeHtml(asset.name)}</div>
          <button class="finder-button" data-path="${asset.path}">
            <i class="codicon codicon-folder-opened"></i>
          </button>
        </div>
        <div class="property-row" style="align-items: flex-start;">
          <span class="property-row-label">Devices</span>
          <div style="font-size: 12px; line-height: 1.5;">
            ${universalHtml}
            ${devicesHtml}
          </div>
        </div>
        <div class="property-row">
          <span class="property-row-label">Appearances</span>
          <div class="property-row-value">${appearancesText}</div>
        </div>
        <div class="property-row">
          <span class="property-row-label">Gamut</span>
          <div class="property-row-value">${gamut}</div>
        </div>
      </div>
    `;

    addFinderButtonHandler(panel, vscode);
  } else if (asset.type === 'data') {
    panel.innerHTML = `
      <div class="property-section">
        <div class="property-title">Data Set</div>
        <div class="property-row">
          <span class="property-row-label">Name</span>
          <div class="property-row-value" style="flex: 1;">${escapeHtml(asset.name)}</div>
          <button class="finder-button" data-path="${asset.path}">
            <i class="codicon codicon-folder-opened"></i>
          </button>
        </div>
      </div>
    `;

    addFinderButtonHandler(panel, vscode);
  } else if (asset.type === 'folder') {
    panel.innerHTML = `
      <div class="property-section">
        <div class="property-title">Folder</div>
        <div class="property-row">
          <span class="property-row-label">Name</span>
          <div class="property-row-value" style="flex: 1;">${escapeHtml(asset.name)}</div>
          <button class="finder-button" data-path="${asset.path}">
            <i class="codicon codicon-folder-opened"></i>
          </button>
        </div>
      </div>
    `;

    addFinderButtonHandler(panel, vscode);
  }
}

// Helper to add finder button click handler
function addFinderButtonHandler(panel, vscode) {
  const btn = panel.querySelector('.finder-button');
  if (btn) {
    btn.addEventListener('click', (e) => {
      const path = e.currentTarget.dataset.path;
      if (path) {
        vscode.postMessage({ command: 'showInFinder', filePath: path });
      }
    });
  }
}
