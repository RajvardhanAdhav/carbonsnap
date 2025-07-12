import { createWorker } from 'tesseract.js';
import { supabase } from '@/integrations/supabase/client';

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
    category?: string;
  }>;
  subtotal?: number;
  tax?: number;
  total: number;
  totalConfidence: number;
  rawText: string;
  overallConfidence: number;
}

class AdvancedOCRService {
  private worker: any = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('Initializing Tesseract worker...');
    this.worker = await createWorker('eng', 1, {
      logger: m => console.log('Tesseract:', m.status, m.progress)
    });

    await this.worker.setParameters({
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,/$-:()[]',
      tessedit_pageseg_mode: '6', // Assume a single uniform block of text
      tessedit_ocr_engine_mode: '1', // Neural nets LSTM engine only
    });

    this.initialized = true;
    console.log('Tesseract worker initialized');
  }

  async extractTextWithAI(imageDataUrl: string): Promise<ReceiptData> {
    try {
      console.log('Attempting AI-powered OCR...');
      
      const { data, error } = await supabase.functions.invoke('ai-receipt-parser', {
        body: { imageData: imageDataUrl }
      });

      if (error) {
        console.error('AI OCR error:', error);
        throw new Error('AI parsing failed');
      }

      console.log('AI OCR successful:', data);

      return {
        storeName: data.storeName,
        storeNameConfidence: data.confidence,
        date: data.date,
        dateConfidence: data.confidence,
        items: data.items.map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          confidence: data.confidence,
          category: item.category
        })),
        subtotal: data.subtotal,
        tax: data.tax,
        total: data.total,
        totalConfidence: data.confidence,
        rawText: `AI parsed receipt from ${data.storeName}`,
        overallConfidence: data.confidence
      };
    } catch (error) {
      console.error('AI OCR failed, falling back to Tesseract:', error);
      throw error;
    }
  }

  async extractTextWithTesseract(imageDataUrl: string): Promise<OCRResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    console.log('Starting Tesseract OCR...');
    const { data } = await this.worker!.recognize(imageDataUrl);
    
    console.log('Tesseract OCR completed, confidence:', data.confidence);
    
    return {
      text: data.text,
      confidence: data.confidence / 100,
      words: data.words?.map((word: any) => ({
        text: word.text,
        confidence: word.confidence / 100,
        bbox: word.bbox
      })) || []
    };
  }

  async extractText(imageDataUrl: string): Promise<ReceiptData> {
    // Try AI-powered OCR first
    try {
      const aiResult = await this.extractTextWithAI(imageDataUrl);
      if (aiResult.overallConfidence > 0.3) {
        console.log('Using AI OCR result');
        return aiResult;
      }
    } catch (error) {
      console.log('AI OCR failed, falling back to Tesseract');
    }

    // Fallback to Tesseract
    const ocrResult = await this.extractTextWithTesseract(imageDataUrl);
    return this.parseReceiptData(ocrResult);
  }

  parseReceiptData(ocrResult: OCRResult): ReceiptData {
    console.log('Parsing receipt data from OCR result...');
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

    // Enhanced store name extraction
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      if (line.length > 3 && !this.isPrice(line) && !this.isDate(line) && !this.isItemLine(line)) {
        storeName = this.cleanStoreName(line);
        storeNameConfidence = this.getLineConfidence(ocrResult.words, line);
        break;
      }
    }

    // Enhanced date extraction with multiple patterns
    const datePatterns = [
      /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/,
      /(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/,
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}[,\s]+\d{4}/i,
      /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})/i
    ];

    for (const line of lines) {
      for (const pattern of datePatterns) {
        const dateMatch = line.match(pattern);
        if (dateMatch) {
          date = this.formatDate(dateMatch[0]);
          dateConfidence = this.getLineConfidence(ocrResult.words, line);
          break;
        }
      }
      if (date) break;
    }

    // Enhanced total extraction
    const totalPatterns = [
      /total[\s:]*\$?(\d+\.?\d*)/gi,
      /amount[\s:]*\$?(\d+\.?\d*)/gi,
      /balance[\s:]*\$?(\d+\.?\d*)/gi
    ];

    for (const line of lines) {
      for (const pattern of totalPatterns) {
        const totalMatch = line.match(pattern);
        if (totalMatch) {
          const priceMatch = line.match(/(\d+\.?\d*)/);
          if (priceMatch) {
            const amount = parseFloat(priceMatch[0]);
            if (amount > total) { // Take the largest amount as total
              total = amount;
              totalConfidence = this.getLineConfidence(ocrResult.words, line);
            }
          }
        }
      }
    }

    // Extract subtotal and tax
    for (const line of lines) {
      const subtotalMatch = line.match(/subtotal[\s:]*\$?(\d+\.?\d*)/gi);
      if (subtotalMatch) {
        const priceMatch = line.match(/(\d+\.?\d*)/);
        if (priceMatch) subtotal = parseFloat(priceMatch[0]);
      }
      
      const taxMatch = line.match(/tax[\s:]*\$?(\d+\.?\d*)/gi);
      if (taxMatch) {
        const priceMatch = line.match(/(\d+\.?\d*)/);
        if (priceMatch) tax = parseFloat(priceMatch[0]);
      }
    }

    // Enhanced item extraction
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (this.isItemLine(line) && !this.isTotalLine(line)) {
        const item = this.parseItemLine(line, ocrResult.words);
        if (item && item.price > 0) {
          items.push(item);
        }
      }
    }

    // Remove duplicates and invalid items
    const uniqueItems = this.removeDuplicateItems(items);

    // Calculate overall confidence
    const confidences = [
      storeNameConfidence, 
      dateConfidence, 
      totalConfidence, 
      ...uniqueItems.map(i => i.confidence)
    ].filter(c => c > 0);
    
    const overallConfidence = confidences.length > 0 ? 
      confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length : 0.1;

    console.log(`Parsed ${uniqueItems.length} items with ${Math.round(overallConfidence * 100)}% confidence`);

    return {
      storeName: storeName || 'Unknown Store',
      storeNameConfidence,
      date: date || new Date().toISOString().split('T')[0],
      dateConfidence,
      items: uniqueItems,
      subtotal: subtotal > 0 ? subtotal : undefined,
      tax: tax > 0 ? tax : undefined,
      total: total || uniqueItems.reduce((sum, item) => sum + item.price, 0),
      totalConfidence,
      rawText: ocrResult.text,
      overallConfidence: Math.max(0.1, overallConfidence)
    };
  }

  private cleanStoreName(name: string): string {
    return name
      .replace(/[^\w\s&'-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private removeDuplicateItems(items: ReceiptData['items']): ReceiptData['items'] {
    const seen = new Set<string>();
    return items.filter(item => {
      const key = `${item.name.toLowerCase()}-${item.price}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private isPrice(text: string): boolean {
    return /\$?\d+\.?\d*/.test(text);
  }

  private isDate(text: string): boolean {
    return /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(text);
  }

  private isItemLine(line: string): boolean {
    // More sophisticated item detection
    const hasText = /[a-zA-Z]{2,}/.test(line);
    const hasPrice = /\d+\.?\d*/.test(line);
    const hasReasonableLength = line.length > 5 && line.length < 100;
    const notHeader = !/(receipt|store|address|phone|thank)/i.test(line);
    
    return hasText && hasPrice && hasReasonableLength && notHeader;
  }

  private isTotalLine(line: string): boolean {
    const totalWords = ['total', 'subtotal', 'tax', 'amount', 'due', 'balance', 'change', 'paid', 'cash', 'card'];
    const lowerLine = line.toLowerCase();
    return totalWords.some(word => lowerLine.includes(word));
  }

  private parseItemLine(line: string, words: OCRResult['words']): ReceiptData['items'][0] | null {
    // Multiple price extraction patterns
    const pricePatterns = [
      /(\d+\.\d{2})(?=\s*$)/,  // Price at end with decimal
      /(\d+)(?=\s*$)/,         // Whole number at end
      /\$(\d+\.?\d*)/,         // Price with dollar sign
      /(\d+\.?\d*)(?=\s)/      // Price followed by space
    ];

    let price = 0;
    let priceMatch: RegExpMatchArray | null = null;
    
    for (const pattern of pricePatterns) {
      priceMatch = line.match(pattern);
      if (priceMatch) {
        price = parseFloat(priceMatch[1]);
        if (price > 0 && price < 1000) break; // Reasonable price range
      }
    }

    if (!priceMatch || price <= 0) return null;

    // Extract item name (everything before the price)
    const priceIndex = line.lastIndexOf(priceMatch[0]);
    let itemName = line.substring(0, priceIndex).trim();
    
    // Extract quantity if present
    let quantity = '1';
    const quantityPatterns = [
      /(\d+)\s*x\s*/i,
      /(\d+)\s*@\s*/i,
      /qty[\s:]*(\d+)/i
    ];

    for (const pattern of quantityPatterns) {
      const qtyMatch = itemName.match(pattern);
      if (qtyMatch) {
        quantity = qtyMatch[1];
        itemName = itemName.replace(qtyMatch[0], '').trim();
        break;
      }
    }

    // Clean up item name
    itemName = itemName
      .replace(/[^\w\s\-'&]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (itemName.length < 2) return null;

    // Capitalize properly
    itemName = itemName.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    const confidence = this.getLineConfidence(words, line);

    return {
      name: itemName,
      quantity,
      price,
      confidence: Math.max(0.1, confidence),
      category: this.categorizeItem(itemName)
    };
  }

  private categorizeItem(itemName: string): string {
    const name = itemName.toLowerCase();
    
    if (/bread|milk|egg|meat|fish|fruit|vegetable|cheese|yogurt|juice|coffee|tea|sugar|flour|rice|pasta|cereal|snack|candy|chocolate|cookie|cake|pie|pizza|sandwich|burger|chicken|beef|pork|lamb|salmon|tuna|apple|banana|orange|tomato|lettuce|carrot|potato|onion|garlic/.test(name)) {
      return 'food';
    }
    if (/soap|shampoo|toothpaste|detergent|paper|towel|tissue|cleaner|brush|sponge|bag|bottle|container|battery|bulb|tool/.test(name)) {
      return 'household';
    }
    if (/phone|cable|charger|battery|computer|electronic|device|gadget/.test(name)) {
      return 'electronics';
    }
    if (/shirt|pants|dress|shoes|sock|underwear|jacket|coat|hat|glove|belt|bag|clothing|apparel/.test(name)) {
      return 'clothing';
    }
    
    return 'other';
  }

  private getLineConfidence(words: OCRResult['words'], line: string): number {
    if (!words || words.length === 0) return 0.5;

    const lineWords = line.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    let totalConfidence = 0;
    let matchedWords = 0;

    for (const word of words) {
      const wordText = word.text.toLowerCase();
      if (lineWords.some(lw => {
        const similarity = this.calculateSimilarity(wordText, lw);
        return similarity > 0.7;
      })) {
        totalConfidence += word.confidence;
        matchedWords++;
      }
    }

    return matchedWords > 0 ? totalConfidence / matchedWords : 0.3;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private formatDate(dateStr: string): string {
    try {
      // Try different date parsing approaches
      let date: Date;
      
      // Handle month names
      if (/[a-zA-Z]/.test(dateStr)) {
        date = new Date(dateStr);
      } else {
        // Handle numeric dates
        const parts = dateStr.split(/[\/\-\.]/);
        if (parts.length === 3) {
          const [part1, part2, part3] = parts.map(p => parseInt(p));
          
          // Determine year, month, day based on values
          let year, month, day;
          
          if (part3 > 31) { // Year is last
            year = part3;
            month = part1 > 12 ? part2 : part1;
            day = part1 > 12 ? part1 : part2;
          } else if (part1 > 31) { // Year is first
            year = part1;
            month = part2;
            day = part3;
          } else { // Assume MM/DD/YY or DD/MM/YY
            year = part3 < 100 ? 2000 + part3 : part3;
            month = part1 <= 12 ? part1 : part2;
            day = part1 <= 12 ? part2 : part1;
          }
          
          date = new Date(year, month - 1, day);
        } else {
          date = new Date(dateStr);
        }
      }
      
      if (isNaN(date.getTime())) {
        return new Date().toISOString().split('T')[0];
      }
      
      return date.toISOString().split('T')[0];
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.initialized = false;
    }
  }
}

export const ocrService = new AdvancedOCRService();