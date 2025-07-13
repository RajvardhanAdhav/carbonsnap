import { useState, useEffect } from "react";
import { Lightbulb, TrendingDown, Leaf, Zap, Target, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface ReceiptItem {
  name: string;
  category: string;
  emissions: number;
  alternatives?: string[];
}

interface ReductionTip {
  id: string;
  title: string;
  description: string;
  type: 'substitution' | 'behavior' | 'purchase' | 'seasonal';
  impact: 'high' | 'medium' | 'low';
  savingsPotential: number; // kg CO2e
  difficulty: 'easy' | 'moderate' | 'challenging';
  targetItems: string[];
  icon: any;
  actionText: string;
  learnMoreUrl?: string;
}

interface ReductionTipsEngineProps {
  items: ReceiptItem[];
  totalEmissions: number;
  onTipSelect?: (tip: ReductionTip) => void;
}

export function ReductionTipsEngine({ items, totalEmissions, onTipSelect }: ReductionTipsEngineProps) {
  const [personalizedTips, setPersonalizedTips] = useState<ReductionTip[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [totalSavingsPotential, setTotalSavingsPotential] = useState<number>(0);

  useEffect(() => {
    generatePersonalizedTips();
  }, [items]);

  const generatePersonalizedTips = () => {
    const tips: ReductionTip[] = [];
    let totalSavings = 0;

    // Analyze high-emission items
    const highEmissionItems = items.filter(item => item.emissions > totalEmissions * 0.2);
    
    highEmissionItems.forEach(item => {
      const itemTips = getItemSpecificTips(item);
      tips.push(...itemTips);
      totalSavings += itemTips.reduce((sum, tip) => sum + tip.savingsPotential, 0);
    });

    // Add general behavior tips
    const behaviorTips = getGeneralBehaviorTips(items);
    tips.push(...behaviorTips);
    totalSavings += behaviorTips.reduce((sum, tip) => sum + tip.savingsPotential, 0);

    // Add seasonal tips
    const seasonalTips = getSeasonalTips();
    tips.push(...seasonalTips);
    totalSavings += seasonalTips.reduce((sum, tip) => sum + tip.savingsPotential, 0);

    // Sort by impact and relevance
    tips.sort((a, b) => {
      const impactOrder = { high: 3, medium: 2, low: 1 };
      return impactOrder[b.impact] - impactOrder[a.impact];
    });

    setPersonalizedTips(tips.slice(0, 8)); // Limit to top 8 tips
    setTotalSavingsPotential(totalSavings);
  };

  const getItemSpecificTips = (item: ReceiptItem): ReductionTip[] => {
    const tips: ReductionTip[] = [];

    switch (item.category.toLowerCase()) {
      case 'beef':
        tips.push({
          id: `beef-alt-${item.name}`,
          title: 'Try Plant-Based Alternatives',
          description: `Replace ${item.name} with plant-based alternatives to reduce emissions by up to 90%`,
          type: 'substitution',
          impact: 'high',
          savingsPotential: item.emissions * 0.9,
          difficulty: 'easy',
          targetItems: [item.name],
          icon: Leaf,
          actionText: 'Find Alternatives',
          learnMoreUrl: 'https://example.com/plant-based-meat'
        });
        break;

      case 'dairy':
        tips.push({
          id: `dairy-alt-${item.name}`,
          title: 'Switch to Plant Milk',
          description: `Plant-based milk alternatives can reduce your dairy emissions by 70%`,
          type: 'substitution',
          impact: 'medium',
          savingsPotential: item.emissions * 0.7,
          difficulty: 'easy',
          targetItems: [item.name],
          icon: Leaf,
          actionText: 'Try Plant Milk'
        });
        break;

      case 'imported':
        tips.push({
          id: `local-alt-${item.name}`,
          title: 'Choose Local Alternatives',
          description: `Locally sourced ${item.category} can reduce transport emissions by up to 50%`,
          type: 'purchase',
          impact: 'medium',
          savingsPotential: item.emissions * 0.3,
          difficulty: 'moderate',
          targetItems: [item.name],
          icon: Target,
          actionText: 'Find Local Options'
        });
        break;
    }

    return tips;
  };

  const getGeneralBehaviorTips = (items: ReceiptItem[]): ReductionTip[] => {
    const tips: ReductionTip[] = [];
    const categories = Array.from(new Set(items.map(item => item.category)));

    if (categories.includes('meat')) {
      tips.push({
        id: 'meatless-monday',
        title: 'Try Meatless Monday',
        description: 'Going meat-free one day per week can save 1.6 kg CO₂e weekly',
        type: 'behavior',
        impact: 'medium',
        savingsPotential: 6.4, // Monthly savings
        difficulty: 'easy',
        targetItems: [],
        icon: TrendingDown,
        actionText: 'Start Today'
      });
    }

    if (items.length > 10) {
      tips.push({
        id: 'meal-planning',
        title: 'Plan Your Meals',
        description: 'Meal planning reduces food waste and unnecessary purchases by 25%',
        type: 'behavior',
        impact: 'medium',
        savingsPotential: totalEmissions * 0.25,
        difficulty: 'moderate',
        targetItems: [],
        icon: Target,
        actionText: 'Get Started'
      });
    }

    return tips;
  };

  const getSeasonalTips = (): ReductionTip[] => {
    const month = new Date().getMonth();
    const tips: ReductionTip[] = [];

    // Spring/Summer tips
    if (month >= 3 && month <= 8) {
      tips.push({
        id: 'seasonal-produce',
        title: 'Buy Seasonal Produce',
        description: 'In-season fruits and vegetables have 30% lower carbon footprint',
        type: 'seasonal',
        impact: 'medium',
        savingsPotential: 2.5,
        difficulty: 'easy',
        targetItems: [],
        icon: Leaf,
        actionText: 'See What\'s in Season'
      });
    }

    return tips;
  };

  const getTipsByCategory = (category: string) => {
    if (category === 'all') return personalizedTips;
    return personalizedTips.filter(tip => tip.type === category);
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-success border-success';
      case 'medium': return 'text-warning border-warning';
      case 'low': return 'text-muted-foreground border-muted-foreground';
      default: return 'text-muted-foreground border-muted-foreground';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-success/10 text-success';
      case 'moderate': return 'bg-warning/10 text-warning';
      case 'challenging': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted/10 text-muted-foreground';
    }
  };

  const categories = [
    { key: 'all', label: 'All Tips' },
    { key: 'substitution', label: 'Substitutions' },
    { key: 'behavior', label: 'Behavior' },
    { key: 'purchase', label: 'Shopping' },
    { key: 'seasonal', label: 'Seasonal' }
  ];

  const filteredTips = getTipsByCategory(selectedCategory);

  return (
    <div className="space-y-6">
      {/* Header with Summary */}
      <Card className="p-6 bg-gradient-to-r from-eco-light/20 to-eco-secondary/20 border-eco-primary/30">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-eco-primary/10 rounded-full">
            <Lightbulb className="h-6 w-6 text-eco-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold mb-2">Personalized Reduction Tips</h2>
            <p className="text-muted-foreground mb-4">
              Based on your recent purchases, here are ways to reduce your carbon footprint
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-eco-primary">{personalizedTips.length}</div>
                <div className="text-sm text-muted-foreground">Tips Available</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-success">{totalSavingsPotential.toFixed(1)} kg</div>
                <div className="text-sm text-muted-foreground">Potential Savings</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {Math.round((totalSavingsPotential / totalEmissions) * 100)}%
                </div>
                <div className="text-sm text-muted-foreground">Reduction Potential</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map(category => (
          <Button
            key={category.key}
            variant={selectedCategory === category.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(category.key)}
            className={selectedCategory === category.key ? 'bg-eco-primary hover:bg-eco-primary/90' : ''}
          >
            {category.label}
          </Button>
        ))}
      </div>

      {/* Tips Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTips.map((tip) => (
          <Card key={tip.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onTipSelect?.(tip)}>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-eco-primary/10 rounded-full flex-shrink-0">
                <tip.icon className="h-5 w-5 text-eco-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-sm">{tip.title}</h3>
                  <Badge variant="outline" className={getImpactColor(tip.impact)}>
                    {tip.impact} impact
                  </Badge>
                </div>
                
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {tip.description}
                </p>

                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-muted-foreground">
                    Potential savings: <span className="font-medium text-success">
                      {tip.savingsPotential.toFixed(1)} kg CO₂e
                    </span>
                  </div>
                  <Badge className={getDifficultyColor(tip.difficulty)}>
                    {tip.difficulty}
                  </Badge>
                </div>

                <Progress 
                  value={(tip.savingsPotential / totalEmissions) * 100} 
                  className="h-1 mb-3"
                />

                <div className="flex items-center justify-between">
                  <Button size="sm" variant="outline" className="text-xs">
                    {tip.actionText}
                  </Button>
                  {tip.learnMoreUrl && (
                    <Button size="sm" variant="ghost" className="text-xs p-1">
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {tip.targetItems.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Applies to: {tip.targetItems.join(', ')}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredTips.length === 0 && (
        <Card className="p-8 text-center">
          <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No tips available</h3>
          <p className="text-muted-foreground">
            {selectedCategory === 'all' 
              ? 'Scan more items to get personalized reduction tips'
              : `No ${selectedCategory} tips available for your current items`
            }
          </p>
        </Card>
      )}
    </div>
  );
}