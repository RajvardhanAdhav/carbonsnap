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
      // Show error state instead of mock data
      setDashboardData(null);
    } finally {
      setLoading(false);
    }
  };

  const getEmptyDashboardData = (): DashboardData => ({
    stats: {
      total: 0,
      change: 0,
      goal: 60,
      scans: 0,
      carbonSaved: 0
    },
    categories: [],
    weeklyData: [],
    monthlyTrend: [],
    topItems: []
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

  if (!dashboardData) {
    return (
      <div className="space-y-6">
        <Card className="p-8 text-center">
          <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
          <p className="text-muted-foreground">
            Start scanning items to see your carbon footprint analytics
          </p>
        </Card>
      </div>
    );
  }

  const progressPercentage = Math.min((dashboardData.stats.total / dashboardData.stats.goal) * 100, 100);

  return (
    <div className="space-y-6">
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