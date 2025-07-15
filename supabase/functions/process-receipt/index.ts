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

interface ReceiptData {
  store: string;
  date: string;
  items: ReceiptItem[];
  totalCarbon: number;
  total: number;
  location: string;
  equivalents: string[];
  summary: {
    highest_impact_category: string;
    reduction_potential_kg: number;
    improvement_score: number;
  };
}

interface ProcessedReceipt extends ReceiptData {}

interface ParsedReceiptData {
  store: string;
  date: string;
  items: Array<{
    name: string;
    price: number;
    quantity: string;
  }>;
  subtotal?: number;
  tax?: number;
  total: number;
  confidence: number;
}

// Carbon footprint calculation for different product categories
function calculateItemEmissions(itemName: string, quantity: string, enhancedData?: any): {
  emissions_kg: number;
  breakdown: { production: number; packaging: number; transport: number; use: number; disposal: number };
  suggestions: string[];
  confidence: number;
} {
  console.log(`🧮 Calculating emissions for: ${itemName} (${quantity})`);
  
  const lowerName = itemName.toLowerCase();
  let baseEmissions = 0.5; // Default low-carbon item
  let category = 'low';
  
  // Enhanced categorization with more specific items
  const carbonCategories = {
    // High carbon foods
    meat: ['beef', 'steak', 'hamburger', 'burger', 'lamb', 'pork', 'bacon', 'sausage', 'ham', 'chicken', 'turkey', 'fish', 'salmon', 'tuna'],
    dairy: ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'ice cream'],
    
    // Medium carbon foods
    packaged: ['chips', 'crackers', 'cookies', 'candy', 'chocolate', 'cereal', 'bread', 'pasta', 'rice'],
    processed: ['soda', 'juice', 'beer', 'wine', 'coffee', 'tea'],
    
    // Low carbon foods
    produce: ['apple', 'banana', 'orange', 'lettuce', 'spinach', 'carrot', 'tomato', 'potato', 'onion', 'garlic'],
    grains: ['oats', 'quinoa', 'barley', 'lentils', 'beans'],
    
    // Non-food items
    household: ['detergent', 'soap', 'shampoo', 'toothpaste', 'toilet paper', 'paper towel'],
    personal: ['deodorant', 'lotion', 'makeup', 'razor']
  };

  // Determine category and base emissions
  for (const [cat, items] of Object.entries(carbonCategories)) {
    if (items.some(item => lowerName.includes(item))) {
      if (cat === 'meat') {
        baseEmissions = lowerName.includes('beef') ? 8.5 : lowerName.includes('lamb') ? 7.2 : 5.5;
        category = 'high';
      } else if (cat === 'dairy') {
        baseEmissions = 3.2;
        category = 'medium';
      } else if (cat === 'packaged' || cat === 'processed') {
        baseEmissions = 2.1;
        category = 'medium';
      } else if (cat === 'produce' || cat === 'grains') {
        baseEmissions = 0.8;
        category = 'low';
      } else {
        baseEmissions = 1.5;
        category = 'low';
      }
      break;
    }
  }

  // Parse quantity to get multiplier
  let quantityMultiplier = 1;
  const qtyMatch = quantity.match(/(\d+(?:\.\d+)?)/);
  if (qtyMatch) {
    quantityMultiplier = parseFloat(qtyMatch[1]);
  }

  const totalEmissions = baseEmissions * quantityMultiplier;
  
  console.log(`📊 Emissions calculated: ${totalEmissions.toFixed(2)}kg CO2 (base: ${baseEmissions}, qty: ${quantityMultiplier})`);

  return {
    emissions_kg: Math.round(totalEmissions * 100) / 100,
    breakdown: {
      production: Math.round(totalEmissions * 0.6 * 100) / 100,
      packaging: Math.round(totalEmissions * 0.15 * 100) / 100,
      transport: Math.round(totalEmissions * 0.15 * 100) / 100,
      use: Math.round(totalEmissions * 0.05 * 100) / 100,
      disposal: Math.round(totalEmissions * 0.05 * 100) / 100,
    },
    suggestions: generateReductionSuggestions(category, itemName),
    confidence: 0.85
  };
}

