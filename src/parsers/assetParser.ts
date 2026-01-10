import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MAX_DIRECTORY_DEPTH } from '../constants';
import {
  AssetCatalog,
  AssetItem,
  ImageSet,
  ImageVariant,
  AppIconSet,
  AppIconVariant,
  ColorSet,
  DataSet,
  DataItem,
  ImageContents,
  AppIconContents,
  ColorContents,
  DataContents,
  ColorDefinition
} from '../types';

export class AssetParser {
  async parse(xcassetsPath: string): Promise<AssetCatalog> {
    const catalog: AssetCatalog = {
      name: path.basename(xcassetsPath),
      items: await this.parseDirectory(xcassetsPath),
    };

    return catalog;
  }

  private async parseDirectory(dirPath: string, depth: number = 0, rootPath?: string): Promise<AssetItem[]> {
    if (depth > MAX_DIRECTORY_DEPTH) {
      console.warn(`Max depth exceeded: ${dirPath}`);
      return [];
    }

    const root = rootPath || dirPath;

    let entries;
    try {
      entries = await fs.promises.readdir(dirPath, {
        withFileTypes: true,
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Cannot read directory: ${dirPath}`);
      return [];
    }

    // Filter valid entries first
    const validEntries = entries.filter(entry => {
      if (!entry.isDirectory()) return false;
      if (entry.name.startsWith('.')) return false;
      const entryPath = path.join(dirPath, entry.name);
      const resolved = path.resolve(entryPath);
      if (!resolved.startsWith(path.resolve(root))) {
        console.warn(`Skipping path outside catalog: ${resolved}`);
        return false;
      }
      return true;
    });

    // Parse all entries in parallel
    const parsePromises = validEntries.map(async (entry): Promise<AssetItem | null> => {
      const entryPath = path.join(dirPath, entry.name);

      if (entry.name.endsWith('.imageset')) {
        const imageSet = await this.parseImageSet(entryPath);
        if (!imageSet) {
          console.warn(`Failed to parse imageset: ${entryPath}`);
          return null;
        }
        return { type: 'imageset', name: imageSet.name, path: entryPath, imageSet };
      } else if (entry.name.endsWith('.appiconset')) {
        const appIconSet = await this.parseAppIconSet(entryPath);
        if (!appIconSet) {
          console.warn(`Failed to parse appiconset: ${entryPath}`);
          return null;
        }
        return { type: 'appiconset', name: appIconSet.name, path: entryPath, appIconSet };
      } else if (entry.name.endsWith('.colorset')) {
        const colorSet = await this.parseColorSet(entryPath);
        if (!colorSet) {
          console.warn(`Failed to parse colorset: ${entryPath}`);
          return null;
        }
        return { type: 'colorset', name: colorSet.name, path: entryPath, colorSet };
      } else if (entry.name.endsWith('.dataset')) {
        const dataSet = await this.parseDataSet(entryPath);
        if (!dataSet) {
          console.warn(`Failed to parse dataset: ${entryPath}`);
          return null;
        }
        return { type: 'dataset', name: dataSet.name, path: entryPath, dataSet };
      } else {
        // Regular folder - recurse into it
        const children = await this.parseDirectory(entryPath, depth + 1, root);
        if (children.length > 0) {
          return { type: 'folder', name: entry.name, path: entryPath, children };
        }
        return null;
      }
    });

    const results = await Promise.all(parsePromises);
    return results
      .filter((item): item is AssetItem => item !== null)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  }

  private async parseImageSet(imageSetPath: string): Promise<ImageSet | null> {
    const contentsPath = path.join(imageSetPath, 'Contents.json');

    let contents: ImageContents;
    try {
      contents = JSON.parse(
        await fs.promises.readFile(contentsPath, 'utf8')
      ) as ImageContents;
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to parse ${path.basename(imageSetPath)}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return null;
    }

    // Validate structure
    if (!contents.images || !Array.isArray(contents.images)) {
      console.warn(`Invalid imageset structure: ${imageSetPath}`);
      return null;
    }

    const images: ImageVariant[] = [];

    for (const image of contents.images || []) {
      const imagePath = image.filename
        ? path.join(imageSetPath, image.filename)
        : undefined;

      images.push({
        filename: image.filename || '',
        scale: image.scale,
        idiom: image.idiom || 'universal',
        subtype: image.subtype,
        path: imagePath || '',
      });
    }

    return {
      name: path.basename(imageSetPath, '.imageset'),
      images,
      templateRenderingIntent: contents.properties?.['template-rendering-intent'],
      preservesVectorRepresentation: contents.properties?.['preserves-vector-representation'],
    };
  }

  private async parseAppIconSet(appIconSetPath: string): Promise<AppIconSet | null> {
    const contentsPath = path.join(appIconSetPath, 'Contents.json');

    let contents: AppIconContents;
    try {
      contents = JSON.parse(
        await fs.promises.readFile(contentsPath, 'utf8')
      ) as AppIconContents;
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to parse ${path.basename(appIconSetPath)}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return null;
    }

    // Validate structure
    if (!contents.images || !Array.isArray(contents.images)) {
      console.warn(`Invalid appiconset structure: ${appIconSetPath}`);
      return null;
    }

    const icons: AppIconVariant[] = [];

    for (const image of contents.images || []) {
      const imagePath = image.filename
        ? path.join(appIconSetPath, image.filename)
        : undefined;

      icons.push({
        filename: image.filename || '',
        size: image.size,
        scale: image.scale,
        idiom: image.idiom || 'universal',
        platform: image.platform,
        appearances: image.appearances || [],
        path: imagePath || '',
      });
    }

    return {
      name: path.basename(appIconSetPath, '.appiconset'),
      icons,
    };
  }

  private async parseColorSet(colorSetPath: string): Promise<ColorSet | null> {
    const contentsPath = path.join(colorSetPath, 'Contents.json');

    let contents: ColorContents;
    try {
      contents = JSON.parse(
        await fs.promises.readFile(contentsPath, 'utf8')
      ) as ColorContents;
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to parse ${path.basename(colorSetPath)}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return null;
    }

    // Validate structure
    if (!contents.colors || !Array.isArray(contents.colors)) {
      console.warn(`Invalid colorset structure: ${colorSetPath}`);
      return null;
    }

    return {
      name: path.basename(colorSetPath, '.colorset'),
      colors: contents.colors as ColorDefinition[],
    };
  }

  private async parseDataSet(dataSetPath: string): Promise<DataSet | null> {
    const contentsPath = path.join(dataSetPath, 'Contents.json');

    let contents: DataContents;
    try {
      contents = JSON.parse(
        await fs.promises.readFile(contentsPath, 'utf8')
      ) as DataContents;
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to parse ${path.basename(dataSetPath)}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return null;
    }

    // Validate structure
    if (!contents.data || !Array.isArray(contents.data)) {
      console.warn(`Invalid dataset structure: ${dataSetPath}`);
      return null;
    }

    const dataItems: DataItem[] = [];
    for (const item of contents.data || []) {
      const dataItem: DataItem = {
        filename: item.filename || '',
        idiom: item.idiom || 'universal',
      };

      if (item.filename) {
        const filePath = path.join(dataSetPath, item.filename);
        dataItem.path = filePath;
        const lowerFilename = item.filename.toLowerCase();

        // .lottie files are binary (ZIP archives), not text
        const isDotLottie = lowerFilename.endsWith('.lottie');
        if (isDotLottie) {
          dataItem.isLottie = true;
        }

        // Only read content for text-based files
        const textExtensions = ['.json', '.txt', '.xml', '.plist', '.strings'];
        const isTextFile = textExtensions.some(ext => lowerFilename.endsWith(ext));

        if (isTextFile) {
          try {
            const content = await fs.promises.readFile(filePath, 'utf8');
            dataItem.content = content;
            // Detect Lottie JSON animation
            if (lowerFilename.endsWith('.json')) {
              dataItem.isLottie = this.isLottieAnimation(content);
            }
          } catch (e) {
            // File missing or not readable as text
            dataItem.content = undefined;
          }
        }
      }

      dataItems.push(dataItem);
    }

    return {
      name: path.basename(dataSetPath, '.dataset'),
      data: dataItems,
    };
  }

  private isLottieAnimation(content: string): boolean {
    try {
      const json = JSON.parse(content);
      // Lottie files have these required properties
      return (
        typeof json.v === 'string' &&
        typeof json.fr === 'number' &&
        typeof json.w === 'number' &&
        typeof json.h === 'number' &&
        Array.isArray(json.layers)
      );
    } catch {
      return false;
    }
  }
}
