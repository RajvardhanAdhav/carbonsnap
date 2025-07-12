import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SCAN-ITEM] ${step}${detailsStr}`);
};

// Mock barcode/image recognition - in production, integrate with OpenFoodFacts API or similar
const mockProductDatabase = [
  { barcode: "123456789012", name: "Organic Bananas", brand: "Chiquita", category: "fruits" },
  { barcode: "123456789013", name: "Ground Beef", brand: "Local Farm", category: "beef" },
  { barcode: "123456789014", name: "Oat Milk", brand: "Oatly", category: "dairy" },
  { barcode: "123456789015", name: "iPhone Charger", brand: "Apple", category: "electronics" },
  { barcode: "123456789016", name: "Chicken Breast", brand: "Organic Valley", category: "chicken" },
  { barcode: "123456789017", name: "Spinach", brand: "Fresh Express", category: "vegetables" },
  { barcode: "123456789018", name: "Shampoo", brand: "Pantene", category: "personal care" },
  { barcode: "123456789019", name: "Coca Cola", brand: "Coca-Cola", category: "beverages" },
  { barcode: "123456789020", name: "Bread", brand: "Wonder", category: "grains" },
];

const recognizeProduct = async (barcode?: string, imageUrl?: string) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (barcode) {
    const product = mockProductDatabase.find(p => p.barcode === barcode);
    if (product) return product;
  }
  
  // If no barcode match, simulate image recognition with random product
  const randomProduct = mockProductDatabase[Math.floor(Math.random() * mockProductDatabase.length)];
  return randomProduct;
};

const matchToCategory = async (categoryName: string, supabase: any) => {
  const { data: categories } = await supabase
    .from('carbon_categories')
    .select('*');
  
  // Direct match first
  let category = categories?.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
  
  if (!category) {
    // Fuzzy matching
    const categoryMap = {
      'fruits': 'Fruits',
      'beef': 'Beef',
      'dairy': 'Dairy',
      'electronics': 'Electronics',
      'chicken': 'Chicken',
      'vegetables': 'Vegetables',
      'personal care': 'Personal Care',
      'beverages': 'Beverages',
      'grains': 'Grains'
    };
    
    const mappedCategory = categoryMap[categoryName.toLowerCase()];
    if (mappedCategory) {
      category = categories?.find(c => c.name === mappedCategory);
    }
  }
  
  // Default fallback
  return category || categories?.find(c => c.name === 'Packaged Foods');
};

const calculateCarbonFootprint = (category: any) => {
  if (!category) return 0;
  
  // For items, we typically calculate per unit
  return category.base_emission_factor;
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

    const { barcode, imageUrl } = await req.json();
    if (!barcode && !imageUrl) throw new Error("Barcode or image URL required");

    logStep("Scanning item", { barcode, imageUrl: !!imageUrl });

    // Recognize product using barcode or image
    const product = await recognizeProduct(barcode, imageUrl);
    if (!product) {
      throw new Error("Product not recognized");
    }

    logStep("Product recognized", { product });

    // Match to carbon category
    const category = await matchToCategory(product.category, supabase);
    const carbonFootprint = calculateCarbonFootprint(category);

    // Save scanned item
    const { data: scannedItem, error: insertError } = await supabase
      .from('scanned_items')
      .insert({
        user_id: userData.user.id,
        item_name: product.name,
        barcode: product.barcode,
        brand: product.brand,
        category_id: category?.id,
        carbon_footprint: carbonFootprint,
        image_url: imageUrl
      })
      .select()
      .single();

    if (insertError) throw insertError;

    logStep("Item saved", { itemId: scannedItem.id, carbonFootprint });

    // Check for achievements
    const { data: totalItems } = await supabase
      .from('scanned_items')
      .select('id', { count: 'exact' })
      .eq('user_id', userData.user.id);

    const achievements = [];
    if (totalItems && totalItems.length === 1) {
      // First scan achievement
      const { error: achievementError } = await supabase
        .from('user_achievements')
        .upsert({
          user_id: userData.user.id,
          achievement_type: 'first_scan',
          title: 'First Scan',
          description: 'Scanned your first item!',
          icon: '🔍'
        });
      
      if (!achievementError) {
        achievements.push({
          title: 'First Scan',
          description: 'Scanned your first item!',
          icon: '🔍'
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      product: {
        name: product.name,
        brand: product.brand,
        category: category?.name,
        carbonFootprint,
        barcode: product.barcode
      },
      achievements
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