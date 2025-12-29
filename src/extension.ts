import * as vscode from 'vscode';
import { XCAssetsViewer } from './xcassetsViewer';

export function activate(context: vscode.ExtensionContext) {
  const viewer = new XCAssetsViewer(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('xcassetsViewer.openViewer', async (uri?: vscode.Uri) => {
      if (!uri) {
        const selected = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          filters: { 'XCAssets': ['xcassets'] }
        });
        if (selected && selected[0]) {
          uri = selected[0];
        } else {
          return;
        }
      }

      viewer.openXCAssets(uri);
    })
  );
}

export function deactivate() {}
