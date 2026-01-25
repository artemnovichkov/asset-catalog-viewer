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
      if (!entry.isDirectory()) {
        return false;
      }
      if (entry.name.startsWith('.')) {
        return false;
      }
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
        return this.processAssetSet(entryPath, 'imageset', this.parseImageSet.bind(this));
      } else if (entry.name.endsWith('.appiconset')) {
        return this.processAssetSet(entryPath, 'appiconset', this.parseAppIconSet.bind(this));
      } else if (entry.name.endsWith('.colorset')) {
        return this.processAssetSet(entryPath, 'colorset', this.parseColorSet.bind(this));
      } else if (entry.name.endsWith('.dataset')) {
        return this.processAssetSet(entryPath, 'dataset', this.parseDataSet.bind(this));
      } else {
        // Regular folder - check for Contents.json and recurse
        const children = await this.parseDirectory(entryPath, depth + 1, root);
        let providesNamespace = false;
        try {
          const contents = await this.readContentsFile<{ properties?: { 'provides-namespace'?: boolean } }>(entryPath);
          if (contents?.properties?.['provides-namespace']) {
            providesNamespace = true;
          }
        } catch (e) {
          // Ignore if Contents.json doesn't exist or is invalid
        }
        return { type: 'folder', name: entry.name, path: entryPath, children, providesNamespace };
      }
    });

    const results = await Promise.all(parsePromises);
    return results
      .filter((item): item is AssetItem => item !== null)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  }

  private async processAssetSet<T extends { name: string }>(
    entryPath: string,
    type: AssetItem['type'],
    parser: (path: string) => Promise<T | null>,
    _ignored?: any
  ): Promise<AssetItem | null> {
    const set = await parser(entryPath);
    if (!set) {
      console.warn(`Failed to parse ${type}: ${entryPath}`);
      return null;
    }

    let size = 0;
    // Calculate size based on type
    if (type === 'imageset') {
      const s = set as unknown as ImageSet;
      for (const img of s.images) {
        if (img.path) {
          size += await this.getFileSize(img.path);
        }
      }
    } else if (type === 'appiconset') {
      const s = set as unknown as AppIconSet;
      for (const icon of s.icons) {
        if (icon.path) {
          size += await this.getFileSize(icon.path);
        }
      }
    } else if (type === 'dataset') {
      const s = set as unknown as DataSet;
      for (const item of s.data) {
        if (item.path) {
          size += await this.getFileSize(item.path);
        }
      }
    }

    const item: AssetItem = { type, name: set.name, path: entryPath, size };
    if (type === 'imageset') {
      item.imageSet = set as unknown as ImageSet;
    } else if (type === 'appiconset') {
      item.appIconSet = set as unknown as AppIconSet;
    } else if (type === 'colorset') {
      item.colorSet = set as unknown as ColorSet;
    } else if (type === 'dataset') {
      item.dataSet = set as unknown as DataSet;
    }
    
    return item;
  }

  private async readContentsFile<T>(assetPath: string): Promise<T | null> {
    const contentsPath = path.join(assetPath, 'Contents.json');
    try {
      const content = await fs.promises.readFile(contentsPath, 'utf8');
      return JSON.parse(content) as T;
    } catch (error) {
       // Only show error if it's not a missing file (which is common for folders)
       // But for asset sets it should exist.
       return null;
    }
  }

  private async parseImageSet(imageSetPath: string): Promise<ImageSet | null> {
    const contents = await this.readContentsFile<ImageContents>(imageSetPath);
    
    if (!contents) {
        // Log error only if needed, readContentsFile swallows it but we might want to know for asset sets
        vscode.window.showErrorMessage(`Failed to parse ${path.basename(imageSetPath)}`);
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
        appearances: image.appearances,
      });
    }

    return {
      name: path.basename(imageSetPath, '.imageset'),
      images,
      templateRenderingIntent: contents.properties?.['template-rendering-intent'],
      preservesVectorRepresentation: contents.properties?.['preserves-vector-representation'],
      compressionType: contents.properties?.['compression-type'],
    };
  }

  private async parseAppIconSet(appIconSetPath: string): Promise<AppIconSet | null> {
    const contents = await this.readContentsFile<AppIconContents>(appIconSetPath);
    
    if (!contents) {
        vscode.window.showErrorMessage(`Failed to parse ${path.basename(appIconSetPath)}`);
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
    const contents = await this.readContentsFile<ColorContents>(colorSetPath);
    
    if (!contents) {
        vscode.window.showErrorMessage(`Failed to parse ${path.basename(colorSetPath)}`);
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
    const contents = await this.readContentsFile<DataContents>(dataSetPath);
    
    if (!contents) {
        vscode.window.showErrorMessage(`Failed to parse ${path.basename(dataSetPath)}`);
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

  private async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.promises.stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }
}
