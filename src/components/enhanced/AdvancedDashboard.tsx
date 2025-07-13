import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { TrendingDown, TrendingUp, Target, Download, Share2, Lightbulb, Award, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface DashboardData {
  stats: {
    total: number;
    change: number;
    goal: number;
    scans: number;
    carbonSaved: number;
  };
  categories: Array<{
    name: string;
    emissions: number;
    percentage: number;
    color: string;
    count: number;
  }>;
  weeklyData: Array<{
    day: string;
    emissions: number;
    scans: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    emissions: number;
    goal: number;
  }>;
  topItems: Array<{
    name: string;
    emissions: number;
    category: string;
    suggestions: string[];
  }>;
}

interface AdvancedDashboardProps {
  timeframe: "week" | "month" | "year";
}

const COLORS = {
  high: '#ef4444',
  medium: '#f59e0b', 
  low: '#22c55e',
  eco: '#10b981'
};

export function AdvancedDashboard({ timeframe }: AdvancedDashboardProps) {
  const { user, session } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<'emissions' | 'scans'>('emissions');

  useEffect(() => {
    if (user && session?.access_token) {
      fetchEnhancedDashboardData();
    }
  }, [user, session, timeframe]);

  const fetchEnhancedDashboardData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('get-enhanced-dashboard-data', {
        body: { timeframe },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;
      setDashboardData(data.data);
    } catch (error) {
      console.error('Error fetching enhanced dashboard data:', error);
      // Fallback to mock data
      setDashboardData(getMockDashboardData());
    } finally {
      setLoading(false);
    }
  };

  const getMockDashboardData = (): DashboardData => ({
    stats: {
      total: 45.8,
      change: -12.5,
      goal: 60,
      scans: 127,
      carbonSaved: 18.3
    },
    categories: [
      { name: 'Meat & Dairy', emissions: 28.4, percentage: 62, color: COLORS.high, count: 23 },
      { name: 'Produce', emissions: 8.2, percentage: 18, color: COLORS.low, count: 45 },
      { name: 'Grains', emissions: 5.1, percentage: 11, color: COLORS.medium, count: 31 },
      { name: 'Beverages', emissions: 2.8, percentage: 6, color: COLORS.medium, count: 18 },
      { name: 'Other', emissions: 1.3, percentage: 3, color: COLORS.eco, count: 10 }
    ],
    weeklyData: [
      { day: 'Mon', emissions: 6.2, scans: 3 },
      { day: 'Tue', emissions: 8.1, scans: 5 },
      { day: 'Wed', emissions: 5.9, scans: 4 },
      { day: 'Thu', emissions: 7.3, scans: 6 },
      { day: 'Fri', emissions: 9.8, scans: 8 },
      { day: 'Sat', emissions: 4.2, scans: 7 },
      { day: 'Sun', emissions: 4.3, scans: 4 }
    ],
    monthlyTrend: [
      { month: 'Jan', emissions: 52.3, goal: 60 },
      { month: 'Feb', emissions: 48.7, goal: 60 },
      { month: 'Mar', emissions: 51.2, goal: 60 },
      { month: 'Apr', emissions: 45.8, goal: 60 }
    ],
    topItems: [
      { name: 'Ground Beef (1 lb)', emissions: 12.2, category: 'Meat', suggestions: ['Try plant-based alternatives', 'Consider chicken instead'] },
      { name: 'Cheese Block', emissions: 4.8, category: 'Dairy', suggestions: ['Look for plant-based cheese', 'Buy in smaller quantities'] },
      { name: 'Frozen Pizza', emissions: 3.2, category: 'Processed', suggestions: ['Make homemade pizza', 'Choose vegetarian options'] }
    ]
  });

  const exportData = async () => {
    if (!dashboardData) return;

    const csvData = [
      ['Category', 'Emissions (kg CO2e)', 'Percentage', 'Item Count'],
      ...dashboardData.categories.map(cat => [cat.name, cat.emissions, cat.percentage, cat.count])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carbon-footprint-${timeframe}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="h-4 bg-muted rounded w-1/4 mb-4"></div>
            <div className="h-32 bg-muted rounded"></div>
          </Card>
        ))}
      </div>
    );
  }

  if (!dashboardData) return null;

  const progressPercentage = Math.min((dashboardData.stats.total / dashboardData.stats.goal) * 100, 100);

  return (
    <div className="space-y-6">
      {/* Enhanced Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-eco opacity-10 rounded-full -translate-y-10 translate-x-10"></div>
          <div className="flex items-center justify-between relative">
            <div>
              <p className="text-sm text-muted-foreground">Total Emissions</p>
              <p className="text-2xl font-bold">{dashboardData.stats.total} kg</p>
              <p className="text-xs text-muted-foreground">CO₂ equivalent</p>
            </div>
            <div className={`flex items-center text-sm ${dashboardData.stats.change < 0 ? 'text-success' : 'text-destructive'}`}>
              {dashboardData.stats.change < 0 ? <TrendingDown className="h-4 w-4 mr-1" /> : <TrendingUp className="h-4 w-4 mr-1" />}
              {Math.abs(dashboardData.stats.change)}%
            </div>
          </div>
        </Card>

        <Card className="p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-eco-primary to-eco-secondary opacity-10 rounded-full -translate-y-10 translate-x-10"></div>
          <div className="space-y-2 relative">
            <div className="flex justify-between">
              <p className="text-sm text-muted-foreground">Goal Progress</p>
              <p className="text-sm text-eco-primary font-medium">{Math.round(progressPercentage)}%</p>
            </div>
            <Progress value={progressPercentage} className="h-3" />
            <p className="text-xs text-muted-foreground">
              {dashboardData.stats.total} / {dashboardData.stats.goal} kg target
            </p>
          </div>
        </Card>

        <Card className="p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-success opacity-10 rounded-full -translate-y-10 translate-x-10"></div>
          <div className="flex items-center justify-between relative">
            <div>
              <p className="text-sm text-muted-foreground">Carbon Saved</p>
              <p className="text-2xl font-bold text-success">{dashboardData.stats.carbonSaved} kg</p>
              <p className="text-xs text-muted-foreground">vs. last {timeframe}</p>
            </div>
            <Target className="h-8 w-8 text-success" />
          </div>
        </Card>

        <Card className="p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-primary opacity-10 rounded-full -translate-y-10 translate-x-10"></div>
          <div className="flex items-center justify-between relative">
            <div>
              <p className="text-sm text-muted-foreground">Items Scanned</p>
              <p className="text-2xl font-bold">{dashboardData.stats.scans}</p>
              <p className="text-xs text-muted-foreground">this {timeframe}</p>
            </div>
            <Zap className="h-8 w-8 text-primary" />
          </div>
        </Card>
      </div>

      {/* Export & Share */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={exportData}>
          <Download className="h-4 w-4 mr-2" />
          Export Data
        </Button>
        <Button variant="outline">
          <Share2 className="h-4 w-4 mr-2" />
          Share Report
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Enhanced Category Pie Chart */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Emissions by Category</h3>
          <div className="flex flex-col lg:flex-row items-center gap-4">
            <div className="w-64 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dashboardData.categories}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    paddingAngle={2}
                    dataKey="emissions"
                  >
                    {dashboardData.categories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`${value} kg CO₂e`, 'Emissions']}
                    labelFormatter={(label) => dashboardData.categories.find(c => c.emissions.toString() === label)?.name}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 flex-1">
              {dashboardData.categories.map((category, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: category.color }}
                  />
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{category.name}</span>
                      <Badge variant="outline">{category.count} items</Badge>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{category.emissions} kg CO₂e</span>
                      <span>{category.percentage}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Weekly/Monthly Trend Chart */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Trend Analysis</h3>
            <div className="flex gap-2">
              <Button
                variant={selectedMetric === 'emissions' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedMetric('emissions')}
              >
                Emissions
              </Button>
              <Button
                variant={selectedMetric === 'scans' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedMetric('scans')}
              >
                Scans
              </Button>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              {timeframe === 'month' || timeframe === 'year' ? (
                <LineChart data={dashboardData.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="emissions" 
                    stroke="hsl(var(--eco-primary))" 
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="goal" 
                    stroke="hsl(var(--muted-foreground))" 
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              ) : (
                <BarChart data={dashboardData.weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Bar 
                    dataKey={selectedMetric} 
                    fill="hsl(var(--eco-primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Top Impact Items with Suggestions */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="h-5 w-5 text-eco-primary" />
          <h3 className="text-lg font-semibold">Highest Impact Items & Suggestions</h3>
        </div>
        <div className="space-y-4">
          {dashboardData.topItems.map((item, index) => (
            <div key={index} className="p-4 bg-muted/30 rounded-lg border border-eco-primary/20">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-medium">{item.name}</h4>
                  <p className="text-sm text-muted-foreground">{item.category}</p>
                </div>
                <Badge variant="outline" className="text-destructive border-destructive">
                  {item.emissions} kg CO₂e
                </Badge>
              </div>
              <div className="space-y-1">
                {item.suggestions.map((suggestion, idx) => (
                  <p key={idx} className="text-sm text-eco-primary">• {suggestion}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}