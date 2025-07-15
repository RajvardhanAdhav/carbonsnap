import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReceiptItem {
  name: string;
  quantity: string;
  carbon: number;
  category: 'low' | 'medium' | 'high';
  price?: number;
  breakdown?: {
    production: number;
    packaging: number;
    transport: number;
    use: number;
    disposal: number;
  };
  suggestions?: string[];
  confidence?: number;
}

interface ProcessedReceipt {
  store: string;
  date: string;
  items: ReceiptItem[];
  totalCarbon: number;
  total?: number;
  location?: string;
  equivalents?: string[];
  summary?: {
    highest_impact_category: string;
    reduction_potential_kg: number;
    improvement_score: number;
  };
}

// Comprehensive lifecycle carbon footprint calculation
const EMISSION_FACTORS = {
  beef: { production: 27.0, packaging: 0.5, transport: 2.0, use: 0, disposal: 0.3, modifiers: { grassFed: 0.9, organic: 0.95 }},
  lamb: { production: 24.0, packaging: 0.4, transport: 1.8, use: 0, disposal: 0.2, modifiers: { organic: 0.9 }},
  pork: { production: 7.2, packaging: 0.3, transport: 1.2, use: 0, disposal: 0.2, modifiers: { organic: 0.85 }},
  chicken: { production: 6.9, packaging: 0.3, transport: 1.0, use: 0, disposal: 0.15, modifiers: { organic: 0.8 }},
  fish_wild: { production: 2.9, packaging: 0.4, transport: 4.0, use: 0, disposal: 0.1, modifiers: { imported: 1.8 }},
  fish_farmed: { production: 5.4, packaging: 0.4, transport: 3.5, use: 0, disposal: 0.1, modifiers: { imported: 1.6 }},
  milk: { production: 3.2, packaging: 0.1, transport: 0.3, use: 0, disposal: 0.05, modifiers: { organic: 0.85, local: 0.7 }},
  cheese: { production: 13.5, packaging: 0.2, transport: 0.8, use: 0, disposal: 0.1, modifiers: { organic: 0.9 }},
  eggs: { production: 4.2, packaging: 0.3, transport: 0.5, use: 0, disposal: 0.1, modifiers: { organic: 0.8, local: 0.75 }},
  plant_meat: { production: 2.5, packaging: 0.8, transport: 1.0, use: 0, disposal: 0.2, modifiers: { organic: 0.9 }},
  nuts: { production: 2.3, packaging: 0.3, transport: 1.2, use: 0, disposal: 0.05, modifiers: { organic: 0.9, bulk: 0.8 }},
  bananas: { production: 0.7, packaging: 0.05, transport: 2.5, use: 0, disposal: 0.02, modifiers: { organic: 0.85 }},
  apples: { production: 0.4, packaging: 0.1, transport: 0.6, use: 0, disposal: 0.02, modifiers: { organic: 0.8, local: 0.5 }},
  leafy_greens: { production: 2.0, packaging: 0.2, transport: 1.5, use: 0, disposal: 0.1, modifiers: { organic: 0.7, local: 0.4 }},
  wheat_bread: { production: 1.6, packaging: 0.3, transport: 0.4, use: 0, disposal: 0.1, modifiers: { organic: 0.85 }},
  rice: { production: 4.0, packaging: 0.1, transport: 0.8, use: 0, disposal: 0.02, modifiers: { organic: 0.9, bulk: 0.85 }},
  quinoa: { production: 1.8, packaging: 0.2, transport: 1.0, use: 0, disposal: 0.05, modifiers: { organic: 0.85 }},
  default: { production: 2.0, packaging: 0.3, transport: 0.8, use: 0, disposal: 0.1, modifiers: {}}
};

