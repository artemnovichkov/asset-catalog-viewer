import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AssetParser } from './parsers/assetParser';
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
    panel.webview.html = this.getHtmlForWebview(panel.webview, assets, xcassetsPath);

    panel.webview.onDidReceiveMessage(message => {
      const { spawn } = require('child_process');

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

  private getHtmlForWebview(
    webview: vscode.Webview,
    catalog: AssetCatalog,
    xcassetsPath: string
  ): string {
    // Convert items to webview format with URIs
    const convertItems = (items: AssetItem[]): ConvertedAssetItem[] => {
      return items.map(item => {
        if (item.type === 'folder') {
          return {
            type: 'folder' as const,
            name: item.name,
            path: item.path || '',
            children: item.children ? convertItems(item.children) : []
          };
        } else if (item.type === 'imageset' && item.imageSet) {
          return {
            type: 'image' as const,
            name: item.imageSet.name,
            path: item.path || '',
            images: item.imageSet.images.map(img => ({
              ...img,
              uri: img.path ? webview.asWebviewUri(vscode.Uri.file(img.path)).toString() : '',
              fsPath: img.path
            }))
          };
        } else if (item.type === 'colorset' && item.colorSet) {
          return {
            type: 'color' as const,
            name: item.colorSet.name,
            path: item.path || '',
            colors: item.colorSet.colors
          };
        } else if (item.type === 'dataset' && item.dataSet) {
          return {
            type: 'data' as const,
            name: item.dataSet.name,
            path: item.path || '',
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

    const assetsData = {
      items: convertItems(catalog.items)
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
    let template = fs.readFileSync(templatePath, 'utf8');

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
