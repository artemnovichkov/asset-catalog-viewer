// HTML escaping for security
export function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Parse a color component string to 0-255 range.
// Handles: hex ("0xFF"), float with decimal ("0.478"), integer ("255")
export function componentTo255(value) {
  const str = String(value);
  if (str.startsWith('0x') || str.startsWith('0X')) {
    return parseInt(str, 16);
  }
  if (str.includes('.')) {
    return Math.round(parseFloat(str) * 255);
  }
  return Math.round(parseFloat(str));
}

// Get CSS color value from asset color object
export function getColorValue(color) {
  if (!color) return '#000000';
  const components = color.components;
  if (!components) return '#000000';

  if (components.red !== undefined) {
    const r = componentTo255(components.red);
    const g = componentTo255(components.green);
    const b = componentTo255(components.blue);
    return `rgb(${r}, ${g}, ${b})`;
  }

  return '#000000';
}

// Format file size in bytes to human readable format
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format seconds as M:SS
export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Loading overlay
export function showLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.classList.add('visible');
  }
}

export function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.classList.remove('visible');
  }
}
