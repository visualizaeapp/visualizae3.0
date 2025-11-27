const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};

const colorDistance = (rgb1: { r: number; g: number; b: number }, rgb2: { r: number; g: number; b: number }): number => {
    const dr = rgb1.r - rgb2.r;
    const dg = rgb1.g - rgb2.g;
    const db = rgb1.b - rgb2.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
};

export const magicWandErase = (
  dataUrl: string,
  point: { x: number; y: number },
  tolerance: number,
  width: number,
  height: number
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = dataUrl;

    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        return reject(new Error('Não foi possível obter o contexto 2D do canvas.'));
      }

      ctx.drawImage(image, 0, 0, width, height);

      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      const startX = Math.floor(point.x);
      const startY = Math.floor(point.y);
      const startPos = (startY * width + startX) * 4;

      const startColor = {
        r: data[startPos],
        g: data[startPos + 1],
        b: data[startPos + 2],
      };

      const queue: [number, number][] = [[startX, startY]];
      const visited = new Set<string>();
      visited.add(`${startX},${startY}`);

      while (queue.length > 0) {
        const [x, y] = queue.shift()!;

        if (x < 0 || x >= width || y < 0 || y >= height) {
          continue;
        }

        const currentPos = (y * width + x) * 4;
        const currentColor = {
          r: data[currentPos],
          g: data[currentPos + 1],
          b: data[currentPos + 2],
        };

        const distance = colorDistance(startColor, currentColor);

        if (distance <= tolerance) {
          // Erase pixel (set alpha to 0)
          data[currentPos + 3] = 0;

          const neighbors: [number, number][] = [
            [x + 1, y],
            [x - 1, y],
            [x, y + 1],
            [x, y - 1],
          ];

          for (const [nx, ny] of neighbors) {
            if (!visited.has(`${nx},${ny}`)) {
              queue.push([nx, ny]);
              visited.add(`${nx},${ny}`);
            }
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL());
    };

    image.onerror = () => {
      reject(new Error('Falha ao carregar a imagem para a varinha mágica.'));
    };
  });
};
