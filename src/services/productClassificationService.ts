interface ProductData {
  name: string;
  category: string;
  brand?: string;
  description?: string;
  barcode?: string;
}

interface ClassificationResult {
  category: string;
  confidence: number;
  alternatives: Array<{
    category: string;
    confidence: number;
  }>;
  suggestions: string[];
  carbonIntensity: 'low' | 'medium' | 'high';
}

interface SemanticMatch {
  similarity: number;
  category: string;
  keywords: string[];
}

export class ProductClassificationService {
  private static instance: ProductClassificationService;
  private productDatabase: Map<string, any> = new Map();
  private categoryKeywords: Map<string, string[]> = new Map();
  private initialized = false;

  static getInstance(): ProductClassificationService {
    if (!ProductClassificationService.instance) {
      ProductClassificationService.instance = new ProductClassificationService();
    }
    return ProductClassificationService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize category keywords for semantic matching
    this.initializeCategoryKeywords();
    
    // Load product database
    await this.loadProductDatabase();
    
    this.initialized = true;
  }

  private initializeCategoryKeywords(): void {
    this.categoryKeywords.set('beef', [
      'beef', 'steak', 'hamburger', 'ground beef', 'ribeye', 'sirloin', 'chuck', 'brisket', 'patty',
      'burger', 'meatball', 'roast beef', 'prime rib', 'tenderloin', 'filet mignon'
    ]);

    this.categoryKeywords.set('chicken', [
      'chicken', 'poultry', 'wing', 'breast', 'thigh', 'drumstick', 'rotisserie',
      'nugget', 'tender', 'cutlet', 'hen', 'rooster'
    ]);

    this.categoryKeywords.set('pork', [
      'pork', 'bacon', 'ham', 'sausage', 'chorizo', 'pepperoni', 'chop', 'ribs',
      'pork loin', 'shoulder', 'belly', 'prosciutto', 'salami'
    ]);

    this.categoryKeywords.set('fish', [
      'fish', 'salmon', 'tuna', 'cod', 'tilapia', 'catfish', 'trout', 'halibut',
      'sardine', 'mackerel', 'bass', 'shrimp', 'crab', 'lobster', 'seafood'
    ]);

    this.categoryKeywords.set('dairy', [
      'milk', 'cheese', 'yogurt', 'butter', 'cream', 'ice cream', 'cottage cheese',
      'sour cream', 'whipped cream', 'heavy cream', 'half and half'
    ]);

    this.categoryKeywords.set('produce', [
      'apple', 'banana', 'orange', 'grape', 'strawberry', 'blueberry', 'tomato',
      'lettuce', 'spinach', 'carrot', 'potato', 'onion', 'garlic', 'pepper',
      'cucumber', 'broccoli', 'cauliflower', 'celery', 'mushroom'
    ]);

    this.categoryKeywords.set('grains', [
      'bread', 'pasta', 'rice', 'cereal', 'oats', 'quinoa', 'barley', 'wheat',
      'flour', 'noodles', 'crackers', 'bagel', 'tortilla'
    ]);

    this.categoryKeywords.set('beverages', [
      'water', 'soda', 'juice', 'coffee', 'tea', 'beer', 'wine', 'energy drink',
      'sports drink', 'milk', 'smoothie', 'kombucha'
    ]);

    this.categoryKeywords.set('snacks', [
      'chips', 'cookies', 'candy', 'chocolate', 'nuts', 'granola', 'bar',
      'crackers', 'popcorn', 'pretzel', 'trail mix'
    ]);

    this.categoryKeywords.set('frozen', [
      'frozen', 'ice cream', 'frozen pizza', 'frozen vegetables', 'frozen fruit',
      'tv dinner', 'frozen meal', 'popsicle', 'frozen yogurt'
    ]);
  }

  private async loadProductDatabase(): Promise<void> {
    // Real database would be loaded from external APIs
    // For now, keep minimal fallback data
    this.productDatabase.clear();
  }

  async classifyProduct(productData: ProductData): Promise<ClassificationResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const productName = productData.name.toLowerCase().trim();
    
    // Try exact match first
    const exactMatch = this.productDatabase.get(productName);
    if (exactMatch) {
      return {
        category: exactMatch.category,
        confidence: 0.95,
        alternatives: [],
        suggestions: this.generateSuggestions(exactMatch.category, exactMatch.carbonIntensity),
        carbonIntensity: exactMatch.carbonIntensity
      };
    }

    // Try semantic matching
    const semanticMatches = this.findSemanticMatches(productName);
    
    if (semanticMatches.length > 0) {
      const bestMatch = semanticMatches[0];
      const alternatives = semanticMatches.slice(1, 3).map(match => ({
        category: match.category,
        confidence: match.similarity
      }));

      return {
        category: bestMatch.category,
        confidence: bestMatch.similarity,
        alternatives,
        suggestions: this.generateSuggestions(bestMatch.category, this.getCarbonIntensity(bestMatch.category)),
        carbonIntensity: this.getCarbonIntensity(bestMatch.category)
      };
    }

