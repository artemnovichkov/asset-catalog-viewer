import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AssetParser } from './parsers/assetParser';
import { MAX_DIRECTORY_DEPTH, SWIFTUI_COLOR_TEMPLATE, SWIFTUI_IMAGE_TEMPLATE, NSDATA_ASSET_TEMPLATE } from './constants';
import {
  AssetCatalog,
  AssetItem,
  ConvertedAssetItem,
  ConvertedDataItem
} from './types';

export class XCAssetsViewer {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async openXCAssets(uri: vscode.Uri): Promise<void> {
    const xcassetsPath = uri.fsPath;
    const catalogName = path.basename(xcassetsPath);

    const webviewPath = vscode.Uri.file(path.join(this.context.extensionPath, 'out', 'webview'));
    const panel = vscode.window.createWebviewPanel(
      'xcassetsViewer',
      catalogName,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [uri, webviewPath]
      }
    );

    const parser = new AssetParser();
    const assets = await parser.parse(xcassetsPath);
    panel.webview.html = await this.getHtmlForWebview(panel.webview, assets);

    // Watch for file system changes
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(xcassetsPath, '**/*')
    );

    let debounceTimer: NodeJS.Timeout | undefined;
    let pauseRefresh = false;
    const refresh = async () => {
      if (pauseRefresh) return;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(async () => {
        if (pauseRefresh) return;
        const updatedAssets = await parser.parse(xcassetsPath);
        panel.webview.html = await this.getHtmlForWebview(panel.webview, updatedAssets);
      }, 300);
    };

    watcher.onDidCreate(refresh);
    watcher.onDidChange(refresh);
    watcher.onDidDelete(deletedUri => {
      if (deletedUri.fsPath === xcassetsPath) {
        panel.dispose();
        return;
      }
      refresh();
    });

    // Watch for configuration changes
    const configWatcher = vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('assetCatalogViewer.largeAssetThreshold')) {
        refresh();
      }
    });

    panel.onDidDispose(() => {
      watcher.dispose();
      configWatcher.dispose();
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    });

    panel.webview.onDidReceiveMessage(async message => {
      const { spawn, execFile } = require('child_process');

      if (message.command === 'showColorPanel') {
        const { colorSetPath, colorIndex, currentColor } = message;

        // Validate path
        const resolvedPath = path.resolve(colorSetPath);
        const catalogResolved = path.resolve(xcassetsPath);
        if (!resolvedPath.startsWith(catalogResolved)) {
          vscode.window.showErrorMessage('Invalid path');
          return;
        }

        const colorPickerPath = path.join(this.context.extensionPath, 'native', 'ColorPicker');
        const contentsPath = path.join(resolvedPath, 'Contents.json');

        // Spawn the color picker with real-time updates
        const colorPicker = spawn(colorPickerPath, [currentColor]);
        let buffer = '';
        pauseRefresh = true;

        colorPicker.stdout.on('data', async (data: Buffer) => {
          buffer += data.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === '__CLOSED__') continue;

            try {
              const newColor = JSON.parse(trimmed);
              if (!newColor['color-space']) continue;

              // Read and update Contents.json
              const contentsData = await fs.promises.readFile(contentsPath, 'utf8');
              const contents = JSON.parse(contentsData);

              if (contents.colors && contents.colors[colorIndex]) {
                contents.colors[colorIndex].color = newColor;
                await fs.promises.writeFile(contentsPath, JSON.stringify(contents, null, 2));

                // Send targeted update to webview (no full refresh)
                panel.webview.postMessage({
                  command: 'colorUpdated',
                  colorSetPath: resolvedPath,
                  colorIndex,
                  newColor
                });
              }
            } catch {
              // Ignore parse errors
            }
          }
        });

        colorPicker.on('close', () => {
          pauseRefresh = false;
        });

        colorPicker.on('error', (err: Error) => {
          pauseRefresh = false;
          vscode.window.showErrorMessage(`Color picker failed: ${err.message}`);
        });

        return;
      }

      if (message.command === 'rename') {
        const { oldPath, newName, assetType } = message;

        // Validate oldPath is within xcassetsPath
        const resolvedOld = path.resolve(oldPath);
        const catalogResolved = path.resolve(xcassetsPath);
        if (!resolvedOld.startsWith(catalogResolved)) {
          vscode.window.showErrorMessage('Invalid path');
          return;
        }

        try {
          const parentDir = path.dirname(resolvedOld);
          let newPath: string;

          if (assetType === 'folder') {
            // Folder: rename directory
            newPath = path.join(parentDir, newName);
          } else {
            // Asset: rename directory and update extension
            const ext = path.extname(resolvedOld);
            newPath = path.join(parentDir, newName + ext);
          }

          // Rename the directory
          await fs.promises.rename(resolvedOld, newPath);

          // Re-parse and refresh webview
          const assets = await parser.parse(xcassetsPath);
          panel.webview.html = await this.getHtmlForWebview(panel.webview, assets);

        } catch (err: any) {
          vscode.window.showErrorMessage(`Rename failed: ${err.message}`);
        }
        return;
      }

      if (message.command === 'delete') {
        const { filePath } = message;

        // Validate path is within xcassetsPath
        const resolvedPath = path.resolve(filePath);
        const catalogResolved = path.resolve(xcassetsPath);
        if (!resolvedPath.startsWith(catalogResolved)) {
          vscode.window.showErrorMessage('Invalid path');
          return;
        }

        try {
          await fs.promises.rm(resolvedPath, { recursive: true });

          // Re-parse and refresh webview
          const assets = await parser.parse(xcassetsPath);
          panel.webview.html = await this.getHtmlForWebview(panel.webview, assets);
        } catch (err: any) {
          vscode.window.showErrorMessage(`Delete failed: ${err.message}`);
        }
        return;
      }

      if (message.command === 'deleteMultiple') {
        const { filePaths } = message;
        const catalogResolved = path.resolve(xcassetsPath);

        // Validate all paths
        const validPaths: string[] = [];
        for (const filePath of filePaths) {
          const resolvedPath = path.resolve(filePath);
          if (resolvedPath.startsWith(catalogResolved)) {
            validPaths.push(resolvedPath);
          }
        }

        if (validPaths.length === 0) {
          vscode.window.showErrorMessage('No valid paths to delete');
          return;
        }

        try {
          // Delete all valid paths
          for (const resolvedPath of validPaths) {
            await fs.promises.rm(resolvedPath, { recursive: true });
          }

          // Re-parse and refresh webview
          const assets = await parser.parse(xcassetsPath);
          panel.webview.html = await this.getHtmlForWebview(panel.webview, assets);
        } catch (err: any) {
          vscode.window.showErrorMessage(`Delete failed: ${err.message}`);
        }
        return;
      }

      if (message.command === 'addColorSet') {
        const { targetFolderPath } = message;

        // Determine parent folder
        let parentDir = xcassetsPath;
        if (targetFolderPath) {
          const resolvedTarget = path.resolve(targetFolderPath);
          const catalogResolved = path.resolve(xcassetsPath);
          if (resolvedTarget.startsWith(catalogResolved)) {
            parentDir = resolvedTarget;
          }
        }

        // Generate unique name
        let baseName = 'Color';
        let colorSetName = baseName;
        let counter = 1;
        while (fs.existsSync(path.join(parentDir, `${colorSetName}.colorset`))) {
          colorSetName = `${baseName} ${counter}`;
          counter++;
        }

        const colorSetPath = path.join(parentDir, `${colorSetName}.colorset`);
        const contentsJson = {
          colors: [
            {
              color: {
                'color-space': 'display-p3',
                components: { alpha: '1.000', blue: '1.000', green: '1.000', red: '1.000' }
              },
              idiom: 'universal'
            },
            {
              appearances: [{ appearance: 'luminosity', value: 'dark' }],
              color: {
                'color-space': 'display-p3',
                components: { alpha: '1.000', blue: '1.000', green: '1.000', red: '1.000' }
              },
              idiom: 'universal'
            }
          ],
          info: { author: 'xcode', version: 1 }
        };

        try {
          await fs.promises.mkdir(colorSetPath);
          await fs.promises.writeFile(
            path.join(colorSetPath, 'Contents.json'),
            JSON.stringify(contentsJson, null, 2)
          );

          // File watcher will auto-refresh, but send message for selection
          panel.webview.postMessage({ command: 'colorSetCreated', name: colorSetName, path: colorSetPath });
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to create color set: ${err.message}`);
        }
        return;
      }

      // Validate path
      if (!message.filePath) {
        return;
      }
      const resolved = path.resolve(message.filePath);
      const catalogResolved = path.resolve(xcassetsPath);
      if (!resolved.startsWith(catalogResolved)) {
        vscode.window.showErrorMessage('Invalid file path');
        return;
      }

      if (message.command === 'quicklook') {
        spawn('qlmanage', ['-p', resolved], { detached: true, stdio: 'ignore' }).unref();
      } else if (message.command === 'showInFinder') {
        spawn('open', ['-R', resolved], { detached: true, stdio: 'ignore' }).unref();
      }
    });
  }

  private async getHtmlForWebview(
    webview: vscode.Webview,
    catalog: AssetCatalog
  ): Promise<string> {
    // Convert items to webview format with URIs
    const convertItems = (items: AssetItem[]): ConvertedAssetItem[] => {
      return items.map(item => {
        if (item.type === 'folder') {
          return {
            type: 'folder' as const,
            name: item.name,
            path: item.path || '',
            children: item.children ? convertItems(item.children) : [],
            providesNamespace: item.providesNamespace
          };
        } else if (item.type === 'imageset' && item.imageSet) {
          return {
            type: 'image' as const,
            name: item.imageSet.name,
            path: item.path || '',
            size: item.size || 0,
            images: item.imageSet.images.map(img => ({
              ...img,
              uri: img.path ? webview.asWebviewUri(vscode.Uri.file(img.path)).toString() : '',
              fsPath: img.path
            })),
            templateRenderingIntent: item.imageSet.templateRenderingIntent,
            preservesVectorRepresentation: item.imageSet.preservesVectorRepresentation,
            compressionType: item.imageSet.compressionType
          };
        } else if (item.type === 'colorset' && item.colorSet) {
          return {
            type: 'color' as const,
            name: item.colorSet.name,
            path: item.path || '',
            size: item.size || 0,
            colors: item.colorSet.colors
          };
        } else if (item.type === 'dataset' && item.dataSet) {
          return {
            type: 'data' as const,
            name: item.dataSet.name,
            path: item.path || '',
            size: item.size || 0,
            data: item.dataSet.data.map(d => {
              const converted: ConvertedDataItem = {
                filename: d.filename,
                idiom: d.idiom,
                path: d.path,
                content: d.content,
                uri: d.path ? webview.asWebviewUri(vscode.Uri.file(d.path)).toString() : '',
                fsPath: d.path || '',
                isLottie: d.isLottie
              };
              return converted;
            })
          };
        } else if (item.type === 'appiconset' && item.appIconSet) {
          return {
            type: 'appicon' as const,
            name: item.appIconSet.name,
            path: item.path || '',
            size: item.size || 0,
            icons: item.appIconSet.icons.map(icon => ({
              ...icon,
              uri: icon.path ? webview.asWebviewUri(vscode.Uri.file(icon.path)).toString() : '',
              fsPath: icon.path
            }))
          };
        }
        return null;
      }).filter((item): item is ConvertedAssetItem => item !== null);
    };

    const config = vscode.workspace.getConfiguration('assetCatalogViewer');
    const largeAssetThreshold = config.get<number>('largeAssetThreshold', 500);

    const assetsData = {
      items: convertItems(catalog.items),
      config: {
        largeAssetThreshold,
        templates: {
          color: SWIFTUI_COLOR_TEMPLATE,
          image: SWIFTUI_IMAGE_TEMPLATE,
          data: NSDATA_ASSET_TEMPLATE
        }
      }
    };

    const assetsJson = JSON.stringify(assetsData);

    // Get URIs for external resources
    const webviewDir = path.join(this.context.extensionPath, 'out', 'webview');
    const stylesUri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewDir, 'styles.css')));
    const mainJsUri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewDir, 'main.js')));
    const codiconsUri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewDir, 'codicon.css')));
    const pdfWorkerUri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewDir, 'pdf.worker.min.mjs')));

    // Read template file
    const templatePath = path.join(webviewDir, 'template.html');
    let template = await fs.promises.readFile(templatePath, 'utf8');

    // Replace placeholders
    template = template.replace('{{STYLES_URI}}', stylesUri.toString());
    template = template.replace('{{MAIN_JS_URI}}', mainJsUri.toString());
    template = template.replace('{{CODICONS_URI}}', codiconsUri.toString());
    template = template.replace('{{PDF_WORKER_URI}}', pdfWorkerUri.toString());
    template = template.replace('{{TITLE}}', catalog.name);
    template = template.replace('{{ASSETS_DATA}}', assetsJson);

    return template;
  }
}
