interface ProductModifiers {
  organic?: boolean;
  imported?: boolean;
  frozen?: boolean;
  grassFed?: boolean;
  local?: boolean;
  bulk?: boolean;
  seasonal?: boolean;
}

interface EmissionBreakdown {
  production: number;
  packaging: number;
  transport: number;
  use: number;
  disposal: number;
}

interface CarbonResult {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  emissions_kg: number;
  breakdown: EmissionBreakdown;
  suggestions: string[];
  confidence: number;
}

interface CarbonFootprintResult {
  total_emissions_kg: number;
  items: CarbonResult[];
  equivalents: string[];
  summary: {
    highest_impact_category: string;
    reduction_potential_kg: number;
    improvement_score: number;
  };
}

// Comprehensive emission factors database (kg CO2e per unit)
const EMISSION_FACTORS = {
  // Meat & Dairy
  beef: {
    production: 27.0, packaging: 0.5, transport: 2.0, use: 0, disposal: 0.3,
    unit: 'kg', modifiers: { grassFed: 0.9, organic: 0.95, imported: 1.5 }
  },
  lamb: {
    production: 24.0, packaging: 0.4, transport: 1.8, use: 0, disposal: 0.2,
    unit: 'kg', modifiers: { organic: 0.9, imported: 1.4 }
  },
  pork: {
    production: 7.2, packaging: 0.3, transport: 1.2, use: 0, disposal: 0.2,
    unit: 'kg', modifiers: { organic: 0.85, imported: 1.3 }
  },
  chicken: {
    production: 6.9, packaging: 0.3, transport: 1.0, use: 0, disposal: 0.15,
    unit: 'kg', modifiers: { organic: 0.8, imported: 1.2 }
  },
  fish_farmed: {
    production: 5.4, packaging: 0.4, transport: 3.5, use: 0, disposal: 0.1,
    unit: 'kg', modifiers: { imported: 1.8, frozen: 1.1 }
  },
  fish_wild: {
    production: 2.9, packaging: 0.4, transport: 4.0, use: 0, disposal: 0.1,
    unit: 'kg', modifiers: { imported: 2.0, frozen: 1.15 }
  },
  cheese: {
    production: 13.5, packaging: 0.2, transport: 0.8, use: 0, disposal: 0.1,
    unit: 'kg', modifiers: { organic: 0.9, imported: 1.3 }
  },
  milk: {
    production: 3.2, packaging: 0.1, transport: 0.3, use: 0, disposal: 0.05,
    unit: 'L', modifiers: { organic: 0.85, local: 0.7 }
  },
  eggs: {
    production: 4.2, packaging: 0.3, transport: 0.5, use: 0, disposal: 0.1,
    unit: 'dozen', modifiers: { organic: 0.8, local: 0.75 }
  },

  // Plant-based alternatives
  plant_meat: {
    production: 2.5, packaging: 0.8, transport: 1.0, use: 0, disposal: 0.2,
    unit: 'kg', modifiers: { organic: 0.9, bulk: 0.85 }
  },
  tofu: {
    production: 3.0, packaging: 0.2, transport: 0.8, use: 0, disposal: 0.1,
    unit: 'kg', modifiers: { organic: 0.85, local: 0.7 }
  },
  nuts: {
    production: 2.3, packaging: 0.3, transport: 1.2, use: 0, disposal: 0.05,
    unit: 'kg', modifiers: { organic: 0.9, bulk: 0.8, imported: 1.4 }
  },

  // Grains & Carbs
  rice: {
    production: 4.0, packaging: 0.1, transport: 0.8, use: 0, disposal: 0.02,
    unit: 'kg', modifiers: { organic: 0.9, imported: 1.3, bulk: 0.85 }
  },
  wheat_bread: {
    production: 1.6, packaging: 0.3, transport: 0.4, use: 0, disposal: 0.1,
    unit: 'kg', modifiers: { organic: 0.85, local: 0.8 }
  },
  pasta: {
    production: 1.4, packaging: 0.2, transport: 0.3, use: 0, disposal: 0.05,
    unit: 'kg', modifiers: { organic: 0.9, bulk: 0.8 }
  },
  potatoes: {
    production: 0.5, packaging: 0.05, transport: 0.2, use: 0, disposal: 0.02,
    unit: 'kg', modifiers: { organic: 0.8, local: 0.6, imported: 2.0 }
  },

  // Fruits & Vegetables
  tomatoes: {
    production: 2.1, packaging: 0.1, transport: 0.8, use: 0, disposal: 0.05,
    unit: 'kg', modifiers: { organic: 0.8, local: 0.5, imported: 2.5, seasonal: 0.7 }
  },
  bananas: {
    production: 0.7, packaging: 0.05, transport: 2.5, use: 0, disposal: 0.02,
    unit: 'kg', modifiers: { organic: 0.85, imported: 1.2 }
  },
  apples: {
    production: 0.4, packaging: 0.1, transport: 0.6, use: 0, disposal: 0.02,
    unit: 'kg', modifiers: { organic: 0.8, local: 0.5, imported: 1.8, seasonal: 0.6 }
  },
  berries: {
    production: 1.5, packaging: 0.3, transport: 3.0, use: 0, disposal: 0.05,
    unit: 'kg', modifiers: { organic: 0.8, local: 0.4, imported: 2.0, seasonal: 0.5 }
  },
  leafy_greens: {
    production: 2.0, packaging: 0.2, transport: 1.5, use: 0, disposal: 0.1,
    unit: 'kg', modifiers: { organic: 0.7, local: 0.4, imported: 2.2 }
  },

  // Beverages
  coffee: {
    production: 15.0, packaging: 0.5, transport: 2.0, use: 0, disposal: 0.2,
    unit: 'kg', modifiers: { organic: 0.8, imported: 1.0 }
  },
  tea: {
    production: 6.0, packaging: 0.3, transport: 1.5, use: 0, disposal: 0.1,
    unit: 'kg', modifiers: { organic: 0.8, imported: 1.0 }
  },
  wine: {
    production: 1.8, packaging: 0.7, transport: 1.0, use: 0, disposal: 0.3,
    unit: 'L', modifiers: { organic: 0.9, imported: 1.5 }
  },
  beer: {
    production: 0.7, packaging: 0.4, transport: 0.3, use: 0, disposal: 0.2,
    unit: 'L', modifiers: { local: 0.7, imported: 1.3 }
  },

  // Electronics & Appliances
  smartphone: {
    production: 85.0, packaging: 2.0, transport: 8.0, use: 15.0, disposal: 5.0,
    unit: 'device', modifiers: { bulk: 0.95 }
  },
  laptop: {
    production: 420.0, packaging: 15.0, transport: 35.0, use: 180.0, disposal: 25.0,
    unit: 'device', modifiers: { bulk: 0.9 }
  },
  tablet: {
    production: 130.0, packaging: 5.0, transport: 12.0, use: 45.0, disposal: 8.0,
    unit: 'device', modifiers: { bulk: 0.95 }
  },

  // Clothing
  cotton_shirt: {
    production: 15.0, packaging: 0.5, transport: 2.0, use: 8.0, disposal: 1.0,
    unit: 'item', modifiers: { organic: 0.7, imported: 1.5 }
  },
  jeans: {
    production: 33.0, packaging: 1.0, transport: 3.5, use: 15.0, disposal: 2.0,
    unit: 'item', modifiers: { organic: 0.8, imported: 1.3 }
  },
  polyester_jacket: {
    production: 26.0, packaging: 1.5, transport: 4.0, use: 5.0, disposal: 8.0,
    unit: 'item', modifiers: { imported: 1.4 }
  },

  // Default fallback
  default: {
    production: 2.0, packaging: 0.3, transport: 0.8, use: 0, disposal: 0.1,
    unit: 'item', modifiers: {}
  }
};

