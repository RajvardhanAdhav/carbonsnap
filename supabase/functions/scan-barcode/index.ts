import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProductData {
  name: string;
  brand: string;
  category: string;
  ingredients: string[];
  nutritionFacts?: any;
  imageUrl?: string;
  weight?: string;
  origin?: string;
  confidence: number;
}

interface ProcessedProduct {
  name: string;
  brand: string;
  carbon: number;
  category: 'low' | 'medium' | 'high';
  details: {
    material: string;
    origin: string;
    transport: string;
    packaging: string;
  };
  breakdown: {
    production: number;
    packaging: number;
    transport: number;
    use: number;
    disposal: number;
  };
  suggestions: string[];
  confidence: number;
}

// Enhanced carbon footprint calculation for products
function calculateProductEmissions(productData: ProductData): ProcessedProduct {
  console.log('Calculating emissions for product:', productData.name);
  
  let baseEmissions = 2.0; // Default kg CO2e
  let category = 'medium';
  
  // Product category-based emissions
  const categoryEmissions: Record<string, number> = {
    'meat': 20.0,
    'dairy': 8.5,
    'produce': 1.2,
    'packaged foods': 3.5,
    'beverages': 2.8,
    'snacks': 4.2,
    'frozen': 5.1,
    'household': 6.0,
    'personal care': 3.8,
    'cleaning': 4.5,
    'default': 2.0
  };

  // Determine emissions based on product category and name
  const productName = productData.name.toLowerCase();
  const productCategory = productData.category.toLowerCase();
  
  if (productCategory.includes('meat') || productName.includes('beef') || productName.includes('lamb')) {
    baseEmissions = categoryEmissions['meat'];
    category = 'high';
  } else if (productCategory.includes('dairy') || productName.includes('milk') || productName.includes('cheese')) {
    baseEmissions = categoryEmissions['dairy'];
    category = 'medium';
  } else if (productCategory.includes('produce') || productCategory.includes('fruit') || productCategory.includes('vegetable')) {
    baseEmissions = categoryEmissions['produce'];
    category = 'low';
  } else if (productCategory.includes('packaged') || productCategory.includes('food')) {
    baseEmissions = categoryEmissions['packaged foods'];
  } else if (productCategory.includes('beverage') || productCategory.includes('drink')) {
    baseEmissions = categoryEmissions['beverages'];
  } else if (productCategory.includes('snack') || productCategory.includes('candy')) {
    baseEmissions = categoryEmissions['snacks'];
  } else if (productCategory.includes('frozen')) {
    baseEmissions = categoryEmissions['frozen'];
  } else if (productCategory.includes('household')) {
    baseEmissions = categoryEmissions['household'];
  } else if (productCategory.includes('personal') || productCategory.includes('care')) {
    baseEmissions = categoryEmissions['personal care'];
  } else if (productCategory.includes('cleaning')) {
    baseEmissions = categoryEmissions['cleaning'];
  } else {
    baseEmissions = categoryEmissions['default'];
  }

  // Apply modifiers based on product attributes
  let modifierFactor = 1.0;
  
  // Organic modifier
  if (productName.includes('organic')) {
    modifierFactor *= 0.85;
  }
  
  // Local/regional modifier
  if (productName.includes('local') || productData.origin?.includes('local')) {
    modifierFactor *= 0.7;
  }
  
  // Packaging considerations
  let packagingEmissions = 0.3;
  if (productName.includes('glass')) {
    packagingEmissions = 0.8;
  } else if (productName.includes('plastic') || productName.includes('bottle')) {
    packagingEmissions = 0.5;
  } else if (productName.includes('can') || productName.includes('aluminum')) {
    packagingEmissions = 0.6;
  } else if (productName.includes('paper') || productName.includes('cardboard')) {
    packagingEmissions = 0.2;
  }

  const finalEmissions = baseEmissions * modifierFactor;
  
  // Determine category based on final emissions
  if (finalEmissions > 8) category = 'high';
  else if (finalEmissions > 3) category = 'medium';
  else category = 'low';

  // Create breakdown
  const breakdown = {
    production: Math.round(finalEmissions * 0.6 * 100) / 100,
    packaging: Math.round(packagingEmissions * 100) / 100,
    transport: Math.round(finalEmissions * 0.25 * 100) / 100,
    use: 0,
    disposal: Math.round(finalEmissions * 0.05 * 100) / 100
  };

  // Generate suggestions
  const suggestions: string[] = [];
  if (category === 'high') {
    suggestions.push('Consider plant-based alternatives to reduce emissions by up to 80%');
    suggestions.push('Look for local or regional versions of this product');
  } else if (category === 'medium') {
    suggestions.push('Choose products with minimal packaging when possible');
    suggestions.push('Look for organic or sustainably sourced options');
  } else {
    suggestions.push('Great choice! This product has a low carbon footprint');
    suggestions.push('Support local producers when available');
  }

  return {
    name: productData.name,
    brand: productData.brand,
    carbon: Math.round(finalEmissions * 100) / 100,
    category: category as 'low' | 'medium' | 'high',
    details: {
      material: productData.category,
      origin: productData.origin || 'Unknown',
      transport: 'Estimated based on category',
      packaging: packagingEmissions > 0.5 ? 'High impact' : 'Low impact'
    },
    breakdown,
    suggestions: suggestions.slice(0, 2),
    confidence: productData.confidence
  };
}

