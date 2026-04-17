export type LayerType = 'background_blur' | 'image' | 'gradient' | 'text' | 'shape';

interface BaseLayer {
  id: string;
  type: LayerType;
  label: string;
  visible: boolean;
  opacity: number; // 0–1
}

export interface BackgroundBlurLayer extends BaseLayer {
  type: 'background_blur';
  blurRadius: number;
  brightness: number; // 0–1
}

export interface ImageLayer extends BaseLayer {
  type: 'image';
  source: 'cover';
  x: number;
  y: number;
  width: number;
  height: number;
  fit: 'cover' | 'contain' | 'fill';
  position: 'top' | 'center' | 'bottom';
}

export interface GradientStop {
  offset: number;  // 0–1
  color: string;   // hex
  opacity: number; // 0–1
}

export interface GradientLayer extends BaseLayer {
  type: 'gradient';
  x: number;
  y: number;
  width: number;
  height: number;
  direction: 'to-bottom' | 'to-top' | 'to-right' | 'to-left';
  stops: GradientStop[];
}

export type TextSource =
  | 'title'
  | 'summary'
  | 'source_name'
  | 'niche_label'
  | 'custom'
  | 'full_text_block';

export interface TextLayer extends BaseLayer {
  type: 'text';
  source: TextSource;
  customValue?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: 400 | 700;
  color: string;
  lineHeight: number;
  letterSpacing?: number;
  truncateAt?: number;
  backgroundColor?: string;
  borderRadius?: number;
  paddingX?: number;
  paddingY?: number;
  alignSelf?: 'flex-start' | 'center' | 'flex-end';
}

export interface ShapeLayer extends BaseLayer {
  type: 'shape';
  shape: 'rectangle';
  x: number;
  y: number;
  width: number | 'full';
  height: number;
  backgroundColor: string;
  borderRadius?: number;
  anchor?: 'absolute';
  bottom?: number;
  left?: number;
}

export type AnyLayer =
  | BackgroundBlurLayer
  | ImageLayer
  | GradientLayer
  | TextLayer
  | ShapeLayer;

export interface StoryTemplateConfig {
  version: 1;
  canvasWidth: 1080;
  canvasHeight: 1920;
  accentColor: string;
  layers: AnyLayer[];
}

export interface StoryTemplate {
  id: string;
  niche: string;
  slot: 1 | 2 | 3;
  name: string;
  config: StoryTemplateConfig;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PreviewSampleData {
  title: string;
  summary: string;
  sourceName: string;
  chipLabel: string;
  coverImageUrl: string;
}
