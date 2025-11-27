

'use client';

import type { Layer, Scene, Selection } from '@/types';
import { toast } from '@/hooks/use-toast';


// Helper to load an image from a data URL
export const loadImage = (src: string): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => {
            console.error(`Failed to load image: ${src.substring(0, 100)}...`);
            resolve(null); // Resolve with null on error
        };
        img.src = src;
    });
};

export const applyEdgeFeathering = async (
  dataUrl: string,
  options: { top: number; right: number; bottom: number; left: number }
): Promise<string> => {
    const image = await loadImage(dataUrl);
    if (!image) return dataUrl;
    
    // If all feathers are 0, return original image
    if (options.top === 0 && options.right === 0 && options.bottom === 0 && options.left === 0) {
        return dataUrl;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;

    canvas.width = image.width;
    canvas.height = image.height;

    // Create a mask on a separate canvas
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = image.width;
    maskCanvas.height = image.height;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return dataUrl;

    const featherTop = image.height * (options.top / 100);
    const featherRight = image.width * (options.right / 100);
    const featherBottom = image.height * (options.bottom / 100);
    const featherLeft = image.width * (options.left / 100);

    // 1. Draw the opaque center rectangle
    maskCtx.fillStyle = 'black';
    maskCtx.fillRect(featherLeft, featherTop, image.width - featherLeft - featherRight, image.height - featherTop - featherBottom);

    // 2. Draw the linear gradients for the straight edges
    // Top
    if (featherTop > 0) {
        const topGrad = maskCtx.createLinearGradient(0, 0, 0, featherTop);
        topGrad.addColorStop(0, 'transparent');
        topGrad.addColorStop(1, 'black');
        maskCtx.fillStyle = topGrad;
        maskCtx.fillRect(featherLeft, 0, image.width - featherLeft - featherRight, featherTop);
    }

    // Bottom
    if (featherBottom > 0) {
        const bottomGrad = maskCtx.createLinearGradient(0, image.height - featherBottom, 0, image.height);
        bottomGrad.addColorStop(0, 'black');
        bottomGrad.addColorStop(1, 'transparent');
        maskCtx.fillStyle = bottomGrad;
        maskCtx.fillRect(featherLeft, image.height - featherBottom, image.width - featherLeft - featherRight, featherBottom);
    }

    // Left
    if (featherLeft > 0) {
        const leftGrad = maskCtx.createLinearGradient(0, 0, featherLeft, 0);
        leftGrad.addColorStop(0, 'transparent');
        leftGrad.addColorStop(1, 'black');
        maskCtx.fillStyle = leftGrad;
        maskCtx.fillRect(0, featherTop, featherLeft, image.height - featherTop - featherBottom);
    }

    // Right
    if (featherRight > 0) {
        const rightGrad = maskCtx.createLinearGradient(image.width - featherRight, 0, image.width, 0);
        rightGrad.addColorStop(0, 'black');
        rightGrad.addColorStop(1, 'transparent');
        maskCtx.fillStyle = rightGrad;
        maskCtx.fillRect(image.width - featherRight, featherTop, featherRight, image.height - featherTop - featherBottom);
    }
    
    // 3. Draw the radial gradients for the corners
    // Top-Left
    if (featherTop > 0 && featherLeft > 0) {
        const tlGrad = maskCtx.createRadialGradient(featherLeft, featherTop, 0, featherLeft, featherTop, Math.max(featherLeft, featherTop));
        tlGrad.addColorStop(0, 'black');
        tlGrad.addColorStop(1, 'transparent');
        maskCtx.fillStyle = tlGrad;
        maskCtx.fillRect(0, 0, featherLeft, featherTop);
    }

    // Top-Right
    if (featherTop > 0 && featherRight > 0) {
        const trGrad = maskCtx.createRadialGradient(image.width - featherRight, featherTop, 0, image.width - featherRight, featherTop, Math.max(featherRight, featherTop));
        trGrad.addColorStop(0, 'black');
        trGrad.addColorStop(1, 'transparent');
        maskCtx.fillStyle = trGrad;
        maskCtx.fillRect(image.width - featherRight, 0, featherRight, featherTop);
    }

    // Bottom-Left
    if (featherBottom > 0 && featherLeft > 0) {
        const blGrad = maskCtx.createRadialGradient(featherLeft, image.height - featherBottom, 0, featherLeft, image.height - featherBottom, Math.max(featherLeft, featherBottom));
        blGrad.addColorStop(0, 'black');
        blGrad.addColorStop(1, 'transparent');
        maskCtx.fillStyle = blGrad;
        maskCtx.fillRect(0, image.height - featherBottom, featherLeft, featherBottom);
    }

    // Bottom-Right
    if (featherBottom > 0 && featherRight > 0) {
        const brGrad = maskCtx.createRadialGradient(image.width - featherRight, image.height - featherBottom, 0, image.width - featherRight, image.height - featherBottom, Math.max(featherRight, featherBottom));
        brGrad.addColorStop(0, 'black');
        brGrad.addColorStop(1, 'transparent');
        maskCtx.fillStyle = brGrad;
        maskCtx.fillRect(image.width - featherRight, image.height - featherBottom, featherRight, featherBottom);
    }


    // Draw the original image on the main canvas
    ctx.drawImage(image, 0, 0);
    // Apply the mask
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskCanvas, 0, 0);
    
    return canvas.toDataURL();
};