function generateReductionSuggestions(category: string, itemName: string): string[] {
  const suggestions = {
    high: [
      'Consider plant-based alternatives',
      'Choose local/organic options when possible',
      'Reduce portion sizes'
    ],
    medium: [
      'Look for items with minimal packaging',
      'Choose bulk options to reduce packaging waste',
      'Consider generic brands (often less packaging)'
    ],
    low: [
      'Great choice! Low carbon footprint',
      'Buy local when possible',
      'Choose organic for even better impact'
    ]
  };

  return suggestions[category as keyof typeof suggestions] || suggestions.low;
}

async function processReceiptData(receiptData: ParsedReceiptData): Promise<ProcessedReceipt> {
  console.log('🔄 Processing receipt data into carbon calculations...');
  console.log('📝 Receipt details:', {
    store: receiptData.store,
    date: receiptData.date,
    itemCount: receiptData.items?.length || 0,
    total: receiptData.total,
    confidence: receiptData.confidence
  });

  const processedItems: ReceiptItem[] = [];
  let totalCarbon = 0;

  if (receiptData.items && Array.isArray(receiptData.items)) {
    console.log(`📦 Processing ${receiptData.items.length} items...`);
    
    for (const item of receiptData.items) {
      console.log(`\n🛒 Processing item: ${item.name}`);
      
      const result = calculateItemEmissions(item.name, item.quantity || '1');
      
      const processedItem: ReceiptItem = {
        name: item.name,
        quantity: item.quantity || '1',
        carbon: result.emissions_kg,
        category: result.emissions_kg > 8 ? 'high' : result.emissions_kg > 3 ? 'medium' : 'low',
        price: item.price,
        breakdown: result.breakdown,
        suggestions: result.suggestions,
        confidence: result.confidence * receiptData.confidence
      };

      processedItems.push(processedItem);
      totalCarbon += result.emissions_kg;
      
      console.log(`✅ Item processed: ${processedItem.carbon}kg CO2 (${processedItem.category} impact)`);
    }
  }

  console.log(`\n📈 Total carbon footprint: ${totalCarbon.toFixed(2)}kg CO2`);

  return {
    store: receiptData.store,
    date: receiptData.date,
    items: processedItems,
    totalCarbon: Math.round(totalCarbon * 100) / 100,
    total: receiptData.total || 0,
    location: "Receipt Analysis",
    equivalents: generateEquivalents(totalCarbon),
    summary: {
      highest_impact_category: processedItems.length > 0 ? 
        processedItems.reduce((prev, current) => (prev.carbon > current.carbon) ? prev : current).category : "None",
      reduction_potential_kg: Math.round(totalCarbon * 0.25 * 100) / 100,
      improvement_score: Math.min(95, Math.max(60, 90 - (totalCarbon * 2)))
    }
  };
}

function generateEquivalents(totalEmissions: number): string[] {
  console.log(`🌍 Generating equivalents for ${totalEmissions}kg CO2`);
  const milesDriven = Math.round(totalEmissions / 0.4); // Rough estimate: 0.4kg CO2 per mile
  const phoneCharges = Math.round(totalEmissions / 0.008);
  return [
    `Equivalent to driving ${milesDriven} miles in a gas-powered car`,
    `Same as charging a smartphone ${phoneCharges} times`
  ];
}

