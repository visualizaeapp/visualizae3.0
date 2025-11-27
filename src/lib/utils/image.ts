
'use client';

import { ASPECT_RATIOS, PRO_ASPECT_RATIOS } from "@/lib/consts";
import type { AspectRatio } from "@/types";

export const getClosestRatio = (width: number, height: number, isProMode: boolean = false): AspectRatio => {
    if (height === 0 || width === 0) return ASPECT_RATIOS.find(r => r.name === 'Square')!;
    const currentRatio = width / height;
    const ratiosToUse = isProMode ? PRO_ASPECT_RATIOS : ASPECT_RATIOS;
    return ratiosToUse.reduce((prev, curr) =>
        Math.abs(curr.ratio - currentRatio) < Math.abs(prev.ratio - currentRatio) ? curr : prev
    );
};

export const resizeImage = (dataUrl: string, width: number, height: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.src = dataUrl;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = Math.floor(width);
            canvas.height = Math.floor(height);
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Could not get canvas context'));
            ctx.drawImage(img, 0, 0, Math.floor(width), Math.floor(height));
            resolve(canvas.toDataURL());
        };
        img.onerror = (err) => reject(err);
    });
};

export const resizeToClosestStandard = (dataUrl: string, isProMode: boolean = false): Promise<{ dataUrl: string, width: number, height: number }> => {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.src = dataUrl;
        img.onload = async () => {
            const originalWidth = img.naturalWidth;
            const originalHeight = img.naturalHeight;
            const aspectRatio = originalWidth / originalHeight;

            // Dynamically determine target dimensions based on closest standard ratio
            const closestRatio = getClosestRatio(originalWidth, originalHeight, isProMode);

            // Parse exact dimensions from the standard
            const [stdWidth, stdHeight] = closestRatio.dimensions.split(' / ').map(Number);

            let targetWidth = stdWidth;
            let targetHeight = stdHeight;

            // Ensure even numbers (just in case, though standards should be even)
            if (targetWidth % 2 !== 0) targetWidth++;
            if (targetHeight % 2 !== 0) targetHeight++;

            try {
                const resizedDataUrl = await resizeImage(dataUrl, targetWidth, targetHeight);
                resolve({ dataUrl: resizedDataUrl, width: targetWidth, height: targetHeight });
            } catch (error) {
                reject(error);
            }
        };
        img.onerror = reject;
    });
};
