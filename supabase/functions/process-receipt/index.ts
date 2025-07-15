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

// Enhanced receipt processing with comprehensive LCA
async function processReceiptImage(imageData: string): Promise<ProcessedReceipt> {
  const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
  
  console.log('Processing receipt image with advanced AI OCR...');
  
  try {
    // First attempt: Use latest GPT model with detailed prompting
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: `You are an expert receipt parser used by major companies like Fetch for extracting purchase data. Your task is to accurately extract ALL items, prices, and store information from receipt images.

INSTRUCTIONS:
1. Extract store name from the top of the receipt
2. Find the purchase date (look for date formats like MM/DD/YYYY, DD/MM/YYYY, etc.)
3. Identify ALL purchased items with their prices
4. Look for subtotal, tax, and total amounts
5. Be very thorough - don't miss any items, even small ones
6. If text is unclear, make your best educated guess based on context
7. For quantities, look for patterns like "2x", "3 @", "QTY: 2", etc.

IMPORTANT: Extract EVERY item you can see, even if partially obscured. Companies like Fetch need complete transaction data.

Return your response in this EXACT JSON format:
{
  "store": "Store Name Here",
  "date": "YYYY-MM-DD",
  "items": [
    {"name": "Product Name", "price": 0.00, "quantity": 1}
  ],
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00,
  "confidence": 0.95
}

If you cannot read certain parts clearly, still include your best guess and set confidence lower.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please extract all purchase information from this receipt image. Be thorough and extract every item you can see:'
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
        temperature: 0.1 // Low temperature for consistency
      }),
    });

    if (!response.ok) {
      console.error(`OpenAI API error: ${response.status} - ${await response.text()}`);
      throw new Error(`OpenAI API failed with status ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log('OpenAI response received:', JSON.stringify(aiResponse, null, 2));
    
    if (!aiResponse.choices || !aiResponse.choices[0]?.message?.content) {
      throw new Error('Invalid OpenAI response structure');
    }

    const content = aiResponse.choices[0].message.content;
    console.log('AI extracted content:', content);
    
    // Parse the JSON response with multiple fallback strategies
    let receiptData;
    try {
      // Try direct JSON parse first
      receiptData = JSON.parse(content);
    } catch (parseError) {
      console.log('Direct JSON parse failed, trying markdown extraction...');
      
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          receiptData = JSON.parse(jsonMatch[1]);
        } catch (markdownError) {
          console.error('Markdown JSON parse failed:', markdownError);
          throw new Error('Failed to parse AI response as JSON');
        }
      } else {
        // Try to find JSON-like structure without code blocks
        const possibleJson = content.match(/\{[\s\S]*\}/);
        if (possibleJson) {
          try {
            receiptData = JSON.parse(possibleJson[0]);
          } catch (structureError) {
            console.error('Structure JSON parse failed:', structureError);
            throw new Error('No valid JSON structure found in AI response');
          }
        } else {
          throw new Error('No JSON structure found in AI response');
        }
      }
    }

    console.log('Successfully parsed receipt data:', JSON.stringify(receiptData, null, 2));

    // Validate the parsed data
    if (!receiptData || typeof receiptData !== 'object') {
      throw new Error('Invalid receipt data structure');
    }

    // Ensure required fields exist with defaults
    receiptData.store = receiptData.store || "Unknown Store";
    receiptData.date = receiptData.date || new Date().toISOString().split('T')[0];
    receiptData.items = Array.isArray(receiptData.items) ? receiptData.items : [];
    receiptData.total = typeof receiptData.total === 'number' ? receiptData.total : 0;
    receiptData.confidence = typeof receiptData.confidence === 'number' ? receiptData.confidence : 0.7;

    // Process each item through carbon calculation
    const processedItems: ReceiptItem[] = receiptData.items.map((item: any) => {
      const itemName = item.name || "Unknown Item";
      const itemPrice = typeof item.price === 'number' ? item.price : 0;
      const itemQuantity = typeof item.quantity === 'number' ? item.quantity : 1;
      
      const result = calculateItemEmissions(itemName, itemQuantity);
      
      return {
        name: itemName,
        quantity: itemQuantity.toString(),
        carbon: result.emissions_kg,
        category: result.emissions_kg > 8 ? 'high' : result.emissions_kg > 3 ? 'medium' : 'low',
        price: itemPrice,
        breakdown: result.breakdown,
        suggestions: result.suggestions,
        confidence: result.confidence * receiptData.confidence // Combine confidences
      };
    });

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
      // Calculate potential reduction based on item type
      if (item.name.toLowerCase().includes('beef') || item.name.toLowerCase().includes('lamb')) {
        return sum + item.carbon * 0.85; // High reduction potential
      } else if (item.name.toLowerCase().includes('dairy') || item.name.toLowerCase().includes('cheese')) {
        return sum + item.carbon * 0.6; // Medium reduction potential
      } else if (item.name.toLowerCase().includes('chicken') || item.name.toLowerCase().includes('fish')) {
        return sum + item.carbon * 0.4; // Lower reduction potential
      }
      return sum + item.carbon * 0.2; // General reduction potential
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

  } catch (error) {
    console.error('Advanced AI OCR failed:', error);
    
    // Fallback strategy: Try with simpler prompt and different model
    try {
      console.log('Attempting fallback OCR with simpler approach...');
      
      const fallbackResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'Extract items and prices from this receipt. Return JSON with store, items array with name and price, and total.'
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'What items and prices do you see on this receipt?'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageData
                  }
                }
              ]
            }
          ],
          max_tokens: 2000
        }),
      });

      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        const fallbackContent = fallbackData.choices[0]?.message?.content;
        
        if (fallbackContent) {
          console.log('Fallback response:', fallbackContent);
          
          // Try to extract any usable data from the fallback response
          const items: ReceiptItem[] = [];
          
          // Look for price patterns in the text
          const priceMatches = fallbackContent.match(/\$?\d+\.?\d*/g);
          const itemMatches = fallbackContent.match(/[a-zA-Z][a-zA-Z\s]+(?=\s*\$?\d+\.?\d*)/g);
          
          if (priceMatches && itemMatches) {
            const minLength = Math.min(priceMatches.length, itemMatches.length);
            for (let i = 0; i < minLength && i < 10; i++) { // Limit to 10 items max
              const price = parseFloat(priceMatches[i].replace('$', '')) || 0;
              const name = itemMatches[i]?.trim() || `Item ${i + 1}`;
              
              if (price > 0 && price < 1000) { // Reasonable price range
                const result = calculateItemEmissions(name, 1);
                items.push({
                  name,
                  quantity: "1",
                  carbon: result.emissions_kg,
                  category: result.emissions_kg > 8 ? 'high' : result.emissions_kg > 3 ? 'medium' : 'low',
                  price,
                  breakdown: result.breakdown,
                  suggestions: result.suggestions,
                  confidence: 0.5 // Lower confidence for fallback
                });
              }
            }
          }
          
          if (items.length > 0) {
            const totalCarbon = items.reduce((sum, item) => sum + item.carbon, 0);
            const totalPrice = items.reduce((sum, item) => sum + item.price, 0);
            
            return {
              store: "Extracted Store",
              date: new Date().toISOString().split('T')[0],
              items,
              totalCarbon: Math.round(totalCarbon * 100) / 100,
              total: Math.round(totalPrice * 100) / 100,
              location: "Receipt Location",
              equivalents: generateEquivalents(totalCarbon),
              summary: {
                highest_impact_category: items.length > 0 ? "Mixed Items" : "None",
                reduction_potential_kg: Math.round(totalCarbon * 0.3 * 100) / 100,
                improvement_score: 50
              }
            };
          }
        }
      }
    } catch (fallbackError) {
      console.error('Fallback OCR also failed:', fallbackError);
    }
    
    // Final fallback: Return empty but valid response
    console.log('All OCR attempts failed, returning empty response');
    return {
      store: "Receipt Processing Failed - Please try a clearer image",
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { imageData, scanMethod = 'camera' } = await req.json();
    
    if (!imageData) {
      throw new Error('Image data is required');
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
    
    if (authError || !user) {
      throw new Error('Authentication required');
    }

    console.log('Processing receipt for user:', user.id);

    // Process the receipt image
    const processedReceipt = await processReceiptImage(imageData);

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
        details: { itemCount: processedReceipt.items.length }
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