const wrapText = (context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const words = text.split(' ');
    let line = '';
    const lines = [];

    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = context.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
            lines.push(line);
            line = words[n] + ' ';
        } else {
            line = testLine;
        }
    }
    lines.push(line);
    
    // Adjust y to center the whole text block
    const totalTextHeight = lines.length * lineHeight;
    let currentY = y - (totalTextHeight / 2) + (lineHeight / 2);

    for (let i = 0; i < lines.length; i++) {
        context.fillText(lines[i].trim(), x, currentY);
        currentY += lineHeight;
    }
}

export const generateScript = async (
  layers: Layer[],
  targetLayerIdForRecording: string | null,
  backgroundLayer: Layer | undefined,
  scriptFromState: Scene[] = [],
  videoSpeed: number = 1,
): Promise<Scene[]> => {
    // If there's no background or no layers at all, return empty.
    if (!backgroundLayer || !backgroundLayer.variations[0]) {
       return [];
    }

    const isProjectVideo = targetLayerIdForRecording === null;
    
    const allLayersToConsider = layers.filter(l => !l.isBackground);
    
    const layersToProcess = isProjectVideo
      ? allLayersToConsider
      : allLayersToConsider.filter((l) => l.id === targetLayerIdForRecording);

    const allLayersWithVariations = layersToProcess.filter((l) => l.variations.length > 1);

    // This is the true Layer 0
    const firstAnimatedLayer = layersToProcess[0];

    // If there are no processable layers, return empty
    if (layersToProcess.length === 0) {
       return [];
    }
    
    const getBaseDuration = (sceneType: Scene['type'], details: any = {}): number => {
        switch (sceneType) {
            case 'full_canvas_hold':
                return details.isFinal ? 2000 : 2000;
            case 'zoom_in':
                return 2000;
            case 'typing':
                const readPauseDuration = 500;
                const promptTypingDuration = details.prompt ? (details.prompt.length * 40) : 0;
                return promptTypingDuration + readPauseDuration;
            case 'result':
                return 1000;
            default:
                return 2000; // Default duration
        }
    };


    // SCENARIO: No variations at all, just create a static video of Lay 0.
    if (allLayersWithVariations.length === 0 && firstAnimatedLayer) {
        const staticVisibilityMap = new Map<string, boolean>();
        layers.forEach(l => staticVisibilityMap.set(l.id, false));
        staticVisibilityMap.set(backgroundLayer.id, true);
        staticVisibilityMap.set(firstAnimatedLayer.id, true);

        const initialVariationMap = new Map<string, number>();
        layers.forEach(l => initialVariationMap.set(l.id, 0));
        
        const parentWidth = backgroundLayer.variations[0].width;
        const parentHeight = backgroundLayer.variations[0].height;
        const initialZoom = Math.min(parentWidth / parentWidth, parentHeight / parentHeight);
        const initialOffset = {
          x: (parentWidth - parentWidth * initialZoom) / 2 - backgroundLayer.x * initialZoom,
          y: (parentHeight - parentHeight * initialZoom) / 2 - backgroundLayer.y * initialZoom,
        };

        return [{
            type: 'full_canvas_hold',
            duration: getBaseDuration('full_canvas_hold') / videoSpeed,
            visibilityMap: staticVisibilityMap,
            currentVariationMap: initialVariationMap,
            startZoom: initialZoom,
            endZoom: initialZoom,
            startOffset: initialOffset,
            endOffset: initialOffset,
        }];
    }
  
    const scenes: Scene[] = [];
  
    const bgVariation = backgroundLayer.variations[0];
    const videoWidth = bgVariation.width;
    const videoHeight = bgVariation.height;
  
    const parentWidth = videoWidth;
    const parentHeight = videoHeight;
    const initialZoom = Math.min(parentWidth / videoWidth, parentHeight / videoHeight);
    const initialOffset = {
      x: (parentWidth - videoWidth * initialZoom) / 2 - backgroundLayer.x * initialZoom,
      y: (parentHeight - videoHeight * initialZoom) / 2 - backgroundLayer.y * initialZoom,
    };
    
    const initialVariationMap = new Map<string, number>();
    layers.forEach(l => initialVariationMap.set(l.id, 0));
    
    // --- CENA 0: Visão Geral Início ---
    const initialVisibilityMap = new Map<string, boolean>();
    layers.forEach(l => initialVisibilityMap.set(l.id, false));
    if (backgroundLayer) initialVisibilityMap.set(backgroundLayer.id, true);
    if (firstAnimatedLayer) initialVisibilityMap.set(firstAnimatedLayer.id, true);

    scenes.push({
      type: 'full_canvas_hold',
      duration: getBaseDuration('full_canvas_hold') / videoSpeed,
      visibilityMap: initialVisibilityMap,
      currentVariationMap: new Map(initialVariationMap),
      startZoom: initialZoom,
      endZoom: initialZoom,
      startOffset: initialOffset,
      endOffset: initialOffset,
    });

    let currentVariationMap = new Map(initialVariationMap);
    
    let sceneIndexCounter = 1; 
    const getSceneState = (index: number) => scriptFromState[index];
        
    const cumulativeVisibilityMap = new Map(initialVisibilityMap);
    if (firstAnimatedLayer) cumulativeVisibilityMap.set(firstAnimatedLayer.id, true);

    for (const layer of allLayersWithVariations) {
      for (let i = 1; i < layer.variations.length; i++) {
        
        currentVariationMap.set(layer.id, i-1);

        const prevVariation = layer.variations[i - 1];
        const currentVariation = layer.variations[i];
        
        const previousSceneEndZoom = scenes.length > 0 ? scenes[scenes.length - 1].endZoom : initialZoom;
        const previousSceneEndOffset = scenes.length > 0 ? scenes[scenes.length - 1].endOffset : initialOffset;
        
        const selectionForAnimation: Selection = {
            x: layer.x,
            y: layer.y,
            width: prevVariation.width,
            height: prevVariation.height,
            visible: true
        };

        const zoomInStateScene = getSceneState(sceneIndexCounter);
        const animationEffect = zoomInStateScene && zoomInStateScene.type === 'zoom_in' ? zoomInStateScene.animationEffect : 'zoom';
        
        const typingStateScene = getSceneState(sceneIndexCounter + 1);


        // Calculate zoom-in parameters
        const scaleX = videoWidth / selectionForAnimation.width;
        const scaleY = videoHeight / selectionForAnimation.height;
        const zoomInLevel = Math.min(scaleX, scaleY);
        
        // Ideal offset to center the selection
        let idealZoomInOffsetX = (videoWidth - selectionForAnimation.width * zoomInLevel) / 2 - selectionForAnimation.x * zoomInLevel;
        let idealZoomInOffsetY = (videoHeight - selectionForAnimation.height * zoomInLevel) / 2 - selectionForAnimation.y * zoomInLevel;

        // Clamp the offset to keep the background in view
        const bgWidthWithZoom = videoWidth * zoomInLevel;
        const bgHeightWithZoom = videoHeight * zoomInLevel;
        
        const minOffsetX = videoWidth - bgWidthWithZoom;
        const maxOffsetX = 0;
        const minOffsetY = videoHeight - bgHeightWithZoom;
        const maxOffsetY = 0;
        
        const clampedZoomInOffsetX = Math.max(minOffsetX, Math.min(idealZoomInOffsetX, maxOffsetX));
        const clampedZoomInOffsetY = Math.max(minOffsetY, Math.min(idealZoomInOffsetY, maxOffsetY));

        const zoomInOffset = { x: clampedZoomInOffsetX, y: clampedZoomInOffsetY };
        
        const zoomInBaseDuration = getBaseDuration('zoom_in');
        const zoomInDuration = (zoomInStateScene?.duration ? (zoomInStateScene.duration) : zoomInBaseDuration) / videoSpeed;
        
        const setupVisibilityMap = new Map(cumulativeVisibilityMap);
        setupVisibilityMap.set(layer.id, true);
        if (firstAnimatedLayer) setupVisibilityMap.set(firstAnimatedLayer.id, true);

        // --- CENA ZOOM_IN ---
        const zoomInScene: Scene = {
          type: 'zoom_in',
          duration: zoomInDuration,
          visibilityMap: setupVisibilityMap,
          currentVariationMap: new Map(currentVariationMap),
          selection: selectionForAnimation,
          layer: layer,
          animationEffect: animationEffect,
          startZoom: previousSceneEndZoom,
          startOffset: previousSceneEndOffset,
          endZoom: animationEffect === 'zoom' ? zoomInLevel : previousSceneEndZoom,
          endOffset: animationEffect === 'zoom' ? zoomInOffset : previousSceneEndOffset,
        };
        scenes.push(zoomInScene);
        sceneIndexCounter++;

        // --- CENA TYPING ---
        const typingBaseDuration = getBaseDuration('typing', { prompt: currentVariation.generationData?.prompt });
        const typingSceneDuration = (typingStateScene?.duration ? (typingStateScene.duration) : typingBaseDuration) / videoSpeed;

        const typingScene: Scene = {
            type: 'typing',
            duration: typingSceneDuration,
            visibilityMap: setupVisibilityMap,
            currentVariationMap: new Map(currentVariationMap),
            prompt: currentVariation.generationData?.prompt,
            selection: selectionForAnimation,
            layer: layer,
            startZoom: zoomInScene.endZoom,
            endZoom: zoomInScene.endZoom,
            startOffset: zoomInScene.endOffset,
            endOffset: zoomInScene.endOffset,
        }
        scenes.push(typingScene);
        sceneIndexCounter++;

        // --- CENA RESULT ---
        currentVariationMap.set(layer.id, i);
        cumulativeVisibilityMap.set(layer.id, true); // Add to cumulative map after setup
        
        const resultVisibilityMap = new Map(cumulativeVisibilityMap);
        if (firstAnimatedLayer) resultVisibilityMap.set(firstAnimatedLayer.id, true);
        
        const resultBaseDuration = getBaseDuration('result');
        const resultDuration = (getSceneState(sceneIndexCounter)?.duration ? (getSceneState(sceneIndexCounter)!.duration) : resultBaseDuration) / videoSpeed;

        const resultScene: Scene = {
          type: 'result',
          duration: resultDuration,
          visibilityMap: resultVisibilityMap,
          currentVariationMap: new Map(currentVariationMap),
          previousVariationIndex: i - 1,
          layerForFade: layer,
          layer: layer,
          startZoom: typingScene.endZoom,
          endZoom: typingScene.endZoom,
          startOffset: typingScene.endOffset,
          endOffset: typingScene.endOffset,
        };
        scenes.push(resultScene);
        sceneIndexCounter++;

        // --- CENA HOLD / ZOOM_OUT ---
        const holdBaseDuration = getBaseDuration('full_canvas_hold');
        const holdSceneDuration = (zoomInScene.animationEffect === 'selection_rectangle' ? 0 : (getSceneState(sceneIndexCounter)?.duration ? (getSceneState(sceneIndexCounter)!.duration) : holdBaseDuration)) / videoSpeed;
        
        const holdVisibilityMap = new Map(cumulativeVisibilityMap);
        if (firstAnimatedLayer) holdVisibilityMap.set(firstAnimatedLayer.id, true);

        const holdScene: Scene = {
            type: 'full_canvas_hold',
            duration: holdSceneDuration,
            visibilityMap: holdVisibilityMap,
            currentVariationMap: new Map(currentVariationMap),
            startZoom: resultScene.endZoom,
            endZoom: initialZoom,
            startOffset: resultScene.endOffset,
            endOffset: initialOffset,
        };
        scenes.push(holdScene);
        sceneIndexCounter++;
      }
    }
    
    if (allLayersWithVariations.length > 0) {
        const finalStateScene = getSceneState(sceneIndexCounter);
        const finalHoldBaseDuration = getBaseDuration('full_canvas_hold', { isFinal: true });
        const finalHoldDuration = (finalStateScene?.duration ? (finalStateScene.duration) : finalHoldBaseDuration) / videoSpeed;
        const finalZoomStart = initialZoom;
        const finalZoomEnd = finalZoomStart * 1.1; // Gentle zoom in
        const finalOffsetStart = {
          x: (videoWidth - videoWidth * finalZoomStart) / 2 - backgroundLayer.x * finalZoomStart,
          y: (videoHeight - videoHeight * finalZoomStart) / 2 - backgroundLayer.y * finalZoomStart,
        };
        const finalOffsetEnd = {
          x: (videoWidth - videoWidth * finalZoomEnd) / 2 - backgroundLayer.x * finalZoomEnd,
          y: (videoHeight - videoHeight * finalZoomEnd) / 2 - backgroundLayer.y * finalZoomEnd,
        };

        const finalVisibilityMap = new Map(cumulativeVisibilityMap);
        if (firstAnimatedLayer) finalVisibilityMap.set(firstAnimatedLayer.id, true);

        const lastSceneBeforeFinal = scenes[scenes.length - 1];

        scenes.push({
            type: 'full_canvas_hold',
            duration: finalHoldDuration,
            visibilityMap: finalVisibilityMap,
            currentVariationMap: new Map(currentVariationMap),
            startZoom: finalZoomStart,
            endZoom: finalZoomEnd,
            startOffset: finalOffsetStart,
            endOffset: finalOffsetEnd,
        });
    }
    
    return scenes;
  };


