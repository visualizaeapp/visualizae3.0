

'use client';

import React, { createContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';
import type { Tool, Layer, Selection, AspectRatio, GenerationSource, LayerVariation, AspectRatioData, EnhanceGroupData, RenderLayerData, EditorHistory, DivisionToolState, SelectionDivisionPreview, EditorContextType, GenerationJob, RecordingCropArea, Scene, FeatheringState, ActiveToolMenu } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { generateVariationAction, smartBackgroundFillAction } from '@/app/actions';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import { applyEdgeFeathering, loadImage } from '@/lib/utils/video';
import { resizeImage, resizeToClosestStandard } from '@/lib/utils/image';
import { ASPECT_RATIOS } from '@/lib/consts';

const INITIAL_DIVISION_TOOL_STATE: DivisionToolState = {
  isActive: false,
  divisions: 4,
  suggestionIndex: 0,
  suggestedRects: [],
  suggestionType: 'simple-horizontal',
  qualityLoss: 0,
  isStandardRatio: false,
  offsetX: 0,
  offsetY: 0,
  overlap: 0,
};

const INITIAL_SELECTION_DIVISION_PREVIEW_STATE: SelectionDivisionPreview = {
  isActive: false,
  rects: [],
};

export const EditorContext = createContext<EditorContextType | null>(null);

const getFactorPairs = (n: number): { rows: number, cols: number }[] => {
  const pairs: { rows: number, cols: number }[] = [];
  for (let i = 1; i <= Math.sqrt(n); i++) {
    if (n % i === 0) {
      pairs.push({ rows: i, cols: n / i });
      if (i * i !== n) {
        pairs.push({ rows: n / i, cols: i });
      }
    }
  }
  return pairs;
};

export function EditorProvider({ children }: { children: ReactNode }) {
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
  const [lastEditedLayerId, setLastEditedLayerId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('rectangle');
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selection, setSelection] = useState<Selection>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    visible: false,
  });
  const [isSelectionActionMenuVisible, setIsSelectionActionMenuVisible] = useState(false);
  const [openCollapsibleId, setOpenCollapsibleId] = useState<string | null>(null);
  const [aspectRatioData, setAspectRatioData] = useState<AspectRatioData | null>(null);
  const [message, setMessage] = useState<{ text: string, level: 'info' | 'warning' | 'danger' } | null>(null);
  const [enhanceGroupData, setEnhanceGroupData] = useState<EnhanceGroupData>({ isOpen: false });
  const [renderLayerData, setRenderLayerData] = useState<RenderLayerData | null>(null);
  const [generationCount, setGenerationCount] = useState(1);
  const [history, setHistory] = useState<EditorHistory[]>([{ layers: [] }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [eraserSize, setEraserSize] = useState(50);
  const [eraserOpacity, setEraserOpacity] = useState(100);
  const [brushSize, setBrushSize] = useState(50);
  const [brushOpacity, setBrushOpacity] = useState(100);
  const [divisionTool, setDivisionTool] = useState<DivisionToolState>(INITIAL_DIVISION_TOOL_STATE);
  const [selectionDivisionPreview, setSelectionDivisionPreview] = useState<SelectionDivisionPreview>(INITIAL_SELECTION_DIVISION_PREVIEW_STATE);
  const [validDivisionCounts, setValidDivisionCounts] = useState<number[]>([]);
  const [lassoPoints, setLassoPoints] = useState<{ x: number, y: number }[]>([]);
  const [savedDivisionLayouts, setSavedDivisionLayouts] = useState<Selection[][]>([]);
  const { toast } = useToast();
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const [isBackgroundResizeMode, setIsBackgroundResizeMode] = useState(false);
  const [generationJobs, setGenerationJobs] = useState<GenerationJob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingSetupOpen, setIsRecordingSetupOpen] = useState(false);
  const [recordingCropArea, setRecordingCropArea] = useState<RecordingCropArea | null>(null);
  const [targetLayerIdForRecording, setTargetLayerIdForRecording] = useState<string | null>(null);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [videoStatusMessage, setVideoStatusMessage] = useState('');
  const [recordedVideoBlob, setRecordedVideoBlob] = useState<{ blob: Blob, mimeType: string } | null>(null);
  const [rectangleThickness, setRectangleThickness] = useState(4);
  const [promptFontSize, setPromptFontSize] = useState(128);
  const [videoScript, setVideoScript] = useState<Scene[]>([]);
  const [videoFPS, setVideoFPS] = useState(24);
  const [videoSpeed, setVideoSpeed] = useState(1);
  const [featherEditMode, setFeatherEditMode] = useState<{ layerId: string | null }>({ layerId: null });
  const [activeToolMenu, setActiveToolMenu] = useState<ActiveToolMenu>(null);
  const [isProMode, setIsProMode] = useState(false);

  const backgroundLayer = layers.find(l => l.isBackground);

  const canGenerate = useCallback(() => {
    // If user is not logged in, generation is not allowed.
    if (!user) return false;
    // Infinite credits for admin
    if (user.email === 'visualizaeapp@gmail.com') return true;
    // If user is logged in, they can generate if they have credits.
    return user.credits > 0;
  }, [user]);

  const activateTool = useCallback((toolToActivate: Tool) => {
    // 1. Deselect everything (ESC behavior)
    setSelection(prev => ({ ...prev, visible: false }));
    setIsSelectionActionMenuVisible(false);
    setLassoPoints([]);
    if (toolToActivate !== 'division') {
      setDivisionTool(prev => ({ ...prev, isActive: false, suggestedRects: [] }));
    }
    setActiveToolMenu(null);

    // 2. Select appropriate layer (for brush-like tools)
    const isBrushLike = ['eraser', 'brush', 'lasso', 'restore-lasso'].some(t => toolToActivate.startsWith(t));

    if (isBrushLike) {
      const normalLayers = layers.filter(l => !l.isBackground);
      if (lastEditedLayerId && layers.some(l => l.id === lastEditedLayerId)) {
        setSelectedLayerIds([lastEditedLayerId]);
      } else if (normalLayers.length > 0) {
        setSelectedLayerIds([normalLayers[normalLayers.length - 1].id]);
      }
    }

    // 3. Set the tool
    setTool(toolToActivate);

  }, [layers, lastEditedLayerId]);


  const addGenerationJob = useCallback((job: Omit<GenerationJob, 'id' | 'status' | 'progress' | 'error' | 'isShown'>) => {
    if (!canGenerate()) {
      toast({
        title: 'Créditos insuficientes ou não autenticado.',
        description: 'Faça login ou adquira um plano para continuar gerando.',
        variant: 'destructive',
      });
      return;
    }
    setGenerationJobs(prev => [
      ...prev,
      {
        ...job,
        id: crypto.randomUUID(),
        status: 'pending',
        progress: 0,
        isShown: false,
      }
    ]);
  }, [canGenerate, toast]);

  const updateGenerationJob = useCallback((id: string, updates: Partial<Omit<GenerationJob, 'id'>>) => {
    setGenerationJobs(prev => prev.map(job => job.id === id ? { ...job, ...updates } : job));
  }, []);

  const addVariationToLayer = useCallback(async (id: string, dataUrl: string, generationData: Omit<GenerationSource, 'timestamp'>, options?: { width?: number, height?: number }) => {
    const targetLayer = layers.find(l => l.id === id);
    if (!targetLayer) return;

    const sourceVariation = targetLayer.variations[targetLayer.activeVariationIndex];

    const width = options?.width ?? sourceVariation.width;
    const height = options?.height ?? sourceVariation.height;

    // Calculate new scale to maintain the same visual size on canvas
    // Visual Size = width * scale
    // newScale = (oldWidth * oldScale) / newWidth
    const scaleX = (sourceVariation.width * sourceVariation.transform.scaleX) / width;
    const scaleY = (sourceVariation.height * sourceVariation.transform.scaleY) / height;

    const newVariation: LayerVariation = {
      dataUrl,
      width,
      height,
      generationData: { ...generationData, prompt: generationData.prompt || 'Variação', timestamp: Date.now() },
      opacity: 100,
      brightness: 100,
      contrast: 100,
      saturate: 100,
      transform: {
        ...sourceVariation.transform,
        scaleX,
        scaleY
      },
    };

    const updater = (layer: Layer) => {
      if (layer.id === id) {
        const newVariations = [...layer.variations, newVariation];
        return {
          ...layer,
          variations: newVariations,
          activeVariationIndex: newVariations.length - 1,
        };
      }
      return layer;
    };

    setLayers(prev => prev.map(updater));
    setSelectedLayerIds([id]);

  }, [layers]);

  // Effect to process the generation queue
  useEffect(() => {
    const isGenerating = generationJobs.some(job => job.status === 'generating');
    if (isGenerating) return;

    const pendingJob = generationJobs.find(job => job.status === 'pending');
    if (!pendingJob) return;

    const processJob = async () => {
      updateGenerationJob(pendingJob.id, { status: 'generating', progress: 10 });

      if (user && firestore) {
        const userRef = doc(firestore, 'users', user.uid);
        try {
          const isInfiniteUser = user.email === 'visualizaeapp@gmail.com';
          await updateDoc(userRef, {
            credits: isInfiniteUser ? increment(0) : increment(-1),
            renderCount: increment(1)
          });
        } catch (error) {
          console.error("Failed to decrement credits:", error);
          updateGenerationJob(pendingJob.id, { status: 'error', error: 'Falha ao atualizar os créditos.' });
          return;
        }
      } else {
        // This case should be blocked by canGenerate check, but as a safeguard:
        updateGenerationJob(pendingJob.id, { status: 'error', error: 'Usuário não autenticado.' });
        return;
      }

      const { layerId, sourceVariationIndex, prompt, referenceImages } = pendingJob;
      const targetLayer = layers.find(l => l.id === layerId);
      const sourceVariation = targetLayer?.variations[sourceVariationIndex];

      if (!targetLayer || !sourceVariation) {
        updateGenerationJob(pendingJob.id, { status: 'error', error: 'Camada de origem não encontrada.' });
        return;
      }

      updateGenerationJob(pendingJob.id, { progress: 20 });

      try {
        let result: { image?: string; width?: number; height?: number, error?: string };
        const { dataUrl: imageForUpscale, width: upscaledWidth, height: upscaledHeight } = await resizeToClosestStandard(sourceVariation.dataUrl, isProMode);
        updateGenerationJob(pendingJob.id, { progress: 40 });

        if (pendingJob.type === 'smart-fill') {
          result = await smartBackgroundFillAction({ prompt, width: upscaledWidth, height: upscaledHeight });
        } else {
          result = await generateVariationAction({
            prompt: prompt,
            imageToEdit: imageForUpscale,
            referenceImages: referenceImages,
            isProMode: isProMode,
          });
        }

        if (result.error || !result.image) {
          throw new Error(result.error || 'A IA não retornou uma imagem.');
        }

        updateGenerationJob(pendingJob.id, { progress: 80 });

        // Don't resize back to original. Keep the high-res result from AI.
        // const resizedResultDataUrl = await resizeImage(result.image, sourceVariation.width, sourceVariation.height);

        await addVariationToLayer(
          layerId,
          result.image,
          {
            type: 'variation',
            prompt,
            originalDataUrl: sourceVariation.dataUrl,
            referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
            upscaledResolution: { width: upscaledWidth, height: upscaledHeight },
            generationResolution: { width: result.width ?? 0, height: result.height ?? 0 },
            model: isProMode ? 'Gemini 3 Pro (Pro Mode)' : 'Gemini 2.5 Flash (Nano Mode)',
            isProMode: isProMode,
          },
          { width: result.width || upscaledWidth, height: result.height || upscaledHeight } // Pass new dimensions
        );

        updateGenerationJob(pendingJob.id, { status: 'completed', progress: 100 });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido na geração.';
        updateGenerationJob(pendingJob.id, { status: 'error', error: errorMessage });
      }
    };

    processJob();

  }, [generationJobs, layers, addVariationToLayer, updateGenerationJob, user, firestore, isProMode]);


  useEffect(() => {
    const currentState = history[historyIndex];
    if (
      currentState &&
      JSON.stringify(currentState.layers) === JSON.stringify(layers)
    ) {
      return;
    }

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ layers });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [layers, history, historyIndex]);

  const reorderLayers = useCallback((startIndex: number, endIndex: number) => {
    const backgroundLayer = layers.find(l => l.isBackground);
    const normalLayers = layers.filter(l => !l.isBackground);

    const reversedLayers = [...normalLayers].reverse();
    const [removed] = reversedLayers.splice(startIndex, 1);
    reversedLayers.splice(endIndex, 0, removed);

    const newNormalLayers = reversedLayers.reverse();
    const newLayers = backgroundLayer ? [backgroundLayer, ...newNormalLayers] : newNormalLayers;
    setLayers(newLayers);
  }, [layers]);

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const prevState = history[newIndex];
      setLayers(prevState.layers);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const nextState = history[newIndex];
      setLayers(nextState.layers);
    }
  };

  const undoLongPress = () => {
    // This functionality can be re-evaluated. For now, it behaves like a normal undo.
    undo();
  };

  const redoLongPress = () => {
    // This functionality can be re-evaluated. For now, it behaves like a normal redo.
    redo();
  };

  const calculateOptimizedRects = useCallback((
    bgX: number,
    bgY: number,
    bgWidth: number,
    bgHeight: number,
    divisions: number,
    limitInMP: number // Infinity for yellow, 1.05 for purple
  ): { type: DivisionToolState['suggestionType'], rects: Selection[], totalArea: number, isStandardRatio: boolean }[] => {

    const layouts = getFactorPairs(divisions).map(pair => ({
      ...pair,
      name: pair.rows === 1 ? 'horizontal' : pair.cols === 1 ? 'vertical' : 'grid'
    }));

    const bestFits: { type: DivisionToolState['suggestionType'], rects: Selection[], totalArea: number, isStandardRatio: boolean }[] = [];

    layouts.forEach(layout => {
      let bestFitForLayout: { rects: Selection[], totalArea: number, type: DivisionToolState['suggestionType'], isStandardRatio: boolean } | null = null;

      ASPECT_RATIOS.forEach(ar => {
        let rectWidth: number, rectHeight: number;

        // Tenta encaixar pela largura total do bg
        let h1 = bgHeight / layout.rows;
        let w1 = h1 * ar.ratio;
        let totalW1 = w1 * layout.cols;

        // Tenta encaixar pela altura total do bg
        let w2 = bgWidth / layout.cols;
        let h2 = w2 / ar.ratio;
        let totalH2 = h2 * layout.rows;

        let useFit1 = totalW1 <= bgWidth;
        let useFit2 = totalH2 <= bgHeight;

        if (useFit1 && (!useFit2 || (totalW1 * bgHeight > totalH2 * bgWidth))) {
          rectWidth = w1;
          rectHeight = h1;
        } else if (useFit2) {
          rectWidth = w2;
          rectHeight = h2;
        } else {
          return; // Não cabe
        }

        if (rectWidth === 0 || rectHeight === 0) return;

        const maxRectArea = (limitInMP === Infinity) ? Infinity : limitInMP * 1000000;
        if (rectWidth * rectHeight > maxRectArea) {
          const scale = Math.sqrt(maxRectArea / (rectWidth * rectHeight));
          rectWidth = Math.floor(rectWidth * scale);
          rectHeight = Math.floor(rectHeight * scale);
        }

        const totalArea = (rectWidth * rectHeight) * divisions;

        if (rectWidth > 0 && rectHeight > 0 && (!bestFitForLayout || totalArea > bestFitForLayout.totalArea)) {
          const rects = [];
          const totalWidth = rectWidth * layout.cols;
          const totalHeight = rectHeight * layout.rows;
          const offsetX = (bgWidth - totalWidth) / 2;
          const offsetY = (bgHeight - totalHeight) / 2;

          for (let row = 0; row < layout.rows; row++) {
            for (let col = 0; col < layout.cols; col++) {
              rects.push({
                x: bgX + offsetX + col * rectWidth,
                y: bgY + offsetY + row * rectHeight,
                width: rectWidth,
                height: rectHeight,
                visible: true,
              });
            }
          }
          const typeKey = limitInMP === Infinity ? 'optimized-unlimited' : 'optimized-quality';

          const layoutName = layout.rows === 1 ? 'horizontal' : layout.cols === 1 ? 'vertical' : 'grid';

          bestFitForLayout = {
            rects,
            totalArea,
            type: `${typeKey}-${layoutName}` as DivisionToolState['suggestionType'],
            isStandardRatio: true
          };
        }
      });

      if (bestFitForLayout) {
        bestFits.push(bestFitForLayout);
      }
    });

    return bestFits.sort((a, b) => b.totalArea - a.totalArea);
  }, []);

  const generateDivisionSuggestions = useCallback((divisions: number, suggestionIndexOffset: number = 0, newOverlap: number = 0) => {
    const activeBg = layers.find(l => l.isBackground && l.visible);
    if (!activeBg) {
      setDivisionTool(prev => ({ ...prev, suggestedRects: [] }));
      return;
    }
    const bgVar = activeBg.variations[activeBg.activeVariationIndex];
    const bgScaleX = bgVar.transform.scaleX / 100;
    const bgScaleY = bgVar.transform.scaleY / 100;
    const bgWidth = bgVar.width * bgScaleX;
    const bgHeight = bgVar.height * bgScaleY;
    const bgX = activeBg.x + bgVar.transform.offsetX;
    const bgY = activeBg.y + bgVar.transform.offsetY;

    // Simple divisions
    const simpleHorizontal: Selection[] = [];
    const hRectWidth = bgWidth / divisions;
    for (let i = 0; i < divisions; i++) {
      simpleHorizontal.push({
        x: bgX + i * hRectWidth,
        y: bgY,
        width: hRectWidth,
        height: bgHeight,
        visible: true
      });
    }

    const simpleVertical: Selection[] = [];
    const vRectHeight = bgHeight / divisions;
    for (let i = 0; i < divisions; i++) {
      simpleVertical.push({
        x: bgX,
        y: bgY + i * vRectHeight,
        width: bgWidth,
        height: vRectHeight,
        visible: true
      });
    }

    // Optimized for quality (purple)
    const limit = isProMode ? 4.2 : 1.1;
    const optimizedQuality = calculateOptimizedRects(bgX, bgY, bgWidth, bgHeight, divisions, limit);

    // Optimized for size (yellow)
    const optimizedUnlimited = calculateOptimizedRects(bgX, bgY, bgWidth, bgHeight, divisions, Infinity);

    const allSuggestions: { type: DivisionToolState['suggestionType'], rects: Selection[], totalArea: number, isStandardRatio: boolean }[] = [];

    if (optimizedQuality.length > 0) allSuggestions.push(...optimizedQuality);
    if (optimizedUnlimited.length > 0) allSuggestions.push(...optimizedUnlimited);
    allSuggestions.push({ type: 'simple-horizontal', rects: simpleHorizontal, totalArea: bgWidth * bgHeight, isStandardRatio: false });
    allSuggestions.push({ type: 'simple-vertical', rects: simpleVertical, totalArea: bgWidth * bgHeight, isStandardRatio: false });

    setDivisionTool(prev => {
      let newSuggestionIndex = (prev.suggestionIndex + suggestionIndexOffset);

      // Se o número de divisões mudou, queremos o melhor layout, que é o primeiro.
      if (prev.divisions !== divisions) {
        newSuggestionIndex = 0;
      } else {
        newSuggestionIndex = (newSuggestionIndex + allSuggestions.length) % allSuggestions.length;
      }

      const activeSuggestion = allSuggestions[newSuggestionIndex];

      const applyOverlap = (rects: Selection[], type: DivisionToolState['suggestionType']): Selection[] => {
        if (newOverlap === 0) return rects;

        const layout = getFactorPairs(rects.length).find(p => {
          const typeStr = type.split('-').pop();
          if (typeStr === 'horizontal') return p.rows === 1;
          if (typeStr === 'vertical') return p.cols === 1;
          if (typeStr === 'grid') return p.rows > 1 && p.cols > 1;
          return false;
        }) || { rows: 1, cols: rects.length }; // Fallback

        const { rows, cols } = layout;

        return rects.map((rect, i) => {
          let { x, y, width, height } = rect;
          const overlapXAmount = width * (newOverlap / 100);
          const overlapYAmount = height * (newOverlap / 100);

          const colIndex = i % cols;
          const rowIndex = Math.floor(i / cols);

          if (cols > 1) {
            if (colIndex > 0) { // Overlap left
              x -= overlapXAmount / 2;
              width += overlapXAmount / 2;
            }
            if (colIndex < cols - 1) { // Overlap right
              width += overlapXAmount / 2;
            }
          }

          if (rows > 1) {
            if (rowIndex > 0) { // Overlap top
              y -= overlapYAmount / 2;
              height += overlapYAmount / 2;
            }
            if (rowIndex < rows - 1) { // Overlap bottom
              height += overlapYAmount / 2;
            }
          }

          return { ...rect, x, y, width, height };
        });
      };

      // When setting rects here, they are absolute. We set offsetX/Y to 0 because the rects are already positioned.
      const finalRects = applyOverlap(activeSuggestion.rects, activeSuggestion.type);

      const maxArea = bgWidth * bgHeight;
      const currentArea = activeSuggestion.totalArea;

      return {
        ...prev,
        isActive: true,
        divisions,
        suggestedRects: finalRects,
        suggestionType: activeSuggestion.type,
        suggestionIndex: newSuggestionIndex,
        isStandardRatio: activeSuggestion.isStandardRatio,
        qualityLoss: (maxArea - currentArea) / maxArea,
        offsetX: 0,
        offsetY: 0,
        overlap: newOverlap,
      }
    });
  }, [layers, calculateOptimizedRects, isProMode]);

  const setDivisionOverlap = useCallback((overlap: number) => {
    generateDivisionSuggestions(divisionTool.divisions, 0, overlap);
  }, [divisionTool.divisions, generateDivisionSuggestions]);

  useEffect(() => {
    if (tool === 'division' && !divisionTool.isActive) {
      const activeBg = layers.find(l => l.isBackground && l.visible);
      if (activeBg && validDivisionCounts.length > 0) {
        generateDivisionSuggestions(validDivisionCounts[0] || 2, 0, 0);
      }
    }
  }, [tool, layers, validDivisionCounts, generateDivisionSuggestions, divisionTool.isActive]);

  useEffect(() => {
    if (!backgroundLayer) {
      setValidDivisionCounts([]);
      return;
    }

    const bgVar = backgroundLayer.variations[backgroundLayer.activeVariationIndex];
    if (!bgVar) {
      setValidDivisionCounts([]);
      return;
    }

    const bgWidth = bgVar.width;
    const bgHeight = bgVar.height;
    const bgX = backgroundLayer.x;
    const bgY = backgroundLayer.y;
    const MIN_AREA_PER_RECT = 800000;
    const newValidCounts: number[] = [];

    for (let n = 2; n <= 9; n++) {
      const layouts = getFactorPairs(n);
      const isViable = layouts.some(layout => {
        const simpleRectArea = (bgWidth / layout.cols) * (bgHeight / layout.rows);
        if (simpleRectArea > MIN_AREA_PER_RECT) return true;

        const limit = isProMode ? 4.2 : 1.1;
        const optimizedFits = calculateOptimizedRects(bgX, bgY, bgWidth, bgHeight, n, limit);
        return optimizedFits.length > 0 && optimizedFits[0].totalArea / n > MIN_AREA_PER_RECT;
      });

      if (isViable) {
        newValidCounts.push(n);
      }
    }
    setValidDivisionCounts(newValidCounts);
  }, [backgroundLayer, calculateOptimizedRects, isProMode]);


  const centerAndZoom = useCallback((imgWidth: number, imgHeight: number, layerX = 0, layerY = 0) => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;

    if (parent && imgWidth > 0 && imgHeight > 0) {
      const parentWidth = parent.clientWidth;
      const parentHeight = parent.clientHeight;

      const scaleX = parentWidth / imgWidth;
      const scaleY = parentHeight / imgHeight;
      const newZoom = Math.min(scaleX, scaleY) * 0.9;

      const newOffsetX = (parentWidth - imgWidth * newZoom) / 2 - (layerX * newZoom);
      const newOffsetY = (parentHeight - imgHeight * newZoom) / 2 - (layerY * newZoom);

      setZoom(newZoom);
      setOffset({ x: newOffsetX, y: newOffsetY });
    }
  }, [canvasRef]);

  const addPaintingCanvas = useCallback((data: { dataUrl?: string, width: number, height: number }, name: string) => {
    const { width, height } = data;
    let dataUrl: string;

    if ('dataUrl' in data && data.dataUrl) {
      dataUrl = data.dataUrl;
    } else {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      dataUrl = tempCanvas.toDataURL(); // Creates a transparent image
    }

    const newLayer: Layer = {
      id: crypto.randomUUID(),
      type: 'image',
      name: name,
      visible: true,
      x: 0,
      y: 0,
      isBackground: true,
      variations: [{
        dataUrl,
        width,
        height,
        opacity: 100,
        brightness: 100,
        contrast: 100,
        saturate: 100,
        transform: { offsetX: 0, offsetY: 0, scaleX: 100, scaleY: 100 },
        generationData: {
          type: 'canvas',
          prompt: name,
          timestamp: Date.now(),
        }
      }],
      activeVariationIndex: 0,
    };

    setLayers(prev => [newLayer, ...prev.filter(l => !l.isBackground)]);
    setSelectedLayerIds([]);
    setSelection({ x: 0, y: 0, width: 0, height: 0, visible: false });
    setIsSelectionActionMenuVisible(false);
    centerAndZoom(width, height);
  }, [centerAndZoom]);

  const addLayer = useCallback((dataUrl: string, name: string, options: { x?: number, y?: number } = {}) => {
    const { x, y } = options;

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      const canvas = canvasRef.current;
      const parent = canvas?.parentElement;
      let layerX = x ?? 0;
      let layerY = y ?? 0;

      const activeBg = layers.find(l => l.isBackground && l.visible) || null;
      if (x === undefined || y === undefined) {
        if (parent) {
          const viewCenterX = (parent.clientWidth / 2 - offset.x) / zoom;
          const viewCenterY = (parent.clientHeight / 2 - offset.y) / zoom;
          layerX = viewCenterX - img.width / 2;
          layerY = viewCenterY - img.height / 2;
        } else if (activeBg) {
          const bgVariation = activeBg.variations[activeBg.activeVariationIndex];
          if (bgVariation) {
            layerX = activeBg.x + (bgVariation.width / 2) - (img.width / 2);
            layerY = activeBg.y + (bgVariation.height / 2) - (img.height / 2);
          }
        }
      }

      const layerNumber = layers.filter(l => !l.isBackground).length;
      const layerName = `Lay ${layerNumber}`;

      const newLayer: Layer = {
        id: crypto.randomUUID(),
        type: 'image',
        name: layerName,
        visible: true,
        x: layerX, y: layerY,
        isBackground: false,
        variations: [{
          dataUrl,
          width: img.width,
          height: img.height,
          generationData: { type: 'initial', prompt: `Import: ${name}`, timestamp: Date.now() },
          opacity: 100, brightness: 100, contrast: 100, saturate: 100,
          transform: { offsetX: 0, offsetY: 0, scaleX: 100, scaleY: 100 },
        }],
        activeVariationIndex: 0,
      };

      setLayers(prev => [...prev, newLayer]);
      setSelectedLayerIds([newLayer.id]);
    };
    img.src = dataUrl;
  }, [layers, canvasRef, offset, zoom, setSelection, setSelectedLayerIds]);

  const addLayerInPlace = useCallback((variations: (Omit<LayerVariation, 'transform' | 'opacity' | 'brightness' | 'contrast' | 'saturate'>)[], selection: Selection, name?: string): Layer => {
    const newWidth = Math.floor(Math.abs(selection.width));
    const newHeight = Math.floor(Math.abs(selection.height));

    const layerVariations: LayerVariation[] = variations.map(v => ({
      ...v,
      width: newWidth,
      height: newHeight,
      opacity: 100,
      brightness: 100,
      contrast: 100,
      saturate: 100,
      transform: { offsetX: 0, offsetY: 0, scaleX: 100, scaleY: 100 },
    }));

    const layerNumber = layers.filter(l => !l.isBackground).length;
    const layerName = name || `Lay ${layerNumber}`;

    const newLayer: Layer = {
      id: crypto.randomUUID(),
      type: 'image',
      name: layerName,
      visible: true,
      x: selection.width < 0 ? selection.x + selection.width : selection.x,
      y: selection.height < 0 ? selection.y + selection.height : selection.y,
      isBackground: false,
      variations: layerVariations,
      activeVariationIndex: 0,
    };

    setLayers(prev => [...prev, newLayer]);
    setSelectedLayerIds([newLayer.id]);
    return newLayer;
  }, [layers]);

  const deleteLayer = useCallback((id: string) => {
    setLayers(prev => prev.filter(layer => layer.id !== id));
    setSelectedLayerIds(prev => prev.filter(selectedId => selectedId !== id));
  }, []);

  const deleteVariationFromLayer = useCallback((layerId: string, variationIndex: number) => {
    setLayers(prevLayers =>
      prevLayers.map(layer => {
        // 1. Verificação de segurança: ID correto e impede deletar a última variação restante
        if (layer.id !== layerId || layer.variations.length <= 1) {
          return layer;
        }

        // 2. Cria o novo array de variações
        const newVariations = layer.variations.filter((_, index) => index !== variationIndex);

        let newActiveIndex = layer.activeVariationIndex;

        // 3. Recálculo Robusto do Índice
        if (variationIndex < newActiveIndex) {
          // CENÁRIO A: Removemos um item ANTES do ativo.
          // O item ativo deslizou uma posição para a esquerda, então decrementamos o índice.
          newActiveIndex -= 1;
        } else if (variationIndex === newActiveIndex) {
          // CENÁRIO B: Removemos o PRÓPRIO item ativo.
          // Queremos manter o índice atual (para que o próximo item ocupe o lugar),
          // mas se era o último item, devemos recuar para o anterior.
          // Usamos Math.min para "grampear" o índice ao novo tamanho do array.
          newActiveIndex = Math.min(newActiveIndex, newVariations.length - 1);
        }
        // CENÁRIO C (Implícito): Removemos um item DEPOIS do ativo.
        // Nada muda. O índice ativo continua apontando para o mesmo objeto.

        return {
          ...layer,
          variations: newVariations,
          activeVariationIndex: newActiveIndex,
        };
      })
    );
  }, []);


  const toggleLayerVisibility = useCallback((id: string) => {
    setLayers(prev => prev.map(layer =>
      layer.id === id ? { ...layer, visible: !layer.visible } : layer
    ));
    // NOTE: History is NOT recorded for visibility toggles to avoid cluttering undo/redo.
  }, []);

  const updateLayer = useCallback((id: string, newProps: Partial<Omit<Layer, 'variations' | 'activeVariationIndex'>> & { variations?: LayerVariation[], activeVariationIndex?: number }) => {
    setLayers(prev => prev.map(layer =>
      layer.id === id ? { ...layer, ...newProps } : layer
    ));
  }, []);

  const updateVariation = useCallback((layerId: string, variationIndex: number, newProps: Partial<LayerVariation>) => {
    const updater = (layer: Layer) => {
      if (layer.id === layerId) {
        const newVariations = [...layer.variations];
        newVariations[variationIndex] = { ...newVariations[variationIndex], ...newProps };
        return { ...layer, variations: newVariations };
      }
      return layer;
    };
    setLayers(prev => prev.map(updater));
  }, []);

  const eraseFromLayer = (layerId: string, worldPoints: { x: number; y: number }[]) => {
    if (worldPoints.length === 0) return;
    setLastEditedLayerId(layerId);
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;

    const activeVariation = layer.variations[layer.activeVariationIndex];
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = activeVariation.dataUrl;

    img.onload = () => {
      const tempCanvas = document.createElement('canvas');
      const originalWidth = activeVariation.width;
      const originalHeight = activeVariation.height;

      tempCanvas.width = originalWidth;
      tempCanvas.height = originalHeight;

      const ctx = tempCanvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, originalWidth, originalHeight);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = eraserOpacity / 100;

      const scaleX = activeVariation.transform.scaleX / 100;
      const scaleY = activeVariation.transform.scaleY / 100;

      const layerPoints = worldPoints.map(p => ({
        x: (p.x - layer.x - activeVariation.transform.offsetX) / scaleX,
        y: (p.y - layer.y - activeVariation.transform.offsetY) / scaleY
      }));

      ctx.lineWidth = eraserSize / ((scaleX + scaleY) / 2);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();

      if (layerPoints.length === 1) {
        ctx.arc(layerPoints[0].x, layerPoints[0].y, (eraserSize / ((scaleX + scaleY) / 2)) / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.moveTo(layerPoints[0].x, layerPoints[0].y);
        for (let i = 1; i < layerPoints.length; i++) {
          ctx.lineTo(layerPoints[i].x, layerPoints[i].y);
        }
        ctx.stroke();
      }

      const newDataUrl = tempCanvas.toDataURL();

      const updater = (l: Layer) => {
        if (l.id === layerId) {
          const newVariations = [...l.variations];
          const originalDataUrl = newVariations[l.activeVariationIndex].generationData?.originalDataUrl;
          newVariations[l.activeVariationIndex] = {
            ...newVariations[l.activeVariationIndex],
            dataUrl: newDataUrl,
            generationData: {
              ...newVariations[l.activeVariationIndex].generationData,
              originalDataUrl: originalDataUrl || activeVariation.dataUrl,
              type: 'erase'
            }
          };
          return { ...l, variations: newVariations };
        }
        return l;
      };

      setLayers(prev => prev.map(updater));
    };
  };

  const eraseWithPolygon = useCallback((layerId: string, worldPoints: { x: number, y: number }[]) => {
    if (worldPoints.length < 3) return;
    setLastEditedLayerId(layerId);
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;

    const activeVariation = layer.variations[layer.activeVariationIndex];
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = activeVariation.dataUrl;

    img.onload = () => {
      const tempCanvas = document.createElement('canvas');
      const originalWidth = activeVariation.width;
      const originalHeight = activeVariation.height;

      tempCanvas.width = originalWidth;
      tempCanvas.height = originalHeight;

      const ctx = tempCanvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, originalWidth, originalHeight);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = eraserOpacity / 100;

      const scaleX = activeVariation.transform.scaleX / 100;
      const scaleY = activeVariation.transform.scaleY / 100;

      const layerPoints = worldPoints.map(p => ({
        x: (p.x - layer.x - activeVariation.transform.offsetX) / scaleX,
        y: (p.y - layer.y - activeVariation.transform.offsetY) / scaleY
      }));

      ctx.beginPath();
      ctx.moveTo(layerPoints[0].x, layerPoints[0].y);
      for (let i = 1; i < layerPoints.length; i++) {
        ctx.lineTo(layerPoints[i].x, layerPoints[i].y);
      }
      ctx.closePath();
      ctx.fill();

      const newDataUrl = tempCanvas.toDataURL();

      const updater = (l: Layer) => {
        if (l.id === layerId) {
          const newVariations = [...l.variations];
          const originalDataUrl = newVariations[l.activeVariationIndex].generationData?.originalDataUrl;
          newVariations[l.activeVariationIndex] = {
            ...newVariations[l.activeVariationIndex],
            dataUrl: newDataUrl,
            generationData: {
              ...newVariations[l.activeVariationIndex].generationData,
              originalDataUrl: originalDataUrl || activeVariation.dataUrl,
              type: 'erase'
            }
          };
          return { ...l, variations: newVariations };
        }
        return l;
      };

      setLayers(prev => prev.map(updater));
    };

  }, [layers, eraserOpacity]);

  const eraseWithSelection = useCallback((layerId: string, selection: Selection) => {
    setLastEditedLayerId(layerId);
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;

    const activeVariation = layer.variations[layer.activeVariationIndex];
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = activeVariation.dataUrl;

    img.onload = () => {
      const tempCanvas = document.createElement('canvas');
      const scaledWidth = activeVariation.width * (activeVariation.transform.scaleX / 100);
      const scaledHeight = activeVariation.height * (activeVariation.transform.scaleY / 100);

      tempCanvas.width = scaledWidth;
      tempCanvas.height = scaledHeight;

      const ctx = tempCanvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
      ctx.globalCompositeOperation = 'destination-out';

      const selX = selection.x - layer.x - activeVariation.transform.offsetX + (scaledWidth - activeVariation.width) / 2;
      const selY = selection.y - layer.y - activeVariation.transform.offsetY + (scaledHeight - activeVariation.height) / 2;

      ctx.fillStyle = `rgba(0, 0, 0, ${eraserOpacity / 100})`;
      ctx.fillRect(selX, selY, selection.width, selection.height);

      const newDataUrl = tempCanvas.toDataURL();

      const updater = (l: Layer) => {
        if (l.id === layerId) {
          const newVariations = [...l.variations];
          const originalDataUrl = newVariations[l.activeVariationIndex].generationData?.originalDataUrl;
          newVariations[l.activeVariationIndex] = {
            ...newVariations[l.activeVariationIndex],
            dataUrl: newDataUrl,
            generationData: {
              ...newVariations[l.activeVariationIndex].generationData,
              originalDataUrl: originalDataUrl || activeVariation.dataUrl,
              type: 'erase'
            }
          };
          return { ...l, variations: newVariations };
        }
        return l;
      };

      setLayers(prev => prev.map(updater));
    };
  }, [layers, eraserOpacity]);

  const restoreToLayer = useCallback(async (layerId: string, worldPoints: { x: number; y: number }[]) => {
    if (worldPoints.length === 0) return;
    setLastEditedLayerId(layerId);
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;

    const activeVariation = layer.variations[layer.activeVariationIndex];
    const originalDataUrl = activeVariation.generationData?.originalDataUrl;
    if (!originalDataUrl) {
      toast({
        variant: 'destructive',
        title: 'Não há o que restaurar',
        description: 'Esta camada não possui um estado anterior para restaurar.',
      });
      return;
    }

    const [currentImg, originalImg] = await Promise.all([
      loadImage(activeVariation.dataUrl),
      loadImage(originalDataUrl),
    ]);

    if (!currentImg || !originalImg) {
      toast({ variant: 'destructive', title: 'Erro ao carregar imagens', description: 'Não foi possível carregar as imagens para restauração.' });
      return;
    }

    const scaledWidth = activeVariation.width * (activeVariation.transform.scaleX / 100);
    const scaledHeight = activeVariation.height * (activeVariation.transform.scaleY / 100);

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = scaledWidth;
    maskCanvas.height = scaledHeight;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return;

    const layerPoints = worldPoints.map(p => ({
      x: p.x - layer.x - activeVariation.transform.offsetX + (scaledWidth - activeVariation.width) / 2,
      y: p.y - layer.y - activeVariation.transform.offsetY + (scaledHeight - activeVariation.height) / 2
    }));

    maskCtx.fillStyle = `rgba(0, 0, 0, ${brushOpacity / 100})`;
    maskCtx.lineWidth = brushSize;
    maskCtx.lineCap = 'round';
    maskCtx.lineJoin = 'round';

    maskCtx.beginPath();
    if (layerPoints.length === 1) {
      maskCtx.arc(layerPoints[0].x, layerPoints[0].y, brushSize / 2, 0, Math.PI * 2);
      maskCtx.fill();
    } else {
      maskCtx.moveTo(layerPoints[0].x, layerPoints[0].y);
      for (let i = 1; i < layerPoints.length; i++) {
        maskCtx.lineTo(layerPoints[i].x, layerPoints[i].y);
      }
      maskCtx.stroke();
    }

    const tempRestoreCanvas = document.createElement('canvas');
    tempRestoreCanvas.width = scaledWidth;
    tempRestoreCanvas.height = scaledHeight;
    const tempRestoreCtx = tempRestoreCanvas.getContext('2d');
    if (!tempRestoreCtx) return;

    tempRestoreCtx.drawImage(originalImg, 0, 0, scaledWidth, scaledHeight);
    tempRestoreCtx.globalCompositeOperation = 'destination-in';
    tempRestoreCtx.drawImage(maskCanvas, 0, 0);

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = scaledWidth;
    finalCanvas.height = scaledHeight;
    const finalCtx = finalCanvas.getContext('2d');
    if (!finalCtx) return;

    finalCtx.drawImage(currentImg, 0, 0, scaledWidth, scaledHeight);
    finalCtx.drawImage(tempRestoreCanvas, 0, 0);

    const newDataUrl = finalCanvas.toDataURL();

    const updater = (l: Layer) => {
      if (l.id === layerId) {
        const newVariations = [...l.variations];
        newVariations[l.activeVariationIndex] = {
          ...newVariations[l.activeVariationIndex],
          dataUrl: newDataUrl,
        };
        return { ...l, variations: newVariations };
      }
      return l;
    };

    setLayers(prev => prev.map(updater));
  }, [layers, brushSize, brushOpacity, toast]);

  const restoreWithPolygon = useCallback(async (layerId: string, worldPoints: { x: number, y: number }[]) => {
    if (worldPoints.length < 3) return;
    setLastEditedLayerId(layerId);
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;

    const activeVariation = layer.variations[layer.activeVariationIndex];
    const originalDataUrl = activeVariation.generationData?.originalDataUrl;
    if (!originalDataUrl) {
      toast({ variant: 'destructive', title: 'Não há o que restaurar', description: 'Esta camada não tem estado anterior para restaurar.' });
      return;
    }

    const [currentImg, originalImg] = await Promise.all([
      loadImage(activeVariation.dataUrl),
      loadImage(originalDataUrl),
    ]);

    if (!currentImg || !originalImg) {
      toast({ variant: 'destructive', title: 'Erro ao carregar imagens', description: 'Não foi possível carregar as imagens para restauração.' });
      return;
    }

    const scaledWidth = activeVariation.width * (activeVariation.transform.scaleX / 100);
    const scaledHeight = activeVariation.height * (activeVariation.transform.scaleY / 100);

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = scaledWidth;
    maskCanvas.height = scaledHeight;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return;

    const layerPoints = worldPoints.map(p => ({
      x: p.x - layer.x - activeVariation.transform.offsetX + (scaledWidth - activeVariation.width) / 2,
      y: p.y - layer.y - activeVariation.transform.offsetY + (scaledHeight - activeVariation.height) / 2,
    }));

    maskCtx.beginPath();
    maskCtx.moveTo(layerPoints[0].x, layerPoints[0].y);
    for (let i = 1; i < layerPoints.length; i++) {
      maskCtx.lineTo(layerPoints[i].x, layerPoints[i].y);
    }
    maskCtx.closePath();
    maskCtx.fillStyle = 'black';
    maskCtx.fill();

    const tempRestoreCanvas = document.createElement('canvas');
    tempRestoreCanvas.width = scaledWidth;
    tempRestoreCanvas.height = scaledHeight;
    const tempRestoreCtx = tempRestoreCanvas.getContext('2d');
    if (!tempRestoreCtx) return;

    tempRestoreCtx.drawImage(originalImg, 0, 0, scaledWidth, scaledHeight);
    tempRestoreCtx.globalCompositeOperation = 'destination-in';
    tempRestoreCtx.drawImage(maskCanvas, 0, 0);

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = scaledWidth;
    finalCanvas.height = scaledHeight;
    const finalCtx = finalCanvas.getContext('2d');
    if (!finalCtx) return;

    finalCtx.drawImage(currentImg, 0, 0, scaledWidth, scaledHeight);
    finalCtx.drawImage(tempRestoreCanvas, 0, 0);

    const newDataUrl = finalCanvas.toDataURL();

    const updater = (l: Layer) => {
      if (l.id === layerId) {
        const newVariations = [...l.variations];
        newVariations[l.activeVariationIndex] = { ...newVariations[l.activeVariationIndex], dataUrl: newDataUrl };
        return { ...l, variations: newVariations };
      }
      return l;
    };

    setLayers(prev => prev.map(updater));
  }, [layers, toast]);

  const getCanvasDataUrl = useCallback(async (includeBackground = true, format: 'image/png' | 'image/jpeg' = 'image/png', layersToInclude?: Layer[], scale: number = 1, boundsOnly = false): Promise<{ dataUrl: string, bounds: { minX: number, minY: number, width: number, height: number } }> => {
    if (layers.length === 0) return { dataUrl: '', bounds: { minX: 0, minY: 0, width: 0, height: 0 } };

    let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;

    const layersForExport = layersToInclude || layers.filter(l => l.visible && (includeBackground || !l.isBackground));

    if (layersForExport.length === 0) return { dataUrl: '', bounds: { minX: 0, minY: 0, width: 0, height: 0 } };

    layersForExport.forEach(layer => {
      const activeVariation = layer.variations[layer.activeVariationIndex];
      if (!activeVariation) return;

      const transform = activeVariation.transform;
      const layerScaleX = transform.scaleX / 100;
      const layerScaleY = transform.scaleY / 100;
      const finalWidth = activeVariation.width * layerScaleX;
      const finalHeight = activeVariation.height * layerScaleY;
      const finalX = layer.x + transform.offsetX;
      const finalY = layer.y + transform.offsetY;

      minX = Math.min(minX, finalX);
      minY = Math.min(minY, finalY);
      maxX = Math.max(maxX, finalX + finalWidth);
      maxY = Math.max(maxY, finalY + finalHeight);
    });

    if (minX === Infinity) return { dataUrl: '', bounds: { minX: 0, minY: 0, width: 0, height: 0 } };

    const exportWidth = maxX - minX;
    const exportHeight = maxY - minY;

    const bounds = { minX, minY, width: exportWidth, height: exportHeight };
    if (boundsOnly) return { dataUrl: '', bounds };

    const scaledWidth = exportWidth * scale;
    const scaledHeight = exportHeight * scale;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = scaledWidth;
    tempCanvas.height = scaledHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return { dataUrl: '', bounds };

    if (format === 'image/jpeg' || (includeBackground && layers.some(l => l.isBackground))) {
      tempCtx.fillStyle = 'white'; // Padrão para JPEG ou quando o fundo está incluído
      tempCtx.fillRect(0, 0, scaledWidth, scaledHeight);
    } else {
      tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    }

    tempCtx.scale(scale, scale);

    const imageLoadPromises = layersForExport.map(layer => {
      return new Promise<{ img: HTMLImageElement; layer: Layer }>((resolve, reject) => {
        const activeVariation = layer.variations[layer.activeVariationIndex];
        if (!activeVariation) {
          return reject(new Error(`No active variation for layer ${layer.id}`));
        }
        loadImage(activeVariation.dataUrl).then(img => {
          if (img) resolve({ img, layer });
          else reject(new Error(`Failed to load image for layer ${layer.id}`));
        }).catch(reject);
      });
    });

    const loadedImageObjects = await Promise.all(imageLoadPromises);

    const orderedLayers = layers
      .map(layer => loadedImageObjects.find(obj => obj.layer.id === layer.id))
      .filter((obj): obj is { img: HTMLImageElement; layer: Layer } => !!obj);

    orderedLayers.forEach(({ img, layer }) => {
      const activeVariation = layer.variations[layer.activeVariationIndex];
      if (!activeVariation) return;

      tempCtx.save();
      tempCtx.globalAlpha = activeVariation.opacity / 100;
      tempCtx.filter = `brightness(${activeVariation.brightness / 100}) contrast(${activeVariation.contrast / 100}) saturate(${activeVariation.saturate / 100})`;

      const transform = activeVariation.transform;
      const layerScaleX = transform.scaleX / 100;
      const layerScaleY = transform.scaleY / 100;
      const finalWidth = activeVariation.width * layerScaleX;
      const finalHeight = activeVariation.height * layerScaleY;
      const finalX = layer.x + transform.offsetX;
      const finalY = layer.y + transform.offsetY;

      tempCtx.drawImage(img, finalX - minX, finalY - minY, finalWidth, finalHeight);
      tempCtx.restore();
    });

    return { dataUrl: tempCanvas.toDataURL(format), bounds };
  }, [layers]);

  const performCrop = useCallback(async (renderAfterCrop: boolean = false) => {
    if (!selection.visible || selection.width === 0 || selection.height === 0) {
      toast({
        variant: 'destructive',
        title: 'Nenhuma seleção para recortar',
        description: 'Por favor, desenhe um retângulo no canvas primeiro.',
      });
      return;
    }

    try {
      const { dataUrl: canvasImage, bounds: canvasBounds } = await getCanvasDataUrl(true);
      if (!canvasImage) throw new Error("Não foi possível capturar a imagem do canvas.");

      const img = await loadImage(canvasImage);
      if (!img) throw new Error("Não foi possível carregar a imagem do canvas.");

      const tempCanvas = document.createElement('canvas');
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) throw new Error("Não foi possível obter o contexto do canvas temporário.");

      const absWidth = Math.abs(selection.width);
      const absHeight = Math.abs(selection.height);

      const selectionX = selection.width < 0 ? selection.x + selection.width : selection.x;
      const selectionY = selection.height < 0 ? selection.y + selection.height : selection.y;

      const sx = selectionX - canvasBounds.minX;
      const sy = selectionY - canvasBounds.minY;

      tempCanvas.width = absWidth;
      tempCanvas.height = absHeight;

      ctx.drawImage(img, sx, sy, absWidth, absHeight, 0, 0, absWidth, absHeight);

      const croppedDataUrl = tempCanvas.toDataURL();

      const currentSelection = { ...selection, x: selectionX, y: selectionY, width: absWidth, height: absHeight };

      setSelection(prev => ({ ...prev, visible: false }));
      setIsSelectionActionMenuVisible(false);

      if (renderAfterCrop) {
        const newLayer = addLayerInPlace(
          [{
            dataUrl: croppedDataUrl,
            width: absWidth,
            height: absHeight,
            generationData: {
              type: 'render-crop',
              prompt: '',
            }
          }],
          currentSelection
        );
        setRenderLayerData({
          layerId: newLayer.id,
        });
      } else {
        const layerNumber = layers.filter(l => !l.isBackground).length;
        const layerName = `Lay ${layerNumber}`;
        addLayer(croppedDataUrl, layerName, { x: selectionX, y: selectionY });
        toast({
          title: 'Camada Criada',
          description: 'Uma nova camada foi criada a partir da sua seleção.',
        });
      }

    } catch (error) {
      console.error("Falha ao criar recorte:", error);
      const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
      toast({
        variant: 'destructive',
        title: 'Erro ao Recortar',
        description: errorMessage,
      });
    }
  }, [selection, getCanvasDataUrl, addLayer, setSelection, setIsSelectionActionMenuVisible, toast, setRenderLayerData, addLayerInPlace, layers]);

  const splitImageIntoLayers = useCallback(async () => {
    if (divisionTool.suggestedRects.length === 0) {
      toast({ variant: 'destructive', title: 'Nenhuma sugestão de divisão', description: 'Gere uma sugestão de divisão primeiro.' });
      return;
    }
    try {
      const { dataUrl: canvasImage, bounds: canvasBounds } = await getCanvasDataUrl(true);
      if (!canvasImage) throw new Error("Não foi possível capturar a imagem do canvas.");

      const img = await loadImage(canvasImage);
      if (!img) throw new Error("Não foi possível carregar imagem do canvas para divisão.");

      const cropPromises = divisionTool.suggestedRects.map(rect => {
        return new Promise<string>((resolve, reject) => {
          const tempCanvas = document.createElement('canvas');
          const ctx = tempCanvas.getContext('2d');
          if (!ctx) return reject(new Error("Não foi possível obter o contexto do canvas temporário."));

          const sx = rect.x + divisionTool.offsetX - canvasBounds.minX;
          const sy = rect.y + divisionTool.offsetY - canvasBounds.minY;

          tempCanvas.width = rect.width;
          tempCanvas.height = rect.height;

          ctx.drawImage(img, sx, sy, tempCanvas.width, tempCanvas.height, 0, 0, tempCanvas.width, tempCanvas.height);
          resolve(tempCanvas.toDataURL());
        });
      });

      const croppedImages = await Promise.all(cropPromises);

      const newLayersToAdd = croppedImages.map((dataUrl, index) => {
        const rect = divisionTool.suggestedRects[index];
        const layerNumber = layers.filter(l => !l.isBackground).length + index;
        const layerName = `Lay ${layerNumber}`;

        const newLayer: Layer = {
          id: crypto.randomUUID(),
          type: 'image',
          name: layerName,
          visible: true,
          x: rect.x + divisionTool.offsetX,
          y: rect.y + divisionTool.offsetY,
          isBackground: false,
          variations: [{
            dataUrl,
            width: rect.width,
            height: rect.height,
            generationData: {
              type: 'split',
              prompt: '',
              timestamp: Date.now(),
            },
            opacity: 100,
            brightness: 100,
            contrast: 100,
            saturate: 100,
            transform: { offsetX: 0, offsetY: 0, scaleX: 100, scaleY: 100 },
          }],
          activeVariationIndex: 0,
        };
        return newLayer;
      });

      setLayers(prev => [...prev, ...newLayersToAdd]);
      setDivisionTool(INITIAL_DIVISION_TOOL_STATE);

      toast({
        title: 'Camadas Criadas',
        description: `${divisionTool.suggestedRects.length} camadas foram criadas a partir da divisão.`,
      });

    } catch (error) {
      console.error("Falha ao dividir em camadas:", error);
      const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
      toast({
        variant: 'destructive',
        title: 'Erro ao Dividir',
        description: errorMessage,
      });
    }

  }, [divisionTool, getCanvasDataUrl, layers, toast]);

  const prepareSelectionSplit = useCallback((numDivisions: number) => {
    if (!selection.visible || selection.width === 0 || selection.height === 0) return;

    const initialSelWidth = Math.abs(selection.width);
    const initialSelHeight = Math.abs(selection.height);
    const isHorizontalSplit = initialSelWidth / initialSelHeight > 1.2;
    const cols = isHorizontalSplit ? numDivisions : 1;
    const rows = isHorizontalSplit ? 1 : numDivisions;

    const targetSubRatio = (initialSelWidth / cols) / (initialSelHeight / rows);
    const closestStandardRatio = ASPECT_RATIOS.reduce((prev, curr) => Math.abs(curr.ratio - targetSubRatio) < Math.abs(prev.ratio - targetSubRatio) ? curr : prev);

    let finalSelWidth, finalSelHeight;
    if (isHorizontalSplit) {
      finalSelHeight = initialSelHeight;
      finalSelWidth = (finalSelHeight * closestStandardRatio.ratio) * numDivisions;
    } else {
      finalSelWidth = initialSelWidth;
      finalSelHeight = (finalSelWidth / closestStandardRatio.ratio) * numDivisions;
    }

    const selX = selection.x + (initialSelWidth - finalSelWidth) / 2;
    const selY = selection.y + (initialSelHeight - finalSelHeight) / 2;

    const subRectWidth = finalSelWidth / cols;
    const subRectHeight = finalSelHeight / rows;

    const rects: Selection[] = [];
    for (let i = 0; i < numDivisions; i++) {
      rects.push({
        x: selX + (isHorizontalSplit ? i * subRectWidth : 0),
        y: selY + (isHorizontalSplit ? 0 : i * subRectHeight),
        width: subRectWidth,
        height: subRectHeight,
        visible: true
      });
    }
    setSelectionDivisionPreview({ isActive: true, rects });

  }, [selection]);

  const confirmSelectionSplit = useCallback(async () => {
    if (!selectionDivisionPreview.isActive || selectionDivisionPreview.rects.length === 0) {
      toast({ variant: 'destructive', title: 'Nenhuma pré-visualização de divisão', description: 'Prepare uma divisão primeiro.' });
      return;
    }

    try {
      const { dataUrl: canvasImage, bounds: canvasBounds } = await getCanvasDataUrl(true);
      if (!canvasImage) throw new Error("Não foi possível capturar a imagem do canvas.");

      const img = await loadImage(canvasImage);
      if (!img) throw new Error("Não foi possível carregar a imagem do canvas.");


      const numDivisions = selectionDivisionPreview.rects.length;

      const cropPromises = selectionDivisionPreview.rects.map(rect => {
        return new Promise<string>((resolve, reject) => {
          const tempCanvas = document.createElement('canvas');
          const ctx = tempCanvas.getContext('2d');
          if (!ctx) return reject(new Error("Não foi possível obter o contexto do canvas temporário."));

          const sx = Math.floor(rect.x - canvasBounds.minX);
          const sy = Math.floor(rect.y - canvasBounds.minY);

          tempCanvas.width = rect.width;
          tempCanvas.height = rect.height;
          ctx.drawImage(img, sx, sy, rect.width, rect.height, 0, 0, rect.width, rect.height);
          resolve(tempCanvas.toDataURL());
        });
      });

      const croppedImages = await Promise.all(cropPromises);

      const newLayersToAdd = croppedImages.map((dataUrl, index) => {
        const rect = selectionDivisionPreview.rects[index];
        const layerNumber = layers.filter(l => !l.isBackground).length + index;
        return {
          id: crypto.randomUUID(),
          type: 'image' as const,
          name: `Lay ${layerNumber}`,
          visible: true,
          x: rect.x,
          y: rect.y,
          isBackground: false,
          variations: [{
            dataUrl,
            width: rect.width,
            height: rect.height,
            generationData: {
              type: 'split' as const,
              prompt: '',
              timestamp: Date.now()
            },
            opacity: 100,
            brightness: 100, contrast: 100, saturate: 100,
            transform: { offsetX: 0, offsetY: 0, scaleX: 100, scaleY: 100 },
          }],
          activeVariationIndex: 0
        };
      });

      setLayers(prev => [...prev, ...newLayersToAdd]);
      setSelection(prev => ({ ...prev, visible: false }));
      setIsSelectionActionMenuVisible(false);
      setSelectionDivisionPreview(INITIAL_SELECTION_DIVISION_PREVIEW_STATE);

      toast({
        title: 'Seleção Dividida',
        description: `A seleção foi dividida em ${numDivisions} novas camadas.`
      });

    } catch (error) {
      console.error("Falha ao dividir seleção:", error);
      toast({ variant: 'destructive', title: 'Erro ao Dividir', description: 'Não foi possível dividir a seleção.' });
    }
  }, [selectionDivisionPreview, getCanvasDataUrl, layers, toast, setSelection, setIsSelectionActionMenuVisible, setSelectionDivisionPreview]);

  const mergeLayers = useCallback(async () => {
    if (selectedLayerIds.length < 2) {
      toast({ variant: 'destructive', title: 'Seleção insuficiente', description: 'Selecione duas ou mais camadas para mesclar.' });
      return;
    }

    try {
      const layersToMerge = layers
        .filter(l => selectedLayerIds.includes(l.id))
        .sort((a, b) => {
          const aIndex = layers.findIndex(l => l.id === a.id);
          const bIndex = layers.findIndex(l => l.id === b.id);
          return aIndex - bIndex;
        });

      if (layersToMerge.length !== selectedLayerIds.length) {
        throw new Error("Algumas camadas selecionadas não foram encontradas.");
      }

      const { dataUrl: mergedDataUrl, bounds } = await getCanvasDataUrl(false, 'image/png', layersToMerge);

      if (!mergedDataUrl || bounds.width === 0 || bounds.height === 0) {
        throw new Error("Falha ao criar imagem mesclada.");
      }

      const newLayersList = layers.filter(l => !selectedLayerIds.includes(l.id));

      const newLayer: Layer = {
        id: crypto.randomUUID(),
        type: 'image',
        name: 'Mescla',
        visible: true,
        x: bounds.minX,
        y: bounds.minY,
        isBackground: false,
        variations: [{
          dataUrl: mergedDataUrl,
          width: bounds.width,
          height: bounds.height,
          generationData: {
            type: 'merge',
            prompt: `Camadas mescladas: ${layersToMerge.map(l => l.name).join(', ')}`,
            timestamp: Date.now(),
          },
          opacity: 100,
          brightness: 100, contrast: 100, saturate: 100,
          transform: { offsetX: 0, offsetY: 0, scaleX: 100, scaleY: 100 },
        }],
        activeVariationIndex: 0,
      };

      setLayers([...newLayersList, newLayer]);
      setSelectedLayerIds([newLayer.id]);

      toast({
        title: 'Camadas Mescladas',
        description: `${layersToMerge.length} camadas foram mescladas em uma.`,
      });

    } catch (error) {
      console.error("Falha ao mesclar camadas:", error);
      const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
      toast({ variant: 'destructive', title: 'Erro ao Mesclar', description: errorMessage });
    }
  }, [selectedLayerIds, layers, getCanvasDataUrl, toast]);

  const saveCurrentDivisionLayout = useCallback(() => {
    if (divisionTool.isActive && divisionTool.suggestedRects.length > 0) {
      // Adjust the saved rects by the current offset to make them absolute
      const layoutToSave = divisionTool.suggestedRects.map(rect => ({
        ...rect,
        x: rect.x + divisionTool.offsetX,
        y: rect.y + divisionTool.offsetY,
        visible: true // ensure it's visible when reloaded
      }));
      setSavedDivisionLayouts(prev => [...prev, layoutToSave]);
      toast({
        title: "Layout de Divisão Salvo",
        description: `O layout com ${layoutToSave.length} retângulos foi salvo.`,
      });
      setDivisionTool(INITIAL_DIVISION_TOOL_STATE);
    } else {
      toast({
        variant: "destructive",
        title: "Nenhuma Divisão Ativa",
        description: "Não há um layout de divisão ativo para salvar.",
      });
    }
  }, [divisionTool, toast]);

  const loadDivisionLayout = useCallback((layoutIndex: number) => {
    const layout = savedDivisionLayouts[layoutIndex];
    if (layout) {
      setDivisionTool({
        isActive: false, // Don't activate the tool options bar
        suggestedRects: layout,
        divisions: layout.length,
        suggestionIndex: -1, // Indicate it's a loaded layout
        suggestionType: 'loaded-layout',
        qualityLoss: 0,
        isStandardRatio: false,
        offsetX: 0,
        offsetY: 0,
        overlap: 0,
      });
    }
  }, [savedDivisionLayouts]);

  const updateFeatherPreview = useCallback((layerId: string, variationIndex: number, feather: FeatheringState) => {
    updateVariation(layerId, variationIndex, { feather });
  }, [updateVariation]);

  const applyFeathering = useCallback(async (layerId: string, variationIndex: number, feather: FeatheringState) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;

    const variation = layer.variations[variationIndex];
    if (!variation) return;

    const baseImage = variation.originalDataUrlForFeather || variation.dataUrl;

    if (!baseImage) {
      toast({
        variant: 'destructive',
        title: 'Imagem base não encontrada',
        description: 'Não foi possível encontrar a imagem original para aplicar o efeito.',
      });
      return;
    }

    try {
      const featheredDataUrl = await applyEdgeFeathering(baseImage, feather);
      updateVariation(layerId, variationIndex, { dataUrl: featheredDataUrl, feather });
    } catch (error) {
      console.error("Feathering failed:", error);
      toast({
        variant: 'destructive',
        title: 'Erro ao Suavizar',
        description: 'Não foi possível aplicar o efeito de suavização.',
      });
    }
  }, [layers, updateVariation, toast]);


  const confirmFeathering = useCallback((layerId: string) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;

    // "Bake" the feather effect by removing the originalDataUrlForFeather
    const newVariations = [...layer.variations];
    const activeVariation = newVariations[layer.activeVariationIndex];
    if (activeVariation) {
      delete activeVariation.originalDataUrlForFeather;
    }
    updateLayer(layerId, { variations: newVariations });
    setFeatherEditMode({ layerId: null });
  }, [layers, updateLayer]);


  const cancelFeathering = useCallback((layerId: string) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;

    const newVariations = [...layer.variations];
    const activeVariation = newVariations[layer.activeVariationIndex];

    if (activeVariation && activeVariation.originalDataUrlForFeather) {
      // Restore the original image
      activeVariation.dataUrl = activeVariation.originalDataUrlForFeather;
      // Reset feather state
      delete activeVariation.feather;
      delete activeVariation.originalDataUrlForFeather;
    }

    updateLayer(layerId, { variations: newVariations });
    setFeatherEditMode({ layerId: null });
  }, [layers, updateLayer]);

  const selectAll = useCallback(() => {
    if (!backgroundLayer) return;
    const activeVariation = backgroundLayer.variations[backgroundLayer.activeVariationIndex];
    if (!activeVariation) return;

    setSelection({
      x: backgroundLayer.x,
      y: backgroundLayer.y,
      width: activeVariation.width,
      height: activeVariation.height,
      visible: true,
    });
    setIsSelectionActionMenuVisible(true);
  }, [backgroundLayer, setSelection, setIsSelectionActionMenuVisible]);

  const value: EditorContextType = {
    layers,
    setLayers,
    reorderLayers,
    selectedLayerIds,
    setSelectedLayerIds,
    lastEditedLayerId,
    setLastEditedLayerId,
    tool,
    setTool,
    addPaintingCanvas,
    addLayer,
    addLayerInPlace,
    deleteLayer,
    deleteVariationFromLayer,
    toggleLayerVisibility,
    updateLayer,
    addVariationToLayer,
    eraseFromLayer,
    restoreToLayer,
    getCanvasDataUrl,
    canvasRef,
    zoom,
    setZoom,
    offset,
    setOffset,
    selection,
    setSelection,
    selectAll,
    isSelectionActionMenuVisible,
    setIsSelectionActionMenuVisible,
    aspectRatioData,
    setAspectRatioData,
    message,
    setMessage,
    openCollapsibleId,
    setOpenCollapsibleId,
    enhanceGroupData,
    setEnhanceGroupData,
    renderLayerData,
    setRenderLayerData,
    generationCount,
    setGenerationCount,
    performCrop,
    history,
    historyIndex,
    undo,
    redo,
    undoLongPress,
    redoLongPress,
    eraserSize,
    setEraserSize,
    eraserOpacity,
    setEraserOpacity,
    brushSize,
    setBrushSize,
    brushOpacity,
    setBrushOpacity,
    divisionTool,
    setDivisionTool,
    generateDivisionSuggestions,
    setDivisionOverlap,
    splitImageIntoLayers,
    prepareSelectionSplit,
    confirmSelectionSplit,
    selectionDivisionPreview,
    setSelectionDivisionPreview,
    mergeLayers,
    updateVariation,
    validDivisionCounts,
    isApiKeyDialogOpen,
    setIsApiKeyDialogOpen,
    canGenerate,
    lassoPoints,
    setLassoPoints,
    eraseWithPolygon,
    eraseWithSelection,
    restoreWithPolygon,
    centerAndZoom,
    savedDivisionLayouts,
    saveCurrentDivisionLayout,
    loadDivisionLayout,
    isBackgroundResizeMode,
    setIsBackgroundResizeMode,
    addGenerationJob,
    generationJobs,
    backgroundLayer,
    isRecording,
    setIsRecording,
    isRecordingSetupOpen,
    setIsRecordingSetupOpen,
    recordingCropArea,
    setRecordingCropArea,
    targetLayerIdForRecording,
    setTargetLayerIdForRecording,
    isProcessingVideo,
    setIsProcessingVideo,
    videoStatusMessage,
    setVideoStatusMessage,
    recordedVideoBlob,
    setRecordedVideoBlob,
    rectangleThickness,
    setRectangleThickness,
    promptFontSize,
    setPromptFontSize,
    videoScript,
    setVideoScript,
    videoFPS,
    setVideoFPS,
    videoSpeed,
    setVideoSpeed,
    featherEditMode,
    setFeatherEditMode,
    updateFeatherPreview,
    applyFeathering,
    confirmFeathering,
    cancelFeathering,
    activeToolMenu,
    setActiveToolMenu,
    activateTool,
    isProMode,
    setIsProMode,
    toast,
  };

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
}
