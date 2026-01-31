import { escapeHtml, componentTo255 } from './utils.js';

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

// Helper: add preserves vector checkbox handler
function addPreservesVectorHandler(vscode) {
  const checkbox = document.getElementById('preservesVectorCheckbox');
  if (checkbox) {
    checkbox.addEventListener('change', (e) => {
      const imageSetPath = e.target.dataset.path;
      const preservesVector = e.target.checked;
      vscode.postMessage({ command: 'togglePreservesVector', imageSetPath, preservesVector });
    });
  }
}

// Helper: add render as select handler
function addRenderAsHandler(vscode) {
  const select = document.getElementById('renderAsSelect');
  if (select) {
    select.addEventListener('change', (e) => {
      const imageSetPath = e.target.dataset.path;
      const renderAs = e.target.value;
      vscode.postMessage({ command: 'changeRenderAs', imageSetPath, renderAs });
    });
  }
}

// Helper: render "Render As" select
function renderAsSelect(templateRenderingIntent, path) {
  const value = templateRenderingIntent || 'default';
  return `
    <div class="property-row">
      <span class="property-row-label">Render As</span>
      <select id="renderAsSelect" data-path="${path}" class="property-select">
        <option value="default" ${value === 'default' ? 'selected' : ''}>Default</option>
        <option value="original" ${value === 'original' ? 'selected' : ''}>Original Image</option>
        <option value="template" ${value === 'template' ? 'selected' : ''}>Template Image</option>
      </select>
    </div>`;
}

// Helper: render to panel
function render(panel, html, vscode) {
  panel.innerHTML = html;
  addFinderButtonHandler(panel, vscode);
}

// Helper: convert string to camelCase (e.g. "brand-color" -> "brandColor", "My Icon" -> "myIcon", "8swift" -> "_8Swift")
function toCamelCase(str) {
  let result = str
    .replace(/[^a-zA-Z0-9]/g, ' ') // Replace non-alphanumeric with space
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, '');
  if (/^\d/.test(result)) {
    result = '_' + result.replace(/^(\d+)([a-z])/, (_, digits, ch) => digits + ch.toUpperCase());
  }
  return result;
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
    const stripped = name.replace(/(?:Color|Icon|Image)$/i, '');
    processedName = toCamelCase(stripped || name);
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

// Helper: parse a color component to its numeric value (hex→int, otherwise parseFloat)
function parseComponent(value) {
  const str = String(value);
  if (str.startsWith('0x') || str.startsWith('0X')) {
    return parseInt(str, 16);
  }
  return parseFloat(str);
}

