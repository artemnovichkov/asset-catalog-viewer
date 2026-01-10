// HTML escaping for security
export function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Get CSS color value from asset color object
export function getColorValue(color) {
  if (!color) return '#000000';
  const components = color.components;
  if (!components) return '#000000';

  if (components.red !== undefined) {
    const redVal = parseFloat(components.red);
    const greenVal = parseFloat(components.green);
    const blueVal = parseFloat(components.blue);

    const r = redVal > 1 ? Math.round(redVal) : Math.round(redVal * 255);
    const g = greenVal > 1 ? Math.round(greenVal) : Math.round(greenVal * 255);
    const b = blueVal > 1 ? Math.round(blueVal) : Math.round(blueVal * 255);
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
