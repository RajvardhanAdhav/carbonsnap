interface GoogleVisionResult {
  text: string;
  confidence: number;
  boundingBoxes: Array<{
    vertices: Array<{ x: number; y: number }>;
    text: string;
  }>;
}

interface EnhancedReceiptData {
  storeName: string;
  date: string;
  items: Array<{
    name: string;
    quantity: string;
    price: number;
    category?: string;
  }>;
  total: number;
  confidence: number;
  metadata: {
    ocrMethod: 'google-vision' | 'tesseract' | 'fallback';
    processingTime: number;
    imageQuality: number;
  };
}

export class AdvancedOcrService {
  private static instance: AdvancedOcrService;
  private tesseractWorker: any = null;
  private initialized = false;

  static getInstance(): AdvancedOcrService {
    if (!AdvancedOcrService.instance) {
      AdvancedOcrService.instance = new AdvancedOcrService();
    }
    return AdvancedOcrService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Import Tesseract dynamically
      const { createWorker } = await import('tesseract.js');
      this.tesseractWorker = await createWorker('eng', 1, {
        logger: m => console.log(m)
      });

      await this.tesseractWorker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz $.,()-/:',
        tessedit_pageseg_mode: '6', // Single block
      });

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Tesseract:', error);
    }
  }

  async extractReceiptData(imageDataUrl: string): Promise<EnhancedReceiptData> {
    const startTime = Date.now();
    
    try {
      // Try Google Vision API first
      const googleResult = await this.tryGoogleVision(imageDataUrl);
      if (googleResult) {
        return {
          ...googleResult,
          metadata: {
            ocrMethod: 'google-vision',
            processingTime: Date.now() - startTime,
            imageQuality: this.assessImageQuality(imageDataUrl)
          }
        };
      }
    } catch (error) {
      console.warn('Google Vision failed, falling back to Tesseract:', error);
    }

    // Fallback to Tesseract
    try {
      const tesseractResult = await this.tryTesseract(imageDataUrl);
      return {
        ...tesseractResult,
        metadata: {
          ocrMethod: 'tesseract',
          processingTime: Date.now() - startTime,
          imageQuality: this.assessImageQuality(imageDataUrl)
        }
      };
    } catch (error) {
      console.error('Both OCR methods failed:', error);
      
      // Return fallback result
      return {
        storeName: 'Unknown Store',
        date: new Date().toLocaleDateString(),
        items: [],
        total: 0,
        confidence: 0.1,
        metadata: {
          ocrMethod: 'fallback',
          processingTime: Date.now() - startTime,
          imageQuality: 0.3
        }
      };
    }
  }

  private async tryGoogleVision(imageDataUrl: string): Promise<EnhancedReceiptData | null> {
    // Check if we have Google Vision API key in environment
    // In a real implementation, this would call the Google Vision API
    // For now, return null to fallback to Tesseract
    return null;
  }

  private async tryTesseract(imageDataUrl: string): Promise<EnhancedReceiptData> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.tesseractWorker) {
      throw new Error('Tesseract worker not initialized');
    }

    const { data } = await this.tesseractWorker.recognize(imageDataUrl);
    return this.parseReceiptText(data.text);
  }

  private parseReceiptText(text: string): EnhancedReceiptData {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    // Extract store name (usually first few lines)
    const storeName = this.extractStoreName(lines);
    
    // Extract date
    const date = this.extractDate(lines);
    
    // Extract items
    const items = this.extractItems(lines);
    
    // Extract total
    const total = this.extractTotal(lines);
    
    // Calculate confidence based on parsing success
    const confidence = this.calculateParsingConfidence(storeName, date, items, total);

    return {
      storeName,
      date,
      items,
      total,
      confidence,
      metadata: {
        ocrMethod: 'tesseract',
        processingTime: 0,
        imageQuality: 0.5
      }
    };
  }

  private extractStoreName(lines: string[]): string {
    // Look for store name in first 5 lines
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      if (line.length > 3 && line.length < 50 && /[A-Za-z]/.test(line)) {
        // Filter out obviously non-store patterns
        if (!/^\d+$/.test(line) && !line.includes('RECEIPT') && !line.includes('INVOICE')) {
          return line;
        }
      }
    }
    return 'Unknown Store';
  }

  private extractDate(lines: string[]): string {
    const datePatterns = [
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
      /(\d{1,2}-\d{1,2}-\d{2,4})/,
      /(\d{4}-\d{1,2}-\d{1,2})/,
      /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i
    ];

    for (const line of lines) {
      for (const pattern of datePatterns) {
        const match = line.match(pattern);
        if (match) {
          return match[1] || match[0];
        }
      }
    }
    return new Date().toLocaleDateString();
  }

  private extractItems(lines: string[]): Array<{name: string; quantity: string; price: number}> {
    const items: Array<{name: string; quantity: string; price: number}> = [];
    
    for (const line of lines) {
      const itemMatch = this.parseItemLine(line);
      if (itemMatch) {
        items.push(itemMatch);
      }
    }
    
    return items;
  }

  private parseItemLine(line: string): {name: string; quantity: string; price: number} | null {
    // Pattern to match: "ITEM NAME   $12.34" or "ITEM NAME 2x  $12.34"
    const patterns = [
      /^(.+?)\s+\$?(\d+\.?\d*)\s*$/,
      /^(.+?)\s+(\d+(?:\.\d+)?)\s*x?\s+\$?(\d+\.?\d*)\s*$/,
      /^(.+?)\s+(\d+)\s+@\s+\$?(\d+\.?\d*)\s*$/
    ];

    for (const pattern of patterns) {
      const match = line.trim().match(pattern);
      if (match) {
        const price = parseFloat(match[match.length - 1]);
        if (price > 0 && price < 1000) { // Reasonable price range
          const name = match[1].trim();
          const quantity = match.length > 3 ? match[2] : '1';
          
          // Filter out obviously non-item lines
          if (name.length > 2 && !name.includes('TOTAL') && !name.includes('TAX') && !name.includes('SUBTOTAL')) {
            return { name, quantity, price };
          }
        }
      }
    }
    
    return null;
  }

  private extractTotal(lines: string[]): number {
    const totalPatterns = [
      /TOTAL\s*:?\s*\$?(\d+\.?\d*)/i,
      /GRAND\s*TOTAL\s*:?\s*\$?(\d+\.?\d*)/i,
      /AMOUNT\s*DUE\s*:?\s*\$?(\d+\.?\d*)/i
    ];

    // Check lines from bottom up
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 10); i--) {
      const line = lines[i];
      for (const pattern of totalPatterns) {
        const match = line.match(pattern);
        if (match) {
          const total = parseFloat(match[1]);
          if (total > 0) return total;
        }
      }
    }
    
    return 0;
  }

  private calculateParsingConfidence(storeName: string, date: string, items: any[], total: number): number {
    let confidence = 0.3; // Base confidence
    
    if (storeName !== 'Unknown Store') confidence += 0.2;
    if (date !== new Date().toLocaleDateString()) confidence += 0.1;
    if (items.length > 0) confidence += 0.2;
    if (total > 0) confidence += 0.2;
    
    return Math.min(confidence, 0.95);
  }

  private assessImageQuality(imageDataUrl: string): number {
    // Simple image quality assessment based on file size
    const base64Length = imageDataUrl.split(',')[1]?.length || 0;
    const imageSizeKB = (base64Length * 3) / 4 / 1024;
    
    if (imageSizeKB > 500) return 0.9;
    if (imageSizeKB > 200) return 0.7;
    if (imageSizeKB > 100) return 0.5;
    return 0.3;
  }

  async terminate(): Promise<void> {
    if (this.tesseractWorker) {
      await this.tesseractWorker.terminate();
      this.tesseractWorker = null;
    }
    this.initialized = false;
  }
}

export const advancedOcrService = AdvancedOcrService.getInstance();