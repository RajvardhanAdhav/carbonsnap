import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar, Target, Trophy, TrendingUp, TrendingDown, Award, Zap, Globe, Recycle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface ProductivityStats {
  totalScans: number;
  carbonSaved: number;
  streakDays: number;
  weeklyGoal: number;
  weeklyProgress: number;
  eco_score: number;
  impact_level: 'beginner' | 'eco-warrior' | 'planet-hero';
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: any;
  requirement: number;
  achieved: boolean;
  progress: number;
  category: 'scans' | 'reduction' | 'streak' | 'special';
}

export function ProductivityTracker() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ProductivityStats>({
    totalScans: 0,
    carbonSaved: 0,
    streakDays: 0,
    weeklyGoal: 15,
    weeklyProgress: 0,
    eco_score: 0,
    impact_level: 'beginner'
  });
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  const predefinedAchievements: Omit<Achievement, 'achieved' | 'progress'>[] = [
    {
      id: 'first_scan',
      title: 'First Steps',
      description: 'Complete your first scan',
      icon: Zap,
      requirement: 1,
      category: 'scans'
    },
    {
      id: 'scan_streak_7',
      title: 'Weekly Warrior',
      description: 'Scan items for 7 consecutive days',
      icon: Calendar,
      requirement: 7,
      category: 'streak'
    },
    {
      id: 'carbon_saver_10',
      title: 'Carbon Saver',
      description: 'Save 10kg of CO₂ emissions',
      icon: Globe,
      requirement: 10,
      category: 'reduction'
    },
    {
      id: 'eco_scanner_50',
      title: 'Eco Scanner',
      description: 'Complete 50 total scans',
      icon: Trophy,
      requirement: 50,
      category: 'scans'
    },
    {
      id: 'planet_protector_100',
      title: 'Planet Protector',
      description: 'Save 100kg of CO₂ emissions',
      icon: Award,
      requirement: 100,
      category: 'reduction'
    },
    {
      id: 'sustainability_champion',
      title: 'Sustainability Champion',
      description: 'Complete 100 total scans',
      icon: Recycle,
      requirement: 100,
      category: 'scans'
    }
  ];

  useEffect(() => {
    if (user) {
      fetchProductivityData();
    }
  }, [user]);

  const fetchProductivityData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch recent scans for analytics
      const { data: scans, error: scansError } = await supabase
        .from('scanned_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (scansError) throw scansError;

      // Calculate statistics
      const totalScans = scans?.length || 0;
      const totalCarbon = scans?.reduce((sum, scan) => sum + (scan.carbon_footprint || 0), 0) || 0;
      
      // Calculate carbon saved (estimate based on alternatives)
      const carbonSaved = scans?.reduce((sum, scan) => {
        // Estimate savings based on choosing eco-friendly alternatives
        if (scan.carbon_category === 'high') return sum + (scan.carbon_footprint * 0.7);
        if (scan.carbon_category === 'medium') return sum + (scan.carbon_footprint * 0.4);
        return sum + (scan.carbon_footprint * 0.1);
      }, 0) || 0;

      // Calculate weekly progress
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const weeklyScans = scans?.filter(scan => 
        new Date(scan.created_at) >= oneWeekAgo
      ) || [];

      // Calculate streak days (simplified)
      const streakDays = calculateStreakDays(scans || []);

      // Calculate eco score
      const ecoScore = Math.min(100, Math.round(
        (totalScans * 2) + 
        (carbonSaved * 0.5) + 
        (streakDays * 5)
      ));

      // Determine impact level
      let impactLevel: 'beginner' | 'eco-warrior' | 'planet-hero' = 'beginner';
      if (ecoScore >= 80) impactLevel = 'planet-hero';
      else if (ecoScore >= 40) impactLevel = 'eco-warrior';

      setStats({
        totalScans,
        carbonSaved: Math.round(carbonSaved * 100) / 100,
        streakDays,
        weeklyGoal: 15, // Could be user-configurable
        weeklyProgress: weeklyScans.length,
        eco_score: ecoScore,
        impact_level: impactLevel
      });

      // Calculate achievements
      const calculatedAchievements = predefinedAchievements.map(achievement => {
        let progress = 0;
        let achieved = false;

        switch (achievement.category) {
          case 'scans':
            progress = totalScans;
            achieved = totalScans >= achievement.requirement;
            break;
          case 'reduction':
            progress = carbonSaved;
            achieved = carbonSaved >= achievement.requirement;
            break;
          case 'streak':
            progress = streakDays;
            achieved = streakDays >= achievement.requirement;
            break;
        }

        return {
          ...achievement,
          achieved,
          progress: Math.min(100, (progress / achievement.requirement) * 100)
        };
      });

      setAchievements(calculatedAchievements);

    } catch (error) {
      console.error('Error fetching productivity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStreakDays = (scans: any[]) => {
    if (!scans.length) return 0;

    // Group scans by date
    const scanDates = [...new Set(scans.map(scan => 
      new Date(scan.created_at).toDateString()
    ))].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    let streak = 0;
    const today = new Date().toDateString();
    
    for (let i = 0; i < scanDates.length; i++) {
      const currentDate = new Date(scanDates[i]);
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - i);
      
      if (currentDate.toDateString() === expectedDate.toDateString()) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  };

  const getImpactLevelColor = (level: string) => {
    switch (level) {
      case 'planet-hero': return 'bg-gradient-to-r from-purple-500 to-pink-500 text-white';
      case 'eco-warrior': return 'bg-gradient-to-r from-green-500 to-blue-500 text-white';
      default: return 'bg-gradient-to-r from-gray-400 to-gray-600 text-white';
    }
  };

  const getImpactLevelTitle = (level: string) => {
    switch (level) {
      case 'planet-hero': return '🌟 Planet Hero';
      case 'eco-warrior': return '🛡️ Eco Warrior';
      default: return '🌱 Eco Beginner';
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-1/4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-muted rounded"></div>
            <div className="h-3 bg-muted rounded w-5/6"></div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Impact Level & Eco Score */}
      <Card className="p-6">
        <div className="text-center space-y-4">
          <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${getImpactLevelColor(stats.impact_level)}`}>
            {getImpactLevelTitle(stats.impact_level)}
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Eco Score</span>
              <span className="font-medium">{stats.eco_score}/100</span>
            </div>
            <Progress value={stats.eco_score} className="h-3" />
          </div>
        </div>
      </Card>

      {/* Key Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-eco-primary">{stats.totalScans}</div>
          <div className="text-xs text-muted-foreground">Total Scans</div>
        </Card>
        
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-success">{stats.carbonSaved}kg</div>
          <div className="text-xs text-muted-foreground">CO₂ Saved</div>
        </Card>
        
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-orange-500">{stats.streakDays}</div>
          <div className="text-xs text-muted-foreground">Day Streak</div>
        </Card>
        
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-purple-500">{stats.weeklyProgress}/{stats.weeklyGoal}</div>
          <div className="text-xs text-muted-foreground">Weekly Goal</div>
        </Card>
      </div>

      {/* Weekly Progress */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-eco-primary" />
            <h3 className="font-semibold">Weekly Progress</h3>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>This Week's Scans</span>
              <span>{stats.weeklyProgress} / {stats.weeklyGoal}</span>
            </div>
            <Progress 
              value={(stats.weeklyProgress / stats.weeklyGoal) * 100} 
              className="h-2" 
            />
            {stats.weeklyProgress >= stats.weeklyGoal && (
              <div className="flex items-center gap-1 text-sm text-success">
                <Trophy className="h-4 w-4" />
                Weekly goal achieved! 🎉
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Achievements */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-eco-primary" />
            <h3 className="font-semibold">Achievements</h3>
          </div>
          
          <div className="grid gap-3">
            {achievements.map((achievement) => (
              <div 
                key={achievement.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  achievement.achieved 
                    ? 'bg-eco-light/30 border-eco-primary/30' 
                    : 'bg-muted/30 border-muted'
                }`}
              >
                <div className={`p-2 rounded-full ${
                  achievement.achieved 
                    ? 'bg-eco-primary text-white' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  <achievement.icon className="h-4 w-4" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`font-medium ${
                      achievement.achieved ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                      {achievement.title}
                    </p>
                    {achievement.achieved && (
                      <Badge variant="outline" className="text-eco-primary border-eco-primary text-xs">
                        ✓
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{achievement.description}</p>
                  
                  {!achievement.achieved && (
                    <div className="mt-2">
                      <Progress value={achievement.progress} className="h-1" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {Math.round(achievement.progress)}% complete
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}