function classifyProduct(rawName: string): string {
  const name = rawName.toLowerCase();
  const patterns = {
    beef: /(?:beef|steak|hamburger|ground beef|grass.*fed.*beef)/i,
    lamb: /(?:lamb|mutton)/i,
    pork: /(?:pork|bacon|ham|sausage)/i,
    chicken: /(?:chicken|poultry|breast|thigh|free.*range)/i,
    fish_wild: /(?:wild.*salmon|cod|sardine|mackerel)/i,
    fish_farmed: /(?:salmon|tilapia|catfish|farmed)/i,
    milk: /(?:milk|dairy)/i,
    cheese: /(?:cheese|cheddar|mozzarella)/i,
    eggs: /(?:egg|dozen)/i,
    plant_meat: /(?:beyond|impossible|plant.*burger|almond.*milk)/i,
    nuts: /(?:nuts|almond|walnut|cashew)/i,
    bananas: /(?:banana|bananas)/i,
    apples: /(?:apple|apples)/i,
    leafy_greens: /(?:spinach|lettuce|greens|kale)/i,
    wheat_bread: /(?:bread|wheat|sourdough)/i,
    rice: /(?:rice|basmati|jasmine)/i,
    quinoa: /(?:quinoa)/i
  };
  
  for (const [category, pattern] of Object.entries(patterns)) {
    if (pattern.test(name)) return category;
  }
  return 'default';
}

function extractModifiers(rawName: string, merchant?: string) {
  const name = rawName.toLowerCase();
  return {
    organic: /organic|bio/i.test(name),
    grassFed: /grass.*fed|pasture.*raised/i.test(name),
    local: /local|farm.*fresh/i.test(name) || /farmers.*market|co-op/i.test(merchant || ''),
    imported: /imported|exotic/i.test(name),
    freeRange: /free.*range/i.test(name),
    wild: /wild/i.test(name)
  };
}

function parseQuantity(rawName: string) {
  const lbMatch = rawName.match(/(\d+(?:\.\d+)?)\s*lbs?/i);
  if (lbMatch) return { quantity: parseFloat(lbMatch[1]) * 0.453592, unit: 'kg' };
  
  const kgMatch = rawName.match(/(\d+(?:\.\d+)?)\s*kg/i);
  if (kgMatch) return { quantity: parseFloat(kgMatch[1]), unit: 'kg' };
  
  const gallonMatch = rawName.match(/(\d+)\s*gallon/i);
  if (gallonMatch) return { quantity: parseFloat(gallonMatch[1]) * 3.78541, unit: 'L' };
  
  return { quantity: 1, unit: 'item' };
}

function calculateItemEmissions(rawName: string, quantity: number, merchant?: string) {
  const category = classifyProduct(rawName);
  const modifiers = extractModifiers(rawName, merchant);
  const { quantity: parsedQty, unit } = parseQuantity(rawName);
  const actualQuantity = quantity * parsedQty;
  
  const emissionFactor = EMISSION_FACTORS[category as keyof typeof EMISSION_FACTORS] || EMISSION_FACTORS.default;
  
  // Apply modifiers
  let modifierFactor = 1.0;
  for (const [key, value] of Object.entries(modifiers)) {
    if (value && emissionFactor.modifiers[key as keyof typeof emissionFactor.modifiers]) {
      modifierFactor *= emissionFactor.modifiers[key as keyof typeof emissionFactor.modifiers] as number;
    }
  }
  
  const breakdown = {
    production: emissionFactor.production * actualQuantity * modifierFactor,
    packaging: emissionFactor.packaging * actualQuantity,
    transport: emissionFactor.transport * actualQuantity * (modifiers.imported ? 1.5 : modifiers.local ? 0.5 : 1.0),
    use: emissionFactor.use * actualQuantity,
    disposal: emissionFactor.disposal * actualQuantity
  };
  
  const totalEmissions = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
  
  // Generate suggestions
  const suggestions: string[] = [];
  if (category === 'beef' || category === 'lamb') {
    suggestions.push('Consider plant-based alternatives to reduce emissions by up to 90%');
  }
  if (breakdown.transport > breakdown.production * 0.3) {
    suggestions.push('Choose local alternatives when available');
  }
  if (breakdown.packaging > breakdown.production * 0.2) {
    suggestions.push('Look for minimal packaging options');
  }
  
  // Calculate confidence
  let confidence = category !== 'default' ? 0.8 : 0.6;
  if (rawName.split(' ').length > 2) confidence += 0.1;
  if (Object.values(modifiers).some(v => v)) confidence += 0.1;
  
  return {
    name: rawName.replace(/\d+(?:\.\d+)?\s*(?:lb|lbs|kg|gallon)/gi, '').trim(),
    category: getCategoryDisplayName(category),
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
    suggestions: suggestions.slice(0, 2),
    confidence: Math.min(confidence, 0.95)
  };
}