// Product classification patterns
const PRODUCT_PATTERNS = {
  // Meat patterns
  beef: /(?:beef|steak|hamburger|ground beef|ribeye|sirloin|chuck|brisket|patty)/i,
  lamb: /(?:lamb|mutton)/i,
  pork: /(?:pork|bacon|ham|sausage|chorizo|pepperoni)/i,
  chicken: /(?:chicken|poultry|wing|breast|thigh|drumstick)/i,
  fish_farmed: /(?:salmon|tilapia|catfish|farmed)/i,
  fish_wild: /(?:tuna|cod|sardine|mackerel|wild|caught)/i,
  
  // Dairy
  cheese: /(?:cheese|cheddar|mozzarella|parmesan|brie|gouda)/i,
  milk: /(?:milk|dairy|cream|yogurt|kefir)/i,
  eggs: /(?:egg|dozen)/i,
  
  // Plant-based
  plant_meat: /(?:beyond|impossible|plant.*(?:meat|burger|sausage)|veggie.*burger|mock.*meat)/i,
  tofu: /(?:tofu|tempeh|seitan)/i,
  nuts: /(?:nuts|almond|walnut|cashew|pecan|peanut|pistachio)/i,
  
  // Grains
  rice: /(?:rice|basmati|jasmine|brown rice|wild rice)/i,
  wheat_bread: /(?:bread|loaf|baguette|wheat|sourdough)/i,
  pasta: /(?:pasta|spaghetti|macaroni|linguine|penne|noodle)/i,
  potatoes: /(?:potato|russet|yukon|sweet potato|fries)/i,
  
  // Produce
  tomatoes: /(?:tomato|tomatoes)/i,
  bananas: /(?:banana|bananas)/i,
  apples: /(?:apple|apples|gala|fuji|granny)/i,
  berries: /(?:berry|berries|strawberry|blueberry|raspberry|blackberry)/i,
  leafy_greens: /(?:lettuce|spinach|kale|arugula|greens|salad)/i,
  
  // Beverages
  coffee: /(?:coffee|espresso|latte|cappuccino|americano)/i,
  tea: /(?:tea|chai|green tea|black tea|herbal)/i,
  wine: /(?:wine|merlot|cabernet|chardonnay|pinot)/i,
  beer: /(?:beer|ale|lager|ipa|stout)/i,
  
  // Electronics
  smartphone: /(?:phone|smartphone|iphone|android|mobile)/i,
  laptop: /(?:laptop|computer|macbook|notebook)/i,
  tablet: /(?:tablet|ipad|kindle)/i,
  
  // Clothing
  cotton_shirt: /(?:shirt|t-shirt|blouse|top).*cotton|cotton.*(?:shirt|t-shirt)/i,
  jeans: /(?:jeans|denim|pants)/i,
  polyester_jacket: /(?:jacket|coat|windbreaker).*polyester|polyester.*(?:jacket|coat)/i
};

