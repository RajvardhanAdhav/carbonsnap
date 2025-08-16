import { useState, useEffect } from "react";
import { ArrowLeft, TrendingDown, TrendingUp, Target, Calendar, Zap, Award, Lightbulb, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AdvancedDashboard } from "@/components/enhanced/AdvancedDashboard";


const DashboardPage = () => {
  const { user, session } = useAuth();
  const [timeframe, setTimeframe] = useState<"week" | "month" | "year">("month");
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [aiRecommendations, setAiRecommendations] = useState<any[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    if (user && session?.access_token) {
      fetchDashboardData();
      fetchRecentScans();
    }
  }, [user, session, timeframe]);

  // Fetch AI recommendations when recent scans change
  useEffect(() => {
    if (recentScans.length > 0 && user && session?.access_token) {
      fetchAIRecommendations();
    } else {
      setAiRecommendations([]);
    }
  }, [recentScans, user, session]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Try enhanced dashboard first, fallback to basic
      const { data, error } = await supabase.functions.invoke('get-enhanced-dashboard-data', {
        body: { timeframe },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) {
        // Fallback to basic dashboard
        const { data: basicData, error: basicError } = await supabase.functions.invoke('get-dashboard-data', {
          body: {},
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        });
        if (basicError) throw basicError;
        setDashboardData(basicData.data);
      } else {
        setDashboardData(data.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentScans = async () => {
    try {
      const { data, error } = await supabase
        .from('scanned_items')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentScans(data || []);
    } catch (error) {
      console.error('Error fetching recent scans:', error);
    }
  };

  const deleteScannedItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('scanned_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      
      // Remove the recommendation associated with this scan
      setAiRecommendations(prev => prev.filter(rec => rec.scan_id !== itemId));
      
      // Refresh data
      fetchDashboardData();
      fetchRecentScans();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const clearAllScans = async () => {
    try {
      const { error } = await supabase
        .from('scanned_items')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all user's items

      if (error) throw error;
      
      // Clear all recommendations
      setAiRecommendations([]);
      
      // Refresh data
      fetchDashboardData();
      fetchRecentScans();
    } catch (error) {
      console.error('Error clearing all scans:', error);
    }
  };

  const fetchAIRecommendations = async () => {
    if (recentScans.length === 0) {
      setAiRecommendations([]);
      return;
    }

    try {
      setLoadingRecommendations(true);
      const { data, error } = await supabase.functions.invoke('ai-carbon-recommendations', {
        body: { 
          timeframe,
          recent_scans: recentScans.map(scan => ({
            id: scan.id,
            item_type: scan.item_type,
            product_name: scan.product_name,
            store_name: scan.store_name,
            carbon_footprint: scan.carbon_footprint,
            carbon_category: scan.carbon_category,
            created_at: scan.created_at,
            details: scan.details
          }))
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;
      
      // Ensure recommendations are tied to specific scans
      const recommendations = (data.recommendations || []).map((rec: any, index: number) => ({
        ...rec,
        scan_id: recentScans[index % recentScans.length]?.id // Associate with a scan
      }));
      
      setAiRecommendations(recommendations);
    } catch (error) {
      console.error('Error fetching AI recommendations:', error);
      // Fallback recommendations tied to current scans
      const fallbackRecs = recentScans.slice(0, 3).map((scan, index) => ({
        scan_id: scan.id,
        category: scan.carbon_category === 'high' ? "High Emission Item" : "Optimization",
        impact: scan.carbon_footprint > 10 ? "High" : scan.carbon_footprint > 5 ? "Medium" : "Low",
        suggestion: scan.carbon_footprint > 10 
          ? `Consider alternatives to ${scan.product_name || scan.store_name} to reduce high emissions`
          : `Look for eco-friendly alternatives to ${scan.product_name || scan.store_name}`,
        potential_savings: `${Math.round(scan.carbon_footprint * 0.3)}-${Math.round(scan.carbon_footprint * 0.7)} kg CO₂/month`
      }));
      setAiRecommendations(fallbackRecs);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  // Use real data if available, fallback to loading or empty state
  const currentStats = dashboardData?.stats || { total: 0, change: 0, goal: 60, scans: 0 };
  const progressPercentage = Math.min((currentStats.total / currentStats.goal) * 100, 100);
  const categoryData = dashboardData?.categories || [];
  const weeklyData = dashboardData?.weeklyData || [];
  const maxEmissions = weeklyData.length > 0 ? Math.max(...weeklyData.map(d => d.emissions)) : 1;

  const achievements = [
    { title: "Eco Warrior", description: "Reduced emissions by 20%", icon: Award, unlocked: currentStats.change < 0 },
    { title: "Scanner Pro", description: "100+ items scanned", icon: Zap, unlocked: currentStats.scans >= 100 },
    { title: "Green Week", description: "7 days under target", icon: Target, unlocked: false }
  ];

  const tips = [
    "🥬 Plant-based meals can reduce food emissions by up to 70%",
    "🚲 Walking or cycling for short trips saves 2.6 kg CO₂ per mile",
    "♻️ Buying second-hand clothing reduces fashion emissions by 80%",
    "💡 LED bulbs use 75% less energy than traditional bulbs"
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-eco-primary/20 border-t-eco-primary mx-auto mb-4"></div>
            <div className="animate-ping absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-eco-primary rounded-full opacity-75"></div>
          </div>
          <p className="text-lg font-medium animate-pulse">Loading your dashboard...</p>
          <p className="text-sm text-muted-foreground mt-2">Analyzing your carbon footprint</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background animate-fade-in">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-300">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm" className="hover-scale transition-all duration-200">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="font-semibold">Dashboard</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-6xl">{/* Time Period Selector */}
        {/* Time Period Selector */}
        <div className="flex justify-center mb-8 animate-scale-in">
          <div className="flex rounded-lg bg-muted p-1 transition-all duration-300 hover:shadow-lg">
            {(["week", "month", "year"] as const).map((period) => (
              <Button
                key={period}
                variant={timeframe === period ? "default" : "ghost"}
                size="sm"
                onClick={() => setTimeframe(period)}
                className={`transition-all duration-300 transform hover:scale-105 ${
                  timeframe === period 
                    ? "bg-eco-primary hover:bg-eco-primary/90 shadow-md" 
                    : "hover:bg-muted-foreground/10"
                }`}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 hover-scale transition-all duration-300 hover:shadow-lg animate-fade-in" style={{animationDelay: '0.1s'}}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Emissions</p>
                <p className="text-2xl font-bold transition-all duration-500">{currentStats.total} kg</p>
                <p className="text-xs text-muted-foreground">CO₂ equivalent</p>
              </div>
              <div className={`flex items-center text-sm transition-all duration-300 ${
                currentStats.change < 0 ? 'text-success' : 'text-destructive'
              }`}>
                {currentStats.change < 0 ? 
                  <TrendingDown className="h-4 w-4 mr-1 animate-bounce" /> : 
                  <TrendingUp className="h-4 w-4 mr-1 animate-bounce" />
                }
                <span className="font-medium">{Math.abs(currentStats.change)}%</span>
              </div>
            </div>
          </Card>

          <Card className="p-6 hover-scale transition-all duration-300 hover:shadow-lg animate-fade-in" style={{animationDelay: '0.2s'}}>
            <div className="space-y-2">
              <div className="flex justify-between">
                <p className="text-sm text-muted-foreground">Goal Progress</p>
                <p className="text-sm text-eco-primary font-medium transition-all duration-300">{Math.round(progressPercentage)}%</p>
              </div>
              <Progress 
                value={progressPercentage} 
                className="h-2 transition-all duration-1000 ease-out" 
              />
              <p className="text-xs text-muted-foreground">
                {currentStats.total} / {currentStats.goal} kg target
              </p>
            </div>
          </Card>

          <Card className="p-6 hover-scale transition-all duration-300 hover:shadow-lg animate-fade-in" style={{animationDelay: '0.3s'}}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Items Scanned</p>
                <p className="text-2xl font-bold transition-all duration-500">{currentStats.scans}</p>
              </div>
              <Calendar className="h-8 w-8 text-eco-primary transition-transform duration-300 hover:scale-110" />
            </div>
          </Card>

          <Card className="p-6 hover-scale transition-all duration-300 hover:shadow-lg animate-fade-in" style={{animationDelay: '0.4s'}}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Carbon Saved</p>
                <p className="text-2xl font-bold text-success transition-all duration-500">8.2 kg</p>
              </div>
              <Target className="h-8 w-8 text-success transition-transform duration-300 hover:scale-110" />
            </div>
          </Card>
        </div>

        {/* Enhanced Dashboard */}
        <div className="animate-fade-in" style={{animationDelay: '0.5s'}}>
          <AdvancedDashboard timeframe={timeframe} />
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Achievements */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Achievements</h3>
            <div className="space-y-4">
              {achievements.map((achievement, index) => (
                <div key={index} className={`flex items-center gap-3 p-3 rounded-lg ${achievement.unlocked ? 'bg-eco-light/50' : 'bg-muted/50'}`}>
                  <div className={`p-2 rounded-full ${achievement.unlocked ? 'bg-eco-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                    <achievement.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${achievement.unlocked ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {achievement.title}
                    </p>
                    <p className="text-sm text-muted-foreground">{achievement.description}</p>
                  </div>
                  {achievement.unlocked && (
                    <Badge variant="outline" className="text-eco-primary border-eco-primary">
                      Unlocked
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Eco Tips */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="h-5 w-5 text-eco-primary" />
              <h3 className="text-lg font-semibold">Eco Tips</h3>
            </div>
            <div className="space-y-3">
              {tips.map((tip, index) => (
                <div key={index} className="p-3 bg-eco-light/30 rounded-lg border border-eco-primary/20">
                  <p className="text-sm">{tip}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mt-8 animate-fade-in" style={{animationDelay: '0.6s'}}>
          {/* AI Recommendations */}
          <Card className="p-6 hover-scale transition-all duration-300 hover:shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-eco-primary animate-pulse" />
              <h3 className="text-lg font-semibold">AI Carbon Reduction Recommendations</h3>
            </div>
            {loadingRecommendations ? (
              <div className="space-y-3">
                <div className="animate-pulse space-y-3">
                  <div className="h-16 bg-gradient-to-r from-muted via-muted/50 to-muted rounded-lg animate-fade-in"></div>
                  <div className="h-16 bg-gradient-to-r from-muted via-muted/50 to-muted rounded-lg animate-fade-in" style={{animationDelay: '0.2s'}}></div>
                  <div className="h-16 bg-gradient-to-r from-muted via-muted/50 to-muted rounded-lg animate-fade-in" style={{animationDelay: '0.4s'}}></div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {aiRecommendations.map((rec, index) => (
                  <div 
                    key={index} 
                    className="p-4 bg-gradient-eco/10 border border-eco-primary/20 rounded-lg hover-scale transition-all duration-300 hover:shadow-md animate-fade-in" 
                    style={{animationDelay: `${index * 0.1}s`}}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`${
                          rec.impact === 'High' ? 'border-red-400 text-red-600' :
                          rec.impact === 'Medium' ? 'border-yellow-400 text-yellow-600' :
                          'border-green-400 text-green-600'
                        }`}>
                          {rec.impact} Impact
                        </Badge>
                        <span className="text-sm font-medium text-eco-primary">{rec.category}</span>
                      </div>
                    </div>
                    <p className="text-sm mb-2">{rec.suggestion}</p>
                    <p className="text-xs text-eco-primary font-medium">
                      Potential savings: {rec.potential_savings}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent Scans */}
          <Card className="p-6 hover-scale transition-all duration-300 hover:shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Recent Scans</h3>
              {recentScans.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllScans}
                  className="text-destructive hover:text-destructive/90 border-destructive/30 hover-scale transition-all duration-200"
                >
                  <X className="h-4 w-4 mr-1 transition-transform duration-200 hover:rotate-90" />
                  Clear All
                </Button>
              )}
            </div>
            {recentScans.length > 0 ? (
              <div className="space-y-3">
                {recentScans.map((scan, index) => (
                  <div 
                    key={scan.id} 
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover-scale transition-all duration-300 hover:bg-muted/70 animate-fade-in"
                    style={{animationDelay: `${index * 0.1}s`}}
                  >
                    <div className="flex-1">
                      <p className="font-medium">
                        {scan.item_type === 'receipt' ? scan.store_name : scan.product_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {scan.carbon_footprint} kg CO₂ • {new Date(scan.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteScannedItem(scan.id)}
                      className="text-destructive hover:text-destructive/90 hover-scale transition-all duration-200"
                    >
                      <Trash2 className="h-4 w-4 transition-transform duration-200 hover:scale-110" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground animate-fade-in">
                <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50 animate-pulse" />
                <p className="font-medium">No recent scans</p>
                <p className="text-sm">Start scanning to see your carbon footprint data</p>
              </div>
            )}
          </Card>
        </div>

        {/* Action Button */}
        <div className="text-center mt-8 animate-fade-in" style={{animationDelay: '0.8s'}}>
          <Link to="/scanner">
            <Button 
              size="lg" 
              className="bg-gradient-eco hover:opacity-90 shadow-eco hover-scale transition-all duration-300 hover:shadow-xl transform hover:-translate-y-1"
            >
              <Zap className="mr-2 h-5 w-5 animate-pulse" />
              Scan More Items
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;