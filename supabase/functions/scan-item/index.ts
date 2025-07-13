import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Enhanced product lookup using real data
async function lookupProductByBarcode(barcode: string) {
  try {
    console.log('Looking up barcode in OpenFoodFacts:', barcode);
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch from OpenFoodFacts');
    }
    
    const data = await response.json();
    
    if (data.status === 1 && data.product) {
      const product = data.product;
      return {
        name: product.product_name || product.generic_name || 'Unknown Product',
        brand: product.brands || 'Unknown',
        category: mapCategory(product.categories_tags || []),
        description: product.generic_name || product.product_name || '',
        nutritionGrade: product.nutrition_grade_fr || null,
        ecoScore: product.ecoscore_score || null
      };
    }
    
    return null;
  } catch (error) {
    console.error('OpenFoodFacts lookup failed:', error);
    return null;
  }
}

function mapCategory(categories: string[]): string {
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
    'en:chocolates': 'snacks'
  };

  for (const category of categories) {
    if (categoryMap[category]) {
      return categoryMap[category];
    }
  }
  
  // Fallback matches
  for (const category of categories) {
    if (category.includes('meat')) return 'meat';
    if (category.includes('dairy')) return 'dairy';
    if (category.includes('fruit') || category.includes('vegetable')) return 'produce';
    if (category.includes('beverage')) return 'beverages';
  }
  
  return 'general';
}

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

    console.log('Processing single item for user:', user.id, 'Product:', productName, 'Barcode:', barcode);

    // Try to get real product data if barcode is provided
    let enhancedProductData = null;
    if (barcode) {
      enhancedProductData = await lookupProductByBarcode(barcode);
      if (enhancedProductData) {
        console.log('Found real product data:', enhancedProductData);
      }
    }

    // Use real product data if available, otherwise use provided data
    const finalProductName = enhancedProductData?.name || productName;
    const finalBrand = enhancedProductData?.brand || brand;
    const finalCategory = enhancedProductData?.category || category;

    // Estimate carbon footprint
    const { carbon, carbonCategory, details } = estimateProductCarbon(finalProductName, finalCategory);

    // Store the scanned item
    const { data: scannedItem, error: insertError } = await supabase
      .from('scanned_items')
      .insert({
        user_id: user.id,
        item_type: 'single_item',
        product_name: finalProductName,
        brand: finalBrand,
        barcode: barcode,
        carbon_footprint: carbon,
        carbon_category: carbonCategory,
        scan_method: scanMethod,
        details: {
          ...details,
          realProductData: enhancedProductData
        }
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
          name: finalProductName,
          brand: finalBrand,
          carbon: carbon,
          category: carbonCategory,
          details: {
            ...details,
            realProductData: enhancedProductData
          }
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