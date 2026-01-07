import { leftWidth, rightWidth, setLeftWidth, setRightWidth } from './state.js';

// Initialize resizer functionality
export function initResizers() {
  const leftResizer = document.getElementById('leftResizer');
  const rightResizer = document.getElementById('rightResizer');

  let isResizing = false;
  let currentResizer = null;

  leftResizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    currentResizer = 'left';
    leftResizer.classList.add('dragging');
    e.preventDefault();
  });

  rightResizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    currentResizer = 'right';
    rightResizer.classList.add('dragging');
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    if (currentResizer === 'left') {
      const newWidth = e.clientX;
      if (newWidth >= 150 && newWidth <= 500) {
        setLeftWidth(newWidth);
        document.body.style.setProperty('--left-width', `${newWidth}px`);
      }
    } else if (currentResizer === 'right') {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 200 && newWidth <= 600) {
        setRightWidth(newWidth);
        document.body.style.setProperty('--right-width', `${newWidth}px`);
      }
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      leftResizer.classList.remove('dragging');
      rightResizer.classList.remove('dragging');
      currentResizer = null;
    }
  });
}
