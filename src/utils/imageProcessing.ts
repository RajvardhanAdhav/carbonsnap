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
 * Advanced Gaussian blur for noise reduction
 */
export function gaussianBlur(canvas: HTMLCanvasElement, radius = 1): HTMLCanvasElement {
  console.log('Starting Gaussian blur processing, canvas size:', canvas.width, 'x', canvas.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas context not available');

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;

  // Create Gaussian kernel
  const kernel = createGaussianKernel(radius);
  const kernelSize = kernel.length;
  const half = Math.floor(kernelSize / 2);

  const newImageData = ctx.createImageData(width, height);
  const newData = newImageData.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      let weightSum = 0;

      for (let ky = 0; ky < kernelSize; ky++) {
        for (let kx = 0; kx < kernelSize; kx++) {
          const py = y + ky - half;
          const px = x + kx - half;

          if (py >= 0 && py < height && px >= 0 && px < width) {
            const weight = kernel[ky][kx];
            const idx = (py * width + px) * 4;

            r += data[idx] * weight;
            g += data[idx + 1] * weight;
            b += data[idx + 2] * weight;
            a += data[idx + 3] * weight;
            weightSum += weight;
          }
        }
      }

      const idx = (y * width + x) * 4;
      newData[idx] = r / weightSum;
      newData[idx + 1] = g / weightSum;
      newData[idx + 2] = b / weightSum;
      newData[idx + 3] = a / weightSum;
    }
  }

  ctx.putImageData(newImageData, 0, 0);
  return canvas;
}

function createGaussianKernel(radius: number): number[][] {
  const size = 2 * radius + 1;
  const kernel: number[][] = [];
  const sigma = radius / 3;
  let sum = 0;

  for (let y = 0; y < size; y++) {
    kernel[y] = [];
    for (let x = 0; x < size; x++) {
      const dx = x - radius;
      const dy = y - radius;
      const value = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
      kernel[y][x] = value;
      sum += value;
    }
  }

  // Normalize
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      kernel[y][x] /= sum;
    }
  }

  return kernel;
}

/**
 * Convert image to grayscale with better color preservation
 */