export class CarbonFootprintCalculator {
  
  static classifyProduct(rawName: string): string {
    const name = rawName.toLowerCase();
    
    for (const [category, pattern] of Object.entries(PRODUCT_PATTERNS)) {
      if (pattern.test(name)) {
        return category;
      }
    }
    
    return 'default';
  }
  
  static extractModifiers(rawName: string, merchant?: string, location?: string): ProductModifiers {
    const name = rawName.toLowerCase();
    
    return {
      organic: /organic|bio/i.test(name),
      imported: /imported|international|exotic/i.test(name) || this.isLikelyImported(rawName, location),
      frozen: /frozen|freeze/i.test(name),
      grassFed: /grass.*fed|pasture.*raised/i.test(name),
      local: /local|farm.*fresh|farmers.*market/i.test(name) || this.isLocalStore(merchant),
      bulk: /bulk|family.*size|large|xl/i.test(name),
      seasonal: this.isSeasonal(rawName, new Date())
    };
  }
  
  static isLikelyImported(product: string, location?: string): boolean {
    if (!location) return false;
    
    const tropicalFruits = /banana|mango|pineapple|coconut|avocado/i;
    const isNorthAmerica = /usa|canada|us|ca/i.test(location);
    
    return isNorthAmerica && tropicalFruits.test(product);
  }
  
