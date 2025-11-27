

















export type Tool =
  | 'rectangle'
  | 'select'
  | 'lasso'
  | 'restore-lasso'
  | 'division'
  | 'eraser'
  | 'eraser-square'
  | 'eraser-polygon'
  | 'eraser-rectangle'
  | 'brush'
  | 'brush-square'
  | 'brush-polygon'
  | 'brush-rectangle';

export type AspectRatio = {
  name: string;
  ratio: number;
  dimensions: string;
  pixels: string;
  megapixels: number;
};

export type GenerationSource = {
  type: 'initial' | 'variation' | 'inpaint' | 'outpaint' | 'crop' | 'split' | 'merge' | 'render-crop' | 'erase' | 'canvas';
  prompt: string;
  timestamp?: number;
  originalDataUrl?: string;
  selection?: Selection;
  referenceImages?: string[];
  originalLayerName?: string;
  upscaledResolution?: { width: number; height: number };
  generationResolution?: { width: number; height: number };
  model?: string;
  isProMode?: boolean;
};

export type GenerationJob = {
  id: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
  progress: number;
  layerId: string;
  sourceVariationIndex: number;
  prompt: string;
  referenceImages: string[];
  error?: string;
  isShown?: boolean;
  jobIndexInBatch?: number;
  totalJobsInBatch?: number;
  type?: 'variation' | 'smart-fill';
};

export type FeatheringState = {
  top: number; // 0-100 percentage
  right: number;
  bottom: number;
  left: number;
};

export type LayerVariation = {
  dataUrl: string;
  width: number;
  height: number;
  generationData: GenerationSource;
  opacity: number;
  brightness: number;
  contrast: number;
  saturate: number;
  transform: {
    offsetX: number;
    offsetY: number;
    scaleX: number;
    scaleY: number;
  };
  feather?: FeatheringState;
  originalDataUrlForFeather?: string;
};

export type Layer = {
  id: string;
  type: 'image';
  name: string;
  visible: boolean;
  x: number;
  y: number;
  variations: LayerVariation[];
  activeVariationIndex: number;
  isBackground: boolean;
};

export type Selection = {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
};

export type FeatherEditState = {
  layerId: string;
  handle: 'top' | 'right' | 'bottom' | 'left';
};

export type InteractionState = {
  type: 'none' | 'panning' | 'drawing' | 'moving' | 'resizing' | 'erasing' | 'restoring' | 'moving-division' | 'drawing-erase-lasso' | 'drawing-restore-lasso' | 'holding-division' | 'resizing-background' | 'moving-recording-crop' | 'editing-feather';
  startPoint?: { x: number; y: number };
  startOffset?: { x: number; y: number };
  startSelection?: Selection;
  startLayer?: Layer;
  cursor?: string;
  clickedRect?: Selection;
  featherEditState?: FeatherEditState;
};

export type AspectRatioData = {
  source:
  | { type: 'initial-background'; initialDataUrl: string }
  | { type: 'layer'; layer: Layer };
  targetRatio: AspectRatio;
  onConfirm: (result: { dataUrl: string; width: number; height: number; }) => void;
} | null;

export type EnhanceGroupData = {
  isOpen: boolean;
};

export type RenderLayerData = {
  layerId: string;
} | null;

export type EditorHistory = {
  layers: Layer[];
};

export type DivisionToolState = {
  isActive: boolean;
  divisions: number;
  suggestionIndex: number;
  suggestedRects: Selection[];
  suggestionType: 'simple-horizontal' | 'simple-vertical' | 'simple-grid' | 'optimized-quality-horizontal' | 'optimized-quality-vertical' | 'optimized-quality-grid' | 'optimized-unlimited-horizontal' | 'optimized-unlimited-vertical' | 'optimized-unlimited-grid' | 'loaded-layout';
  qualityLoss: number;
  isStandardRatio: boolean;
  offsetX: number;
  offsetY: number;
  overlap: number;
};

export type SelectionDivisionPreview = {
  isActive: boolean;
  rects: Selection[];
};

export type User = {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  credits: number;
  renderCount: number;
  theme: 'light' | 'dark' | 'nude' | 'ocean' | 'rainbow' | 'stone';
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  stripeCurrentPeriodEnd: Date | null;
};

export type RecordingMode = 'instagram' | 'hd' | null;

export type RecordingCropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
  format: RecordingMode;
};