function getCategoryDisplayName(category: string): string {
  const names: Record<string, string> = {
    beef: 'Beef', lamb: 'Lamb', pork: 'Pork', chicken: 'Chicken',
    fish_wild: 'Wild Fish', fish_farmed: 'Farmed Fish', milk: 'Dairy', cheese: 'Cheese',
    eggs: 'Eggs', plant_meat: 'Plant-Based', nuts: 'Nuts & Seeds',
    bananas: 'Bananas', apples: 'Apples', leafy_greens: 'Leafy Greens',
    wheat_bread: 'Bread & Grains', rice: 'Rice', quinoa: 'Quinoa',
    default: 'General Product'
  };
  return names[category] || 'Product';
}

function generateEquivalents(totalEmissions: number): string[] {
  const milesDriven = Math.round(totalEmissions / 0.404);
  const phoneCharges = Math.round(totalEmissions / 0.008);
  return [
    `Equivalent to driving ${milesDriven} miles in a gas-powered car`,
    `Same as charging a smartphone ${phoneCharges} times`
  ];
}

// Enhanced receipt processing with multiple 3rd party APIs
async function processReceiptImage(imageData: string): Promise<ProcessedReceipt> {
  const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
  
  console.log('Processing receipt image with multiple 3rd party APIs...');
  
  try {
    // Method 1: Try Perplexity AI for receipt analysis (if available)
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (perplexityApiKey) {
      console.log('Attempting receipt analysis with Perplexity AI...');
      
      try {
        const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${perplexityApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.1-sonar-large-128k-online',
            messages: [
              {
                role: 'system',
                content: 'You are an expert receipt parser. Analyze receipt images and extract store information, items, prices, and dates. Return structured JSON data.'
              },
              {
                role: 'user',
                content: `Analyze this receipt image and extract all purchase information. Search for similar receipt parsing methods and return JSON with: store, date (YYYY-MM-DD), items array with name/price/quantity, subtotal, tax, total.`
              }
            ],
            temperature: 0.1,
            max_tokens: 2000,
            return_images: false,
            return_related_questions: false,
            search_recency_filter: 'month'
          }),
        });

        if (perplexityResponse.ok) {
          const perplexityData = await perplexityResponse.json();
          const content = perplexityData.choices[0]?.message?.content;
          
          if (content) {
            console.log('Perplexity analysis result:', content);
            
            // Try to extract structured data from Perplexity response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const receiptData = JSON.parse(jsonMatch[0]);
                if (receiptData.items && Array.isArray(receiptData.items) && receiptData.items.length > 0) {
                  console.log('Successfully extracted receipt data from Perplexity');
                  return await processReceiptData(receiptData);
                }
              } catch (parseError) {
                console.log('Failed to parse Perplexity JSON, continuing to next method...');
              }
            }
          }
        }
      } catch (perplexityError) {
        console.log('Perplexity analysis failed, trying next method...');
      }
    }

    // Method 2: Use OpenAI GPT-4o with enhanced prompting
    console.log('Attempting advanced OpenAI analysis...');
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    console.log('OpenAI API Key status:', {
      exists: !!openaiApiKey,
      length: openaiApiKey?.length || 0,
      prefix: openaiApiKey ? openaiApiKey.substring(0, 12) + '...' : 'none'
    });
    
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not found in environment variables');
    }
    
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert receipt OCR system used by major companies for extracting purchase data. 