// Streamlined receipt processing using only OpenAI
async function processReceiptImage(imageData: string): Promise<ProcessedReceipt> {
  console.log('=== 🚀 Starting Receipt Image Processing ===');
  console.log('📷 Image data received, length:', imageData.length);
  
  try {
    // Check OpenAI API key availability
    const openaiApiKey = Deno.env.get('openai');
    console.log('🔑 OpenAI API Key check:', {
      exists: !!openaiApiKey,
      length: openaiApiKey?.length || 0,
      prefix: openaiApiKey ? openaiApiKey.substring(0, 12) + '...' : 'none'
    });
    
    if (!openaiApiKey) {
      console.error('❌ OpenAI API key not found in environment variables');
      throw new Error('OpenAI API key not found in environment variables');
    }

    console.log('✅ OpenAI API key found, proceeding with analysis...');
    console.log('📤 About to make OpenAI API call...');
    console.log('🔍 Request details:', {
      url: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
      hasAuthHeader: true,
      imageDataPresent: !!imageData,
      imageDataLength: imageData?.length || 0,
      model: 'gpt-4o'
    });
    
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
            content: `You are an expert receipt OCR system. Extract ALL purchase data from receipt images with high accuracy.

TASK: Extract store name, date, ALL items with prices/quantities, and totals.

RETURN FORMAT (strict JSON only, no markdown):
{
  "store": "Store Name",
  "date": "YYYY-MM-DD",
  "items": [
    {"name": "Product Name", "price": 0.00, "quantity": "1x"}
  ],
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00,
  "confidence": 0.95
}

CRITICAL RULES:
- Return ONLY valid JSON, no markdown or extra text
- Extract EVERY visible item from the receipt
- Use educated guesses for unclear text
- Date format must be YYYY-MM-DD
- Include subtotal, tax, and total if visible
- Confidence should be 0.0-1.0 based on text clarity
- DO NOT wrap in markdown code blocks`
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

    console.log('📥 OpenAI API call completed, checking response...');
    console.log('📊 Response status:', openaiResponse.status);
    console.log('📋 Response headers:', Object.fromEntries(openaiResponse.headers.entries()));
    
    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error(`❌ OpenAI API error: ${openaiResponse.status} - ${errorText}`);
      throw new Error(`OpenAI API failed with status ${openaiResponse.status}: ${errorText}`);
    }

    const aiResponse = await openaiResponse.json();
    console.log('✅ OpenAI response structure:', {
      hasChoices: !!aiResponse.choices,
      choicesLength: aiResponse.choices?.length || 0,
      hasUsage: !!aiResponse.usage,
      usage: aiResponse.usage,
      model: aiResponse.model,
      id: aiResponse.id
    });
    
    if (aiResponse.usage) {
      console.log('📊 Token usage details:', {
        promptTokens: aiResponse.usage.prompt_tokens,
        completionTokens: aiResponse.usage.completion_tokens, 
        totalTokens: aiResponse.usage.total_tokens,
        estimatedCost: `$${((aiResponse.usage.total_tokens * 0.00001) * 100).toFixed(4)}`
      });
    }
    
    if (!aiResponse.choices || !aiResponse.choices[0]?.message?.content) {
      console.error('❌ Invalid OpenAI response structure');
      throw new Error('Invalid OpenAI response structure');
    }

    const content = aiResponse.choices[0].message.content;
    console.log('📄 AI extracted content length:', content.length);
    console.log('📄 AI content preview:', content.substring(0, 200) + '...');
    
    // Parse the JSON response with comprehensive fallback strategies
    let receiptData: ParsedReceiptData;
    console.log('🔄 Attempting to parse JSON response...');
    
    try {
      receiptData = JSON.parse(content);
      console.log('✅ Direct JSON parse successful');
    } catch (parseError) {
      console.log('⚠️ Direct JSON parse failed, trying markdown extraction...');
      console.log('❌ Parse error:', parseError.message);
      
      // Try to extract JSON from markdown blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        console.log('📝 Found JSON in markdown block, extracting...');
        try {
          receiptData = JSON.parse(jsonMatch[1]);
          console.log('✅ Markdown JSON extraction successful');
        } catch (markdownParseError) {
          console.error('❌ Markdown JSON parse failed:', markdownParseError.message);
          
          // Try to clean and extract JSON manually
          const cleanedJson = jsonMatch[1].replace(/^\s*```json\s*/, '').replace(/\s*```\s*$/, '').trim();
          try {
            receiptData = JSON.parse(cleanedJson);
            console.log('✅ Cleaned markdown JSON successful');
          } catch (cleanError) {
            console.error('❌ Cleaned JSON parse failed:', cleanError.message);
            throw new Error('Failed to parse JSON from markdown');
          }
        }
      } else {
        console.log('⚠️ No markdown JSON found, trying to extract JSON object...');
        
        // Try to find JSON object in the response
        const objectMatch = content.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          console.log('🔍 Found JSON object, attempting to parse...');
          try {
            receiptData = JSON.parse(objectMatch[0]);
            console.log('✅ Object extraction successful');
          } catch (objectError) {
            console.error('❌ Object JSON parse failed:', objectError.message);
            throw new Error('Failed to extract valid JSON object from response');
          }
        } else {
          console.error('❌ No valid JSON structure found in response');
          console.log('🔍 Full response content:', content);
          throw new Error('No valid JSON found in AI response');
        }
      }
    }

    console.log('✅ Successfully parsed receipt data:', JSON.stringify(receiptData, null, 2));
    
    // Validate the parsed data
    if (!receiptData.store || !receiptData.date) {
      console.error('❌ Invalid receipt data structure - missing required fields');
      throw new Error('Invalid receipt data: missing store or date');
    }
    
    console.log('🔄 Proceeding to carbon calculation...');
    return await processReceiptData(receiptData);

  } catch (error) {
    console.error('❌ Receipt processing failed:', error);
    console.error('📍 Error stack:', error.stack);
    
    // Throw the error so we can see exactly what went wrong
    throw new Error(`Receipt processing failed: ${error.message}`);
  }
}