export type Scene = {
  type: 'zoom_in' | 'typing' | 'result' | 'full_canvas_hold';
  duration: number;
  currentVariationMap: Map<string, number>;
  visibilityMap: Map<string, boolean>;
  layer?: Layer;
  startZoom?: number;
  endZoom?: number;
  startOffset?: { x: number; y: number };
  endOffset?: { x: number; y: number };
} & (
    {
      type: 'zoom_in';
      selection: Selection;
      animationEffect: 'zoom' | 'selection_rectangle';
    } |
    {
      type: 'typing';
      prompt?: string;
      selection: Selection;
    } |
    {
      type: 'result';
      previousVariationIndex: number;
      layerForFade: Layer;
    } |
    {
      type: 'full_canvas_hold';
    }
  );

export type ActiveToolMenu = 'selection' | 'erase' | 'restore' | null;


export interface EditorContextType {
  layers: Layer[];
  setLayers: (layers: Layer[] | ((prev: Layer[]) => Layer[])) => void;
  reorderLayers: (startIndex: number, endIndex: number) => void;
  selectedLayerIds: string[];
  setSelectedLayerIds: React.Dispatch<React.SetStateAction<string[]>>;
  lastEditedLayerId: string | null;
  setLastEditedLayerId: React.Dispatch<React.SetStateAction<string | null>>;
  tool: Tool;
  setTool: React.Dispatch<React.SetStateAction<Tool>>;
  addPaintingCanvas: (data: { dataUrl: string, width: number, height: number } | { width: number, height: number }, name: string) => void;
  addLayer: (dataUrl: string, name: string, options?: { x?: number, y?: number }) => void;
  addLayerInPlace: (variations: (Omit<LayerVariation, 'generationData' | 'transform' | 'opacity' | 'brightness' | 'contrast' | 'saturate'> & { generationData: Omit<GenerationSource, 'timestamp'> })[], selection: Selection, name?: string) => Layer;
  deleteLayer: (id: string) => void;
  deleteVariationFromLayer: (layerId: string, variationIndex: number) => void;
  toggleLayerVisibility: (id: string) => void;
  updateLayer: (id: string, newProps: Partial<Omit<Layer, 'variations' | 'activeVariationIndex'>> & { variations?: LayerVariation[], activeVariationIndex?: number }) => void;
  addVariationToLayer: (id: string, dataUrl: string, generationData: Omit<GenerationSource, 'timestamp'>, options?: { width?: number; height?: number }) => void;
  eraseFromLayer: (layerId: string, points: { x: number, y: number }[]) => void;
  eraseWithPolygon: (layerId: string, points: { x: number, y: number }[]) => void;
  eraseWithSelection: (layerId: string, selection: Selection) => void;
  restoreToLayer: (layerId: string, points: { x: number, y: number }[]) => Promise<void>;
  restoreWithPolygon: (layerId: string, points: { x: number, y: number }[]) => Promise<void>;
  getCanvasDataUrl: (includeBackground?: boolean, format?: 'image/png' | 'image/jpeg', layersToInclude?: Layer[], scale?: number, boundsOnly?: boolean) => Promise<{ dataUrl: string, bounds: { minX: number, minY: number, width: number, height: number } }>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  offset: { x: number; y: number };
  setOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  selection: Selection;
  setSelection: React.Dispatch<React.SetStateAction<Selection>>;
  selectAll: () => void;
  isSelectionActionMenuVisible: boolean;
  setIsSelectionActionMenuVisible: React.Dispatch<React.SetStateAction<boolean>>;
  aspectRatioData: AspectRatioData | null;
  setAspectRatioData: React.Dispatch<React.SetStateAction<AspectRatioData | null>>;
  message: { text: string, level: 'info' | 'warning' | 'danger' } | null;
  setMessage: React.Dispatch<React.SetStateAction<{ text: string, level: 'info' | 'warning' | 'danger' } | null>>;
  openCollapsibleId: string | null;
  setOpenCollapsibleId: React.Dispatch<React.SetStateAction<string | null>>;
  enhanceGroupData: EnhanceGroupData;
  setEnhanceGroupData: React.Dispatch<React.SetStateAction<EnhanceGroupData>>;
  renderLayerData: RenderLayerData | null;
  setRenderLayerData: React.Dispatch<React.SetStateAction<RenderLayerData | null>>;
  generationCount: number;
  setGenerationCount: React.Dispatch<React.SetStateAction<number>>;
  performCrop: (renderAfterCrop?: boolean) => Promise<void>;
  history: EditorHistory[];
  historyIndex: number;
  undo: () => void;
  redo: () => void;
  undoLongPress: () => void;
  redoLongPress: () => void;
  eraserSize: number;
  setEraserSize: React.Dispatch<React.SetStateAction<number>>;
  eraserOpacity: number;
  setEraserOpacity: React.Dispatch<React.SetStateAction<number>>;
  brushSize: number;
  setBrushSize: React.Dispatch<React.SetStateAction<number>>;
  brushOpacity: number;
  setBrushOpacity: React.Dispatch<React.SetStateAction<number>>;
  divisionTool: DivisionToolState;
  setDivisionTool: React.Dispatch<React.SetStateAction<DivisionToolState>>;
  generateDivisionSuggestions: (divisions: number, suggestionIndexOffset?: number, newOverlap?: number) => void;
  setDivisionOverlap: (overlap: number) => void;
  splitImageIntoLayers: () => Promise<void>;
  prepareSelectionSplit: (numDivisions: number) => void;
  confirmSelectionSplit: () => Promise<void>;
  selectionDivisionPreview: SelectionDivisionPreview;
  setSelectionDivisionPreview: React.Dispatch<React.SetStateAction<SelectionDivisionPreview>>;
  mergeLayers: () => Promise<void>;
  updateVariation: (layerId: string, variationIndex: number, newProps: Partial<LayerVariation>) => void;
  validDivisionCounts: number[];
  isApiKeyDialogOpen: boolean;
  setIsApiKeyDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  canGenerate: () => boolean;
  lassoPoints: { x: number, y: number }[];
  setLassoPoints: React.Dispatch<React.SetStateAction<{ x: number, y: number }[]>>;
  centerAndZoom: (imgWidth: number, imgHeight: number, layerX?: number, layerY?: number) => void;
  savedDivisionLayouts: Selection[][];
  saveCurrentDivisionLayout: () => void;
  loadDivisionLayout: (layoutIndex: number) => void;
  isBackgroundResizeMode: boolean;
  setIsBackgroundResizeMode: React.Dispatch<React.SetStateAction<boolean>>;
  addGenerationJob: (job: Omit<GenerationJob, 'id' | 'status' | 'progress' | 'error' | 'isShown'>) => void;
  generationJobs: GenerationJob[];
  backgroundLayer: Layer | undefined;
  isRecording: boolean;
  setIsRecording: React.Dispatch<React.SetStateAction<boolean>>;
  isRecordingSetupOpen: boolean;
  setIsRecordingSetupOpen: React.Dispatch<React.SetStateAction<boolean>>;
  recordingCropArea: RecordingCropArea | null;
  setRecordingCropArea: React.Dispatch<React.SetStateAction<RecordingCropArea | null>>;
  targetLayerIdForRecording: string | null;
  setTargetLayerIdForRecording: React.Dispatch<React.SetStateAction<string | null>>;
  isProcessingVideo: boolean;
  setIsProcessingVideo: React.Dispatch<React.SetStateAction<boolean>>;
  videoStatusMessage: string;
  setVideoStatusMessage: React.Dispatch<React.SetStateAction<string>>;
  recordedVideoBlob: { blob: Blob, mimeType: string } | null;
  setRecordedVideoBlob: React.Dispatch<React.SetStateAction<{ blob: Blob, mimeType: string } | null>>;
  promptFontSize: number;
  setPromptFontSize: React.Dispatch<React.SetStateAction<number>>;
  videoScript: Scene[];
  setVideoScript: React.Dispatch<React.SetStateAction<Scene[]>>;
  videoFPS: number;
  setVideoFPS: React.Dispatch<React.SetStateAction<number>>;
  videoSpeed: number;
  setVideoSpeed: React.Dispatch<React.SetStateAction<number>>;
  featherEditMode: { layerId: string | null };
  setFeatherEditMode: React.Dispatch<React.SetStateAction<{ layerId: string | null }>>;
  updateFeatherPreview: (layerId: string, variationIndex: number, feather: FeatheringState) => void;
  applyFeathering: (layerId: string, variationIndex: number, feather: FeatheringState) => Promise<void>;
  confirmFeathering: (layerId: string) => void;
  cancelFeathering: (layerId: string) => void;
  activeToolMenu: ActiveToolMenu;
  setActiveToolMenu: React.Dispatch<React.SetStateAction<ActiveToolMenu>>;
  activateTool: (tool: Tool) => void;
  rectangleThickness: number;
  setRectangleThickness: React.Dispatch<React.SetStateAction<number>>;
  isProMode: boolean;
  setIsProMode: React.Dispatch<React.SetStateAction<boolean>>;
  toast: (props: any) => void;
}
