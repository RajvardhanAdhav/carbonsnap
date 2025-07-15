import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);

    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    const { timeframe = 'month', recent_scans = [] } = await req.json();

    console.log('Generating AI recommendations for user:', user.id, 'timeframe:', timeframe, 'recent scans:', recent_scans.length);

    // Use the recent_scans data directly if provided, otherwise fetch from database
    let scannedItems = recent_scans;
    
    if (!recent_scans || recent_scans.length === 0) {
      console.log('No recent scans provided, fetching from database');
      const { data: dbItems, error: scanError } = await supabase
        .from('scanned_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (scanError) throw scanError;
      scannedItems = dbItems || [];
    }

    // Fetch user goals
    const { data: userGoals } = await supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    // If no recent scans, return empty recommendations
    if (!scannedItems || scannedItems.length === 0) {
      console.log('No scanned items found, returning empty recommendations');
      return new Response(JSON.stringify({ 
        recommendations: [],
        message: "No recent scans to analyze. Start scanning items to get personalized recommendations!"
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Prepare data for AI analysis
    const userProfile = {
      timeframe,
      total_items: scannedItems?.length || 0,
      total_emissions: scannedItems?.reduce((sum, item) => sum + (item.carbon_footprint || 0), 0) || 0,
      average_daily_emissions: scannedItems?.length ? 
        (scannedItems.reduce((sum, item) => sum + (item.carbon_footprint || 0), 0) / scannedItems.length) : 0,
      categories: scannedItems?.reduce((acc, item) => {
        const category = item.carbon_category || 'unknown';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {},
      goals: {
        weekly: userGoals?.weekly_goal || 15,
        monthly: userGoals?.monthly_goal || 60,
        yearly: userGoals?.yearly_goal || 700
      },
      recent_items: scannedItems?.map(item => ({
        id: item.id,
        type: item.item_type,
        name: item.product_name || item.store_name,
        emissions: item.carbon_footprint,
        category: item.carbon_category,
        date: item.created_at
      })) || []
    };

    // Use OpenAI GPT-4.1 for advanced recommendations
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      console.log('OpenAI API key not found, using fallback recommendations');
      return generateFallbackRecommendations(userProfile);
    }

    const prompt = `
Analyze the user's ACTUAL scanned items and provide specific recommendations for their current shopping/consumption patterns.

User Profile:
- Current recent scans: ${userProfile.recent_items.length} items
- Total emissions from recent scans: ${userProfile.total_emissions.toFixed(2)} kg CO₂
- Average emissions per item: ${userProfile.average_daily_emissions.toFixed(2)} kg CO₂
- Carbon categories breakdown: ${JSON.stringify(userProfile.categories)}
- Goals: Weekly ${userProfile.goals.weekly}kg, Monthly ${userProfile.goals.monthly}kg, Yearly ${userProfile.goals.yearly}kg

SPECIFIC ITEMS TO ANALYZE:
${userProfile.recent_items.map((item, index) => 
  `${index + 1}. ${item.name} (${item.emissions}kg CO₂, ${item.category} category, scanned ${new Date(item.date).toLocaleDateString()})`
).join('\n')}

Provide ${Math.min(userProfile.recent_items.length, 4)} specific recommendations based on these EXACT items in JSON format:
{
  "recommendations": [
    {
      "scan_id": "use the actual item.id from the scanned items",
      "item_name": "specific item name from the scan",
      "category": "Transportation/Food/Energy/Shopping/etc",
      "impact": "High/Medium/Low",
      "suggestion": "Specific advice for THIS exact item the user scanned",
      "potential_savings": "X-Y kg CO₂/month",
      "difficulty": "Easy/Medium/Hard",
      "timeline": "Immediate/1 week/1 month"
    }
  ]
}

Focus on:
1. Each specific item they scanned and alternatives for that exact item
2. Realistic substitutions based on their shopping patterns
3. Specific numbers and realistic savings per item
4. Easy first steps vs longer-term changes
5. Make sure each recommendation has the corresponding scan_id
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: 'You are a world-class carbon footprint reduction expert. Provide precise, item-specific recommendations based on the user\'s actual scanned items. Each recommendation must include the scan_id of the specific item it relates to.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status, await response.text());
      return generateFallbackRecommendations(userProfile);
    }

    const aiResponse = await response.json();
    let recommendations;

    try {
      const content = aiResponse.choices[0].message.content;
      const parsed = JSON.parse(content);
      recommendations = parsed.recommendations.map((rec: any) => ({
        ...rec,
        scan_id: rec.scan_id || userProfile.recent_items[0]?.id // Ensure scan_id is present
      }));
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      return generateFallbackRecommendations(userProfile);
    }

    console.log('Generated AI recommendations:', recommendations);

    return new Response(JSON.stringify({ 
      recommendations,
      user_profile: userProfile,
      ai_powered: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-carbon-recommendations function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      recommendations: getFallbackRecommendations()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateFallbackRecommendations(userProfile: any) {
  const recommendations = getFallbackRecommendations();
  
  return new Response(JSON.stringify({ 
    recommendations,
    user_profile: userProfile,
    ai_powered: false
  }), {
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
  });
}

function getFallbackRecommendations() {
  return [
    {
      category: "Transportation",
      impact: "High",
      suggestion: "Walk or cycle for trips under 3 miles instead of driving. Each mile saves 2.6 kg CO₂",
      potential_savings: "15-25 kg CO₂/month",
      difficulty: "Easy",
      timeline: "Immediate"
    },
    {
      category: "Food",
      impact: "High",
      suggestion: "Replace 3 meat meals per week with plant-based alternatives. Plant proteins emit 70% less CO₂",
      potential_savings: "8-15 kg CO₂/month",
      difficulty: "Medium",
      timeline: "1 week"
    },
    {
      category: "Energy",
      impact: "Medium",
      suggestion: "Switch to LED bulbs and unplug devices when not in use. LEDs use 75% less energy",
      potential_savings: "5-8 kg CO₂/month",
      difficulty: "Easy",
      timeline: "Immediate"
    },
    {
      category: "Shopping",
      impact: "Medium",
      suggestion: "Buy second-hand clothing and electronics when possible. Reduces manufacturing emissions by 80%",
      potential_savings: "3-6 kg CO₂/month",
      difficulty: "Easy",
      timeline: "Immediate"
    }
  ];
}