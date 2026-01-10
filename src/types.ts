// Contents.json schema types
export interface ImageContents {
  images?: Array<{
    filename?: string;
    scale?: string;
    idiom?: string;
    subtype?: string;
  }>;
  properties?: {
    'template-rendering-intent'?: string;
    'preserves-vector-representation'?: boolean;
  };
}

export interface ColorContents {
  colors?: Array<{
    idiom: string;
    color?: {
      'color-space': string;
      components: {
        red?: string;
        green?: string;
        blue?: string;
        alpha?: string;
      };
    };
    appearances?: Array<{
      appearance: string;
      value: string;
    }>;
  }>;
}

export interface AppIconContents {
  images?: Array<{
    filename?: string;
    size?: string;
    scale?: string;
    idiom?: string;
    platform?: string;
    appearances?: Array<{
      appearance: string;
      value: string;
    }>;
  }>;
}

export interface DataContents {
  data?: Array<{
    filename?: string;
    idiom?: string;
  }>;
}

// Converted asset types
export interface ConvertedImageVariant {
  filename: string;
  scale?: string;
  idiom: string;
  subtype?: string;
  path: string;
  uri: string;
  fsPath: string;
}

export interface ColorDefinition {
  idiom: string;
  color?: ColorComponents;
  appearances?: AppearanceVariant[];
  subtype?: string;
}

export interface ColorComponents {
  'color-space': string;
  components: {
    red?: string;
    green?: string;
    blue?: string;
    alpha?: string;
  };
}

export interface AppearanceVariant {
  appearance: string;
  value: string;
}

export interface ConvertedDataItem {
  filename: string;
  idiom: string;
  path?: string;
  content?: string;
  uri: string;
  fsPath: string;
  isLottie?: boolean;
}

export interface ConvertedAppIconVariant {
  filename: string;
  size?: string;
  scale?: string;
  idiom: string;
  platform?: string;
  appearances: AppearanceVariant[];
  path: string;
  uri: string;
  fsPath: string;
}

export type ConvertedAssetItem =
  | { type: 'folder'; name: string; path: string; children: ConvertedAssetItem[] }
  | { type: 'image'; name: string; path: string; size: number; images: ConvertedImageVariant[]; templateRenderingIntent?: string; preservesVectorRepresentation?: boolean }
  | { type: 'color'; name: string; path: string; size: number; colors: ColorDefinition[] }
  | { type: 'data'; name: string; path: string; size: number; data: ConvertedDataItem[] }
  | { type: 'appicon'; name: string; path: string; size: number; icons: ConvertedAppIconVariant[] };

export interface AssetCatalog {
  name: string;
  items: AssetItem[];
}

export interface AssetItem {
  type: 'folder' | 'imageset' | 'colorset' | 'dataset' | 'appiconset';
  name: string;
  path?: string;
  size?: number;
  imageSet?: ImageSet;
  colorSet?: ColorSet;
  dataSet?: DataSet;
  appIconSet?: AppIconSet;
  children?: AssetItem[];
}

export interface ImageSet {
  name: string;
  images: ImageVariant[];
  templateRenderingIntent?: string;
  preservesVectorRepresentation?: boolean;
}

export interface ImageVariant {
  filename: string;
  scale?: string;
  idiom: string;
  subtype?: string;
  path: string;
}

export interface ColorSet {
  name: string;
  colors: ColorDefinition[];
}

export interface DataSet {
  name: string;
  data: DataItem[];
}

export interface DataItem {
  filename: string;
  idiom: string;
  path?: string;
  content?: string;
  isLottie?: boolean;
}

export interface AppIconSet {
  name: string;
  icons: AppIconVariant[];
}

export interface AppIconVariant {
  filename: string;
  size?: string;
  scale?: string;
  idiom: string;
  platform?: string;
  appearances: AppearanceVariant[];
  path: string;
}
