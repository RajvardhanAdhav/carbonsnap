import { createWorker } from 'tesseract.js';

export interface OCRResult {
  text: string;
  confidence: number;
  words: Array<{
    text: string;
    confidence: number;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }>;
}

export interface ReceiptData {
  storeName: string;
  storeNameConfidence: number;
  date: string;
  dateConfidence: number;
  items: Array<{
    name: string;
    quantity: string;
    price: number;
    confidence: number;
  }>;
  subtotal?: number;
  tax?: number;
  total: number;
  totalConfidence: number;
  rawText: string;
  overallConfidence: number;
}

class OCRService {
  private worker: any = null;

  async initialize(): Promise<void> {
    if (this.worker) return;

    this.worker = await createWorker('eng', 1, {
      logger: m => console.log(m)
    });

    await this.worker.setParameters({
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,/$-:',
    });
  }

  async extractText(imageDataUrl: string): Promise<OCRResult> {
    if (!this.worker) {
      await this.initialize();
    }

    const { data } = await this.worker!.recognize(imageDataUrl);
    
    return {
      text: data.text,
      confidence: data.confidence / 100,
      words: [] // Simplified for now
    };
  }

  parseReceiptData(ocrResult: OCRResult): ReceiptData {
    const lines = ocrResult.text.split('\n').filter(line => line.trim().length > 0);
    const items: ReceiptData['items'] = [];
    
    let storeName = '';
    let storeNameConfidence = 0;
    let date = '';
    let dateConfidence = 0;
    let total = 0;
    let totalConfidence = 0;
    let subtotal = 0;
    let tax = 0;

    // Extract store name (usually first few lines)
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      const line = lines[i].trim();
      if (line.length > 3 && !this.isPrice(line) && !this.isDate(line)) {
        storeName = line;
        storeNameConfidence = this.getLineConfidence(ocrResult.words, line);
        break;
      }
    }

    // Extract date
    const dateRegex = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/;
    for (const line of lines) {
      const dateMatch = line.match(dateRegex);
      if (dateMatch) {
        date = this.formatDate(dateMatch[0]);
        dateConfidence = this.getLineConfidence(ocrResult.words, line);
        break;
      }
    }

    // Extract total
    const totalRegex = /total[\s:]*\$?(\d+\.?\d*)/gi;
    for (const line of lines) {
      const totalMatch = line.match(totalRegex);
      if (totalMatch) {
        const priceMatch = line.match(/(\d+\.?\d*)/);
        if (priceMatch) {
          total = parseFloat(priceMatch[0]);
          totalConfidence = this.getLineConfidence(ocrResult.words, line);
          break;
        }
      }
    }

    // Extract subtotal and tax
    const subtotalRegex = /subtotal[\s:]*\$?(\d+\.?\d*)/gi;
    const taxRegex = /tax[\s:]*\$?(\d+\.?\d*)/gi;
    
    for (const line of lines) {
      const subtotalMatch = line.match(subtotalRegex);
      if (subtotalMatch) {
        const priceMatch = line.match(/(\d+\.?\d*)/);
        if (priceMatch) subtotal = parseFloat(priceMatch[0]);
      }
      
      const taxMatch = line.match(taxRegex);
      if (taxMatch) {
        const priceMatch = line.match(/(\d+\.?\d*)/);
        if (priceMatch) tax = parseFloat(priceMatch[0]);
      }
    }

    // Extract items (lines with prices but not totals/subtotals/tax)
    for (const line of lines) {
      if (this.isItemLine(line) && !this.isTotalLine(line)) {
        const item = this.parseItemLine(line, ocrResult.words);
        if (item) items.push(item);
      }
    }

    // Calculate overall confidence
    const confidences = [storeNameConfidence, dateConfidence, totalConfidence, ...items.map(i => i.confidence)];
    const overallConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;

    return {
      storeName: storeName || 'Unknown Store',
      storeNameConfidence,
      date: date || new Date().toISOString().split('T')[0],
      dateConfidence,
      items,
      subtotal: subtotal > 0 ? subtotal : undefined,
      tax: tax > 0 ? tax : undefined,
      total: total || items.reduce((sum, item) => sum + item.price, 0),
      totalConfidence,
      rawText: ocrResult.text,
      overallConfidence: Math.max(0.1, overallConfidence) // Minimum confidence
    };
  }

  private isPrice(text: string): boolean {
    return /\$?\d+\.?\d*/.test(text);
  }

  private isDate(text: string): boolean {
    return /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(text);
  }

  private isItemLine(line: string): boolean {
    // Look for lines that have both text and a price
    return /[a-zA-Z]/.test(line) && /\d+\.?\d*/.test(line) && line.length > 5;
  }

  private isTotalLine(line: string): boolean {
    const totalWords = ['total', 'subtotal', 'tax', 'amount', 'due', 'balance'];
    const lowerLine = line.toLowerCase();
    return totalWords.some(word => lowerLine.includes(word));
  }

  private parseItemLine(line: string, words: OCRResult['words']): ReceiptData['items'][0] | null {
    // Extract price (usually at the end)
    const priceMatch = line.match(/(\d+\.?\d*)(?=\s*$)/);
    if (!priceMatch) return null;

    const price = parseFloat(priceMatch[0]);
    const priceIndex = line.lastIndexOf(priceMatch[0]);
    
    // Extract item name (everything before the price)
    let itemName = line.substring(0, priceIndex).trim();
    
    // Extract quantity if present
    let quantity = '1';
    const quantityMatch = itemName.match(/(\d+)\s*x\s*/i);
    if (quantityMatch) {
      quantity = quantityMatch[1];
      itemName = itemName.replace(quantityMatch[0], '').trim();
    }

    // Clean up item name
    itemName = itemName.replace(/[^\w\s]/g, ' ').trim();
    if (itemName.length < 2) return null;

    const confidence = this.getLineConfidence(words, line);

    return {
      name: itemName,
      quantity,
      price,
      confidence
    };
  }

  private getLineConfidence(words: OCRResult['words'], line: string): number {
    const lineWords = line.toLowerCase().split(/\s+/);
    let totalConfidence = 0;
    let matchedWords = 0;

    for (const word of words) {
      if (lineWords.some(lw => word.text.toLowerCase().includes(lw) || lw.includes(word.text.toLowerCase()))) {
        totalConfidence += word.confidence;
        matchedWords++;
      }
    }

    return matchedWords > 0 ? totalConfidence / matchedWords : 0.5;
  }

  private formatDate(dateStr: string): string {
    // Try to parse and format the date consistently
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
      const [part1, part2, part3] = parts;
      
      // Assume MM/DD/YYYY or DD/MM/YYYY format
      if (part3.length === 4) {
        return `${part3}-${part1.padStart(2, '0')}-${part2.padStart(2, '0')}`;
      } else if (part1.length === 4) {
        return `${part1}-${part2.padStart(2, '0')}-${part3.padStart(2, '0')}`;
      }
    }
    
    return dateStr;
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

export const ocrService = new OCRService();