  static isLocalStore(merchant?: string): boolean {
    if (!merchant) return false;
    
    const localKeywords = /farmers.*market|local|co-op|farm.*stand/i;
    return localKeywords.test(merchant);
  }
  
  static isSeasonal(product: string, date: Date): boolean {
    const month = date.getMonth() + 1; // 1-12
    const seasonalMap: Record<string, number[]> = {
      berry: [5, 6, 7, 8, 9], // May-Sept
      apple: [8, 9, 10, 11], // Aug-Nov
      tomato: [6, 7, 8, 9], // Jun-Sept
    };
    
    for (const [item, months] of Object.entries(seasonalMap)) {
      if (product.toLowerCase().includes(item) && months.includes(month)) {
        return true;
      }
    }
    
    return false;
  }
  
  static parseQuantity(rawName: string): { quantity: number; unit: string } {
    // Extract quantity and unit from product name
    const quantityPatterns = [
      /(\d+(?:\.\d+)?)\s*(lb|lbs|pound|pounds)/i,
      /(\d+(?:\.\d+)?)\s*(kg|kilogram|kilograms)/i,
      /(\d+(?:\.\d+)?)\s*(oz|ounce|ounces)/i,
      /(\d+(?:\.\d+)?)\s*(g|gram|grams)/i,
      /(\d+(?:\.\d+)?)\s*(L|liter|liters|litre|litres)/i,
      /(\d+(?:\.\d+)?)\s*(ml|milliliter|milliliters)/i,
      /(\d+)\s*pack/i,
      /(\d+)\s*ct|count/i,
    ];
    
    for (const pattern of quantityPatterns) {
      const match = rawName.match(pattern);
      if (match) {
        const quantity = parseFloat(match[1]);
        let unit = match[2].toLowerCase();
        
        // Normalize units
        if (['lb', 'lbs', 'pound', 'pounds'].includes(unit)) {
          return { quantity: quantity * 0.453592, unit: 'kg' }; // Convert to kg
        }
        if (['oz', 'ounce', 'ounces'].includes(unit)) {
          return { quantity: quantity * 0.0283495, unit: 'kg' }; // Convert to kg
        }
        if (['g', 'gram', 'grams'].includes(unit)) {
          return { quantity: quantity / 1000, unit: 'kg' }; // Convert to kg
        }
        if (['ml', 'milliliter', 'milliliters'].includes(unit)) {
          return { quantity: quantity / 1000, unit: 'L' }; // Convert to L
        }
        
        return { quantity, unit };
      }
    }
    
    return { quantity: 1, unit: 'item' };
  }
  
