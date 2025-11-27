
'use client';

import { useEditor } from '@/hooks/use-editor-store';
import React, { useEffect, useRef, useState } from 'react';
import { ASPECT_RATIOS } from '@/lib/consts';
import type { InteractionState, Layer, Selection, FeatheringState } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Camera, Upload, Image as ImageIcon, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import NewCanvasDialog from '../new-canvas-dialog';
import { Theme } from '@/components/layout/theme-toggle-button';
// type Theme = 'light' | 'dark' | 'nude' | 'ocean' | 'rainbow' | 'stone';
import RecordingCropArea from './recording-crop-area';
import { getClosestRatio } from '@/lib/utils/image';

// Cache for loaded images to avoid reloading them constantly
const imageCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): Promise<HTMLImageElement> {
  if (imageCache.has(src)) {
    const img = imageCache.get(src)!;
    if (img.complete) {
      return Promise.resolve(img);
    }
  }
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous'; // Allow loading from other domains
    img.src = src;
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = (err) => {
      imageCache.delete(src); // Remove from cache on error
      reject(err);
    };
  });
}

// Function to get cursor style based on position relative to the rectangle
const getCursorForSelection = (x: number, y: number, selection: { x: number, y: number, width: number, height: number }, zoom: number) => {
  const handleSize = 10 / zoom;
  const { x: sx, y: sy, width: sw, height: sh } = selection;

  const absWidth = Math.abs(sw);
  const absHeight = Math.abs(sh);
  const selX = sw < 0 ? sx + sw : sx;
  const selY = sh < 0 ? sy + sh : sy;

  const onTopLeft = x > selX - handleSize && x < selX + handleSize && y > selY - handleSize && y < selY + handleSize;
  const onBottomRight = x > selX + absWidth - handleSize && x < selX + absWidth + handleSize && y > selY + absHeight - handleSize && y < selY + absHeight + handleSize;
  const onTopRight = x > selX + absWidth - handleSize && x < selX + absWidth + handleSize && y > selY - handleSize && y < selY + handleSize;
  const onBottomLeft = x > selX - handleSize && x < selX + handleSize && y > selY + absHeight - handleSize && y < selY + absHeight + handleSize;

  if (onTopLeft || onBottomRight) return 'nwse-resize';
  if (onTopRight || onBottomLeft) return 'nesw-resize';

  if (x > selX && x < selX + absWidth && y > selY && y < selY + absHeight) return 'move';

  return 'crosshair';
};

const getCursorForFeatherHandle = (
  worldX: number,
  worldY: number,
  layer: Layer,
  feather: FeatheringState,
  zoom: number
): string | null => {
  const activeVariation = layer.variations[layer.activeVariationIndex];
  if (!activeVariation) return null;

  const layerWidth = activeVariation.width;
  const layerHeight = activeVariation.height;
  const handleSize = 10 / zoom;

  const handlePositions = {
    top: { x: layer.x + layerWidth / 2, y: layer.y + layerHeight * (feather.top / 100), cursor: 'ns-resize' },
    right: { x: layer.x + layerWidth * (1 - feather.right / 100), y: layer.y + layerHeight / 2, cursor: 'ew-resize' },
    bottom: { x: layer.x + layerWidth / 2, y: layer.y + layerHeight * (1 - feather.bottom / 100), cursor: 'ns-resize' },
    left: { x: layer.x + layerWidth * (feather.left / 100), y: layer.y + layerHeight / 2, cursor: 'ew-resize' }
  };

  for (const key in handlePositions) {
    const handle = handlePositions[key as keyof typeof handlePositions];
    if (Math.abs(worldX - handle.x) < handleSize && Math.abs(worldY - handle.y) < handleSize) {
      return handle.cursor;
    }
  }
  return null;
};


const getCursorForBackgroundResize = (
  worldX: number,
  worldY: number,
  layer: Layer,
  zoom: number
): string | null => {
  const activeVariation = layer.variations[layer.activeVariationIndex];
  if (!activeVariation) return null;

  const handleSize = 12 / zoom;
  const { width, height } = activeVariation;
  const { x, y } = layer;

  const onLeft = worldX >= x - handleSize && worldX <= x + handleSize && worldY >= y && worldY <= y + height;
  const onRight = worldX >= x + width - handleSize && worldX <= x + width + handleSize && worldY >= y && worldY <= y + height;
  const onTop = worldY >= y - handleSize && worldY <= y + handleSize && worldX >= x && worldX <= x + width;
  const onBottom = worldY >= y + height - handleSize && worldY <= y + height + handleSize && worldX >= x && worldX <= x + width;

  if (onLeft) return 'w-resize';
  if (onRight) return 'e-resize';
  if (onTop) return 'n-resize';
  if (onBottom) return 's-resize';

  return null;
};


const isPointInRects = (x: number, y: number, rects: Selection[], offsetX: number = 0, offsetY: number = 0) => {
  return rects.find(rect => {
    const finalX = rect.x + offsetX;
    const finalY = rect.y + offsetY;
    return x >= finalX && x <= finalX + rect.width && y >= finalY && y <= finalY + rect.height;
  });
};

const FeatherEditActions = () => {
  const { featherEditMode, confirmFeathering, cancelFeathering } = useEditor();

  if (!featherEditMode.layerId) {
    return null;
  }

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-1.5 bg-card rounded-lg border shadow-lg">
      <Button variant="ghost" size="sm" onClick={() => cancelFeathering(featherEditMode.layerId!)}>
        <X className="mr-2 h-4 w-4" />
        Cancelar
      </Button>
      <Button size="sm" onClick={() => confirmFeathering(featherEditMode.layerId!)}>
        <Check className="mr-2 h-4 w-4" />
        Finalizar Suavização
      </Button>
    </div>
  );
};

