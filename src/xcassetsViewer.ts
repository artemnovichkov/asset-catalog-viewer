import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AssetParser } from './parsers/assetParser';
import {
  AssetCatalog,
  AssetItem,
  ConvertedAssetItem
} from './types';

export class XCAssetsViewer {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async openXCAssets(uri: vscode.Uri): Promise<void> {
    const xcassetsPath = uri.fsPath;
    const catalogName = path.basename(xcassetsPath);

    const panel = vscode.window.createWebviewPanel(
      'xcassetsViewer',
      catalogName,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [uri]
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
            data: item.dataSet.data.map(d => ({
              ...d,
              uri: d.path ? webview.asWebviewUri(vscode.Uri.file(d.path)).toString() : '',
              fsPath: d.path || ''
            }))
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

    // Read template file
    const templatePath = path.join(this.context.extensionPath, 'src', 'webview', 'template.html');
    let template = fs.readFileSync(templatePath, 'utf8');

    // Replace placeholders
    template = template.replace('{{TITLE}}', catalog.name);
    template = template.replace('{{ASSETS_DATA}}', assetsJson);

    return template;
  }
}