  static calculateEmissions(
    rawName: string,
    quantity: number = 1,
    merchant?: string,
    location?: string
  ): CarbonResult {
    const category = this.classifyProduct(rawName);
    const modifiers = this.extractModifiers(rawName, merchant, location);
    const { quantity: parsedQty, unit } = this.parseQuantity(rawName);
    const actualQuantity = quantity * parsedQty;
    
    const emissionFactor = EMISSION_FACTORS[category as keyof typeof EMISSION_FACTORS] || EMISSION_FACTORS.default;
    
    // Apply modifiers to each stage
    const modifierFactors = emissionFactor.modifiers || {};
    const getModifierFactor = () => {
      let factor = 1.0;
      for (const [modifier, value] of Object.entries(modifiers)) {
        if (value && modifierFactors[modifier as keyof typeof modifierFactors]) {
          factor *= modifierFactors[modifier as keyof typeof modifierFactors] as number;
        }
      }
      return factor;
    };
    
    const modifierFactor = getModifierFactor();
    
    const breakdown: EmissionBreakdown = {
      production: emissionFactor.production * actualQuantity * modifierFactor,
      packaging: emissionFactor.packaging * actualQuantity,
      transport: emissionFactor.transport * actualQuantity * (modifiers.imported ? 1.5 : modifiers.local ? 0.5 : 1.0),
      use: emissionFactor.use * actualQuantity,
      disposal: emissionFactor.disposal * actualQuantity
    };
    
    const totalEmissions = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
    
    const suggestions = this.generateSuggestions(category, modifiers, breakdown);
    
    // Calculate confidence based on data quality
    const confidence = this.calculateConfidence(category, rawName, modifiers);
    
    return {
      name: this.cleanProductName(rawName),
      category: this.getCategoryDisplayName(category),
      quantity: actualQuantity,
      unit,
      emissions_kg: Math.round(totalEmissions * 100) / 100,
      breakdown: {
        production: Math.round(breakdown.production * 100) / 100,
        packaging: Math.round(breakdown.packaging * 100) / 100,
        transport: Math.round(breakdown.transport * 100) / 100,
        use: Math.round(breakdown.use * 100) / 100,
        disposal: Math.round(breakdown.disposal * 100) / 100
      },
      suggestions,
      confidence
    };
  }
  
  static generateSuggestions(category: string, modifiers: ProductModifiers, breakdown: EmissionBreakdown): string[] {
    const suggestions: string[] = [];
    const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
    
    // Production-focused suggestions
    if (breakdown.production / total > 0.6) {
      if (category.includes('beef') || category.includes('lamb')) {
        suggestions.push('Consider plant-based alternatives to reduce emissions by up to 90%');
      } else if (category.includes('dairy')) {
        suggestions.push('Try plant-based milk alternatives like oat or almond milk');
      }
    }
    
    // Transport-focused suggestions
    if (breakdown.transport / total > 0.3) {
      if (modifiers.imported) {
        suggestions.push('Choose local or regional alternatives when available');
      }
      suggestions.push('Buy seasonal produce to reduce transport emissions');
    }
    
    // Packaging suggestions
    if (breakdown.packaging / total > 0.2) {
      suggestions.push('Look for bulk options or minimal packaging alternatives');
    }
    
    // Use phase suggestions
    if (breakdown.use > 0) {
      suggestions.push('Choose energy-efficient models and extend product lifespan');
    }
    
    // General suggestions
    if (!modifiers.organic && ['produce', 'dairy', 'meat'].some(cat => category.includes(cat))) {
      suggestions.push('Consider organic options for potentially lower environmental impact');
    }
    
    return suggestions.slice(0, 3); // Limit to 3 suggestions
  }
  
  static calculateConfidence(category: string, rawName: string, modifiers: ProductModifiers): number {
    let confidence = 0.6; // Base confidence
    
    // Higher confidence for well-known categories
    if (category !== 'default') confidence += 0.2;
    
    // Confidence boost for detailed product names
    if (rawName.split(' ').length > 2) confidence += 0.1;
    
    // Confidence boost for modifiers that provide more context
    if (Object.values(modifiers).some(v => v)) confidence += 0.1;
    
    return Math.min(confidence, 0.95);
  }
  
  static cleanProductName(rawName: string): string {
    return rawName
      .replace(/\d+(?:\.\d+)?\s*(?:lb|lbs|kg|oz|g|ml|L|pack|ct|count)/gi, '')
      .trim()
      .replace(/\s+/g, ' ');
  }
  