// Function to search for product data using multiple APIs
async function getProductData(barcode: string): Promise<ProductData | null> {
  console.log('Searching for product data for barcode:', barcode);
  
  try {
    // Method 1: Use Perplexity AI to search for product information
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (perplexityApiKey) {
      console.log('Searching with Perplexity AI...');
      
      const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
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
              content: 'You are a product database assistant. Search for product information by barcode and return detailed product data in JSON format.'
            },
            {
              role: 'user',
              content: `Find product information for barcode ${barcode}. Return JSON with: name, brand, category, ingredients (array), weight, origin. Be precise and search current product databases.`
            }
          ],
          temperature: 0.2,
          top_p: 0.9,
          max_tokens: 1000,
          return_images: false,
          return_related_questions: false,
          search_recency_filter: 'month',
          frequency_penalty: 1,
          presence_penalty: 0
        }),
      });

      if (perplexityResponse.ok) {
        const perplexityData = await perplexityResponse.json();
        const content = perplexityData.choices[0]?.message?.content;
        
        if (content) {
          console.log('Perplexity response:', content);
          
          // Try to extract JSON from the response
          try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const productInfo = JSON.parse(jsonMatch[0]);
              
              if (productInfo.name) {
                return {
                  name: productInfo.name,
                  brand: productInfo.brand || 'Unknown Brand',
                  category: productInfo.category || 'General Product',
                  ingredients: Array.isArray(productInfo.ingredients) ? productInfo.ingredients : [],
                  weight: productInfo.weight,
                  origin: productInfo.origin,
                  confidence: 0.85
                };
              }
            }
          } catch (parseError) {
            console.log('Failed to parse Perplexity JSON response');
          }
          
          // Fallback: Extract information from text response
          const lines = content.split('\n');
          let name = 'Unknown Product';
          let brand = 'Unknown Brand';
          let category = 'General Product';
          
          for (const line of lines) {
            if (line.toLowerCase().includes('name:') || line.toLowerCase().includes('product:')) {
              name = line.split(':')[1]?.trim() || name;
            }
            if (line.toLowerCase().includes('brand:')) {
              brand = line.split(':')[1]?.trim() || brand;
            }
            if (line.toLowerCase().includes('category:')) {
              category = line.split(':')[1]?.trim() || category;
            }
          }
          
          if (name !== 'Unknown Product') {
            return {
              name,
              brand,
              category,
              ingredients: [],
              confidence: 0.6
            };
          }
        }
      }
    }

    // Method 2: Try Open Food Facts API (free alternative)
    console.log('Trying Open Food Facts API...');
    const offResponse = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    
    if (offResponse.ok) {
      const offData = await offResponse.json();
      
      if (offData.status === 1 && offData.product) {
        const product = offData.product;
        console.log('Found product in Open Food Facts:', product.product_name);
        
        return {
          name: product.product_name || 'Unknown Product',
          brand: product.brands || 'Unknown Brand',
          category: product.categories || 'Food Product',
          ingredients: product.ingredients_text ? product.ingredients_text.split(',').map((i: string) => i.trim()) : [],
          nutritionFacts: product.nutriments,
          imageUrl: product.image_url,
          weight: product.quantity,
          origin: product.origins,
          confidence: 0.9
        };
      }
    }

    // Method 3: Use UPC Database API (if available)
    console.log('Trying UPC Database...');
    const upcResponse = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`);
    
    if (upcResponse.ok) {
      const upcData = await upcResponse.json();
      
      if (upcData.code === 'OK' && upcData.items && upcData.items.length > 0) {
        const item = upcData.items[0];
        console.log('Found product in UPC Database:', item.title);
        
        return {
          name: item.title || 'Unknown Product',
          brand: item.brand || 'Unknown Brand',
          category: item.category || 'General Product',
          ingredients: item.description ? [item.description] : [],
          confidence: 0.75
        };
      }
    }

    console.log('No product data found for barcode:', barcode);
    return null;

  } catch (error) {
    console.error('Error fetching product data:', error);
    return null;
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

    const { barcode, scanMethod = 'barcode' } = await req.json();
    
    if (!barcode) {
      throw new Error('Barcode is required');
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
    
    if (authError || !user) {
      throw new Error('Authentication required');
    }

    console.log('Processing barcode for user:', user.id, 'Barcode:', barcode);

    // Get product data from various sources
    const productData = await getProductData(barcode);
    
    if (!productData) {
      throw new Error('Product not found. Please try manual input.');
    }

    // Calculate carbon emissions
    const processedProduct = calculateProductEmissions(productData);

    // Store the scanned item
    const { data: scannedItem, error: insertError } = await supabase
      .from('scanned_items')
      .insert({
        user_id: user.id,
        item_type: 'barcode',
        product_name: processedProduct.name,
        brand: processedProduct.brand,
        barcode: barcode,
        carbon_footprint: processedProduct.carbon,
        carbon_category: processedProduct.category,
        scan_method: scanMethod,
        details: {
          ...processedProduct.details,
          breakdown: processedProduct.breakdown,
          suggestions: processedProduct.suggestions,
          confidence: processedProduct.confidence,
          source: 'Third-party API'
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting scanned item:', insertError);
      throw insertError;
    }

    console.log('Barcode processed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: scannedItem.id,
          ...processedProduct
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error processing barcode:', error);
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