export function convertToGrayscale(canvas: HTMLCanvasElement): HTMLCanvasElement {
  console.log('Converting to grayscale, canvas size:', canvas.width, 'x', canvas.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas context not available');

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    // Tone down the grayscale by blending with original colors
    const blendFactor = 0.7; // Reduce intensity
    data[i] = gray * blendFactor + data[i] * (1 - blendFactor);     // Red
    data[i + 1] = gray * blendFactor + data[i + 1] * (1 - blendFactor); // Green
    data[i + 2] = gray * blendFactor + data[i + 2] * (1 - blendFactor); // Blue
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Advanced adaptive thresholding with local area analysis
 */
export function applyAdaptiveThreshold(canvas: HTMLCanvasElement): HTMLCanvasElement {
  console.log('Applying adaptive threshold, canvas size:', canvas.width, 'x', canvas.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas context not available');

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;

  const newImageData = ctx.createImageData(width, height);
  const newData = newImageData.data;

  // Calculate local mean for each pixel
  const windowSize = 15;
  const half = Math.floor(windowSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;

      // Calculate local mean
      for (let wy = Math.max(0, y - half); wy < Math.min(height, y + half + 1); wy++) {
        for (let wx = Math.max(0, x - half); wx < Math.min(width, x + half + 1); wx++) {
          const idx = (wy * width + wx) * 4;
          sum += data[idx]; // Use red channel (grayscale)
          count++;
        }
      }

      const localMean = sum / count;
      const currentPixel = data[(y * width + x) * 4];
      const threshold = localMean - 10; // Slight bias towards text

      const binary = currentPixel > threshold ? 255 : 0;
      
      const idx = (y * width + x) * 4;
      newData[idx] = binary;     // Red
      newData[idx + 1] = binary; // Green
      newData[idx + 2] = binary; // Blue
      newData[idx + 3] = 255;    // Alpha
    }
  }

  ctx.putImageData(newImageData, 0, 0);
  return canvas;
}

/**
 * Enhanced contrast adjustment with histogram equalization
 */
export function enhanceContrast(canvas: HTMLCanvasElement, factor = 1.5): HTMLCanvasElement {
  console.log('Enhancing contrast, canvas size:', canvas.width, 'x', canvas.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas context not available');

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Calculate histogram
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    histogram[gray]++;
  }

  // Calculate cumulative distribution
  const cdf = new Array(256);
  cdf[0] = histogram[0];
  for (let i = 1; i < 256; i++) {
    cdf[i] = cdf[i - 1] + histogram[i];
  }

  // Normalize CDF
  const totalPixels = (data.length / 4);
  for (let i = 0; i < 256; i++) {
    cdf[i] = Math.round((cdf[i] / totalPixels) * 255);
  }

  // Apply histogram equalization with contrast factor
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    const equalized = cdf[gray];
    const enhanced = Math.min(255, Math.max(0, (equalized - 128) * factor + 128));
    
    data[i] = enhanced;     // Red
    data[i + 1] = enhanced; // Green
    data[i + 2] = enhanced; // Blue
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Advanced receipt detection using multiple algorithms
 */
export function detectReceipt(canvas: HTMLCanvasElement): ReceiptDetection {
  console.log('Detecting receipt, canvas size:', canvas.width, 'x', canvas.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { isReceiptDetected: false, confidence: 0 };

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;

  // 1. Edge density analysis (Sobel operator)
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

      if (magnitude > 30) edgeCount++; // Lower threshold for better detection
      totalPixels++;
    }
  }

  const edgeRatio = edgeCount / totalPixels;
  
  // 2. Aspect ratio analysis
  const aspectRatio = height / width;
  
  // 3. Text line detection (horizontal lines of consistent intensity)
  const textLines = detectTextLines(data, width, height);
  const textLineRatio = textLines / height * 100; // Lines per 100 pixels

  // 4. Brightness uniformity (receipts usually have consistent background)
  const brightnessVariance = calculateBrightnessVariance(data);
  
  // 5. Color analysis (receipts are usually monochromatic)
  const colorVariance = calculateColorVariance(data);

  // Weighted scoring system
  const edgeScore = Math.min(1, edgeRatio * 8); // Edge density
  const aspectScore = aspectRatio > 1.1 ? Math.min(1, aspectRatio / 3) : 0.3; // Tall rectangles
  const textScore = Math.min(1, textLineRatio / 10); // Text line density
  const brightnessScore = 1 - Math.min(1, brightnessVariance / 5000); // Uniform background
  const colorScore = 1 - Math.min(1, colorVariance / 3000); // Monochromatic

  // Combined confidence with weights
  const confidence = (
    edgeScore * 0.3 +
    aspectScore * 0.2 +
    textScore * 0.25 +
    brightnessScore * 0.15 +
    colorScore * 0.1
  );

  const isLikelyReceipt = confidence > 0.4;

  const suggestions = [];
  if (!isLikelyReceipt) {
    if (aspectRatio < 1.1) suggestions.push("Hold the receipt vertically for better detection");
    if (edgeScore < 0.3) suggestions.push("Ensure good lighting and focus on the receipt");
    if (textScore < 0.3) suggestions.push("Make sure text is clearly visible");
    if (brightnessScore < 0.5) suggestions.push("Avoid shadows and ensure even lighting");
    suggestions.push("Position the entire receipt within the frame");
  }

  return {
    isReceiptDetected: isLikelyReceipt,
    confidence,
    suggestions
  };
}

function detectTextLines(data: Uint8ClampedArray, width: number, height: number): number {
  let textLines = 0;
  const minLineLength = width * 0.3; // At least 30% of width

  for (let y = 0; y < height; y += 3) { // Sample every 3rd line for performance
    let lineIntensity = 0;
    let consistentPixels = 0;

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const intensity = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
      
      if (intensity < 180) { // Dark pixels (text)
        consistentPixels++;
      }
    }

    if (consistentPixels > minLineLength * 0.1 && consistentPixels < minLineLength * 0.8) {
      textLines++;
    }
  }

  return textLines;
}

function calculateBrightnessVariance(data: Uint8ClampedArray): number {
  let sum = 0;
  let sumSquares = 0;
  const pixelCount = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const brightness = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    sum += brightness;
    sumSquares += brightness * brightness;
  }

  const mean = sum / pixelCount;
  const variance = (sumSquares / pixelCount) - (mean * mean);
  return variance;
}