// Helper: convert color components to hex (RRGGBBAA)
function colorToHex(color) {
  if (!color || !color.components) return 'FFFFFFFF';
  const c = color.components;
  const r = componentTo255(c.red || '0');
  const g = componentTo255(c.green || '0');
  const b = componentTo255(c.blue || '0');
  const a = componentTo255(c.alpha || '1.0');
  return [r, g, b, a].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Detect input method from color components
function detectInputMethod(components) {
  if (!components || !components.red) return 'float';
  const red = String(components.red);
  if (red.startsWith('0x') || red.startsWith('0X')) return 'hex';
  if (red.includes('.')) return 'float';
  return '8bit';
}

// Format a 0-255 value as a component string for the given input method
function formatComponentValue(value255, method) {
  const v = Math.max(0, Math.min(255, Math.round(value255)));
  if (method === 'hex') return '0x' + v.toString(16).toUpperCase().padStart(2, '0');
  if (method === '8bit') return String(v);
  return (v / 255).toFixed(3);
}

// Read current RGB (as 0-255) and alpha from color editor DOM
function readColorEditorValues() {
  const hexInput = document.getElementById('colorHexInput');
  let r255, g255, b255;
  if (hexInput) {
    const hex = hexInput.value.replace('#', '');
    r255 = parseInt(hex.substring(0, 2), 16) || 0;
    g255 = parseInt(hex.substring(2, 4), 16) || 0;
    b255 = parseInt(hex.substring(4, 6), 16) || 0;
  } else {
    const sliders = document.querySelectorAll('.color-slider[data-channel]');
    const vals = {};
    sliders.forEach(s => { vals[s.dataset.channel] = parseFloat(s.value); });
    const isFloat = sliders.length > 0 && parseFloat(sliders[0].max) <= 1;
    if (isFloat) {
      r255 = Math.round((vals.red || 0) * 255);
      g255 = Math.round((vals.green || 0) * 255);
      b255 = Math.round((vals.blue || 0) * 255);
    } else {
      r255 = Math.round(vals.red || 0);
      g255 = Math.round(vals.green || 0);
      b255 = Math.round(vals.blue || 0);
    }
  }
  const opacityInput = document.getElementById('colorOpacityInput');
  const alpha = opacityInput ? parseInt(opacityInput.value) / 100 : 1;
  return { r255, g255, b255, alpha };
}

// Generate color editor HTML
function colorEditorHtml(components, inputMethod) {
  const r255 = componentTo255(components.red);
  const g255 = componentTo255(components.green);
  const b255 = componentTo255(components.blue);
  const alpha = parseFloat(components.alpha || '1');
  const opacity = Math.round(alpha * 100);

  const methodSelect = `
    <div class="color-input-row">
      <span class="color-input-label">Input Method</span>
      <select id="inputMethodSelect" class="property-select">
        <option value="float" ${inputMethod === 'float' ? 'selected' : ''}>Floating Point (0.0-1.0)</option>
        <option value="8bit" ${inputMethod === '8bit' ? 'selected' : ''}>8-bit (0-255)</option>
        <option value="hex" ${inputMethod === 'hex' ? 'selected' : ''}>8-bit Hexadecimal</option>
      </select>
    </div>`;

  let channelInputs;
  if (inputMethod === 'hex') {
    const hex = '#' + [r255, g255, b255].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    channelInputs = `
      <div class="color-input-row">
        <span class="color-input-label">Hex</span>
        <input type="text" class="color-hex-input" id="colorHexInput" value="${hex}" maxlength="7" />
      </div>`;
  } else {
    const max = inputMethod === 'float' ? 1 : 255;
    const step = inputMethod === 'float' ? 0.001 : 1;
    const channels = [
      { key: 'red', label: 'Red', val255: r255 },
      { key: 'green', label: 'Green', val255: g255 },
      { key: 'blue', label: 'Blue', val255: b255 }
    ];
    channelInputs = channels.map(({ key, label, val255 }) => {
      const sliderVal = inputMethod === 'float' ? (val255 / 255) : val255;
      const displayVal = inputMethod === 'float' ? (val255 / 255).toFixed(3) : val255;
      return `
        <div class="color-input-row">
          <span class="color-input-label">${label}</span>
          <input type="range" class="color-slider" data-channel="${key}" min="0" max="${max}" step="${step}" value="${sliderVal}" />
          <input type="number" class="color-number-input" data-channel="${key}" min="0" max="${max}" step="${step}" value="${displayVal}" />
        </div>`;
    }).join('');
  }

  const opacitySlider = `
    <div class="color-input-row">
      <span class="color-input-label">Opacity</span>
      <input type="range" class="color-slider" id="colorOpacitySlider" min="0" max="100" value="${opacity}" />
      <div class="color-opacity-wrapper">
        <input type="number" class="color-number-input" id="colorOpacityInput" min="0" max="100" step="1" value="${opacity}" />
        <span class="color-opacity-percent">%</span>
      </div>
    </div>`;

  return methodSelect + channelInputs + opacitySlider;
}

// Wire up color editor event handlers
function addColorEditorHandlers(asset, colorIndex, vscode) {
  const colorSpace = (asset.colors[colorIndex].color || {})['color-space'] || 'srgb';

  function updateSwatch(r255, g255, b255) {
    const rgb = `rgb(${r255}, ${g255}, ${b255})`;
    const swatch = document.querySelector(`.variant-item[data-color-index="${colorIndex}"] .color-slot`);
    if (swatch) swatch.style.backgroundColor = rgb;
    const thumb = document.querySelector(`.asset-list-item[data-path="${asset.path}"] .asset-thumbnail`);
    if (thumb) thumb.style.backgroundColor = rgb;
  }

  function sendUpdate(r255, g255, b255, alpha, method) {
    const newComponents = {
      red: formatComponentValue(r255, method),
      green: formatComponentValue(g255, method),
      blue: formatComponentValue(b255, method),
      alpha: alpha.toFixed(3)
    };
    const newColor = { 'color-space': colorSpace, components: newComponents };
    asset.colors[colorIndex].color = newColor;
    const btn = document.getElementById('showColorPanelBtn');
    if (btn) btn.dataset.colorHex = colorToHex(newColor);
    vscode.postMessage({ command: 'updateColor', colorSetPath: asset.path, colorIndex, newColor });
  }

  // Input method change → re-render
  const methodSelect = document.getElementById('inputMethodSelect');
  if (methodSelect) {
    methodSelect.addEventListener('change', () => {
      const { r255, g255, b255, alpha } = readColorEditorValues();
      const newMethod = methodSelect.value;
      const newComponents = {
        red: formatComponentValue(r255, newMethod),
        green: formatComponentValue(g255, newMethod),
        blue: formatComponentValue(b255, newMethod),
        alpha: alpha.toFixed(3)
      };
      const newColor = { 'color-space': colorSpace, components: newComponents };
      asset.colors[colorIndex].color = newColor;
      renderColorProperties(asset, colorIndex, vscode);
      vscode.postMessage({ command: 'updateColor', colorSetPath: asset.path, colorIndex, newColor });
    });
  }

  // RGB sliders
  document.querySelectorAll('.color-slider[data-channel]').forEach(slider => {
    const numberInput = document.querySelector(`.color-number-input[data-channel="${slider.dataset.channel}"]`);
    slider.addEventListener('input', () => {
      if (numberInput) {
        const isFloat = parseFloat(slider.max) <= 1;
        numberInput.value = isFloat ? parseFloat(slider.value).toFixed(3) : Math.round(parseFloat(slider.value));
      }
      const { r255, g255, b255 } = readColorEditorValues();
      updateSwatch(r255, g255, b255);
    });
    slider.addEventListener('change', () => {
      const method = document.getElementById('inputMethodSelect').value;
      const { r255, g255, b255, alpha } = readColorEditorValues();
      sendUpdate(r255, g255, b255, alpha, method);
    });
  });

  // RGB number inputs
  document.querySelectorAll('.color-number-input[data-channel]').forEach(input => {
    const slider = document.querySelector(`.color-slider[data-channel="${input.dataset.channel}"]`);
    input.addEventListener('input', () => {
      if (slider) slider.value = input.value;
      const { r255, g255, b255 } = readColorEditorValues();
      updateSwatch(r255, g255, b255);
    });
    input.addEventListener('change', () => {
      if (slider) slider.value = input.value;
      const method = document.getElementById('inputMethodSelect').value;
      const { r255, g255, b255, alpha } = readColorEditorValues();
      sendUpdate(r255, g255, b255, alpha, method);
    });
  });

  // Hex input
  const hexInput = document.getElementById('colorHexInput');
  if (hexInput) {
    hexInput.addEventListener('input', () => {
      const hex = hexInput.value.replace('#', '');
      if (/^[0-9a-fA-F]{6}$/.test(hex)) {
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        updateSwatch(r, g, b);
      }
    });
    hexInput.addEventListener('change', () => {
      const hex = hexInput.value.replace('#', '');
      if (/^[0-9a-fA-F]{6}$/.test(hex)) {
        const { r255, g255, b255, alpha } = readColorEditorValues();
        sendUpdate(r255, g255, b255, alpha, 'hex');
      }
    });
  }

  // Opacity slider + input
  const opacitySlider = document.getElementById('colorOpacitySlider');
  const opacityInput = document.getElementById('colorOpacityInput');
  if (opacitySlider) {
    opacitySlider.addEventListener('input', () => {
      if (opacityInput) opacityInput.value = opacitySlider.value;
    });
    opacitySlider.addEventListener('change', () => {
      const method = document.getElementById('inputMethodSelect').value;
      const { r255, g255, b255, alpha } = readColorEditorValues();
      sendUpdate(r255, g255, b255, alpha, method);
    });
  }
  if (opacityInput) {
    opacityInput.addEventListener('input', () => {
      if (opacitySlider) opacitySlider.value = opacityInput.value;
    });
    opacityInput.addEventListener('change', () => {
      if (opacitySlider) opacitySlider.value = opacityInput.value;
      const method = document.getElementById('inputMethodSelect').value;
      const { r255, g255, b255, alpha } = readColorEditorValues();
      sendUpdate(r255, g255, b255, alpha, method);
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
  const inputMethod = detectInputMethod(components);
  const hexColor = colorToHex(color);

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
      ${colorEditorHtml(components, inputMethod)}
      <div style="margin-top: 12px;">
        <button class="color-panel-button" id="showColorPanelBtn" data-path="${asset.path}" data-color-index="${colorIndex}" data-color-hex="${hexColor}">
          Show Color Panel
        </button>
      </div>
    `, { border: true })}
  `;

  render(panel, html, vscode);
  addColorEditorHandlers(asset, colorIndex, vscode);

  const colorPanelBtn = document.getElementById('showColorPanelBtn');
  if (colorPanelBtn) {
    colorPanelBtn.addEventListener('click', () => {
      vscode.postMessage({
        command: 'showColorPanel',
        colorSetPath: colorPanelBtn.dataset.path,
        colorIndex: parseInt(colorPanelBtn.dataset.colorIndex),
        currentColor: colorPanelBtn.dataset.colorHex
      });
    });
  }

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
  const preservesVectorChecked = asset.preservesVectorRepresentation ? 'checked' : '';

  const html = `
    ${section('Image Set', `
      ${nameRow(asset.name, asset.path)}
      ${renderAsSelect(asset.templateRenderingIntent, asset.path)}
      ${compressionSelect(asset.compressionType, asset.path)}
      <div class="property-row align-top">
        <span class="property-row-label">Resizing</span>
        <div style="font-size: 12px; line-height: 1.5;">
          <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; padding: 2px 0;">
            <input type="checkbox" id="preservesVectorCheckbox" ${preservesVectorChecked} data-path="${asset.path}" style="cursor: pointer;" />
            Preserve Vector Data
          </label>
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
  addPreservesVectorHandler(vscode);
  addRenderAsHandler(vscode);
  addCompressionHandler(vscode);
  renderSnippets(asset);
}

// Helper: add compression select handler
function addCompressionHandler(vscode) {
  const select = document.getElementById('compressionSelect');
  if (select) {
    select.addEventListener('change', (e) => {
      const imageSetPath = e.target.dataset.path;
      const compressionType = e.target.value;
      vscode.postMessage({ command: 'changeCompression', imageSetPath, compressionType });
    });
  }
}

// Helper: render compression select
function compressionSelect(compressionType, path) {
  const value = compressionType || 'inherited';
  const options = [
    { value: 'inherited', label: 'Inherited (Automatic)' },
    { value: 'automatic', label: 'Automatic' },
    { value: 'lossless', label: 'Lossless' },
    { value: 'lossy', label: 'Basic' },
    { value: 'gpu-optimized-best', label: 'GPU Best Quality' },
    { value: 'gpu-optimized-smallest', label: 'GPU Smallest Size' },
  ];
  const optionsHtml = options.map(o =>
    `<option value="${o.value}" ${value === o.value ? 'selected' : ''}>${o.label}</option>`
  ).join('');
  return `
    <div class="property-row">
      <span class="property-row-label">Compression</span>
      <select id="compressionSelect" data-path="${path}" class="property-select">
        ${optionsHtml}
      </select>
    </div>`;
}

// Render general properties for asset
export function renderProperties(asset, vscode) {
  const panel = document.getElementById('propertiesPanel');
  let html = '';

  if (asset.type === 'image') {
    const idioms = collectIdioms(asset.images);
    const uniqueScales = [...new Set(asset.images.map(i => i.scale))];
    const scalesText = uniqueScales.length <= 1 ? 'Single Scale' : 'Individual Scales';
    const preservesVectorChecked = asset.preservesVectorRepresentation ? 'checked' : '';

    html = section('Image Set', `
      ${nameRow(asset.name, asset.path)}
      ${renderAsSelect(asset.templateRenderingIntent, asset.path)}
      ${compressionSelect(asset.compressionType, asset.path)}
      <div class="property-row align-top">
        <span class="property-row-label">Resizing</span>
        <div style="font-size: 12px; line-height: 1.5;">
          <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; padding: 2px 0;">
            <input type="checkbox" id="preservesVectorCheckbox" ${preservesVectorChecked} data-path="${asset.path}" style="cursor: pointer;" />
            Preserve Vector Data
          </label>
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
    const checked = asset.providesNamespace ? 'checked' : '';
    html = section('Folder', `
      ${nameRow(asset.name, asset.path)}
      <div class="property-row align-top">
        <span class="property-row-label">Namespace</span>
        <div style="font-size: 12px; line-height: 1.5; padding: 2px 0;">
           <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
             <input type="checkbox" id="providesNamespaceCheckbox" ${checked} data-path="${asset.path}" style="cursor: pointer;" />
             Provides Namespace
           </label>
        </div>
      </div>
    `);
  }

  render(panel, html, vscode);

  // Add handler for preserves vector checkbox (for images)
  addPreservesVectorHandler(vscode);

  // Add handler for render as select (for images)
  addRenderAsHandler(vscode);

  // Add handler for compression select (for images)
  addCompressionHandler(vscode);

  // Add handler for namespace checkbox (for folders)
  const namespaceCheckbox = document.getElementById('providesNamespaceCheckbox');
  if (namespaceCheckbox) {
    namespaceCheckbox.addEventListener('change', (e) => {
      const folderPath = e.target.dataset.path;
      const providesNamespace = e.target.checked;
      vscode.postMessage({ command: 'toggleNamespace', folderPath, providesNamespace });
    });
  }

  renderSnippets(asset);
}