Deno.serve(async (req) => {
  console.log('=== 🌟 Process Receipt Function Started ===');
  console.log('📨 Request method:', req.method);
  console.log('🔗 Request URL:', req.url);
  
  if (req.method === 'OPTIONS') {
    console.log('✅ Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔐 Initializing Supabase client...');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔍 Parsing request body...');
    const { imageData, scanMethod, manualData } = await req.json();
    console.log('📊 Request data:', {
      hasImageData: !!imageData,
      imageDataLength: imageData?.length || 0,
      scanMethod,
      hasManualData: !!manualData
    });

    console.log('🔑 Getting authenticated user...');
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ No authorization header found');
      throw new Error('Authorization header required');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      throw new Error('Authentication failed');
    }

    console.log('✅ User authenticated:', user.id);

    let processedReceipt: ProcessedReceipt;

    if (scanMethod === 'manual' && manualData) {
      console.log('🖊️ Processing manual entry...');
      console.log('📝 Manual data:', manualData);
      
      const items: ReceiptItem[] = [];
      let totalCarbon = 0;
      let totalPrice = 0;

      if (manualData.items && Array.isArray(manualData.items)) {
        for (const item of manualData.items) {
          const result = calculateItemEmissions(item.name, item.quantity || '1');
          
          const processedItem: ReceiptItem = {
            name: item.name,
            quantity: item.quantity || '1',
            carbon: result.emissions_kg,
            category: result.emissions_kg > 8 ? 'high' : result.emissions_kg > 3 ? 'medium' : 'low',
            price: item.price || 0,
            breakdown: result.breakdown,
            suggestions: result.suggestions,
            confidence: result.confidence
          };

          items.push(processedItem);
          totalCarbon += result.emissions_kg;
          totalPrice += item.price || 0;
        }
      }

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
      console.log('📷 Processing image data...');
      processedReceipt = await processReceiptImage(imageData);
    } else {
      console.error('❌ No valid input provided');
      throw new Error('No valid input provided');
    }

    console.log('💾 Storing receipt in database...');
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
      console.error('❌ Error inserting scanned item:', insertError);
      throw insertError;
    }

    console.log('📦 Storing individual receipt items...');
    const receiptItems = processedReceipt.items.map(item => ({
      scanned_item_id: scannedItem.id,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.price || 0,
      carbon_footprint: item.carbon,
      category: item.category,
      carbon_category: item.category
    }));

    if (receiptItems.length > 0) {
      const { error: itemsError } = await supabase
        .from('receipt_items')
        .insert(receiptItems);

      if (itemsError) {
        console.error('❌ Error inserting receipt items:', itemsError);
        throw itemsError;
      }
    }

    console.log('✅ Receipt processing completed successfully!');
    console.log('📊 Final result:', {
      store: processedReceipt.store,
      itemCount: processedReceipt.items.length,
      totalCarbon: processedReceipt.totalCarbon,
      total: processedReceipt.total
    });

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
    console.error('❌ Error processing receipt:', error);
    console.error('📍 Error stack:', error.stack);
    
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