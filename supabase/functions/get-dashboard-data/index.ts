import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getDateRange(timeframe: 'week' | 'month' | 'year') {
  const now = new Date();
  const startDate = new Date();
  
  switch (timeframe) {
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(now.getMonth() - 1);
      break;
    case 'year':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
  }
  
  return { startDate: startDate.toISOString(), endDate: now.toISOString() };
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

    const url = new URL(req.url);
    const timeframe = url.searchParams.get('timeframe') as 'week' | 'month' | 'year' || 'month';

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
    
    if (authError || !user) {
      throw new Error('Authentication required');
    }

    console.log('Getting dashboard data for user:', user.id, 'timeframe:', timeframe);

    const { startDate, endDate } = getDateRange(timeframe);

    // Get user's scanned items for the timeframe
    const { data: scannedItems, error: itemsError } = await supabase
      .from('scanned_items')
      .select(`
        *,
        receipt_items (*)
      `)
      .eq('user_id', user.id)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });

    if (itemsError) {
      throw itemsError;
    }

    // Get user goals
    const { data: userGoals } = await supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Calculate statistics
    const totalEmissions = scannedItems.reduce((sum, item) => sum + Number(item.carbon_footprint), 0);
    const totalScans = scannedItems.length;
    
    // Get goal for timeframe
    const goals = userGoals || { weekly_goal: 15, monthly_goal: 60, yearly_goal: 700 };
    const goal = timeframe === 'week' ? goals.weekly_goal : 
                timeframe === 'month' ? goals.monthly_goal : goals.yearly_goal;

    // Calculate previous period for comparison
    const prevStartDate = new Date(startDate);
    const prevEndDate = new Date(startDate);
    
    if (timeframe === 'week') {
      prevStartDate.setDate(prevStartDate.getDate() - 7);
    } else if (timeframe === 'month') {
      prevStartDate.setMonth(prevStartDate.getMonth() - 1);
    } else {
      prevStartDate.setFullYear(prevStartDate.getFullYear() - 1);
    }

    const { data: prevItems } = await supabase
      .from('scanned_items')
      .select('carbon_footprint')
      .eq('user_id', user.id)
      .gte('created_at', prevStartDate.toISOString())
      .lt('created_at', startDate);

    const prevEmissions = prevItems?.reduce((sum, item) => sum + Number(item.carbon_footprint), 0) || 0;
    const change = prevEmissions > 0 ? ((totalEmissions - prevEmissions) / prevEmissions) * 100 : 0;

    // Calculate category breakdown
    const categoryData: Record<string, { emissions: number; count: number }> = {};
    
    scannedItems.forEach(item => {
      if (item.item_type === 'receipt' && item.receipt_items) {
        item.receipt_items.forEach((receiptItem: any) => {
          const category = receiptItem.category || 'Other';
          if (!categoryData[category]) {
            categoryData[category] = { emissions: 0, count: 0 };
          }
          categoryData[category].emissions += Number(receiptItem.carbon_footprint);
          categoryData[category].count += 1;
        });
      } else {
        const category = item.details?.category || 'Other';
        if (!categoryData[category]) {
          categoryData[category] = { emissions: 0, count: 0 };
        }
        categoryData[category].emissions += Number(item.carbon_footprint);
        categoryData[category].count += 1;
      }
    });

    // Format category data for frontend
    const categories = Object.entries(categoryData)
      .map(([name, data]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        emissions: Number(data.emissions.toFixed(1)),
        percentage: totalEmissions > 0 ? Math.round((data.emissions / totalEmissions) * 100) : 0,
        color: name === 'food' ? 'eco-primary' : 
               name === 'clothing' ? 'carbon-medium' :
               name === 'electronics' ? 'carbon-high' : 'muted'
      }))
      .sort((a, b) => b.emissions - a.emissions);

    // Calculate weekly breakdown (last 7 days)
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const dayItems = scannedItems.filter(item => {
        const itemDate = new Date(item.created_at);
        return itemDate >= dayStart && itemDate <= dayEnd;
      });

      const dayEmissions = dayItems.reduce((sum, item) => sum + Number(item.carbon_footprint), 0);
      
      weeklyData.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        emissions: Number(dayEmissions.toFixed(1))
      });
    }

    const responseData = {
      stats: {
        total: Number(totalEmissions.toFixed(1)),
        change: Number(change.toFixed(1)),
        goal: Number(goal),
        scans: totalScans
      },
      categories,
      weeklyData,
      recentItems: scannedItems.slice(0, 10).map(item => ({
        id: item.id,
        name: item.item_type === 'receipt' ? `${item.store_name} Receipt` : item.product_name,
        carbon: Number(item.carbon_footprint),
        category: item.carbon_category,
        date: item.created_at,
        type: item.item_type
      }))
    };

    console.log('Dashboard data calculated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        data: responseData
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error getting dashboard data:', error);
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