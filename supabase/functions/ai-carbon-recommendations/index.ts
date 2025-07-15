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

    const { timeframe = 'month' } = await req.json();

    console.log('Generating AI recommendations for user:', user.id, 'timeframe:', timeframe);

    // Fetch user's recent scan data for analysis
    const { data: scannedItems, error: scanError } = await supabase
      .from('scanned_items')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (scanError) throw scanError;

    // Fetch user goals
    const { data: userGoals } = await supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', user.id)
      .single();

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
      recent_items: scannedItems?.slice(0, 10).map(item => ({
        type: item.item_type,
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
As an expert carbon footprint analyst, analyze this user's data and provide highly personalized, actionable recommendations to reduce their carbon footprint.

User Profile:
- Timeframe: ${userProfile.timeframe}
- Total items scanned: ${userProfile.total_items}
- Total emissions: ${userProfile.total_emissions.toFixed(2)} kg CO₂
- Average emissions per item: ${userProfile.average_daily_emissions.toFixed(2)} kg CO₂
- Carbon categories breakdown: ${JSON.stringify(userProfile.categories)}
- Goals: Weekly ${userProfile.goals.weekly}kg, Monthly ${userProfile.goals.monthly}kg, Yearly ${userProfile.goals.yearly}kg
- Recent items: ${JSON.stringify(userProfile.recent_items)}

Provide 4-6 highly specific, actionable recommendations in JSON format with this structure:
{
  "recommendations": [
    {
      "category": "Transportation/Food/Energy/Shopping/etc",
      "impact": "High/Medium/Low",
      "suggestion": "Specific, actionable advice based on their actual data",
      "potential_savings": "X-Y kg CO₂/month",
      "difficulty": "Easy/Medium/Hard",
      "timeline": "Immediate/1 week/1 month"
    }
  ]
}

Focus on:
1. Their biggest emission sources based on actual data
2. Quick wins vs long-term changes
3. Specific numbers and realistic savings
4. Personal relevance to their scanning patterns
5. Progressive difficulty levels
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
            content: 'You are a world-class carbon footprint reduction expert. Provide precise, data-driven, actionable recommendations based on user behavior patterns.'
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
      recommendations = parsed.recommendations;
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