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
      if (pauseRefresh) {
        return;
      }
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(async () => {
        if (pauseRefresh) {
          return;
        }
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
      switch (message.command) {
        case 'showColorPanel':
          await this.handleShowColorPanel(message, xcassetsPath, panel, (val) => pauseRefresh = val);
          break;
        case 'rename':
          await this.handleRename(message, xcassetsPath, parser, panel);
          break;
        case 'delete':
          await this.handleDelete(message, xcassetsPath, parser, panel);
          break;
        case 'deleteMultiple':
          await this.handleDeleteMultiple(message, xcassetsPath, parser, panel);
          break;
        case 'addColorSet':
          await this.handleAddColorSet(message, xcassetsPath, panel);
          break;
        case 'quicklook':
          this.handleQuickLook(message, xcassetsPath);
          break;
        case 'showInFinder':
          this.handleShowInFinder(message, xcassetsPath);
          break;
        case 'toggleNamespace':
          await this.handleToggleNamespace(message, xcassetsPath, panel, (val) => pauseRefresh = val);
          break;
        case 'togglePreservesVector':
          await this.handleTogglePreservesVector(message, xcassetsPath, panel, (val) => pauseRefresh = val);
          break;
        case 'changeRenderAs':
          await this.handleChangeRenderAs(message, xcassetsPath, panel, (val) => pauseRefresh = val);
          break;
      }
    });
  }

  private validatePath(filePath: string, rootPath: string): string | null {
    const resolvedPath = path.resolve(filePath);
    const catalogResolved = path.resolve(rootPath);
    if (!resolvedPath.startsWith(catalogResolved)) {
      return null;
    }
    return resolvedPath;
  }

  private async handleShowColorPanel(message: any, xcassetsPath: string, panel: vscode.WebviewPanel, setPauseRefresh: (val: boolean) => void) {
    const { colorSetPath, colorIndex, currentColor } = message;
    const resolvedPath = this.validatePath(colorSetPath, xcassetsPath);
    if (!resolvedPath) {
      vscode.window.showErrorMessage('Invalid path');
      return;
    }

    const { spawn } = require('child_process');
    const colorPickerPath = path.join(this.context.extensionPath, 'native', 'ColorPicker');
    const contentsPath = path.join(resolvedPath, 'Contents.json');

    const colorPicker = spawn(colorPickerPath, [currentColor]);
    let buffer = '';
    setPauseRefresh(true);

    colorPicker.stdout.on('data', async (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; 

                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed || trimmed === '__CLOSED__') {
                    continue;
                  }
      
                  try {
                    const newColor = JSON.parse(trimmed);
                    if (!newColor['color-space']) {
                      continue;
                    }
      
                    const contentsData = await fs.promises.readFile(contentsPath, 'utf8');          const contents = JSON.parse(contentsData);

          if (contents.colors && contents.colors[colorIndex]) {
            contents.colors[colorIndex].color = newColor;
            await fs.promises.writeFile(contentsPath, JSON.stringify(contents, null, 2));

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
      setPauseRefresh(false);
    });

    colorPicker.on('error', (err: Error) => {
      setPauseRefresh(false);
      vscode.window.showErrorMessage(`Color picker failed: ${err.message}`);
    });
  }

  private async handleRename(message: any, xcassetsPath: string, parser: AssetParser, panel: vscode.WebviewPanel) {
    const { oldPath, newName, assetType } = message;
    const resolvedOld = this.validatePath(oldPath, xcassetsPath);
    if (!resolvedOld) {
      vscode.window.showErrorMessage('Invalid path');
      return;
    }

    try {
      const parentDir = path.dirname(resolvedOld);
      let newPath: string;

      if (assetType === 'folder') {
        newPath = path.join(parentDir, newName);
      } else {
        const ext = path.extname(resolvedOld);
        newPath = path.join(parentDir, newName + ext);
      }

      await fs.promises.rename(resolvedOld, newPath);
      const assets = await parser.parse(xcassetsPath);
      panel.webview.html = await this.getHtmlForWebview(panel.webview, assets);
    } catch (err: any) {
      vscode.window.showErrorMessage(`Rename failed: ${err.message}`);
    }
  }

  private async handleDelete(message: any, xcassetsPath: string, parser: AssetParser, panel: vscode.WebviewPanel) {
    const { filePath } = message;
    const resolvedPath = this.validatePath(filePath, xcassetsPath);
    if (!resolvedPath) {
      vscode.window.showErrorMessage('Invalid path');
      return;
    }

    try {
      await fs.promises.rm(resolvedPath, { recursive: true });
      const assets = await parser.parse(xcassetsPath);
      panel.webview.html = await this.getHtmlForWebview(panel.webview, assets);
    } catch (err: any) {
      vscode.window.showErrorMessage(`Delete failed: ${err.message}`);
    }
  }

  private async handleDeleteMultiple(message: any, xcassetsPath: string, parser: AssetParser, panel: vscode.WebviewPanel) {
    const { filePaths } = message;
    const validPaths: string[] = [];
    
    for (const filePath of filePaths) {
      const resolved = this.validatePath(filePath, xcassetsPath);
      if (resolved) {
        validPaths.push(resolved);
      }
    }

    if (validPaths.length === 0) {
      vscode.window.showErrorMessage('No valid paths to delete');
      return;
    }

    try {
      for (const resolvedPath of validPaths) {
        await fs.promises.rm(resolvedPath, { recursive: true });
      }
      const assets = await parser.parse(xcassetsPath);
      panel.webview.html = await this.getHtmlForWebview(panel.webview, assets);
    } catch (err: any) {
      vscode.window.showErrorMessage(`Delete failed: ${err.message}`);
    }
  }

  private async handleAddColorSet(message: any, xcassetsPath: string, panel: vscode.WebviewPanel) {
    const { targetFolderPath } = message;
    let parentDir = xcassetsPath;
    
    if (targetFolderPath) {
      const resolvedTarget = this.validatePath(targetFolderPath, xcassetsPath);
      if (resolvedTarget) {
        parentDir = resolvedTarget;
      }
    }

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
      panel.webview.postMessage({ command: 'colorSetCreated', name: colorSetName, path: colorSetPath });
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to create color set: ${err.message}`);
    }
  }

  private handleQuickLook(message: any, xcassetsPath: string) {
    if (!message.filePath) {
      return;
    }
    const resolved = this.validatePath(message.filePath, xcassetsPath);
    if (!resolved) {
      vscode.window.showErrorMessage('Invalid file path');
      return;
    }
    const { spawn } = require('child_process');
    spawn('qlmanage', ['-p', resolved], { detached: true, stdio: 'ignore' }).unref();
  }

  private handleShowInFinder(message: any, xcassetsPath: string) {
    if (!message.filePath) {
      return;
    }
    const resolved = this.validatePath(message.filePath, xcassetsPath);
    if (!resolved) {
      vscode.window.showErrorMessage('Invalid file path');
      return;
    }
    const { spawn } = require('child_process');
    spawn('open', ['-R', resolved], { detached: true, stdio: 'ignore' }).unref();
  }

  private async handleToggleNamespace(message: any, xcassetsPath: string, panel: vscode.WebviewPanel, setPauseRefresh: (val: boolean) => void) {
    const { folderPath, providesNamespace } = message;
    const resolvedPath = this.validatePath(folderPath, xcassetsPath);
    if (!resolvedPath) {
      vscode.window.showErrorMessage('Invalid path');
      return;
    }

    const contentsPath = path.join(resolvedPath, 'Contents.json');

    setPauseRefresh(true);
    try {
      let contents: any = { info: { author: 'xcode', version: 1 } };

      // Try to read existing Contents.json
      try {
        const data = await fs.promises.readFile(contentsPath, 'utf8');
        contents = JSON.parse(data);
      } catch {
        // File doesn't exist, use default
      }

      // Update provides-namespace property
      if (providesNamespace) {
        if (!contents.properties) {
          contents.properties = {};
        }
        contents.properties['provides-namespace'] = true;
      } else {
        if (contents.properties) {
          delete contents.properties['provides-namespace'];
          // Remove empty properties object
          if (Object.keys(contents.properties).length === 0) {
            delete contents.properties;
          }
        }
      }

      await fs.promises.writeFile(contentsPath, JSON.stringify(contents, null, 2));

      // Notify webview to update left panel
      panel.webview.postMessage({
        command: 'namespaceUpdated',
        folderPath: resolvedPath,
        providesNamespace
      });
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to update namespace: ${err.message}`);
    } finally {
      // Delay unpause to let file watcher events pass
      setTimeout(() => setPauseRefresh(false), 500);
    }
  }

  private async handleTogglePreservesVector(message: any, xcassetsPath: string, panel: vscode.WebviewPanel, setPauseRefresh: (val: boolean) => void) {
    const { imageSetPath, preservesVector } = message;
    const resolvedPath = this.validatePath(imageSetPath, xcassetsPath);
    if (!resolvedPath) {
      vscode.window.showErrorMessage('Invalid path');
      return;
    }

    const contentsPath = path.join(resolvedPath, 'Contents.json');

    setPauseRefresh(true);
    try {
      const data = await fs.promises.readFile(contentsPath, 'utf8');
      const contents = JSON.parse(data);

      // Update preserves-vector-representation property
      if (preservesVector) {
        if (!contents.properties) {
          contents.properties = {};
        }
        contents.properties['preserves-vector-representation'] = true;
      } else {
        if (contents.properties) {
          delete contents.properties['preserves-vector-representation'];
          // Remove empty properties object
          if (Object.keys(contents.properties).length === 0) {
            delete contents.properties;
          }
        }
      }

      await fs.promises.writeFile(contentsPath, JSON.stringify(contents, null, 2));

      // Notify webview to update state
      panel.webview.postMessage({
        command: 'preservesVectorUpdated',
        imageSetPath: resolvedPath,
        preservesVector
      });
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to update preserves vector: ${err.message}`);
    } finally {
      // Delay unpause to let file watcher events pass
      setTimeout(() => setPauseRefresh(false), 500);
    }
  }

  private async handleChangeRenderAs(message: any, xcassetsPath: string, panel: vscode.WebviewPanel, setPauseRefresh: (val: boolean) => void) {
    const { imageSetPath, renderAs } = message;
    const resolvedPath = this.validatePath(imageSetPath, xcassetsPath);
    if (!resolvedPath) {
      vscode.window.showErrorMessage('Invalid path');
      return;
    }

    const contentsPath = path.join(resolvedPath, 'Contents.json');

    setPauseRefresh(true);
    try {
      const data = await fs.promises.readFile(contentsPath, 'utf8');
      const contents = JSON.parse(data);

      // Update template-rendering-intent property
      if (renderAs === 'default') {
        if (contents.properties) {
          delete contents.properties['template-rendering-intent'];
          // Remove empty properties object
          if (Object.keys(contents.properties).length === 0) {
            delete contents.properties;
          }
        }
      } else {
        if (!contents.properties) {
          contents.properties = {};
        }
        contents.properties['template-rendering-intent'] = renderAs;
      }

      await fs.promises.writeFile(contentsPath, JSON.stringify(contents, null, 2));

      // Notify webview to update state
      panel.webview.postMessage({
        command: 'renderAsUpdated',
        imageSetPath: resolvedPath,
        renderAs
      });
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to update render as: ${err.message}`);
    } finally {
      // Delay unpause to let file watcher events pass
      setTimeout(() => setPauseRefresh(false), 500);
    }
  }

  private convertAssetItems(items: AssetItem[], webview: vscode.Webview): ConvertedAssetItem[] {
      return items.map(item => {
        if (item.type === 'folder') {
          return {
            type: 'folder' as const,
            name: item.name,
            path: item.path || '',
            children: item.children ? this.convertAssetItems(item.children, webview) : [],
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
  }

  private async getHtmlForWebview(
    webview: vscode.Webview,
    catalog: AssetCatalog
  ): Promise<string> {
    const config = vscode.workspace.getConfiguration('assetCatalogViewer');
    const largeAssetThreshold = config.get<number>('largeAssetThreshold', 500);

    const assetsData = {
      items: this.convertAssetItems(catalog.items, webview),
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