TASK: Extract ALL items, prices, quantities, store info, and totals from this receipt image.

INSTRUCTIONS:
1. Find store name (usually at top)
2. Locate purchase date (various formats: MM/DD/YYYY, DD/MM/YYYY, etc.)
3. Extract EVERY item with its price and quantity
4. Find subtotal, tax, and final total
5. Be thorough - don't miss any items
6. For unclear text, make educated guesses

RETURN FORMAT (strict JSON):
{
  "store": "Store Name",
  "date": "YYYY-MM-DD",
  "items": [
    {"name": "Product Name", "price": 0.00, "quantity": 1}
  ],
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00,
  "confidence": 0.95
}

IMPORTANT: Extract EVERY visible item. Companies need complete transaction data.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all purchase information from this receipt. Be thorough and capture every item:'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageData,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0.1
      }),
    });

    if (!openaiResponse.ok) {
      console.error(`OpenAI API error: ${openaiResponse.status} - ${await openaiResponse.text()}`);
      throw new Error(`OpenAI API failed with status ${openaiResponse.status}`);
    }

    const aiResponse = await openaiResponse.json();
    console.log('OpenAI response received');
    
    if (!aiResponse.choices || !aiResponse.choices[0]?.message?.content) {
      throw new Error('Invalid OpenAI response structure');
    }

    const content = aiResponse.choices[0].message.content;
    console.log('AI extracted content length:', content.length);
    
    // Parse the JSON response with multiple fallback strategies
    let receiptData;
    try {
      receiptData = JSON.parse(content);
    } catch (parseError) {
      console.log('Direct JSON parse failed, trying markdown extraction...');
      
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          receiptData = JSON.parse(jsonMatch[1]);
        } catch (markdownError) {
          console.error('Markdown JSON parse failed:', markdownError);
          
          // Try to find any JSON-like structure
          const possibleJson = content.match(/\{[\s\S]*\}/);
          if (possibleJson) {
            try {
              receiptData = JSON.parse(possibleJson[0]);
            } catch (structureError) {
              throw new Error('No valid JSON structure found in AI response');
            }
          } else {
            throw new Error('No JSON structure found in AI response');
          }
        }
      } else {
        throw new Error('No JSON structure found in AI response');
      }
    }

    console.log('Successfully parsed receipt data:', JSON.stringify(receiptData, null, 2));
    return await processReceiptData(receiptData);

  } catch (error) {
    console.error('All receipt processing methods failed:', error);
    
    // Final fallback: Return empty but informative response
    return {
      store: "Receipt Processing Failed - Please try a clearer image or manual input",
      date: new Date().toISOString().split('T')[0],
      items: [],
      totalCarbon: 0,
      total: 0,
      location: "Unknown",
      equivalents: [],
      summary: {
        highest_impact_category: "None",
        reduction_potential_kg: 0,
        improvement_score: 0
      }
    };
  }
}