export default function CanvasArea({ theme }: { theme: Theme }) {
  const {
    canvasRef, layers, zoom, setZoom, offset, setOffset, tool, selectedLayerIds,
    selection, setSelection, setSelectedLayerIds, addLayer, setMessage, addPaintingCanvas,
    isSelectionActionMenuVisible, setIsSelectionActionMenuVisible, eraserSize, eraseFromLayer,
    brushSize, restoreToLayer, divisionTool, setDivisionTool, selectionDivisionPreview, setSelectionDivisionPreview,
    lassoPoints, setLassoPoints, eraseWithPolygon, restoreWithPolygon, setGenerationCount, centerAndZoom,
    eraseWithSelection, updateLayer, isBackgroundResizeMode, backgroundLayer, recordingCropArea, featherEditMode,
    updateFeatherPreview,
    applyFeathering,
    setActiveToolMenu,
    lastEditedLayerId,
    isProMode,
  } = useEditor();
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const interactionState = useRef<InteractionState>({ type: 'none' });
  const selectionStartPoint = useRef({ x: 0, y: 0 });
  const initialPinchDistance = useRef<number | null>(null);
  const lastZoom = useRef<number>(zoom);
  const activePoints = useRef<{ x: number, y: number }[]>([]);
  const { toast } = useToast();
  const [isNewCanvasDialogOpen, setIsNewCanvasDialogOpen] = useState(false);

  const getClampedCoordinates = (mouseX: number, mouseY: number) => {
    const activeBg = layers.find(l => l.isBackground && l.visible);
    if (!activeBg || !activeBg.visible) {
      return { clampedX: mouseX, clampedY: mouseY };
    }
    const activeVariation = activeBg.variations[activeBg.activeVariationIndex];
    if (!activeVariation) return { clampedX: mouseX, clampedY: mouseY };

    const bgX = activeBg.x + activeVariation.transform.offsetX;
    const bgY = activeBg.y + activeVariation.transform.offsetY;
    const bgScaleX = activeVariation.transform.scaleX / 100;
    const bgScaleY = activeVariation.transform.scaleY / 100;
    const bgWidth = activeVariation.width * bgScaleX;
    const bgHeight = activeVariation.height * bgScaleY;

    const clampedX = Math.max(bgX, Math.min(mouseX, bgX + bgWidth));
    const clampedY = Math.max(bgY, Math.min(mouseY, bgY + bgHeight));

    return { clampedX, clampedY };
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!containerRef.current || recordingCropArea) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Position of the mouse in the "world" coordinate system before zoom
    const mouseWorldX = (mouseX - offset.x) / zoom;
    const mouseWorldY = (mouseY - offset.y) / zoom;

    const zoomSensitivity = 0.001;
    const newZoom = zoom * (1 - e.deltaY * zoomSensitivity);
    const clampedZoom = Math.max(0.1, Math.min(newZoom, 10));

    // New offset to keep the mouse position in the same "world" location
    const newOffsetX = mouseX - mouseWorldX * clampedZoom;
    const newOffsetY = mouseY - mouseWorldY * clampedZoom;

    setZoom(clampedZoom);
    setOffset({ x: newOffsetX, y: newOffsetY });
  };

  const startInteraction = (worldX: number, worldY: number, clientX: number, clientY: number) => {
    if (recordingCropArea) return;
    const backgroundLayer = layers.find(l => l.isBackground);

    if (featherEditMode.layerId) {
      const layer = layers.find(l => l.id === featherEditMode.layerId);
      if (layer) {
        const activeVariation = layer.variations[layer.activeVariationIndex];
        const feather = activeVariation.feather || { top: 10, right: 10, bottom: 10, left: 10 };

        const layerWidth = activeVariation.width;
        const layerHeight = activeVariation.height;
        const handleSize = 10 / zoom;

        const handlePositions = {
          top: { x: layer.x + layerWidth / 2, y: layer.y + layerHeight * (feather.top / 100) },
          right: { x: layer.x + layerWidth * (1 - feather.right / 100), y: layer.y + layerHeight / 2 },
          bottom: { x: layer.x + layerWidth / 2, y: layer.y + layerHeight * (1 - feather.bottom / 100) },
          left: { x: layer.x + layerWidth * (feather.left / 100), y: layer.y + layerHeight / 2 }
        };

        for (const key in handlePositions) {
          const handle = handlePositions[key as keyof typeof handlePositions];
          if (Math.abs(worldX - handle.x) < handleSize && Math.abs(worldY - handle.y) < handleSize) {
            interactionState.current = {
              type: 'editing-feather',
              featherEditState: { layerId: layer.id, handle: key as keyof typeof handlePositions }
            };
            return;
          }
        }
      }
    }


    if (backgroundLayer && isBackgroundResizeMode) {
      const resizeCursor = getCursorForBackgroundResize(worldX, worldY, backgroundLayer, zoom);
      if (resizeCursor) {
        interactionState.current = {
          type: 'resizing-background',
          startPoint: { x: worldX, y: worldY },
          startLayer: JSON.parse(JSON.stringify(backgroundLayer)), // Deep copy
          cursor: resizeCursor,
        };
        return;
      }
    }

    if (tool === 'eraser-polygon') {
      if (selectedLayerIds.length === 0) {
        toast({ variant: 'destructive', title: 'Nenhuma camada selecionada', description: 'Por favor, selecione uma camada para usar o laço.' });
        return;
      }
      interactionState.current = { type: 'drawing-erase-lasso' };
      const newPoint = { x: worldX, y: worldY };
      if (lassoPoints.length > 1) {
        const firstPoint = lassoPoints[0];
        const dist = Math.sqrt(Math.pow(firstPoint.x - newPoint.x, 2) + Math.pow(firstPoint.y - newPoint.y, 2));
        if (dist < 10 / zoom) {
          eraseWithPolygon(selectedLayerIds[0], lassoPoints);
          setLassoPoints([]);
          interactionState.current = { type: 'none' };
          return;
        }
      }
      setLassoPoints(prev => [...prev, newPoint]);
      return;
    }

    if (tool === 'eraser-rectangle') {
      if (selectedLayerIds.length === 0) {
        toast({ variant: 'destructive', title: 'Nenhuma camada selecionada', description: 'Por favor, selecione uma camada para usar esta ferramenta.' });
        return;
      }
      interactionState.current = { type: 'drawing' };
      selectionStartPoint.current = { x: worldX, y: worldY };
      setSelection({ x: worldX, y: worldY, width: 0, height: 0, visible: true });
      return;
    }

    if (tool === 'lasso' || tool === 'restore-lasso') {
      if (selectedLayerIds.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Nenhuma camada selecionada',
          description: 'Por favor, selecione uma camada para usar o laço.',
        });
        return;
      }

      const interactionType = tool === 'lasso' ? 'drawing-erase-lasso' : 'drawing-restore-lasso';

      if (interactionState.current.type !== interactionType) {
        interactionState.current = { type: interactionType };
      }

      const newPoint = { x: worldX, y: worldY };

      // Check if closing the polygon
      if (lassoPoints.length > 1) {
        const firstPoint = lassoPoints[0];
        const dist = Math.sqrt(Math.pow(firstPoint.x - newPoint.x, 2) + Math.pow(firstPoint.y - newPoint.y, 2));
        if (dist < 10 / zoom) {
          if (tool === 'lasso') {
            eraseWithPolygon(selectedLayerIds[0], lassoPoints);
          } else {
            restoreWithPolygon(selectedLayerIds[0], lassoPoints);
          }
          setLassoPoints([]);
          interactionState.current = { type: 'none' };
          return;
        }
      }
      setLassoPoints(prev => [...prev, newPoint]);
      return;
    }

    if (divisionTool.isActive) {
      const clickedRect = isPointInRects(worldX, worldY, divisionTool.suggestedRects, divisionTool.offsetX, divisionTool.offsetY);
      if (clickedRect) {
        // Immediately select the rect and deactivate division mode
        setSelection({
          x: clickedRect.x + divisionTool.offsetX,
          y: clickedRect.y + divisionTool.offsetY,
          width: clickedRect.width,
          height: clickedRect.height,
          visible: true
        });
        setIsSelectionActionMenuVisible(true);
        setDivisionTool(prev => ({ ...prev, isActive: false, suggestedRects: [] }));
      }
      return;
    }


    if (tool === 'rectangle') {
      // If a division preview is active, a click might select one of the rects
      if (selectionDivisionPreview.isActive) {
        const clickedRect = isPointInRects(worldX, worldY, selectionDivisionPreview.rects);
        if (clickedRect) {
          setSelection(clickedRect); // Promote the clicked rect to the main selection
          setSelectionDivisionPreview({ isActive: false, rects: [] }); // Deactivate preview
          setIsSelectionActionMenuVisible(true);
        } else {
          setSelectionDivisionPreview({ isActive: false, rects: [] }); // Cancel on click outside
        }
        return;
      }

      const { clampedX, clampedY } = getClampedCoordinates(worldX, worldY);
      const cursor = getCursorForSelection(worldX, worldY, selection, zoom);

      if (selection.visible && cursor !== 'crosshair') {
        if (cursor !== 'move') {
          setIsSelectionActionMenuVisible(false);
        }
        interactionState.current = {
          type: cursor === 'move' ? 'moving' : 'resizing',
          startSelection: { ...selection },
          startPoint: { x: worldX, y: worldY },
          cursor: cursor,
        };
      } else {
        interactionState.current = { type: 'drawing' };
        selectionStartPoint.current = { x: clampedX, y: clampedY };
        setSelection({ x: clampedX, y: clampedY, width: 0, height: 0, visible: true });
        setIsSelectionActionMenuVisible(false);
        setSelectedLayerIds([]);
        setGenerationCount(1);
      }
      return;
    }

    if (tool.startsWith('eraser') || tool.startsWith('brush')) {
      if (selectedLayerIds.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Nenhuma camada selecionada',
          description: `Por favor, selecione uma camada no painel de camadas para usar esta ferramenta.`,
        });
        return;
      }
      const layer = layers.find(l => l.id === selectedLayerIds[0]);
      if (!layer || layer.isBackground) return;

      const interactionType = tool.startsWith('eraser') ? 'erasing' : 'restoring';

      if (interactionType === 'restoring' && !layer.variations[layer.activeVariationIndex]?.generationData?.originalDataUrl) {
        toast({
          variant: 'destructive',
          title: 'Não há o que restaurar',
          description: 'Esta camada não possui um estado anterior para restaurar.',
        });
        return;
      }

      interactionState.current = { type: interactionType };
      activePoints.current = [{ x: worldX, y: worldY }]; // Store world coordinates
      return;
    }

    // Default 'select' tool logic
    let clickedLayer = null;
    const selectableLayers = layers.filter(l => !l.isBackground);
    // Iterate backwards to select top layer first
    for (let i = selectableLayers.length - 1; i >= 0; i--) {
      const layer = selectableLayers[i];
      const activeVariation = layer.variations[layer.activeVariationIndex];
      if (!layer.visible || !activeVariation) continue;

      const transform = activeVariation.transform;
      const layerScaleX = transform.scaleX / 100;
      const layerScaleY = transform.scaleY / 100;

      const originalWidth = activeVariation.width;
      const originalHeight = activeVariation.height;

      const finalWidth = originalWidth * layerScaleX;
      const finalHeight = originalHeight * layerScaleY;

      const finalX = layer.x + transform.offsetX;
      const finalY = layer.y + transform.offsetY;

      if (worldX >= finalX && worldX <= finalX + finalWidth && worldY >= finalY && worldY <= finalY + finalHeight) {
        clickedLayer = layer;
        break;
      }
    }

    setSelectedLayerIds(clickedLayer ? [clickedLayer.id] : []);
    setIsSelectionActionMenuVisible(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (recordingCropArea) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseWorldX = (e.clientX - rect.left - offset.x) / zoom;
    const mouseWorldY = (e.clientY - rect.top - offset.y) / zoom;

    if (e.button === 1) { // Middle mouse button
      interactionState.current = {
        type: 'panning',
        startPoint: { x: e.clientX, y: e.clientY },
        startOffset: { ...offset }
      };
      if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }

    if (e.button !== 0) return;

    startInteraction(mouseWorldX, mouseWorldY, e.clientX, e.clientY);
  };

  const endInteraction = () => {
    const { type } = interactionState.current;
    if (type === 'panning' && containerRef.current) {
      containerRef.current.style.cursor = 'grab';
    }
    if (type === 'moving-division' && containerRef.current) {
      containerRef.current.style.cursor = 'grab';
    }

    if (type === 'holding-division') {
      const { clickedRect } = interactionState.current;
      if (clickedRect) {
        const finalRect = {
          ...clickedRect,
        }
        setSelection(finalRect);
        setIsSelectionActionMenuVisible(true);
        setDivisionTool(prev => ({ ...prev, isActive: false }));
      }
    }

    if (tool === 'eraser-rectangle' && type === 'drawing' && selectedLayerIds.length > 0) {
      if (selection.width !== 0 || selection.height !== 0) {
        const finalSelection = {
          ...selection,
          width: Math.abs(selection.width),
          height: Math.abs(selection.height),
          x: selection.width < 0 ? selection.x + selection.width : selection.x,
          y: selection.height < 0 ? selection.y + selection.height : selection.y,
        };
        eraseWithSelection(selectedLayerIds[0], finalSelection);
        setSelection({ ...finalSelection, visible: false }); // Hide selection after erase
      }
    }

    if (type === 'drawing-erase-lasso' || type === 'drawing-restore-lasso') {
      // Don't end interaction on mouse up for lasso, only on close or escape
      return;
    }

    if (type !== 'none') {
      let finalSelection = { ...selection };

      if ((type === 'drawing' || type === 'resizing') && (finalSelection.width !== 0 || finalSelection.height !== 0) && tool === 'rectangle') {
        finalSelection = {
          ...finalSelection,
          width: Math.abs(finalSelection.width),
          height: Math.abs(finalSelection.height),
          x: finalSelection.width < 0 ? finalSelection.x + finalSelection.width : finalSelection.x,
          y: finalSelection.height < 0 ? finalSelection.y + finalSelection.height : finalSelection.y
        };
        setSelection(finalSelection);
        if (type === 'drawing' || type === 'resizing') {
          setIsSelectionActionMenuVisible(true);
        }
      }
    }
    if (type === 'erasing' && selectedLayerIds.length > 0 && activePoints.current.length > 0) {
      eraseFromLayer(selectedLayerIds[0], activePoints.current);
    }
    if (type === 'restoring' && selectedLayerIds.length > 0 && activePoints.current.length > 0) {
      restoreToLayer(selectedLayerIds[0], activePoints.current);
    }

    if (type === 'resizing-background') {
      // The layer state is already updated by updateInteraction, so no further action is needed.
    }

    if (type === 'editing-feather' && interactionState.current.featherEditState) {
      const { layerId } = interactionState.current.featherEditState;
      const layer = layers.find(l => l.id === layerId);
      if (layer?.variations[layer.activeVariationIndex].feather) {
        applyFeathering(layerId, layer.activeVariationIndex, layer.variations[layer.activeVariationIndex].feather!);
      }
    }


    interactionState.current = { type: 'none' };
    activePoints.current = [];
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    endInteraction();

    const canvasContainer = containerRef.current;
    if (!canvasContainer || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - offset.x) / zoom;
    const mouseY = (e.clientY - rect.top - offset.y) / zoom;

    if (tool === 'division' || divisionTool.isActive) {
      canvasContainer.style.cursor = isPointInRects(mouseX, mouseY, divisionTool.suggestedRects, divisionTool.offsetX, divisionTool.offsetY) ? 'pointer' : 'default';
    } else if (tool === 'rectangle') {
      if (selectionDivisionPreview.isActive) {
        canvasContainer.style.cursor = isPointInRects(mouseX, mouseY, selectionDivisionPreview.rects) ? 'pointer' : 'default';
      } else {
        canvasContainer.style.cursor = getCursorForSelection(mouseX, mouseY, selection, zoom);
      }
    } else if (tool === 'lasso' || tool === 'restore-lasso' || tool === 'eraser-polygon') {
      canvasContainer.style.cursor = 'crosshair';
    } else {
      canvasContainer.style.cursor = 'default';
    }
  };

  const updateInteraction = (worldX: number, worldY: number, clientX: number, clientY: number) => {
    if (recordingCropArea) return;
    const { type } = interactionState.current;

    if (type === 'panning') {
      const { startPoint, startOffset } = interactionState.current;
      if (!startPoint || !startOffset) return;
      const dx = clientX - startPoint.x;
      const dy = clientY - startPoint.y;
      setOffset({
        x: startOffset.x + dx,
        y: startOffset.y + dy,
      });
      return;
    }

    if (type === 'editing-feather' && interactionState.current.featherEditState) {
      const { layerId, handle } = interactionState.current.featherEditState;
      const layer = layers.find(l => l.id === layerId);
      if (layer) {
        const activeVariation = layer.variations[layer.activeVariationIndex];
        const layerWidth = activeVariation.width;
        const layerHeight = activeVariation.height;

        let newFeatherValue = 0;
        switch (handle) {
          case 'top':
            newFeatherValue = Math.min(50, Math.max(0, (worldY - layer.y) / layerHeight * 100));
            break;
          case 'right':
            newFeatherValue = Math.min(50, Math.max(0, (layer.x + layerWidth - worldX) / layerWidth * 100));
            break;
          case 'bottom':
            newFeatherValue = Math.min(50, Math.max(0, (layer.y + layerHeight - worldY) / layerHeight * 100));
            break;
          case 'left':
            newFeatherValue = Math.min(50, Math.max(0, (worldX - layer.x) / layerWidth * 100));
            break;
        }

        const currentFeather = activeVariation.feather || { top: 10, right: 10, bottom: 10, left: 10 };
        const newFeatherState: FeatheringState = {
          ...currentFeather,
          [handle]: newFeatherValue
        };

        // Instead of calling the heavy `applyFeathering`, we just update the preview state
        updateFeatherPreview(layerId, layer.activeVariationIndex, newFeatherState);
      }
      return;
    }

    if (type === 'resizing-background') {
      const { startLayer, startPoint, cursor } = interactionState.current as any;
      if (!startLayer || !startPoint || !cursor) return;

      const dx = worldX - startPoint.x;
      const dy = worldY - startPoint.y;

      let newX = startLayer.x;
      let newY = startLayer.y;
      let newWidth = startLayer.variations[0].width;
      let newHeight = startLayer.variations[0].height;

      switch (cursor) {
        case 'e-resize': // Right
          newWidth = Math.max(64, startLayer.variations[0].width + dx);
          break;
        case 'w-resize': // Left
          newWidth = Math.max(64, startLayer.variations[0].width - dx);
          newX = startLayer.x + dx;
          break;
        case 's-resize': // Bottom
          newHeight = Math.max(64, startLayer.variations[0].height + dy);
          break;
        case 'n-resize': // Top
          newHeight = Math.max(64, startLayer.variations[0].height - dy);
          newY = startLayer.y + dy;
          break;
      }

      const updatedVariations = [...startLayer.variations];
      updatedVariations[0] = { ...updatedVariations[0], width: newWidth, height: newHeight };

      updateLayer(startLayer.id, {
        x: newX,
        y: newY,
        variations: updatedVariations,
      });
      return;
    }


    if (tool === 'division') {
      const backgroundLayer = layers.find(l => l.isBackground);

      if (type === 'moving-division') {
        const { startPoint, startOffset } = interactionState.current;
        if (!startPoint || !startOffset || !backgroundLayer) return;

        const dx = worldX - startPoint.x;
        const dy = worldY - startPoint.y;

        const bgVar = backgroundLayer.variations[backgroundLayer.activeVariationIndex];
        const bgScaleX = bgVar.transform.scaleX / 100;
        const bgScaleY = bgVar.transform.scaleY / 100;
        const bgWidth = bgVar.width * bgScaleX;
        const bgHeight = bgVar.height * bgScaleY;
        const bgX = backgroundLayer.x + bgVar.transform.offsetX;
        const bgY = backgroundLayer.y + bgVar.transform.offsetY;

        const groupRects = divisionTool.suggestedRects;
        const minRectX = Math.min(...groupRects.map(r => r.x));
        const maxRectX = Math.max(...groupRects.map(r => r.x + r.width));
        const minRectY = Math.min(...groupRects.map(r => r.y));
        const maxRectY = Math.max(...groupRects.map(r => r.y + r.height));

        const groupWidth = maxRectX - minRectX;
        const groupHeight = maxRectY - minRectY;

        const newOffsetX = startOffset.x + dx;
        const newOffsetY = startOffset.y + dy;

        // Calculate the group's potential new absolute top-left corner
        const newGroupAbsX = minRectX + newOffsetX;
        const newGroupAbsY = minRectY + newOffsetY;

        // Clamp the absolute position
        const clampedGroupAbsX = Math.max(bgX, Math.min(newGroupAbsX, bgX + bgWidth - groupWidth));
        const clampedGroupAbsY = Math.max(bgY, Math.min(newGroupAbsY, bgY + bgHeight - groupHeight));

        // Calculate the final offset based on the clamped absolute position
        const finalOffsetX = clampedGroupAbsX - minRectX;
        const finalOffsetY = clampedGroupAbsY - minRectY;

        setDivisionTool(prev => ({ ...prev, offsetX: finalOffsetX, offsetY: finalOffsetY }));
        return;
      }
    }

    if (tool === 'rectangle' || tool === 'eraser-rectangle') {
      if (type === 'drawing') {
        const { clampedX, clampedY } = getClampedCoordinates(worldX, worldY);
        let startX = selectionStartPoint.current.x;
        let startY = selectionStartPoint.current.y;

        let newWidth = clampedX - startX;
        let newHeight = clampedY - startY;

        // Always snap to closest aspect ratio for 'rectangle' tool
        if (tool === 'rectangle' && Math.abs(newWidth) > 10 && Math.abs(newHeight) > 10) {
          const subWidth = Math.abs(newWidth);
          const closestRatio = getClosestRatio(subWidth, Math.abs(newHeight), isProMode);
          newHeight = (subWidth / closestRatio.ratio) * Math.sign(newHeight);
        }

        setSelection({ x: startX, y: startY, width: newWidth, height: newHeight, visible: true });

      } else if (type === 'moving') {
        const { startSelection, startPoint } = interactionState.current;
        if (!startSelection || !startPoint) return;
        const dx = worldX - startPoint.x;
        const dy = worldY - startPoint.y;

        let newX = startSelection.x + dx;
        let newY = startSelection.y + dy;

        // Clamp movement to background bounds
        const activeBg = layers.find(l => l.isBackground && l.visible);
        if (activeBg) {
          const bgVar = activeBg.variations[activeBg.activeVariationIndex];
          const bgScaleX = bgVar.transform.scaleX / 100;
          const bgScaleY = bgVar.transform.scaleY / 100;
          const bgX = activeBg.x + bgVar.transform.offsetX;
          const bgY = activeBg.y + bgVar.transform.offsetY;
          const bgWidth = bgVar.width * bgScaleX;
          const bgHeight = bgVar.height * bgScaleY;

          newX = Math.max(bgX, Math.min(newX, bgX + bgWidth - startSelection.width));
          newY = Math.max(bgY, Math.min(newY, bgY + bgHeight - startSelection.height));
        }

        setSelection(prev => ({ ...prev, x: newX, y: newY }));

      } else if (type === 'resizing') {
        const { startSelection, cursor: resizeCursor, startPoint } = interactionState.current;
        if (!startSelection || !resizeCursor || !startPoint) return;

        const { clampedX: clampedWorldX, clampedY: clampedWorldY } = getClampedCoordinates(worldX, worldY);

        // Normalize startSelection coordinates and dimensions
        const startAbsWidth = Math.abs(startSelection.width);
        const startAbsHeight = Math.abs(startSelection.height);
        const startX = startSelection.width < 0 ? startSelection.x + startSelection.width : startSelection.x;
        const startY = startSelection.height < 0 ? startSelection.y + startSelection.height : startSelection.y;

        // Define the four corners of the initial selection box
        const corners = {
          nw: { x: startX, y: startY },
          ne: { x: startX + startAbsWidth, y: startY },
          sw: { x: startX, y: startY + startAbsHeight },
          se: { x: startX + startAbsWidth, y: startY + startAbsHeight },
        };

        // Determine which corner is being dragged based on cursor type and start position
        const isNWSE = resizeCursor === 'nwse-resize';
        const dx = startPoint.x - startX;
        const dy = startPoint.y - startY;

        let handle: 'nw' | 'ne' | 'sw' | 'se';
        if (isNWSE) {
          handle = (dx < startAbsWidth / 2 && dy < startAbsHeight / 2) ? 'nw' : 'se';
        } else { // nesw-resize
          handle = (dx > startAbsWidth / 2 && dy < startAbsHeight / 2) ? 'ne' : 'sw';
        }

        let anchor: { x: number, y: number };
        switch (handle) {
          case 'nw': anchor = corners.se; break;
          case 'ne': anchor = corners.sw; break;
          case 'sw': anchor = corners.ne; break;
          case 'se': anchor = corners.nw; break;
        }

        let newWidth = clampedWorldX - anchor.x;
        let newHeight = clampedWorldY - anchor.y;

        if (tool === 'rectangle' && Math.abs(newWidth) > 10 && Math.abs(newHeight) > 10) {
          const closestRatio = getClosestRatio(Math.abs(newWidth), Math.abs(newHeight), isProMode);
          newHeight = (Math.abs(newWidth) / closestRatio.ratio) * Math.sign(newHeight);
        }

        setSelection(prev => ({
          ...prev,
          x: anchor.x,
          y: anchor.y,
          width: newWidth,
          height: newHeight,
        }));
      }
    } else if (tool.startsWith('eraser') && type === 'erasing' && selectedLayerIds.length > 0) {
      activePoints.current.push({ x: worldX, y: worldY });
      // Force a re-render to draw the temporary eraser path
      canvasRef.current?.getContext('2d')?.clearRect(0, 0, 0, 0);
    } else if (tool.startsWith('brush') && type === 'restoring' && selectedLayerIds.length > 0) {
      activePoints.current.push({ x: worldX, y: worldY });
      // Force a re-render to draw the temporary path
      canvasRef.current?.getContext('2d')?.clearRect(0, 0, 0, 0);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseWorldX = (e.clientX - rect.left - offset.x) / zoom;
    const mouseWorldY = (e.clientY - rect.top - offset.y) / zoom;

    const currentContainer = containerRef.current;
    if (!currentContainer) return;

    const { type } = interactionState.current;

    let cursor = 'default';
    const backgroundLayer = layers.find(l => l.isBackground);

    if (type === 'panning') {
      cursor = 'grabbing';
    } else if (type === 'resizing-background') {
      cursor = (interactionState.current as any).cursor;
    } else if (type === 'moving-division') {
      cursor = 'grabbing';
    } else if (type === 'editing-feather' && interactionState.current.featherEditState) {
      const layer = layers.find(l => l.id === interactionState.current.featherEditState!.layerId);
      if (layer) {
        const featherCursor = getCursorForFeatherHandle(mouseWorldX, mouseWorldY, layer, layer.variations[layer.activeVariationIndex].feather!, zoom);
        if (featherCursor) cursor = featherCursor;
      }
    } else if (featherEditMode.layerId) {
      const layer = layers.find(l => l.id === featherEditMode.layerId);
      if (layer) {
        const activeVariation = layer.variations[layer.activeVariationIndex];
        const feather = activeVariation.feather || { top: 10, right: 10, bottom: 10, left: 10 };
        const featherCursor = getCursorForFeatherHandle(mouseWorldX, mouseWorldY, layer, feather, zoom);
        if (featherCursor) {
          cursor = featherCursor;
        }
      }
    } else if (backgroundLayer && isBackgroundResizeMode) {
      const resizeCursor = getCursorForBackgroundResize(mouseWorldX, mouseWorldY, backgroundLayer, zoom);
      if (resizeCursor) {
        cursor = resizeCursor;
      }
    } else if (divisionTool.isActive) {
      cursor = isPointInRects(mouseWorldX, mouseWorldY, divisionTool.suggestedRects, divisionTool.offsetX, divisionTool.offsetY) ? 'pointer' : 'default';
    } else if (tool === 'rectangle' || tool === 'eraser-rectangle') {
      if (selectionDivisionPreview.isActive && tool === 'rectangle') {
        cursor = isPointInRects(mouseWorldX, mouseWorldY, selectionDivisionPreview.rects) ? 'pointer' : 'default';
      } else {
        cursor = 'crosshair';
        if (type === 'none' && (selection.visible || selectionDivisionPreview.isActive)) {
          cursor = getCursorForSelection(mouseWorldX, mouseWorldY, selection, zoom);
        } else if (type === 'moving' || type === 'resizing') {
          cursor = interactionState.current.cursor || 'crosshair';
        }
      }
    } else if (tool.startsWith('eraser-square') || tool.startsWith('brush-square')) {
      cursor = 'none'; // Hide default cursor, we'll draw our own
    } else if (tool.startsWith('eraser-rectangle') || tool.startsWith('brush-rectangle')) {
      cursor = 'none';
    } else if (tool.startsWith('eraser') || tool.startsWith('brush')) {
      cursor = 'none'; // Hide default cursor, we'll draw our own
    } else if (tool === 'lasso' || tool === 'restore-lasso' || tool.startsWith('eraser-polygon')) {
      cursor = 'crosshair';
    }

    currentContainer.style.cursor = cursor;
    updateInteraction(mouseWorldX, mouseWorldY, e.clientX, e.clientY);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (tool === 'lasso' || tool === 'restore-lasso' || tool === 'eraser-polygon') {
      if (lassoPoints.length > 2) {
        if (tool === 'lasso' || tool === 'eraser-polygon') {
          eraseWithPolygon(selectedLayerIds[0], lassoPoints);
        } else {
          restoreWithPolygon(selectedLayerIds[0], lassoPoints);
        }
        setLassoPoints([]);
        interactionState.current = { type: 'none' };
      }
      return;
    }

    if (tool !== 'rectangle' || !selection.visible) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - offset.x) / zoom;
    const mouseY = (e.clientY - rect.top - offset.y) / zoom;

    const handleSize = 10 / zoom;
    const { x, y, width, height } = selection;

    const absWidth = Math.abs(width);
    const absHeight = Math.abs(height);
    const selX = width < 0 ? x + width : x;
    const selY = height < 0 ? y + height : y;

    const handles = {
      topLeft: { x: selX, y: selY },
      topRight: { x: selX + absWidth, y: selY },
      bottomLeft: { x: selX, y: selY + absHeight },
      bottomRight: { x: selX + absWidth, y: selY + absHeight },
    };

    let clickedHandle: keyof typeof handles | null = null;

    for (const key in handles) {
      const handle = handles[key as keyof typeof handles];
      if (
        mouseX >= handle.x - handleSize &&
        mouseX <= handle.x + handleSize &&
        mouseY >= handle.y - handleSize &&
        mouseY <= handle.y + handleSize
      ) {
        clickedHandle = key as keyof typeof handles;
        break;
      }
    }

    if (clickedHandle) {
      e.preventDefault();
      const MAX_SIZE = 4096;
      let newX = selX;
      let newY = selY;
      let newWidth = absWidth;
      let newHeight = absHeight;

      const aspectRatio = newWidth / newHeight;

      if (aspectRatio >= 1) { // Landscape or square
        newWidth = MAX_SIZE;
        newHeight = MAX_SIZE / aspectRatio;
      } else { // Portrait
        newHeight = MAX_SIZE;
        newWidth = MAX_SIZE * aspectRatio;
      }

      switch (clickedHandle) {
        case 'topLeft':
          newX = selX + absWidth - newWidth;
          newY = selY + absHeight - newHeight;
          break;
        case 'topRight':
          newX = selX;
          newY = selY + absHeight - newHeight;
          break;
        case 'bottomLeft':
          newX = selX + absWidth - newWidth;
          newY = selY;
          break;
        case 'bottomRight':
          newX = selX;
          newY = selY;
          break;
      }

      setSelection({
        ...selection,
        x: Math.floor(newX),
        y: Math.floor(newY),
        width: Math.floor(newWidth),
        height: Math.floor(newHeight),
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleFileDrop = (file: File) => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (readEvent) => {
        const dataUrl = readEvent.target?.result as string;
        if (dataUrl) {
          const img = new window.Image();
          img.onload = () => {
            const backgroundLayer = layers.find(l => l.isBackground);
            const layerNumber = layers.filter(l => !l.isBackground).length;
            const layerName = `Lay ${layerNumber}`;
            if (!backgroundLayer) {
              addPaintingCanvas({ width: img.width, height: img.height }, "Fundo");
              addLayer(dataUrl, layerName, { x: 0, y: 0 });
            } else {
              addLayer(dataUrl, layerName);
            }
          }
          img.src = dataUrl;
        }
      };
      reader.readAsDataURL(file);
    } else {
      console.error('Invalid file type dropped');
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileDrop(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileDrop(file);
    }
    // Reset file input so the same file can be selected again
    if (event.target) event.target.value = '';
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || recordingCropArea) return;
    const rect = canvas.getBoundingClientRect();

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const touchX = (touch.clientX - rect.left - offset.x) / zoom;
      const touchY = (touch.clientY - rect.top - offset.y) / zoom;
      startInteraction(touchX, touchY, touch.clientX, touch.clientY);
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      initialPinchDistance.current = dist;
      lastZoom.current = zoom;

      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

      interactionState.current = {
        type: 'panning',
        startPoint: { x: centerX, y: centerY },
        startOffset: { ...offset },
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (recordingCropArea) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const touchX = (touch.clientX - rect.left - offset.x) / zoom;
      const touchY = (touch.clientY - rect.top - offset.y) / zoom;
      updateInteraction(touchX, touchY, touch.clientX, touch.clientY);
    } else if (e.touches.length === 2 && containerRef.current) {
      // Pinch to zoom logic
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const currentPinchDistance = Math.sqrt(dx * dx + dy * dy);

      if (initialPinchDistance.current) {
        const zoomFactor = currentPinchDistance / initialPinchDistance.current;
        const newZoom = lastZoom.current * zoomFactor;
        const clampedZoom = Math.max(0.1, Math.min(newZoom, 10));

        const touchCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const touchCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

        const mouseWorldX = (touchCenterX - offset.x) / zoom;
        const mouseWorldY = (touchCenterY - offset.y) / zoom;

        const newOffsetX = touchCenterX - mouseWorldX * clampedZoom;
        const newOffsetY = touchCenterY - mouseWorldY * clampedZoom;

        setZoom(clampedZoom);
        setOffset({ x: newOffsetX, y: newOffsetY });
      }

      // Two-finger pan logic
      if (interactionState.current.type === 'panning') {
        const { startPoint, startOffset } = interactionState.current;
        if (startPoint && startOffset) {
          const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          const panDx = centerX - startPoint.x;
          const panDy = centerY - startPoint.y;
          setOffset({
            x: startOffset.x + panDx,
            y: startOffset.y + panDy,
          });
        }
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (interactionState.current.type !== 'none' && e.touches.length < 2) {
      endInteraction();
    }

    if (e.touches.length < 2) {
      initialPinchDistance.current = null;
    }
    if (e.touches.length < 1) {
      endInteraction();
    }
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (interactionState.current.type === 'none' || recordingCropArea) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouseWorldX = (e.clientX - rect.left - offset.x) / zoom;
      const mouseWorldY = (e.clientY - rect.top - offset.y) / zoom;

      updateInteraction(mouseWorldX, mouseWorldY, e.clientX, e.clientY);
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (interactionState.current.type !== 'none') {
        endInteraction();
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [offset, zoom, recordingCropArea]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input, textarea, etc.
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'Escape') {
        setSelectedLayerIds([]);
        setSelection(prev => ({ ...prev, visible: false }));
        setIsSelectionActionMenuVisible(false);
        setSelectionDivisionPreview({ isActive: false, rects: [] });
        if (lassoPoints.length > 0) {
          setLassoPoints([]);
          interactionState.current = { type: 'none' };
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedLayerIds.length > 0 && selection.visible) {
          eraseWithSelection(selectedLayerIds[0], selection);
          setSelection(prev => ({ ...prev, visible: false }));
        }
      }
    };

    const handlePaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            handleFileDrop(blob);
            event.preventDefault();
            return;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handlePaste);
    };
  }, [setSelection, setSelectedLayerIds, setIsSelectionActionMenuVisible, setSelectionDivisionPreview, lassoPoints, setLassoPoints, addLayer, selection, selectedLayerIds, eraseWithSelection]);

  // Effect for resizing the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        const context = canvas.getContext('2d');
        if (context) {
          context.scale(dpr, dpr);
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [canvasRef]);

  // Effect for drawing on the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let frameId: number | null = null;
    let chequeredPattern: CanvasPattern | null = null;
    const patternCanvas = document.createElement('canvas');
    const patternCtx = patternCanvas.getContext('2d');
    const patternSize = 20;
    patternCanvas.width = patternSize * 2;
    patternCanvas.height = patternSize * 2;
    if (patternCtx) {
      const mutedColor = `hsl(${getComputedStyle(document.documentElement).getPropertyValue('--muted').trim()})`;
      patternCtx.fillStyle = mutedColor;
      patternCtx.fillRect(0, 0, patternSize, patternSize);
      patternCtx.fillRect(patternSize, patternSize, patternSize, patternSize);
      chequeredPattern = context.createPattern(patternCanvas, 'repeat');
    }

    const draw = () => {
      if (!context) return;
      const { width, height } = canvas.getBoundingClientRect();
      context.clearRect(0, 0, width, height);

      // Get theme colors from CSS variables
      const computedStyle = getComputedStyle(document.documentElement);
      const ringColor = `hsl(${computedStyle.getPropertyValue('--ring').trim()})`;
      const primaryColor = `hsl(${computedStyle.getPropertyValue('--primary').trim()})`;
      const warningColor = `hsl(${computedStyle.getPropertyValue('--warning').trim()})`;
      const dangerColor = 'hsl(0, 84%, 60%)'; // Red

      context.save();
      context.translate(offset.x, offset.y);
      context.scale(zoom, zoom);

      const visibleLayers = [...layers].filter(layer => layer.visible);

      // Load images and trigger redraw
      visibleLayers.forEach(layer => {
        const activeVariation = layer.variations[layer.activeVariationIndex];
        if (activeVariation && !imageCache.has(activeVariation.dataUrl)) {
          loadImage(activeVariation.dataUrl).catch(() => { });
        }
      });

      // Draw visible layers
      const drawLayer = (layer: Layer) => {
        const activeVariation = layer.variations[layer.activeVariationIndex];
        if (!activeVariation) return;

        const img = imageCache.get(activeVariation.dataUrl);

        context.save();

        const transform = activeVariation.transform;
        const layerScaleX = transform.scaleX / 100;
        const layerScaleY = transform.scaleY / 100;

        const originalWidth = activeVariation.width;
        const originalHeight = activeVariation.height;

        const finalWidth = originalWidth * layerScaleX;
        const finalHeight = originalHeight * layerScaleY;

        const finalX = layer.x + transform.offsetX;
        const finalY = layer.y + transform.offsetY;

        if (layer.isBackground) {
          // Draw shadow for floating effect
          context.save();
          context.shadowColor = 'rgba(0,0,0,0.2)';
          context.shadowBlur = 20;
          context.shadowOffsetX = 0;
          context.shadowOffsetY = 5;
          // By drawing a transparent rect, only the shadow is rendered.
          context.fillStyle = 'rgba(0,0,0,0)';
          context.fillRect(finalX, finalY, finalWidth, finalHeight);
          context.restore();

          // Draw the actual background content
          if (chequeredPattern) {
            context.fillStyle = chequeredPattern;
            context.fillRect(finalX, finalY, finalWidth, finalHeight);
          }
        }

        if (img && img.complete) {
          if (!layer.isBackground) {
            context.globalAlpha = activeVariation.opacity / 100;
            context.filter = `brightness(${activeVariation.brightness / 100}) contrast(${activeVariation.contrast / 100}) saturate(${activeVariation.saturate / 100})`;
          }
          context.drawImage(img, finalX, finalY, finalWidth, finalHeight);
        }

        context.restore();
      };

      visibleLayers.forEach(drawLayer);

      if (featherEditMode.layerId) {
        const layer = layers.find(l => l.id === featherEditMode.layerId);
        if (layer) {
          const activeVariation = layer.variations[layer.activeVariationIndex];
          const feather = activeVariation.feather || { top: 10, right: 10, bottom: 10, left: 10 };
          const layerWidth = activeVariation.width;
          const layerHeight = activeVariation.height;

          context.save();

          // Draw outer boundary
          context.strokeStyle = `hsl(${computedStyle.getPropertyValue('--border').trim()})`;
          context.lineWidth = 1 / zoom;
          context.strokeRect(layer.x, layer.y, layerWidth, layerHeight);

          // Draw inner rectangle
          context.strokeStyle = ringColor;
          context.setLineDash([4 / zoom, 2 / zoom]);

          const topY = layer.y + layerHeight * (feather.top / 100);
          const rightX = layer.x + layerWidth * (1 - feather.right / 100);
          const bottomY = layer.y + layerHeight * (1 - feather.bottom / 100);
          const leftX = layer.x + layerWidth * (feather.left / 100);

          context.strokeRect(leftX, topY, rightX - leftX, bottomY - topY);

          // Draw handles
          const handleSize = 8 / zoom;
          context.fillStyle = ringColor;
          const handles = [
            { x: layer.x + layerWidth / 2, y: topY }, // Top
            { x: rightX, y: layer.y + layerHeight / 2 }, // Right
            { x: layer.x + layerWidth / 2, y: bottomY }, // Bottom
            { x: leftX, y: layer.y + layerHeight / 2 } // Left
          ];
          handles.forEach(handle => {
            context.beginPath();
            context.arc(handle.x, handle.y, handleSize / 2, 0, Math.PI * 2);
            context.fill();
          });
          context.restore();
        }
      }


      const backgroundLayer = layers.find(l => l.isBackground);
      if (backgroundLayer) {
        const activeVariation = backgroundLayer.variations[0];
        const finalWidth = activeVariation.width * (activeVariation.transform.scaleX / 100);
        const finalHeight = activeVariation.height * (activeVariation.transform.scaleY / 100);
        context.strokeStyle = primaryColor;
        context.lineWidth = isBackgroundResizeMode ? 2 / zoom : 1 / zoom;
        context.setLineDash(isBackgroundResizeMode ? [] : [4 / zoom, 4 / zoom]);
        context.strokeRect(backgroundLayer.x + activeVariation.transform.offsetX, backgroundLayer.y + activeVariation.transform.offsetY, finalWidth, finalHeight);

        if (isBackgroundResizeMode) {
          const handleSize = 8 / zoom;
          context.fillStyle = primaryColor;
          context.strokeStyle = `hsl(${computedStyle.getPropertyValue('--card').trim()})`;
          context.lineWidth = 2 / zoom;

          const handles = [
            { x: backgroundLayer.x + activeVariation.transform.offsetX + finalWidth / 2, y: backgroundLayer.y + activeVariation.transform.offsetY }, // T
            { x: backgroundLayer.x + activeVariation.transform.offsetX + finalWidth / 2, y: backgroundLayer.y + activeVariation.transform.offsetY + finalHeight }, // B
            { x: backgroundLayer.x + activeVariation.transform.offsetX, y: backgroundLayer.y + activeVariation.transform.offsetY + finalHeight / 2 }, // L
            { x: backgroundLayer.x + activeVariation.transform.offsetX + finalWidth, y: backgroundLayer.y + activeVariation.transform.offsetY + finalHeight / 2 }, // R
          ];

          handles.forEach(handle => {
            context.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
            context.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
          });
        }

        context.setLineDash([]);
      }

      const selectedLayers = layers.filter(l => selectedLayerIds.includes(l.id));
      if (selectedLayers.length > 0 && !featherEditMode.layerId) {
        selectedLayers.forEach(selectedLayer => {
          if (selectedLayer && selectedLayer.visible && !selectedLayer.isBackground) {
            const activeVariation = selectedLayer.variations[selectedLayer.activeVariationIndex];
            if (activeVariation) {
              const img = imageCache.get(activeVariation.dataUrl);
              if (img && img.complete) {
                const transform = activeVariation.transform;
                const layerScaleX = transform.scaleX / 100;
                const layerScaleY = transform.scaleY / 100;

                const originalWidth = activeVariation.width;
                const originalHeight = activeVariation.height;

                const finalWidth = originalWidth * layerScaleX;
                const finalHeight = originalHeight * layerScaleY;

                const finalX = selectedLayer.x + transform.offsetX;
                const finalY = selectedLayer.y + transform.offsetY;

                context.strokeStyle = ringColor;
                context.lineWidth = 2 / zoom;
                context.strokeRect(finalX, finalY, finalWidth, finalHeight);
              }
            }
          }
        })
      }

      const drawDivisionRects = (rects: Selection[], offsetX: number, offsetY: number) => {
        rects.forEach(sel => {
          const selW = Math.abs(sel.width);
          const selH = Math.abs(sel.height);
          context.save();

          let strokeStyle = primaryColor;
          let fillStyle = `hsla(271, 100%, 74%, 0.1)`;

          if (divisionTool.isActive && divisionTool.suggestionType) {
            if (divisionTool.suggestionType.startsWith('simple')) {
              strokeStyle = dangerColor;
              fillStyle = `hsla(0, 84%, 60%, 0.1)`;
            } else if (divisionTool.suggestionType.startsWith('optimized-unlimited')) {
              strokeStyle = warningColor;
              fillStyle = `hsla(48, 96%, 58%, 0.1)`;
            }
          }

          const finalX = sel.x + offsetX;
          const finalY = sel.y + offsetY;

          context.fillStyle = fillStyle;
          context.fillRect(finalX, finalY, selW, selH);
          context.strokeStyle = strokeStyle;
          context.lineWidth = 1.5 / zoom;
          context.strokeRect(finalX, finalY, selW, selH);
          context.restore();
        });
      }

      const drawSelectionRect = (sel: Selection) => {
        let selX = sel.x;
        let selY = sel.y;
        let selW = sel.width;
        let selH = sel.height;

        if (selW < 0) {
          selX += selW;
          selW = -selW;
        }
        if (selH < 0) {
          selY += selH;
          selH = -selH;
        }

        const MEGA_PIXEL = 1000000;
        const maxPixels = isProMode ? 4.2 * MEGA_PIXEL : 1.1 * MEGA_PIXEL;
        const qualityWarning = (tool === 'rectangle' && (selW * selH) > maxPixels);

        if (qualityWarning) {
          setMessage({ text: `Aviso: A área da seleção (${Math.floor(selW)}x${Math.floor(selH)}px) excede ${isProMode ? '4.2MP' : '1.1MP'} e a imagem gerada pode ter qualidade reduzida.`, level: 'warning' });
        } else {
          setMessage(null);
        }

        context.save();

        const fillStyle = qualityWarning
          ? `hsla(48, 96%, 58%, 0.1)` // Semi-transparent yellow
          : `hsla(243, 77%, 59%, 0.1)`; // Semi-transparent purple (primary)
        context.fillStyle = fillStyle;

        context.fillRect(selX, selY, selW, selH);

        const strokeStyle = qualityWarning ? warningColor : primaryColor;
        context.strokeStyle = strokeStyle;
        context.lineWidth = 1.5 / zoom;
        context.setLineDash([6 / zoom, 4 / zoom]);
        context.strokeRect(selX, selY, selW, selH);

        // Draw corner handles
        const handleSize = 12 / zoom;
        context.lineWidth = 3 / zoom;
        context.setLineDash([]);

        const corners = [
          { x: selX, y: selY }, // TL
          { x: selX + selW, y: selY }, // TR
          { x: selX, y: selY + selH }, // BL
          { x: selX + selW, y: selY + selH }, // BR
        ];

        context.beginPath();
        // Top-left
        context.moveTo(corners[0].x, corners[0].y + handleSize);
        context.lineTo(corners[0].x, corners[0].y);
        context.lineTo(corners[0].x + handleSize, corners[0].y);
        // Top-right
        context.moveTo(corners[1].x - handleSize, corners[1].y);
        context.lineTo(corners[1].x, corners[1].y);
        context.lineTo(corners[1].x, corners[1].y + handleSize);
        // Bottom-left
        context.moveTo(corners[2].x, corners[2].y - handleSize);
        context.lineTo(corners[2].x, corners[2].y);
        context.lineTo(corners[2].x + handleSize, corners[2].y);
        // Bottom-right
        context.moveTo(corners[3].x - handleSize, corners[3].y);
        context.lineTo(corners[3].x, corners[3].y);
        context.lineTo(corners[3].x, corners[3].y - handleSize);
        context.stroke();
        context.restore();
      };


      if (selection.visible && (tool === 'rectangle' || tool === 'eraser-rectangle')) {
        if (selectionDivisionPreview.isActive && tool === 'rectangle') {
          drawDivisionRects(selectionDivisionPreview.rects, 0, 0);
        } else {
          drawSelectionRect(selection);
        }
      } else if (divisionTool.isActive || divisionTool.suggestedRects.length > 0) {
        drawDivisionRects(divisionTool.suggestedRects, divisionTool.offsetX, divisionTool.offsetY);
      } else {
        if (tool === 'rectangle') setMessage(null);
      }

      // Draw lasso polygon
      if ((tool === 'lasso' || tool === 'restore-lasso' || tool === 'eraser-polygon') && lassoPoints.length > 0) {
        context.save();
        context.beginPath();
        context.moveTo(lassoPoints[0].x, lassoPoints[0].y);
        for (let i = 1; i < lassoPoints.length; i++) {
          context.lineTo(lassoPoints[i].x, lassoPoints[i].y);
        }

        // Line to cursor
        const rect = canvas.getBoundingClientRect();
        const mouseX = (parseFloat(containerRef.current?.dataset.mouseX || '0') - rect.left - offset.x) / zoom;
        const mouseY = (parseFloat(containerRef.current?.dataset.mouseY || '0') - rect.top - offset.y) / zoom;
        context.lineTo(mouseX, mouseY);

        context.strokeStyle = ringColor;
        context.lineWidth = 1.5 / zoom;
        context.setLineDash([4 / zoom, 2 / zoom]);
        context.stroke();

        // Draw start point circle
        context.beginPath();
        context.arc(lassoPoints[0].x, lassoPoints[0].y, 5 / zoom, 0, Math.PI * 2);
        context.fillStyle = ringColor;
        context.fill();

        context.restore();
      }

      // Draw brush-like cursor
      const brushLikeTool = tool.startsWith('eraser') || tool.startsWith('brush');
      if (brushLikeTool && containerRef.current && containerRef.current.matches(':hover')) {
        const rect = canvas.getBoundingClientRect();
        // This is a bit of a hack to get mouse position without a mouse event
        const mouseX = (parseFloat(containerRef.current.dataset.mouseX || '0') - rect.left - offset.x) / zoom;
        const mouseY = (parseFloat(containerRef.current.dataset.mouseY || '0') - rect.top - offset.y) / zoom;
        const size = tool.startsWith('eraser') ? eraserSize : brushSize;

        context.save();
        context.strokeStyle = 'white';
        context.lineWidth = 1 / zoom;
        context.setLineDash([]);

        if (tool.endsWith('-square') || tool.endsWith('-rectangle')) {
          context.strokeRect(mouseX - size / 2, mouseY - size / 2, size, size);
        } else if (tool.endsWith('-polygon')) {
          // For polygon, don't draw a cursor, it's crosshair
        } else {
          context.beginPath();
          context.arc(mouseX, mouseY, size / 2, 0, Math.PI * 2);
          context.stroke();
        }

        context.strokeStyle = 'black';
        context.lineWidth = 1 / zoom;
        context.setLineDash([4 / zoom, 4 / zoom]);

        if (tool.endsWith('-square') || tool.endsWith('-rectangle')) {
          context.strokeRect(mouseX - size / 2, mouseY - size / 2, size, size);
        } else if (tool.endsWith('-polygon')) {
          // For polygon, don't draw a cursor
        } else {
          context.beginPath();
          context.arc(mouseX, mouseY, size / 2, 0, Math.PI * 2);
          context.stroke();
        }

        if (tool.startsWith('brush')) {
          context.font = `${16 / zoom}px sans-serif`;
          context.fillStyle = 'white';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.fillText('+', mouseX, mouseY + 1 / zoom);
          context.strokeStyle = 'black';
          context.lineWidth = 2 / zoom;
          context.strokeText('+', mouseX, mouseY + 1 / zoom);
        }
        context.restore();
      }


      // Draw temporary path
      if ((interactionState.current.type === 'erasing' || interactionState.current.type === 'restoring') && activePoints.current.length > 0) {
        context.save();
        context.beginPath();
        context.moveTo(activePoints.current[0].x, activePoints.current[0].y);
        for (let i = 1; i < activePoints.current.length; i++) {
          context.lineTo(activePoints.current[i].x, activePoints.current[i].y);
        }
        const size = interactionState.current.type === 'erasing' ? eraserSize : brushSize;
        context.strokeStyle = interactionState.current.type === 'erasing' ? 'rgba(255, 0, 0, 0.7)' : 'rgba(0, 255, 0, 0.7)';
        context.lineWidth = size;
        context.lineCap = tool.endsWith('-square') || tool.endsWith('-rectangle') ? 'square' : 'round';
        context.lineJoin = tool.endsWith('-square') || tool.endsWith('-rectangle') ? 'miter' : 'round';
        context.stroke();
        context.restore();
      }

      context.restore();
      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);

    // Store mouse position on the container for the eraser cursor
    const container = containerRef.current;
    const updateMousePos = (e: MouseEvent) => {
      if (container) {
        container.dataset.mouseX = e.clientX.toString();
        container.dataset.mouseY = e.clientY.toString();
      }
    }
    if (container) {
      container.addEventListener('mousemove', updateMousePos);
    }

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      if (container) {
        container.removeEventListener('mousemove', updateMousePos);
      }
    }

  }, [layers, zoom, offset, selectedLayerIds, tool, selection, canvasRef, eraserSize, brushSize, divisionTool, selectionDivisionPreview, setMessage, lassoPoints, theme, isBackgroundResizeMode, featherEditMode, isProMode]);

  const handlePhotoTaken = (dataUrl: string) => {
    if (dataUrl) {
      const img = new window.Image();
      img.onload = () => {
        const backgroundLayer = layers.find(l => l.isBackground);
        const layerNumber = layers.filter(l => !l.isBackground).length;
        const layerName = `Lay ${layerNumber}`;
        if (!backgroundLayer) {
          addPaintingCanvas({ width: img.width, height: img.height }, "Fundo");
          addLayer(dataUrl, layerName, { x: 0, y: 0 });
        } else {
          addLayer(dataUrl, layerName);
        }
      }
      img.src = dataUrl;
    }
  };

  const handleNewCanvas = (width: number, height: number) => {
    addPaintingCanvas({ width, height }, "Fundo");
    setIsNewCanvasDialogOpen(false);
    // Use a timeout to ensure the new layer is rendered before centering
    setTimeout(() => {
      centerAndZoom(width, height);
    }, 0);
  }

  const handleCanvasMouseEnter = () => {
    if (tool.startsWith('eraser') || tool.startsWith('brush') || tool === 'lasso' || tool === 'restore-lasso') {
      setActiveToolMenu(null);
    }
  }

  return (
    <div
      className="relative h-full w-full bg-muted/10"
    >
      <div
        ref={containerRef}
        className={cn(
          "absolute inset-0 touch-none",
        )}
        style={{ cursor: tool === 'rectangle' ? 'crosshair' : 'default' }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseUp}
        onMouseEnter={handleCanvasMouseEnter}
        onDoubleClick={handleDoubleClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={(e) => {
          e.preventDefault();
          handleWheel(e);
        }}
      >
        <canvas
          ref={canvasRef}
          className="h-full w-full"
        />
        {layers.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="text-center p-8 bg-card/80 backdrop-blur-sm border border-border pointer-events-auto"
            >
              <div className="flex flex-col md:flex-row gap-4">
                <Button
                  variant="ghost"
                  className="h-auto p-4 flex flex-col gap-2 text-muted-foreground"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8" />
                  <span>Carregar Imagem</span>
                  <p className="text-xs hidden md:block">(Clique ou arraste)</p>
                </Button>
                <Button
                  variant="ghost"
                  className="h-auto p-4 flex flex-col gap-2 text-muted-foreground"
                  onClick={() => setIsNewCanvasDialogOpen(true)}
                >
                  <ImageIcon className="h-8 w-8" />
                  <span>Tela de Pintura</span>
                  <p className="text-xs hidden md:block">(Comece do zero)</p>
                </Button>
                <Button
                  variant="ghost"
                  className="h-auto p-4 flex flex-col gap-2 text-muted-foreground"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="h-8 w-8" />
                  <span>Tirar Foto</span>
                  <p className="text-xs hidden md:block">(Use a câmera)</p>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      <RecordingCropArea />
      <FeatherEditActions />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/png, image/jpeg, image/webp"
      />
      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
        capture="environment"
      />
      <NewCanvasDialog isOpen={isNewCanvasDialogOpen} onOpenChange={setIsNewCanvasDialogOpen} onConfirm={handleNewCanvas} />
    </div>
  );
}