    // Fallback classification
    return {
      category: 'general',
      confidence: 0.3,
      alternatives: [],
      suggestions: ['Consider adding more product details for better classification'],
      carbonIntensity: 'medium'
    };
  }

  private findSemanticMatches(productName: string): SemanticMatch[] {
    const matches: SemanticMatch[] = [];
    
    for (const [category, keywords] of this.categoryKeywords.entries()) {
      const similarity = this.calculateSimilarity(productName, keywords);
      if (similarity > 0.3) {
        matches.push({
          similarity,
          category,
          keywords: keywords.filter(keyword => productName.includes(keyword))
        });
      }
    }

    return matches.sort((a, b) => b.similarity - a.similarity);
  }

  private calculateSimilarity(productName: string, keywords: string[]): number {
    let maxSimilarity = 0;
    let totalMatches = 0;

    for (const keyword of keywords) {
      if (productName.includes(keyword.toLowerCase())) {
        totalMatches++;
        const similarity = keyword.length / productName.length;
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }
    }

    // Boost score for multiple keyword matches
    const matchBonus = Math.min(totalMatches * 0.1, 0.3);
    return Math.min(maxSimilarity + matchBonus, 1.0);
  }

  private getCarbonIntensity(category: string): 'low' | 'medium' | 'high' {
    const highCarbonCategories = ['beef', 'lamb', 'cheese'];
    const mediumCarbonCategories = ['chicken', 'pork', 'fish', 'dairy'];
    
    if (highCarbonCategories.includes(category)) return 'high';
    if (mediumCarbonCategories.includes(category)) return 'medium';
    return 'low';
  }

  private generateSuggestions(category: string, carbonIntensity: 'low' | 'medium' | 'high'): string[] {
    const suggestions: string[] = [];

    switch (carbonIntensity) {
      case 'high':
        suggestions.push('Consider plant-based alternatives to reduce carbon footprint');
        if (category === 'beef') {
          suggestions.push('Try chicken or fish for 60-80% lower emissions');
          suggestions.push('Plant-based meat alternatives can reduce emissions by 90%');
        }
        break;
      
      case 'medium':
        suggestions.push('Look for local or organic options when available');
        if (category === 'dairy') {
          suggestions.push('Plant-based milk alternatives have 50-80% lower emissions');
        }
        break;
      
      case 'low':
        suggestions.push('Great choice! This has a low carbon footprint');
        suggestions.push('Choose seasonal and local options for even lower impact');
        break;
    }

    return suggestions.slice(0, 2); // Limit to 2 suggestions
  }

  // Real product search using OpenFoodFacts API
  async searchProductByBarcode(barcode: string): Promise<ProductData | null> {
    try {
      console.log('Looking up barcode:', barcode);
      
      // Call OpenFoodFacts API for real product data
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch product data');
      }
      
      const data = await response.json();
      
      if (data.status === 1 && data.product) {
        const product = data.product;
        
        // Extract meaningful product information
        const productData: ProductData = {
          name: product.product_name || product.generic_name || 'Unknown Product',
          category: this.mapOpenFoodFactsCategory(product.categories_tags || []),
          brand: product.brands || 'Unknown',
          description: product.generic_name || product.product_name || '',
          barcode: barcode
        };
        
        console.log('Found product:', productData);
        return productData;
      } else {
        console.log('Product not found in OpenFoodFacts database');
        return null;
      }
    } catch (error) {
      console.error('Barcode lookup failed:', error);
      return null;
    }
  }

  // Map OpenFoodFacts categories to our internal categories
  private mapOpenFoodFactsCategory(categories: string[]): string {
    const categoryMap: { [key: string]: string } = {
      'en:beverages': 'beverages',
      'en:dairy': 'dairy',
      'en:meat': 'meat',
      'en:fish': 'fish',
      'en:fruits': 'produce',
      'en:vegetables': 'produce',
      'en:cereals': 'grains',
      'en:snacks': 'snacks',
      'en:frozen-foods': 'frozen',
      'en:breads': 'grains',
      'en:chocolates': 'snacks',
      'en:sweet-snacks': 'snacks'
    };

    // Find the most specific category match
    for (const category of categories) {
      if (categoryMap[category]) {
        return categoryMap[category];
      }
    }

    // Try partial matches
    for (const category of categories) {
      if (category.includes('meat')) return 'meat';
      if (category.includes('dairy')) return 'dairy';
      if (category.includes('fruit') || category.includes('vegetable')) return 'produce';
      if (category.includes('beverage') || category.includes('drink')) return 'beverages';
      if (category.includes('snack')) return 'snacks';
    }

    return 'general';
  }

  async enhanceProductData(productData: ProductData): Promise<ProductData> {
    // Try to enhance with external data sources
    if (productData.barcode) {
      const barcodeData = await this.searchProductByBarcode(productData.barcode);
      if (barcodeData) {
        return { ...productData, ...barcodeData };
      }
    }

    return productData;
  }
}

export const productClassificationService = ProductClassificationService.getInstance();