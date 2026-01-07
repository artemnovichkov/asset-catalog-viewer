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
  if (hasLuminosity.has('dark') || hasContrast.has('high')) {
    const parts = [];
    if (hasLuminosity.has('dark')) parts.push('Any, Dark');
    if (hasContrast.has('high')) parts.push('High Contrast');
    appearancesText = parts.join(', ');
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
    componentsHtml = `<div class="property-value">R: ${r}, G: ${g}, B: ${b}, A: ${a}</div>`;
  }

  panel.innerHTML = `
    <div class="property-section">
      <div class="property-title">Color Set</div>
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 12px;">Name</div>
      <div class="property-value-with-button">
        <div class="property-value" style="flex: 1; margin-bottom: 0;">${escapeHtml(asset.name)}</div>
        <button class="finder-button" data-path="${asset.path}">
          <i class="codicon codicon-folder-opened"></i>
        </button>
      </div>
    </div>
    <div class="property-section">
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">Devices</div>
      <div style="font-size: 12px; line-height: 1.5;">
        ${universalHtml}
        ${devicesHtml}
      </div>
    </div>
    <div class="property-section">
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">Appearances</div>
      <div class="property-value">${appearancesText}</div>
    </div>
    <div class="property-section">
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">Gamut</div>
      <div class="property-value">${gamut}</div>
    </div>
    <div class="property-section">
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">Direction</div>
      <div class="property-value">Fixed</div>
    </div>
    <div class="property-section">
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">Width Class</div>
      <div class="property-value">Any</div>
    </div>
    <div class="property-section">
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">Height Class</div>
      <div class="property-value">Any</div>
    </div>
    <div class="property-section">
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">Memory</div>
      <div class="property-value">None</div>
    </div>
    <div class="property-section">
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">Graphics</div>
      <div class="property-value">None</div>
    </div>
    <div class="property-section">
      <div class="property-title">Color Space</div>
      <div class="property-value">${colorSpace}</div>
    </div>
    <div class="property-section">
      <div class="property-title">Components</div>
      ${componentsHtml}
    </div>
  `;

  addFinderButtonHandler(panel, vscode);
}