// Helper function to process receipt data and calculate emissions
async function processReceiptData(receiptData: any): Promise<ProcessedReceipt> {
  // Validate and sanitize the parsed data
  if (!receiptData || typeof receiptData !== 'object') {
    throw new Error('Invalid receipt data structure');
  }

  // Ensure required fields exist with defaults
  receiptData.store = receiptData.store || "Unknown Store";
  receiptData.date = receiptData.date || new Date().toISOString().split('T')[0];
  receiptData.items = Array.isArray(receiptData.items) ? receiptData.items : [];
  receiptData.total = typeof receiptData.total === 'number' ? receiptData.total : 0;
  receiptData.confidence = typeof receiptData.confidence === 'number' ? receiptData.confidence : 0.8;

  // For each item, try to get enhanced product data using web search
  const processedItems: ReceiptItem[] = [];
  
  for (const item of receiptData.items) {
    const itemName = item.name || "Unknown Item";
    const itemPrice = typeof item.price === 'number' ? item.price : 0;
    const itemQuantity = typeof item.quantity === 'number' ? item.quantity : 1;
    
    // Try to enhance product data with 3rd party lookup
    let enhancedProductData = null;
    
    try {
      const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
      if (perplexityApiKey) {
        console.log(`Enhancing product data for: ${itemName}`);
        
        const productResponse = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${perplexityApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.1-sonar-small-128k-online',
            messages: [
              {
                role: 'system',
                content: 'You provide product information for carbon footprint calculation. Be precise and factual.'
              },
              {
                role: 'user',
                content: `What is the carbon footprint category and production details for "${itemName}"? Return: category (food/dairy/meat/produce/packaged), origin (local/imported), packaging type, main ingredients. Be brief.`
              }
            ],
            temperature: 0.2,
            max_tokens: 300,
            return_images: false,
            search_recency_filter: 'month'
          }),
        });

        if (productResponse.ok) {
          const productData = await productResponse.json();
          const productInfo = productData.choices[0]?.message?.content;
          
          if (productInfo) {
            enhancedProductData = {
              category: extractFromText(productInfo, ['food', 'dairy', 'meat', 'produce', 'packaged']),
              origin: extractFromText(productInfo, ['local', 'imported', 'regional']),
              packaging: extractFromText(productInfo, ['plastic', 'glass', 'cardboard', 'aluminum'])
            };
          }
        }
      }
    } catch (enhanceError) {
      console.log(`Failed to enhance data for ${itemName}:`, enhanceError);
    }
    
    // Calculate emissions using enhanced data
    const result = calculateItemEmissions(itemName, itemQuantity, enhancedProductData);
    
    processedItems.push({
      name: itemName,
      quantity: itemQuantity.toString(),
      carbon: result.emissions_kg,
      category: result.emissions_kg > 8 ? 'high' : result.emissions_kg > 3 ? 'medium' : 'low',
      price: itemPrice,
      breakdown: result.breakdown,
      suggestions: result.suggestions,
      confidence: result.confidence * receiptData.confidence
    });
  }

  const totalCarbon = processedItems.reduce((sum, item) => sum + item.carbon, 0);
  const totalPrice = receiptData.total || processedItems.reduce((sum, item) => sum + (item.price || 0), 0);

  // Calculate advanced summary metrics
  const categoryTotals: Record<string, number> = {};
  processedItems.forEach(item => {
    const carbonCategory = item.carbon > 8 ? 'High Impact' : 
                          item.carbon > 3 ? 'Medium Impact' : 'Low Impact';
    categoryTotals[carbonCategory] = (categoryTotals[carbonCategory] || 0) + item.carbon;
  });

  const highestImpactCategory = Object.entries(categoryTotals)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || 'None';

  const reductionPotential = processedItems.reduce((sum, item) => {
    if (item.name.toLowerCase().includes('beef') || item.name.toLowerCase().includes('lamb')) {
      return sum + item.carbon * 0.85;
    } else if (item.name.toLowerCase().includes('dairy') || item.name.toLowerCase().includes('cheese')) {
      return sum + item.carbon * 0.6;
    } else if (item.name.toLowerCase().includes('chicken') || item.name.toLowerCase().includes('fish')) {
      return sum + item.carbon * 0.4;
    }
    return sum + item.carbon * 0.2;
  }, 0);

  const avgConfidence = processedItems.length > 0 ? 
    processedItems.reduce((sum, item) => sum + (item.confidence || 0.7), 0) / processedItems.length : 0.7;

  console.log(`Successfully processed ${processedItems.length} items with ${Math.round(avgConfidence * 100)}% confidence`);

  return {
    store: receiptData.store,
    date: receiptData.date,
    items: processedItems,
    totalCarbon: Math.round(totalCarbon * 100) / 100,
    total: Math.round(totalPrice * 100) / 100,
    location: "Receipt Location",
    equivalents: generateEquivalents(totalCarbon),
    summary: {
      highest_impact_category: highestImpactCategory,
      reduction_potential_kg: Math.round(reductionPotential * 100) / 100,
      improvement_score: Math.round(avgConfidence * 100)
    }
  };
}

