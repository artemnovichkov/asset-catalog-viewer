import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

const outDir = 'out/webview';

// Ensure output directory exists
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Bundle main.js with all dependencies
await esbuild.build({
  entryPoints: ['src/webview/main.js'],
  bundle: true,
  outfile: `${outDir}/main.js`,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: process.argv.includes('--minify'),
  sourcemap: !process.argv.includes('--minify'),
  define: {
    'process.env.NODE_ENV': '"production"'
  }
});

// Copy styles.css
fs.copyFileSync('src/webview/styles.css', `${outDir}/styles.css`);

// Copy template.html
fs.copyFileSync('src/webview/template.html', `${outDir}/template.html`);

// Copy codicons CSS and fonts
const codiconsDir = 'node_modules/@vscode/codicons/dist';
fs.copyFileSync(`${codiconsDir}/codicon.css`, `${outDir}/codicon.css`);
fs.copyFileSync(`${codiconsDir}/codicon.ttf`, `${outDir}/codicon.ttf`);

// Copy PDF.js worker
const pdfWorkerPath = 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs';
fs.copyFileSync(pdfWorkerPath, `${outDir}/pdf.worker.min.mjs`);

console.log('Webview build complete');
