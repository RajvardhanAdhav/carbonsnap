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

// Comprehensive LCA-based carbon calculation for single items
function estimateProductCarbon(productName: string, category: string, brand?: string, description?: string) {
  const EMISSION_FACTORS = {
    beef: { production: 27.0, packaging: 0.5, transport: 2.0, disposal: 0.3 },
    chicken: { production: 6.9, packaging: 0.3, transport: 1.0, disposal: 0.15 },
    smartphone: { production: 85.0, packaging: 2.0, transport: 8.0, disposal: 5.0 },
    laptop: { production: 420.0, packaging: 15.0, transport: 35.0, disposal: 25.0 },
    cotton_shirt: { production: 15.0, packaging: 0.5, transport: 2.0, disposal: 1.0 },
    default: { production: 2.0, packaging: 0.3, transport: 0.8, disposal: 0.1 }
  };

  // Classify product
  const name = productName.toLowerCase();
  let productType = 'default';
  
  if (name.includes('beef') || name.includes('steak')) productType = 'beef';
  else if (name.includes('chicken') || name.includes('poultry')) productType = 'chicken';
  else if (name.includes('phone') || name.includes('smartphone')) productType = 'smartphone';
  else if (name.includes('laptop') || name.includes('computer')) productType = 'laptop';
  else if (name.includes('shirt') || name.includes('clothing')) productType = 'cotton_shirt';

  const factors = EMISSION_FACTORS[productType as keyof typeof EMISSION_FACTORS] || EMISSION_FACTORS.default;
  
  // Calculate lifecycle emissions
  const breakdown = {
    production: factors.production,
    packaging: factors.packaging,
    transport: factors.transport,
    use: factors.use || 0,
    disposal: factors.disposal
  };
  
  const totalCarbon = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
  const carbonCategory = totalCarbon > 10 ? 'high' : totalCarbon > 3 ? 'medium' : 'low';
  
  return { 
    carbon: Math.round(totalCarbon * 100) / 100, 
    carbonCategory, 
    details: {
      category: productType,
      breakdown,
      confidence: 0.8,
      suggestions: productType === 'beef' ? ['Consider plant-based alternatives'] : ['Choose local options when available']
    }
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