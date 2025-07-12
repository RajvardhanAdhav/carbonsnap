export interface ProcessedImage {
  processedDataUrl: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ReceiptDetection {
  isReceiptDetected: boolean;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  suggestions?: string[];
}

/**
 * Convert image to grayscale
 */
export function convertToGrayscale(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    data[i] = gray;     // Red
    data[i + 1] = gray; // Green
    data[i + 2] = gray; // Blue
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Apply adaptive thresholding to enhance text
 */
export function applyAdaptiveThreshold(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;

  // Simple adaptive thresholding
  const threshold = 128;
  const newImageData = ctx.createImageData(width, height);
  const newData = newImageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i]; // Already grayscale
    const binary = gray > threshold ? 255 : 0;
    
    newData[i] = binary;     // Red
    newData[i + 1] = binary; // Green
    newData[i + 2] = binary; // Blue
    newData[i + 3] = 255;    // Alpha
  }

  ctx.putImageData(newImageData, 0, 0);
  return canvas;
}

/**
 * Enhance image contrast
 */
export function enhanceContrast(canvas: HTMLCanvasElement, factor = 1.5): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, (data[i] - 128) * factor + 128));     // Red
    data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * factor + 128)); // Green
    data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * factor + 128)); // Blue
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Detect if image contains a receipt using edge detection and aspect ratio analysis
 */
export function detectReceipt(canvas: HTMLCanvasElement): ReceiptDetection {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { isReceiptDetected: false, confidence: 0 };

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;

  // Simple edge detection using Sobel operator
  let edgeCount = 0;
  let totalPixels = 0;
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      
      // Get surrounding pixels for edge detection
      const tl = data[((y - 1) * width + (x - 1)) * 4];
      const tm = data[((y - 1) * width + x) * 4];
      const tr = data[((y - 1) * width + (x + 1)) * 4];
      const ml = data[(y * width + (x - 1)) * 4];
      const mr = data[(y * width + (x + 1)) * 4];
      const bl = data[((y + 1) * width + (x - 1)) * 4];
      const bm = data[((y + 1) * width + x) * 4];
      const br = data[((y + 1) * width + (x + 1)) * 4];

      // Sobel X and Y
      const sobelX = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
      const sobelY = (bl + 2 * bm + br) - (tl + 2 * tm + tr);
      const magnitude = Math.sqrt(sobelX * sobelX + sobelY * sobelY);

      if (magnitude > 50) edgeCount++;
      totalPixels++;
    }
  }

  const edgeRatio = edgeCount / totalPixels;
  const aspectRatio = height / width;
  
  // Receipts typically have high edge density (text) and are tall/narrow
  const isLikelyReceipt = edgeRatio > 0.1 && aspectRatio > 1.2;
  const confidence = Math.min(1, (edgeRatio * 5) * (aspectRatio > 1.2 ? 1 : 0.5));

  const suggestions = [];
  if (!isLikelyReceipt) {
    if (aspectRatio < 1.2) suggestions.push("Try holding the receipt vertically");
    if (edgeRatio < 0.1) suggestions.push("Ensure good lighting and focus");
    suggestions.push("Position the entire receipt within the frame");
  }

  return {
    isReceiptDetected: isLikelyReceipt,
    confidence,
    suggestions
  };
}

/**
 * Process image for optimal OCR
 */
export async function preprocessImageForOCR(imageDataUrl: string): Promise<ProcessedImage> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      // Set canvas size to image size
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Apply preprocessing steps
      enhanceContrast(canvas, 1.3);
      convertToGrayscale(canvas);
      applyAdaptiveThreshold(canvas);

      // Detect receipt quality
      const detection = detectReceipt(canvas);

      resolve({
        processedDataUrl: canvas.toDataURL('image/png'),
        confidence: detection.confidence,
        boundingBox: detection.boundingBox
      });
    };
    img.src = imageDataUrl;
  });
}

/**
 * Calculate image sharpness using Laplacian variance
 */
export function calculateSharpness(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;

  let variance = 0;
  let count = 0;

  // Apply Laplacian kernel for edge detection
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const center = data[(y * width + x) * 4];
      const top = data[((y - 1) * width + x) * 4];
      const bottom = data[((y + 1) * width + x) * 4];
      const left = data[(y * width + (x - 1)) * 4];
      const right = data[(y * width + (x + 1)) * 4];

      const laplacian = Math.abs(4 * center - top - bottom - left - right);
      variance += laplacian * laplacian;
      count++;
    }
  }

  return variance / count;
}