export const animateScene = (
    ctx: CanvasRenderingContext2D,
    scene: Scene,
    sceneElapsedTime: number,
    allLayersWithImages: ({ layer: Layer, images: (HTMLImageElement | null)[] })[],
    audioElement: HTMLAudioElement | null,
    options: { promptFontSize: number, rectangleThickness: number }
) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const sceneProgress = Math.min(sceneElapsedTime / scene.duration, 1);
    const easedProgress = easeInOutCubic(sceneProgress);

    let cameraZoom = 1;
    let cameraOffset = { x: 0, y: 0 };
    
    const hasZoomAnimation = scene.startZoom !== undefined && scene.endZoom !== undefined && scene.startZoom !== scene.endZoom;
    
    if (scene.startZoom !== undefined && scene.endZoom !== undefined && scene.startOffset && scene.endOffset) {
        if (hasZoomAnimation) {
            cameraZoom = scene.startZoom + (scene.endZoom - scene.startZoom) * easedProgress;
            cameraOffset = {
                x: scene.startOffset.x + (scene.endOffset.x - scene.startOffset.x) * easedProgress,
                y: scene.startOffset.y + (scene.endOffset.y - scene.startOffset.y) * easedProgress,
            };
        } else {
            cameraZoom = scene.startZoom;
            cameraOffset = scene.startOffset;
        }
    }

    ctx.save();
    ctx.translate(cameraOffset.x, cameraOffset.y);
    ctx.scale(cameraZoom, cameraZoom);

    // Draw all layers based on the scene's currentVariationMap
    allLayersWithImages.forEach(item => {
        const { layer, images } = item;
        const variationIndex = scene.currentVariationMap.get(layer.id);
        const isVisible = scene.visibilityMap.get(layer.id);

        if (variationIndex === undefined || !isVisible) return;

        const image = images[variationIndex];
        const activeVariation = layer.variations[variationIndex];

        if (layer.visible && image && activeVariation) {
            ctx.save();
            
            if (scene.type === 'result' && scene.layerForFade?.id === layer.id && scene.previousVariationIndex !== undefined) {
                const previousImageForFade = images[scene.previousVariationIndex];
                if (previousImageForFade) {
                    const prevVariation = layer.variations[scene.previousVariationIndex];
                    
                    ctx.globalAlpha = 1.0;
                    ctx.filter = `brightness(${prevVariation.brightness / 100}) contrast(${prevVariation.contrast / 100}) saturate(${prevVariation.saturate / 100})`;
                    const prevTransform = prevVariation.transform;
                    const prevScaleX = prevTransform.scaleX / 100;
                    const prevScaleY = prevTransform.scaleY / 100;
                    const prevFinalWidth = prevVariation.width * prevScaleX;
                    const prevFinalHeight = prevVariation.height * prevScaleY;
                    const prevFinalX = layer.x + prevTransform.offsetX - (prevFinalWidth - prevVariation.width) / 2;
                    const prevFinalY = layer.y + prevTransform.offsetY - (prevFinalHeight - prevVariation.height) / 2;
                    ctx.drawImage(previousImageForFade, prevFinalX, prevFinalY, prevFinalWidth, prevFinalHeight);
    
                    const fadeInDuration = 500;
                    const fadeProgress = Math.min(sceneElapsedTime / fadeInDuration, 1);
                    ctx.globalAlpha = easeInOutCubic(fadeProgress) * (activeVariation.opacity / 100);
                }
            } else {
                ctx.globalAlpha = activeVariation.opacity / 100;
            }
            
            ctx.filter = `brightness(${activeVariation.brightness / 100}) contrast(${activeVariation.contrast / 100}) saturate(${activeVariation.saturate / 100})`;
            
            const transform = activeVariation.transform;
            const layerScaleX = transform.scaleX / 100;
            const layerScaleY = transform.scaleY / 100;
            const finalWidth = activeVariation.width * layerScaleX;
            const finalHeight = activeVariation.height * layerScaleY;
            const finalX = layer.x + transform.offsetX - (finalWidth - activeVariation.width) / 2;
            const finalY = layer.y + transform.offsetY - (finalHeight - activeVariation.height) / 2;

            ctx.drawImage(image, finalX, finalY, finalWidth, finalHeight);
            ctx.restore();
        }
    });

    // Draw animations on top
    if (scene.type === 'zoom_in' && scene.animationEffect === 'selection_rectangle' && scene.selection) {
        const selectionDrawStartTime = 0; // Starts immediately
        const selectionDrawDuration = scene.duration; // Lasts for the whole scene duration
        if (sceneElapsedTime > selectionDrawStartTime) {
            const selectionProgress = easeInOutCubic(Math.min((sceneElapsedTime - selectionDrawStartTime) / selectionDrawDuration, 1));
            const primaryColor = 'hsl(243, 77%, 59%)';
            
            ctx.fillStyle = `hsla(243, 77%, 59%, 0.1)`;
            ctx.strokeStyle = primaryColor;
            ctx.lineWidth = (options.rectangleThickness * 2) / cameraZoom;
            ctx.setLineDash([10 / cameraZoom, 5 / cameraZoom]);
            
            const { x, y, width, height } = scene.selection;
            const animatedWidth = width * selectionProgress;
            const animatedHeight = height * selectionProgress;
            
            ctx.fillRect(x, y, animatedWidth, animatedHeight);
            ctx.strokeRect(x, y, animatedWidth, animatedHeight);
            ctx.setLineDash([]);
        }
    } else if (scene.type === 'typing') {
        const now = sceneElapsedTime;
        
        const promptTypeStartTime = 0; // Starts immediately in this scene
        const promptTypingDuration = scene.prompt ? (scene.prompt.length * 40) : 0;
        
        if (now > promptTypeStartTime && scene.prompt && promptTypingDuration > 0) {
            const promptProgress = Math.min((now - promptTypeStartTime) / promptTypingDuration, 1);
            const textLength = Math.floor(scene.prompt.length * promptProgress);
            const prevTextLength = Math.floor(scene.prompt.length * (Math.max(0, now - 16.67 - promptTypeStartTime) / promptTypingDuration));
            const text = scene.prompt.substring(0, textLength);
            
            if (audioElement && textLength > prevTextLength && text[textLength - 1] !== ' ') {
                audioElement.currentTime = 0;
                audioElement.play().catch(e => {
                    // This error is expected on the first play attempts before user interaction.
                });
            }

            ctx.restore();
            ctx.save();
            
            const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
            
            ctx.font = `bold ${options.promptFontSize}px 'Space Grotesk', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const boxHeight = ctx.canvas.height * 0.20;
            const textY = ctx.canvas.height / 2;
            
            const gradient = ctx.createLinearGradient(0, textY - boxHeight / 2, 0, textY + boxHeight / 2);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
            gradient.addColorStop(0.2, 'rgba(0, 0, 0, 0.7)');
            gradient.addColorStop(0.8, 'rgba(0, 0, 0, 0.7)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

            ctx.fillStyle = gradient;
            ctx.fillRect(0, textY - boxHeight, ctx.canvas.width, boxHeight * 2);
            
            ctx.fillStyle = 'white';
            
            // Text wrapping logic
            const maxWidth = ctx.canvas.width * 0.8;
            const lineHeight = options.promptFontSize * 1.2;
            wrapText(ctx, text, ctx.canvas.width / 2, textY, maxWidth, lineHeight);
            
            ctx.restore(); 
            ctx.save();
            ctx.translate(cameraOffset.x, cameraOffset.y);
            ctx.scale(cameraZoom, cameraZoom);
        }
    }


    ctx.restore();
};



    

    




    

    






