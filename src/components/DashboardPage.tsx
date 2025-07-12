import { useState, useEffect } from "react";
import { ArrowLeft, TrendingDown, TrendingUp, Target, Calendar, Zap, Award, Lightbulb, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const DashboardPage = () => {
  const { user, session } = useAuth();
  const [timeframe, setTimeframe] = useState<"week" | "month" | "year">("month");
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recentScans, setRecentScans] = useState<any[]>([]);

  useEffect(() => {
    if (user && session?.access_token) {
      fetchDashboardData();
      fetchRecentScans();
    }
  }, [user, session, timeframe]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('get-dashboard-data', {
        body: {},
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;
      setDashboardData(data.data);
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
      
      // Refresh data
      fetchDashboardData();
      fetchRecentScans();
    } catch (error) {
      console.error('Error deleting item:', error);
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
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-eco-primary mx-auto mb-4"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-14 flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="font-semibold">Dashboard</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Time Period Selector */}
        <div className="flex justify-center mb-8">
          <div className="flex rounded-lg bg-muted p-1">
            {(["week", "month", "year"] as const).map((period) => (
              <Button
                key={period}
                variant={timeframe === period ? "default" : "ghost"}
                size="sm"
                onClick={() => setTimeframe(period)}
                className={timeframe === period ? "bg-eco-primary hover:bg-eco-primary/90" : ""}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Emissions</p>
                <p className="text-2xl font-bold">{currentStats.total} kg</p>
                <p className="text-xs text-muted-foreground">CO₂ equivalent</p>
              </div>
              <div className={`flex items-center text-sm ${currentStats.change < 0 ? 'text-success' : 'text-destructive'}`}>
                {currentStats.change < 0 ? <TrendingDown className="h-4 w-4 mr-1" /> : <TrendingUp className="h-4 w-4 mr-1" />}
                {Math.abs(currentStats.change)}%
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <p className="text-sm text-muted-foreground">Goal Progress</p>
                <p className="text-sm text-eco-primary font-medium">{Math.round(progressPercentage)}%</p>
              </div>
              <Progress value={progressPercentage} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {currentStats.total} / {currentStats.goal} kg target
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Items Scanned</p>
                <p className="text-2xl font-bold">{currentStats.scans}</p>
              </div>
              <Calendar className="h-8 w-8 text-eco-primary" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Carbon Saved</p>
                <p className="text-2xl font-bold text-success">8.2 kg</p>
              </div>
              <Target className="h-8 w-8 text-success" />
            </div>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Weekly Emissions Chart */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Weekly Emissions</h3>
            <div className="space-y-3">
              {weeklyData.map((day, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-8">{day.day}</span>
                  <div className="flex-1 bg-muted rounded-full h-2 relative">
                    <div 
                      className="bg-gradient-eco h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(day.emissions / maxEmissions) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-12 text-right">
                    {day.emissions} kg
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Category Breakdown */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Emissions by Category</h3>
            <div className="space-y-4">
              {categoryData.map((category, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{category.name}</span>
                    <span className="text-sm text-muted-foreground">{category.emissions} kg</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className={`bg-${category.color} h-2 rounded-full transition-all duration-500`}
                      style={{ width: `${category.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
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

        {/* Recent Scans */}
        {recentScans.length > 0 && (
          <Card className="p-6 mt-8">
            <h3 className="text-lg font-semibold mb-4">Recent Scans</h3>
            <div className="space-y-3">
              {recentScans.map((scan) => (
                <div key={scan.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
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
                    className="text-destructive hover:text-destructive/90"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Action Button */}
        <div className="text-center mt-8">
          <Link to="/scanner">
            <Button size="lg" className="bg-gradient-eco hover:opacity-90 shadow-eco">
              <Zap className="mr-2 h-5 w-5" />
              Scan More Items
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;