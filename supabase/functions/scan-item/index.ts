import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Carbon footprint database for different product categories
const productCarbonData = {
  clothing: {
    cotton_shirt: { carbon: 5.4, details: { material: '100% Cotton', origin: 'India', transport: 'Sea freight' } },
    jeans: { carbon: 33.4, details: { material: 'Cotton/Polyester blend', origin: 'Bangladesh', transport: 'Sea freight' } },
    wool_sweater: { carbon: 47.2, details: { material: '100% Wool', origin: 'China', transport: 'Air freight' } },
    synthetic_jacket: { carbon: 26.5, details: { material: 'Polyester', origin: 'Vietnam', transport: 'Sea freight' } }
  },
  electronics: {
    smartphone: { carbon: 70.0, details: { material: 'Aluminum/Glass/Silicon', origin: 'China', transport: 'Air freight' } },
    laptop: { carbon: 300.0, details: { material: 'Aluminum/Plastic/Silicon', origin: 'Taiwan', transport: 'Air freight' } },
    headphones: { carbon: 8.5, details: { material: 'Plastic/Metal', origin: 'China', transport: 'Sea freight' } }
  },
  food: {
    apple: { carbon: 0.4, details: { material: 'Organic', origin: 'Local farm', transport: 'Truck' } },
    banana: { carbon: 0.6, details: { material: 'Conventional', origin: 'Ecuador', transport: 'Ship/Truck' } },
    bread: { carbon: 1.2, details: { material: 'Wheat flour', origin: 'Local bakery', transport: 'Local delivery' } }
  }
};

function estimateProductCarbon(productName: string, category: string): {
  carbon: number;
  carbonCategory: 'low' | 'medium' | 'high';
  details: any;
} {
  const name = productName.toLowerCase();
  let carbon = 2.0; // default
  let details = { material: 'Unknown', origin: 'Unknown', transport: 'Unknown', packaging: 'Standard' };

  // Try to match product with our database
  if (category === 'clothing' || name.includes('shirt') || name.includes('clothing')) {
    if (name.includes('organic') || name.includes('cotton')) {
      carbon = productCarbonData.clothing.cotton_shirt.carbon;
      details = { ...productCarbonData.clothing.cotton_shirt.details, packaging: 'Recycled cardboard' };
    } else if (name.includes('jeans') || name.includes('pants')) {
      carbon = productCarbonData.clothing.jeans.carbon;
      details = productCarbonData.clothing.jeans.details;
    } else if (name.includes('wool') || name.includes('sweater')) {
      carbon = productCarbonData.clothing.wool_sweater.carbon;
      details = productCarbonData.clothing.wool_sweater.details;
    } else {
      carbon = productCarbonData.clothing.synthetic_jacket.carbon;
      details = productCarbonData.clothing.synthetic_jacket.details;
    }
  } else if (category === 'electronics' || name.includes('phone') || name.includes('computer')) {
    if (name.includes('phone') || name.includes('mobile')) {
      carbon = productCarbonData.electronics.smartphone.carbon;
      details = productCarbonData.electronics.smartphone.details;
    } else if (name.includes('laptop') || name.includes('computer')) {
      carbon = productCarbonData.electronics.laptop.carbon;
      details = productCarbonData.electronics.laptop.details;
    } else {
      carbon = productCarbonData.electronics.headphones.carbon;
      details = productCarbonData.electronics.headphones.details;
    }
  } else if (name.includes('apple') || name.includes('fruit')) {
    carbon = productCarbonData.food.apple.carbon;
    details = productCarbonData.food.apple.details;
  }

  const carbonCategory = carbon < 5 ? 'low' : carbon < 25 ? 'medium' : 'high';
  
  return { carbon, carbonCategory, details };
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

    const { 
      productName, 
      brand = 'Unknown', 
      barcode, 
      imageData, 
      scanMethod = 'camera',
      category = 'general' 
    } = await req.json();
    
    if (!productName) {
      throw new Error('Product name is required');
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
    
    if (authError || !user) {
      throw new Error('Authentication required');
    }

    console.log('Processing single item for user:', user.id, 'Product:', productName);

    // Estimate carbon footprint
    const { carbon, carbonCategory, details } = estimateProductCarbon(productName, category);

    // Store the scanned item
    const { data: scannedItem, error: insertError } = await supabase
      .from('scanned_items')
      .insert({
        user_id: user.id,
        item_type: 'single_item',
        product_name: productName,
        brand: brand,
        barcode: barcode,
        carbon_footprint: carbon,
        carbon_category: carbonCategory,
        scan_method: scanMethod,
        details: details
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting scanned item:', insertError);
      throw insertError;
    }

    console.log('Item scanned successfully');

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: scannedItem.id,
          name: productName,
          brand: brand,
          carbon: carbon,
          category: carbonCategory,
          details: details
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error processing item:', error);
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