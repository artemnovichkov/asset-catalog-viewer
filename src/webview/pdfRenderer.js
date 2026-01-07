import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker (will be set by extension via global)
pdfjsLib.GlobalWorkerOptions.workerSrc = window.pdfWorkerSrc || '';

// Render PDF to canvas
export async function renderPdfToCanvas(pdfUrl, canvas, scale = 1, maxWidth = null, maxHeight = null) {
  try {
    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    const naturalViewport = page.getViewport({ scale: 1 });
    const devicePixelRatio = window.devicePixelRatio || 1;
    const resolutionMultiplier = 2;

    let actualScale = scale;
    if (maxWidth !== null && maxHeight !== null) {
      const scaleX = maxWidth / naturalViewport.width;
      const scaleY = maxHeight / naturalViewport.height;
      const fitScale = Math.min(scaleX, scaleY);
      actualScale = fitScale * resolutionMultiplier * devicePixelRatio;
    } else {
      actualScale = scale * resolutionMultiplier * devicePixelRatio;
    }

    const viewport = page.getViewport({ scale: actualScale });
    const context = canvas.getContext('2d');

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (maxWidth !== null && maxHeight !== null) {
      const displayScale = Math.min(maxWidth / naturalViewport.width, maxHeight / naturalViewport.height);
      canvas.style.width = (naturalViewport.width * displayScale) + 'px';
      canvas.style.height = (naturalViewport.height * displayScale) + 'px';
    }

    const renderContext = {
      canvasContext: context,
      background: 'rgba(0,0,0,0)',
      viewport: viewport
    };

    await page.render(renderContext).promise;
    return true;
  } catch (error) {
    console.error('PDF render error:', error);
    return false;
  }
}