function calculateColorVariance(data: Uint8ClampedArray): number {
  let rVariance = 0, gVariance = 0, bVariance = 0;
  let rSum = 0, gSum = 0, bSum = 0;
  const pixelCount = data.length / 4;

  // Calculate means
  for (let i = 0; i < data.length; i += 4) {
    rSum += data[i];
    gSum += data[i + 1];
    bSum += data[i + 2];
  }

  const rMean = rSum / pixelCount;
  const gMean = gSum / pixelCount;
  const bMean = bSum / pixelCount;

  // Calculate variances
  for (let i = 0; i < data.length; i += 4) {
    rVariance += Math.pow(data[i] - rMean, 2);
    gVariance += Math.pow(data[i + 1] - gMean, 2);
    bVariance += Math.pow(data[i + 2] - bMean, 2);
  }

  return (rVariance + gVariance + bVariance) / (pixelCount * 3);
}

/**
 * Perspective correction using corner detection
 */
export function correctPerspective(canvas: HTMLCanvasElement): HTMLCanvasElement {
  // Simplified perspective correction - in a real implementation, 
  // you'd use more sophisticated corner detection algorithms
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  // For now, just return the canvas as-is
  // Real perspective correction would require detecting receipt corners
  // and applying homography transformation
  return canvas;
}

/**
 * Process image for optimal OCR with all advanced techniques
 */
export async function preprocessImageForOCR(imageDataUrl: string): Promise<ProcessedImage> {
  console.log('Starting image preprocessing for OCR');
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        console.log('Image loaded, original size:', img.width, 'x', img.height);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('Canvas context not available');

      // Set canvas size to image size
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Apply advanced preprocessing pipeline
      console.log('Starting preprocessing pipeline...');
      gaussianBlur(canvas, 0.5); // Light denoising
      console.log('Gaussian blur completed');
      enhanceContrast(canvas, 1.4); // Enhance contrast
      console.log('Contrast enhancement completed');
      convertToGrayscale(canvas); // Convert to grayscale
      console.log('Grayscale conversion completed');
      applyAdaptiveThreshold(canvas); // Adaptive thresholding
      console.log('Adaptive threshold completed');
      
      // Detect receipt quality
      const detection = detectReceipt(canvas);
      console.log('Receipt detection completed, confidence:', detection.confidence);
      console.log('Detection suggestions:', detection.suggestions);

      resolve({
        processedDataUrl: canvas.toDataURL('image/png'),
        confidence: detection.confidence,
        boundingBox: detection.boundingBox
      });
      } catch (error) {
        console.error('Error in image preprocessing:', error);
        reject(error);
      }
    };
    img.onerror = (error) => {
      console.error('Error loading image:', error);
      reject(new Error('Failed to load image'));
    };
    img.src = imageDataUrl;
  });
}

/**
 * Calculate image sharpness using enhanced Laplacian variance
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

  // Enhanced Laplacian kernel for better edge detection
  const kernel = [
    [0, -1, 0],
    [-1, 4, -1],
    [0, -1, 0]
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      
      for (let ky = 0; ky < 3; ky++) {
        for (let kx = 0; kx < 3; kx++) {
          const pixelY = y + ky - 1;
          const pixelX = x + kx - 1;
          const pixelIndex = (pixelY * width + pixelX) * 4;
          const gray = data[pixelIndex] * 0.299 + data[pixelIndex + 1] * 0.587 + data[pixelIndex + 2] * 0.114;
          sum += gray * kernel[ky][kx];
        }
      }

      variance += sum * sum;
      count++;
    }
  }

  return variance / count;
}