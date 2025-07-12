import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-RECEIPT] ${step}${detailsStr}`);
};

// Simple OCR simulation - in production, integrate with Google Vision API or similar
const simulateOCR = (imageUrl: string): string => {
  // Mock OCR results for demo purposes
  const mockReceipts = [
    `WHOLE FOODS MARKET
123 Main St, City
Date: ${new Date().toLocaleDateString()}
-------------------
Organic Bananas     $3.99
Ground Beef 1lb     $8.99
Oat Milk           $4.49
Spinach Leaves     $2.99
Chicken Breast     $12.99
-------------------
Total:            $33.45`,
    
    `TARGET STORE
456 Oak Ave, Town
Date: ${new Date().toLocaleDateString()}
-------------------
iPhone Charger     $19.99
Toothpaste         $3.49
Shampoo           $7.99
Apples 2lbs       $4.98
Bread             $2.99
-------------------
Total:            $39.44`
  ];
  
  return mockReceipts[Math.floor(Math.random() * mockReceipts.length)];
};

// Extract items from OCR text using pattern matching
const extractItemsFromOCR = (ocrText: string) => {
  const lines = ocrText.split('\n');
  const items = [];
  
  for (const line of lines) {
    // Look for lines with items and prices (contains $ and product name)
    const priceMatch = line.match(/\$(\d+\.?\d*)/);
    if (priceMatch && !line.toLowerCase().includes('total') && !line.toLowerCase().includes('tax')) {
      const price = parseFloat(priceMatch[1]);
      const itemName = line.replace(/\$\d+\.?\d*/, '').trim();
      
      // Extract quantity if present
      const quantityMatch = itemName.match(/(\d+(?:\.\d+)?)\s*(lb|lbs|kg|oz|g)?/i);
      const quantity = quantityMatch ? parseFloat(quantityMatch[1]) : 1;
      const cleanName = itemName.replace(/\d+(?:\.\d+)?\s*(lb|lbs|kg|oz|g)?/i, '').trim();
      
      if (cleanName && price > 0) {
        items.push({
          name: cleanName,
          price,
          quantity
        });
      }
    }
  }
  
  return items;
};

// Match items to carbon categories using keywords
const matchToCategory = async (itemName: string, supabase: any) => {
  const { data: categories } = await supabase
    .from('carbon_categories')
    .select('*');
  
  const name = itemName.toLowerCase();
  
  // Keyword matching for categories
  const categoryMap = {
    'beef': ['beef', 'steak', 'ground beef', 'burger'],
    'chicken': ['chicken', 'poultry', 'turkey'],
    'pork': ['pork', 'bacon', 'ham', 'sausage'],
    'fish': ['fish', 'salmon', 'tuna', 'seafood', 'shrimp'],
    'dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream'],
    'vegetables': ['spinach', 'broccoli', 'carrots', 'lettuce', 'tomato', 'cucumber'],
    'fruits': ['banana', 'apple', 'orange', 'strawberry', 'grapes'],
    'grains': ['bread', 'pasta', 'rice', 'cereal', 'oats'],
    'electronics': ['phone', 'charger', 'cable', 'earphone', 'battery'],
    'personal care': ['toothpaste', 'shampoo', 'soap', 'deodorant'],
    'beverages': ['soda', 'juice', 'water', 'coffee', 'tea']
  };
  
  for (const [categoryName, keywords] of Object.entries(categoryMap)) {
    if (keywords.some(keyword => name.includes(keyword))) {
      const category = categories?.find(c => c.name.toLowerCase() === categoryName);
      if (category) {
        return category;
      }
    }
  }
  
  // Default to packaged foods if no match
  return categories?.find(c => c.name.toLowerCase() === 'packaged foods') || null;
};

// Calculate carbon footprint for an item
const calculateCarbonFootprint = (quantity: number, category: any) => {
  if (!category) return 0;
  
  // Convert quantity based on unit type
  let effectiveQuantity = quantity;
  if (category.unit === 'kg' && quantity < 10) {
    // Assume small quantities are in kg already, larger ones might be in grams
    effectiveQuantity = quantity;
  } else if (category.unit === 'item') {
    effectiveQuantity = Math.max(1, Math.round(quantity));
  }
  
  return effectiveQuantity * category.base_emission_factor;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Authentication failed");

    const { receiptId, imageUrl } = await req.json();
    if (!receiptId) throw new Error("Receipt ID required");

    logStep("Processing receipt", { receiptId, imageUrl });

    // Simulate OCR processing
    const ocrText = simulateOCR(imageUrl);
    logStep("OCR completed", { textLength: ocrText.length });

    // Extract store name and date from OCR
    const lines = ocrText.split('\n');
    const storeName = lines[0]?.trim() || 'Unknown Store';
    const dateMatch = ocrText.match(/Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
    const receiptDate = dateMatch ? new Date(dateMatch[1]) : new Date();

    // Update receipt with OCR data
    await supabase
      .from('receipts')
      .update({
        ocr_text: ocrText,
        store_name: storeName,
        receipt_date: receiptDate.toISOString().split('T')[0],
        processed: true
      })
      .eq('id', receiptId);

    // Extract and process items
    const extractedItems = extractItemsFromOCR(ocrText);
    logStep("Items extracted", { count: extractedItems.length });

    const processedItems = [];
    for (const item of extractedItems) {
      const category = await matchToCategory(item.name, supabase);
      const carbonFootprint = calculateCarbonFootprint(item.quantity, category);
      
      const { data: insertedItem } = await supabase
        .from('receipt_items')
        .insert({
          receipt_id: receiptId,
          item_name: item.name,
          quantity: item.quantity,
          price: item.price,
          category_id: category?.id,
          carbon_footprint: carbonFootprint
        })
        .select()
        .single();

      processedItems.push({
        ...insertedItem,
        category: category?.name
      });
    }

    logStep("Processing completed", { 
      itemsProcessed: processedItems.length,
      totalCarbon: processedItems.reduce((sum, item) => sum + item.carbon_footprint, 0)
    });

    return new Response(JSON.stringify({
      success: true,
      ocrText,
      itemsProcessed: processedItems.length,
      items: processedItems
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    logStep("ERROR", { message: error.message });
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});