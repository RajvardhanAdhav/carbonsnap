import { useState } from "react";
import { ArrowLeft, TrendingDown, TrendingUp, Target, Calendar, Zap, Award, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";

const DashboardPage = () => {
  const [timeframe, setTimeframe] = useState<"week" | "month" | "year">("month");

  const stats = {
    week: {
      total: 12.4,
      change: -15,
      goal: 15,
      scans: 23
    },
    month: {
      total: 52.8,
      change: -8,
      goal: 60,
      scans: 89
    },
    year: {
      total: 648.2,
      change: -12,
      goal: 700,
      scans: 1024
    }
  };

  const currentStats = stats[timeframe];
  const progressPercentage = Math.min((currentStats.total / currentStats.goal) * 100, 100);

  const categoryData = [
    { name: "Food & Beverages", emissions: 18.4, percentage: 35, color: "eco-primary" },
    { name: "Transportation", emissions: 14.2, percentage: 27, color: "carbon-high" },
    { name: "Clothing", emissions: 8.6, percentage: 16, color: "carbon-medium" },
    { name: "Electronics", emissions: 6.8, percentage: 13, color: "accent" },
    { name: "Other", emissions: 4.8, percentage: 9, color: "muted" }
  ];

  const weeklyData = [
    { day: "Mon", emissions: 1.8 },
    { day: "Tue", emissions: 2.4 },
    { day: "Wed", emissions: 1.2 },
    { day: "Thu", emissions: 3.1 },
    { day: "Fri", emissions: 2.6 },
    { day: "Sat", emissions: 0.9 },
    { day: "Sun", emissions: 1.4 }
  ];

  const maxEmissions = Math.max(...weeklyData.map(d => d.emissions));

  const achievements = [
    { title: "Eco Warrior", description: "Reduced emissions by 20%", icon: Award, unlocked: true },
    { title: "Scanner Pro", description: "100+ items scanned", icon: Zap, unlocked: true },
    { title: "Green Week", description: "7 days under target", icon: Target, unlocked: false }
  ];

  const tips = [
    "🥬 Plant-based meals can reduce food emissions by up to 70%",
    "🚲 Walking or cycling for short trips saves 2.6 kg CO₂ per mile",
    "♻️ Buying second-hand clothing reduces fashion emissions by 80%",
    "💡 LED bulbs use 75% less energy than traditional bulbs"
  ];

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