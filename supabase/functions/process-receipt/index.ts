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
}

interface ProcessedReceipt {
  store: string;
  date: string;
  items: ReceiptItem[];
  totalCarbon: number;
  total?: number;
}

// Simple carbon footprint estimation based on product categories
function estimateCarbonFootprint(productName: string): { carbon: number; category: 'low' | 'medium' | 'high' } {
  const name = productName.toLowerCase();
  
  // High carbon foods
  if (name.includes('beef') || name.includes('steak') || name.includes('lamb')) {
    return { carbon: 27.0, category: 'high' };
  }
  if (name.includes('pork') || name.includes('ham') || name.includes('bacon')) {
    return { carbon: 12.0, category: 'high' };
  }
  if (name.includes('chicken') || name.includes('turkey')) {
    return { carbon: 6.0, category: 'medium' };
  }
  if (name.includes('cheese') || name.includes('dairy')) {
    return { carbon: 9.0, category: 'medium' };
  }
  
  // Low carbon foods
  if (name.includes('apple') || name.includes('banana') || name.includes('fruit')) {
    return { carbon: 0.4, category: 'low' };
  }
  if (name.includes('vegetables') || name.includes('lettuce') || name.includes('carrot')) {
    return { carbon: 0.3, category: 'low' };
  }
  if (name.includes('plant') || name.includes('oat') || name.includes('soy')) {
    return { carbon: 0.9, category: 'low' };
  }
  if (name.includes('bread') || name.includes('pasta') || name.includes('rice')) {
    return { carbon: 1.2, category: 'low' };
  }
  
  // Default medium carbon
  return { carbon: 2.5, category: 'medium' };
}

// Mock OCR processing - in real implementation, you'd use a service like Google Vision API
function processReceiptImage(imageData: string): ProcessedReceipt {
  // For now, return mock data with realistic carbon footprints
  const mockItems: ReceiptItem[] = [
    { name: "Organic Apples", quantity: "2 lbs", ...estimateCarbonFootprint("apples"), price: 4.99 },
    { name: "Ground Beef", quantity: "1 lb", ...estimateCarbonFootprint("beef"), price: 8.99 },
    { name: "Plant Milk", quantity: "1 bottle", ...estimateCarbonFootprint("plant milk"), price: 3.49 },
    { name: "Whole Wheat Bread", quantity: "1 loaf", ...estimateCarbonFootprint("bread"), price: 2.99 }
  ];
  
  const totalCarbon = mockItems.reduce((sum, item) => sum + item.carbon, 0);
  
  return {
    store: "Green Market",
    date: new Date().toISOString().split('T')[0],
    items: mockItems,
    totalCarbon: Number(totalCarbon.toFixed(2)),
    total: mockItems.reduce((sum, item) => sum + (item.price || 0), 0)
  };
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
    const processedReceipt = processReceiptImage(imageData);

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