  static getCategoryDisplayName(category: string): string {
    const displayNames: Record<string, string> = {
      beef: 'Beef',
      lamb: 'Lamb',
      pork: 'Pork',
      chicken: 'Chicken',
      fish_farmed: 'Farmed Fish',
      fish_wild: 'Wild Fish',
      cheese: 'Cheese',
      milk: 'Dairy',
      eggs: 'Eggs',
      plant_meat: 'Plant-Based Meat',
      tofu: 'Plant Protein',
      nuts: 'Nuts & Seeds',
      rice: 'Rice',
      wheat_bread: 'Bread & Grains',
      pasta: 'Pasta',
      potatoes: 'Potatoes',
      tomatoes: 'Tomatoes',
      bananas: 'Bananas',
      apples: 'Apples',
      berries: 'Berries',
      leafy_greens: 'Leafy Greens',
      coffee: 'Coffee',
      tea: 'Tea',
      wine: 'Wine',
      beer: 'Beer',
      smartphone: 'Smartphone',
      laptop: 'Laptop',
      tablet: 'Tablet',
      cotton_shirt: 'Cotton Clothing',
      jeans: 'Denim',
      polyester_jacket: 'Synthetic Clothing',
      default: 'General Product'
    };
    
    return displayNames[category] || 'Product';
  }
  
  static generateEquivalents(totalEmissions: number): string[] {
    const equivalents: string[] = [];
    
    // Driving equivalents
    const milesDriven = Math.round(totalEmissions / 0.404); // Average car emissions
    if (milesDriven > 0) {
      equivalents.push(`Equivalent to driving ${milesDriven} miles in a gas-powered car`);
    }
    
    // Smartphone charging
    const phoneCharges = Math.round(totalEmissions / 0.008); // Phone charging emissions
    if (phoneCharges > 0) {
      equivalents.push(`Same as charging a smartphone ${phoneCharges} times`);
    }
    
    // Tree absorption
    const treeDays = Math.round(totalEmissions / 0.022); // Daily tree CO2 absorption
    if (treeDays > 0) {
      equivalents.push(`Would take a tree ${treeDays} days to absorb this CO2`);
    }
    
    // Energy usage
    const kwh = Math.round(totalEmissions / 0.5); // Grid electricity factor
    if (kwh > 0) {
      equivalents.push(`Equal to ${kwh} kWh of electricity from the grid`);
    }
    
    return equivalents.slice(0, 2);
  }
  
  static calculateReceiptFootprint(items: Array<{
    raw_name: string;
    quantity?: number;
    price?: number;
  }>, merchant?: string, location?: string): CarbonFootprintResult {
    
    const carbonResults = items.map(item => 
      this.calculateEmissions(item.raw_name, item.quantity || 1, merchant, location)
    );
    
    const totalEmissions = carbonResults.reduce((sum, result) => sum + result.emissions_kg, 0);
    
    // Find highest impact category
    const categoryTotals = carbonResults.reduce((acc, result) => {
      acc[result.category] = (acc[result.category] || 0) + result.emissions_kg;
      return acc;
    }, {} as Record<string, number>);
    
    const highestImpactCategory = Object.entries(categoryTotals)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Unknown';
    
    // Calculate reduction potential
    const reductionPotential = carbonResults.reduce((sum, result) => {
      if (result.category.includes('Beef') || result.category.includes('Lamb')) {
        return sum + result.emissions_kg * 0.8; // 80% reduction potential
      } else if (result.category.includes('Dairy') || result.category.includes('Pork')) {
        return sum + result.emissions_kg * 0.6; // 60% reduction potential
      }
      return sum + result.emissions_kg * 0.3; // 30% general reduction potential
    }, 0);
    
    // Calculate improvement score (0-100)
    const avgConfidence = carbonResults.reduce((sum, r) => sum + r.confidence, 0) / carbonResults.length;
    const improvementScore = Math.round(avgConfidence * 100);
    
    return {
      total_emissions_kg: Math.round(totalEmissions * 100) / 100,
      items: carbonResults,
      equivalents: this.generateEquivalents(totalEmissions),
      summary: {
        highest_impact_category: highestImpactCategory,
        reduction_potential_kg: Math.round(reductionPotential * 100) / 100,
        improvement_score: improvementScore
      }
    };
  }
}