// Render app icon variant properties
export async function renderAppIconVariantProperties(asset, filename, uri, size, appearance, vscode) {
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

  panel.innerHTML = `
    <div class="property-section">
      <div class="property-title">Name</div>
      <div class="property-value-with-button">
        <div class="property-value" style="flex: 1; margin-bottom: 0;">${escapeHtml(asset.name)}</div>
        <button class="finder-button" data-path="${asset.path}">
          <i class="codicon codicon-folder-opened"></i>
        </button>
      </div>
    </div>
    <div class="property-section">
      <div class="property-title">Type</div>
      <div class="property-value">App Icon Set</div>
    </div>
    <div class="property-section">
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">Platforms</div>
      <div class="property-value">${platformsList || 'iOS'}</div>
    </div>
    <div class="property-section" style="border-top: 1px solid var(--vscode-panel-border); padding-top: 16px; margin-top: 16px;">
      <div class="property-title">Icon</div>
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; margin-top: 12px;">Size</div>
      <div class="property-value">${size}</div>
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; margin-top: 12px;">Appearance</div>
      <div class="property-value">${appearance}</div>
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; margin-top: 12px;">File Name</div>
      <div class="property-value">${escapeHtml(filename)}</div>
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; margin-top: 12px;">Image Size</div>
      <div class="property-value">${imageSizeText}</div>
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

  const scales = [...new Set(asset.images.map(i => i.scale))].join(', ');

  panel.innerHTML = `
    <div class="property-section">
      <div class="property-title">Name</div>
      <div class="property-value-with-button">
        <div class="property-value" style="flex: 1; margin-bottom: 0;">${escapeHtml(asset.name)}</div>
        <button class="finder-button" data-path="${asset.path}">
          <i class="codicon codicon-folder-opened"></i>
        </button>
      </div>
    </div>
    <div class="property-section">
      <div class="property-title">Type</div>
      <div class="property-value">Image Set</div>
    </div>
    <div class="property-section">
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">Devices</div>
      <div style="font-size: 12px; line-height: 1.5;">
        ${universalHtml}
        ${devicesHtml}
      </div>
    </div>
    <div class="property-section">
      <div class="property-title">Scales</div>
      <div class="property-value">${scales}</div>
    </div>
    <div class="property-section" style="border-top: 1px solid var(--vscode-panel-border); padding-top: 16px; margin-top: 16px;">
      <div class="property-title">Image</div>
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; margin-top: 12px;">File Name</div>
      <div class="property-value">${escapeHtml(filename)}</div>
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; margin-top: 12px;">Compression</div>
      <div class="property-value">Inherited (Automatic)</div>
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; margin-top: 12px;">Image Size</div>
      <div class="property-value">${imageSizeText}</div>
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; margin-top: 12px;">Color Space</div>
      <div class="property-value">sRGB IEC61966-2.1</div>
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

    const scales = [...new Set(asset.images.map(i => i.scale))].join(', ');

    panel.innerHTML = `
      <div class="property-section">
        <div class="property-title">Name</div>
        <div class="property-value-with-button">
          <div class="property-value" style="flex: 1; margin-bottom: 0;">${escapeHtml(asset.name)}</div>
          <button class="finder-button" data-path="${asset.path}">
            <i class="codicon codicon-folder-opened"></i>
          </button>
        </div>
      </div>
      <div class="property-section">
        <div class="property-title">Type</div>
        <div class="property-value">Image Set</div>
      </div>
      <div class="property-section">
        <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">Devices</div>
        <div style="font-size: 12px; line-height: 1.5;">
          ${universalHtml}
          ${devicesHtml}
        </div>
      </div>
      <div class="property-section">
        <div class="property-title">Scales</div>
        <div class="property-value">${scales}</div>
      </div>
    `;

    addFinderButtonHandler(panel, vscode);
  } else if (asset.type === 'appicon') {
    const platforms = new Set();
    const sizes = new Set();

    asset.icons.forEach(icon => {
      if (icon.platform) {
        platforms.add(icon.platform);
      }
      if (icon.size) {
        sizes.add(icon.size);
      }
    });

    const platformsList = Array.from(platforms).join(', ');
    const sizesList = Array.from(sizes).join(', ');

    panel.innerHTML = `
      <div class="property-section">
        <div class="property-title">Name</div>
        <div class="property-value-with-button">
          <div class="property-value" style="flex: 1; margin-bottom: 0;">${escapeHtml(asset.name)}</div>
          <button class="finder-button" data-path="${asset.path}">
            <i class="codicon codicon-folder-opened"></i>
          </button>
        </div>
      </div>
      <div class="property-section">
        <div class="property-title">Type</div>
        <div class="property-value">App Icon Set</div>
      </div>
      <div class="property-section">
        <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">Platforms</div>
        <div class="property-value">${platformsList || 'iOS'}</div>
      </div>
      <div class="property-section">
        <div class="property-title">Sizes</div>
        <div class="property-value">${sizesList}</div>
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
    if (hasLuminosity.has('dark') || hasContrast.has('high')) {
      const parts = [];
      if (hasLuminosity.has('dark')) parts.push('Any, Dark');
      if (hasContrast.has('high')) parts.push('High Contrast');
      appearancesText = parts.join(', ');
    }

    const universalHtml = idioms.has('universal')
      ? '<div style="padding: 2px 0; margin-bottom: 4px;">☑ Universal</div>'
      : '';

    panel.innerHTML = `
      <div class="property-section">
        <div class="property-title">Color Set</div>
        <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 12px;">Name</div>
        <div class="property-value-with-button">
          <div class="property-value" style="flex: 1; margin-bottom: 0;">${escapeHtml(asset.name)}</div>
          <button class="finder-button" data-path="${asset.path}">
            <i class="codicon codicon-folder-opened"></i>
          </button>
        </div>
      </div>
      <div class="property-section">
        <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">Devices</div>
        <div style="font-size: 12px; line-height: 1.5;">
          ${universalHtml}
          ${devicesHtml}
        </div>
      </div>
      <div class="property-section">
        <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">Appearances</div>
        <div class="property-value">${appearancesText}</div>
      </div>
      <div class="property-section">
        <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">Gamut</div>
        <div class="property-value">${gamut}</div>
      </div>
    `;

    addFinderButtonHandler(panel, vscode);
  } else if (asset.type === 'data') {
    panel.innerHTML = `
      <div class="property-section">
        <div class="property-title">Name</div>
        <div class="property-value-with-button">
          <div class="property-value" style="flex: 1; margin-bottom: 0;">${escapeHtml(asset.name)}</div>
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
        <div class="property-title">Name</div>
        <div class="property-value-with-button">
          <div class="property-value" style="flex: 1; margin-bottom: 0;">${escapeHtml(asset.name)}</div>
          <button class="finder-button" data-path="${asset.path}">
            <i class="codicon codicon-folder-opened"></i>
          </button>
        </div>
      </div>
      <div class="property-section">
        <div class="property-title">Type</div>
        <div class="property-value">Folder</div>
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
