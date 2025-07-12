import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[DASHBOARD-DATA] ${step}${detailsStr}`);
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

    const userId = userData.user.id;
    logStep("User authenticated", { userId });

    // Get user profile with carbon goal
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('carbon_goal, full_name')
      .eq('id', userId)
      .single();

    // Calculate date ranges
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get weekly carbon data from receipts and scanned items
    const { data: weeklyReceipts } = await supabase
      .from('receipts')
      .select('total_carbon_footprint, created_at')
      .eq('user_id', userId)
      .gte('created_at', startOfWeek.toISOString())
      .eq('processed', true);

    const { data: weeklyScans } = await supabase
      .from('scanned_items')
      .select('carbon_footprint, scan_date')
      .eq('user_id', userId)
      .gte('scan_date', startOfWeek.toISOString());

    // Get monthly data
    const { data: monthlyReceipts } = await supabase
      .from('receipts')
      .select('total_carbon_footprint, created_at')
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString())
      .lte('created_at', endOfMonth.toISOString())
      .eq('processed', true);

    const { data: monthlyScans } = await supabase
      .from('scanned_items')
      .select('carbon_footprint, scan_date')
      .eq('user_id', userId)
      .gte('scan_date', startOfMonth.toISOString())
      .lte('scan_date', endOfMonth.toISOString());

    // Calculate totals
    const weeklyReceiptCarbon = weeklyReceipts?.reduce((sum, r) => sum + (r.total_carbon_footprint || 0), 0) || 0;
    const weeklyScanCarbon = weeklyScans?.reduce((sum, s) => sum + (s.carbon_footprint || 0), 0) || 0;
    const weeklyTotal = weeklyReceiptCarbon + weeklyScanCarbon;

    const monthlyReceiptCarbon = monthlyReceipts?.reduce((sum, r) => sum + (r.total_carbon_footprint || 0), 0) || 0;
    const monthlyScanCarbon = monthlyScans?.reduce((sum, s) => sum + (s.carbon_footprint || 0), 0) || 0;
    const monthlyTotal = monthlyReceiptCarbon + monthlyScanCarbon;

    // Get category breakdown
    const { data: receiptItems } = await supabase
      .from('receipt_items')
      .select(`
        carbon_footprint,
        carbon_categories!inner(name)
      `)
      .gte('created_at', startOfMonth.toISOString())
      .lte('created_at', endOfMonth.toISOString())
      .not('carbon_footprint', 'is', null);

    const { data: scannedItemsWithCategories } = await supabase
      .from('scanned_items')
      .select(`
        carbon_footprint,
        carbon_categories!inner(name)
      `)
      .eq('user_id', userId)
      .gte('scan_date', startOfMonth.toISOString())
      .lte('scan_date', endOfMonth.toISOString());

    // Combine and group by category
    const categoryData = {};
    
    receiptItems?.forEach(item => {
      const category = item.carbon_categories.name;
      categoryData[category] = (categoryData[category] || 0) + item.carbon_footprint;
    });

    scannedItemsWithCategories?.forEach(item => {
      const category = item.carbon_categories.name;
      categoryData[category] = (categoryData[category] || 0) + item.carbon_footprint;
    });

    const categoryBreakdown = Object.entries(categoryData)
      .map(([category, emissions]) => ({ category, emissions }))
      .sort((a, b) => b.emissions - a.emissions);

    // Get recent achievements
    const { data: achievements } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId)
      .order('earned_date', { ascending: false })
      .limit(5);

    // Generate weekly trend data (last 7 days)
    const weeklyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const dayReceipts = weeklyReceipts?.filter(r => {
        const receiptDate = new Date(r.created_at);
        return receiptDate >= dayStart && receiptDate <= dayEnd;
      }) || [];

      const dayScans = weeklyScans?.filter(s => {
        const scanDate = new Date(s.scan_date);
        return scanDate >= dayStart && scanDate <= dayEnd;
      }) || [];

      const dayTotal = dayReceipts.reduce((sum, r) => sum + (r.total_carbon_footprint || 0), 0) +
                     dayScans.reduce((sum, s) => sum + (s.carbon_footprint || 0), 0);

      weeklyTrend.push({
        date: date.toISOString().split('T')[0],
        emissions: dayTotal
      });
    }

    logStep("Dashboard data calculated", { 
      weeklyTotal, 
      monthlyTotal, 
      categoriesCount: categoryBreakdown.length 
    });

    return new Response(JSON.stringify({
      user: {
        name: profile?.full_name || 'User',
        carbonGoal: profile?.carbon_goal || 1000
      },
      weekly: {
        total: weeklyTotal,
        receipts: weeklyReceiptCarbon,
        scans: weeklyScanCarbon,
        trend: weeklyTrend
      },
      monthly: {
        total: monthlyTotal,
        receipts: monthlyReceiptCarbon,
        scans: monthlyScanCarbon,
        goal: profile?.carbon_goal || 1000,
        progress: Math.min(100, (monthlyTotal / (profile?.carbon_goal || 1000)) * 100)
      },
      categories: categoryBreakdown,
      achievements: achievements || [],
      insights: {
        topCategory: categoryBreakdown[0]?.category || 'No data yet',
        weeklyChange: weeklyTotal > 0 ? ((weeklyTotal - 50) / 50 * 100) : 0, // Mock comparison
        monthlyProjection: monthlyTotal * (30 / now.getDate())
      }
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