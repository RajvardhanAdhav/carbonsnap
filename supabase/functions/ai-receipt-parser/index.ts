import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReceiptItem {
  name: string;
  quantity: string;
  price: number;
  category?: string;
}

interface ParsedReceipt {
  storeName: string;
  date: string;
  items: ReceiptItem[];
  subtotal?: number;
  tax?: number;
  total: number;
  confidence: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageData } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('Processing receipt with AI...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert receipt parser. Analyze the receipt image and extract structured data. Return ONLY valid JSON with this exact structure:
{
  "storeName": "string",
  "date": "YYYY-MM-DD",
  "items": [
    {
      "name": "string",
      "quantity": "string",
      "price": number,
      "category": "food|household|electronics|clothing|other"
    }
  ],
  "subtotal": number or null,
  "tax": number or null,
  "total": number,
  "confidence": number between 0 and 1
}

Rules:
- Extract ALL items with prices
- Normalize item names (proper capitalization, remove codes)
- Parse quantities correctly (1, 2x, etc.)
- Convert all prices to numbers
- Use ISO date format
- Categorize items appropriately
- Set confidence based on text clarity
- If no clear receipt structure, set confidence below 0.3`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please parse this receipt and return the data in the specified JSON format.'
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
        max_tokens: 2000,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResult = data.choices[0].message.content;

    console.log('AI response:', aiResult);

    // Parse the JSON response
    let parsedReceipt: ParsedReceipt;
    try {
      parsedReceipt = JSON.parse(aiResult);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      throw new Error('Invalid AI response format');
    }

    // Validate and clean the response
    const cleanedReceipt = validateAndCleanReceipt(parsedReceipt);

    return new Response(JSON.stringify(cleanedReceipt), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-receipt-parser:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      storeName: 'Unknown Store',
      date: new Date().toISOString().split('T')[0],
      items: [],
      total: 0,
      confidence: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function validateAndCleanReceipt(receipt: any): ParsedReceipt {
  // Ensure required fields exist and have correct types
  const cleaned: ParsedReceipt = {
    storeName: typeof receipt.storeName === 'string' ? receipt.storeName : 'Unknown Store',
    date: validateDate(receipt.date),
    items: validateItems(receipt.items || []),
    subtotal: typeof receipt.subtotal === 'number' ? receipt.subtotal : null,
    tax: typeof receipt.tax === 'number' ? receipt.tax : null,
    total: typeof receipt.total === 'number' ? receipt.total : 0,
    confidence: typeof receipt.confidence === 'number' ? 
      Math.max(0, Math.min(1, receipt.confidence)) : 0.5
  };

  // If total is 0, calculate from items
  if (cleaned.total === 0 && cleaned.items.length > 0) {
    cleaned.total = cleaned.items.reduce((sum, item) => sum + item.price, 0);
  }

  // Validate confidence based on data quality
  if (cleaned.items.length === 0 || cleaned.storeName === 'Unknown Store') {
    cleaned.confidence = Math.min(cleaned.confidence, 0.3);
  }

  return cleaned;
}

function validateDate(dateStr: any): string {
  if (typeof dateStr !== 'string') {
    return new Date().toISOString().split('T')[0];
  }

  // Try to parse the date
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return new Date().toISOString().split('T')[0];
  }

  return date.toISOString().split('T')[0];
}

function validateItems(items: any[]): ReceiptItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter(item => 
      typeof item === 'object' && 
      item.name && 
      typeof item.price === 'number' && 
      item.price > 0
    )
    .map(item => ({
      name: String(item.name).trim(),
      quantity: item.quantity ? String(item.quantity) : '1',
      price: Number(item.price),
      category: validateCategory(item.category)
    }));
}

function validateCategory(category: any): string {
  const validCategories = ['food', 'household', 'electronics', 'clothing', 'other'];
  return validCategories.includes(category) ? category : 'other';
}