// Helper function to extract information from text
function extractFromText(text: string, keywords: string[]): string {
  const lowerText = text.toLowerCase();
  for (const keyword of keywords) {
    if (lowerText.includes(keyword)) {
      return keyword;
    }
  }
  return 'unknown';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { imageData, scanMethod = 'camera', manualData } = await req.json();
    
    // Get user from auth header
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
    
    if (authError || !user) {
      throw new Error('Authentication required');
    }

    console.log('Processing receipt for user:', user.id);

    let processedReceipt: ProcessedReceipt;

    // Handle manual input case
    if (scanMethod === 'manual' && manualData) {
      console.log('Processing manual receipt data:', manualData);
      
      // Process manual data directly
      const items: ReceiptItem[] = manualData.items?.map((item: any) => {
        const result = calculateItemEmissions(item.name || item.productName, item.quantity || 1);
        return {
          name: item.name || item.productName,
          quantity: (item.quantity || 1).toString(),
          carbon: result.emissions_kg,
          category: result.emissions_kg > 8 ? 'high' : result.emissions_kg > 3 ? 'medium' : 'low',
          price: item.price || 0,
          breakdown: result.breakdown,
          suggestions: result.suggestions,
          confidence: result.confidence
        };
      }) || [];

      const totalCarbon = items.reduce((sum, item) => sum + item.carbon, 0);
      const totalPrice = manualData.total || items.reduce((sum, item) => sum + (item.price || 0), 0);

      processedReceipt = {
        store: manualData.store || "Manual Entry",
        date: manualData.date || new Date().toISOString().split('T')[0],
        items,
        totalCarbon: Math.round(totalCarbon * 100) / 100,
        total: Math.round(totalPrice * 100) / 100,
        location: "Manual Input",
        equivalents: generateEquivalents(totalCarbon),
        summary: {
          highest_impact_category: items.length > 0 ? "Manual Items" : "None",
          reduction_potential_kg: Math.round(totalCarbon * 0.3 * 100) / 100,
          improvement_score: 85
        }
      };
    } else if (imageData && imageData !== 'manual-input') {
      // Process image data
      processedReceipt = await processReceiptImage(imageData);
    } else {
      throw new Error('No valid input provided');
    }

    // Store the main receipt record
    const { data: scannedItem, error: insertError } = await supabase
      .from('scanned_items')
      .insert({
        user_id: user.id,
        item_type: 'receipt',
        store_name: processedReceipt.store,
        receipt_date: processedReceipt.date,
        receipt_total: processedReceipt.total,
        carbon_footprint: processedReceipt.totalCarbon,
        carbon_category: processedReceipt.totalCarbon > 20 ? 'high' : processedReceipt.totalCarbon > 10 ? 'medium' : 'low',
        scan_method: scanMethod,
        details: { 
          itemCount: processedReceipt.items.length,
          source: scanMethod === 'manual' ? 'Manual Input' : 'AI OCR'
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting scanned item:', insertError);
      throw insertError;
    }

    // Store individual receipt items
    const receiptItems = processedReceipt.items.map(item => ({
      scanned_item_id: scannedItem.id,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.price,
      carbon_footprint: item.carbon,
      carbon_category: item.category,
      category: 'food' // Default category
    }));

    const { error: itemsError } = await supabase
      .from('receipt_items')
      .insert(receiptItems);

    if (itemsError) {
      console.error('Error inserting receipt items:', itemsError);
      throw itemsError;
    }

    console.log('Receipt processed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: scannedItem.id,
          ...processedReceipt
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error processing receipt:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});