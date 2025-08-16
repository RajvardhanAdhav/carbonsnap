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
    const categoryLower = item.category.toLowerCase();

    // High-impact meat alternatives
    if (categoryLower.includes('beef')) {
      tips.push({
        id: `beef-alt-${item.name}`,
        title: 'Switch to Plant-Based Meat',
        description: `Replace ${item.name} with Beyond Meat, Impossible Burger, or lentils to reduce emissions by 85-90%`,
        type: 'substitution',
        impact: 'high',
        savingsPotential: item.emissions * 0.87,
        difficulty: 'easy',
        targetItems: [item.name],
        icon: Leaf,
        actionText: 'Find Plant Alternatives',
        learnMoreUrl: 'https://www.worldwildlife.org/stories/what-are-the-biggest-drivers-of-tropical-deforestation'
      });
    }

    if (categoryLower.includes('lamb')) {
      tips.push({
        id: `lamb-alt-${item.name}`,
        title: 'Try Mushroom or Jackfruit',
        description: `Replace ${item.name} with mushroom-based proteins or jackfruit for 80% emission reduction`,
        type: 'substitution',
        impact: 'high',
        savingsPotential: item.emissions * 0.8,
        difficulty: 'easy',
        targetItems: [item.name],
        icon: Leaf,
        actionText: 'Explore Alternatives'
      });
    }

    if (categoryLower.includes('pork') || categoryLower.includes('bacon') || categoryLower.includes('sausage')) {
      tips.push({
        id: `pork-alt-${item.name}`,
        title: 'Plant-Based Pork Alternatives',
        description: `Try plant-based sausages, tempeh, or mushroom bacon for 70% emission reduction`,
        type: 'substitution',
        impact: 'high',
        savingsPotential: item.emissions * 0.7,
        difficulty: 'easy',
        targetItems: [item.name],
        icon: Leaf,
        actionText: 'Find Alternatives'
      });
    }

    if (categoryLower.includes('chicken')) {
      tips.push({
        id: `chicken-alt-${item.name}`,
        title: 'Plant-Based Chicken',
        description: `Switch to tofu, seitan, or plant-based chicken for 60% emission reduction`,
        type: 'substitution',
        impact: 'medium',
        savingsPotential: item.emissions * 0.6,
        difficulty: 'easy',
        targetItems: [item.name],
        icon: Leaf,
        actionText: 'Try Alternatives'
      });
    }

    // Dairy alternatives
    if (categoryLower.includes('dairy') || categoryLower.includes('milk')) {
      tips.push({
        id: `dairy-alt-${item.name}`,
        title: 'Plant-Based Milk',
        description: `Switch to oat, soy, or almond milk for 65% emission reduction`,
        type: 'substitution',
        impact: 'medium',
        savingsPotential: item.emissions * 0.65,
        difficulty: 'easy',
        targetItems: [item.name],
        icon: Leaf,
        actionText: 'Try Plant Milk'
      });
    }

    if (categoryLower.includes('cheese')) {
      tips.push({
        id: `cheese-alt-${item.name}`,
        title: 'Plant-Based Cheese',
        description: `Try cashew cheese, nutritional yeast, or oat-based cheese for lower emissions`,
        type: 'substitution',
        impact: 'medium',
        savingsPotential: item.emissions * 0.6,
        difficulty: 'moderate',
        targetItems: [item.name],
        icon: Leaf,
        actionText: 'Find Cheese Alternatives'
      });
    }

    // Transport and sourcing tips
    if (item.emissions > 2 && !categoryLower.includes('local')) {
      tips.push({
        id: `local-alt-${item.name}`,
        title: 'Choose Local Sources',
        description: `Look for locally-sourced ${item.category.toLowerCase()} to reduce transport emissions by 30-50%`,
        type: 'purchase',
        impact: 'medium',
        savingsPotential: item.emissions * 0.4,
        difficulty: 'moderate',
        targetItems: [item.name],
        icon: Target,
        actionText: 'Find Local Options'
      });
    }

    // Seasonal produce tips
    if (categoryLower.includes('produce') || categoryLower.includes('fruit') || categoryLower.includes('vegetable')) {
      const currentMonth = new Date().getMonth() + 1;
      tips.push({
        id: `seasonal-${item.name}`,
        title: 'Buy Seasonal Produce',
        description: `Choose seasonal alternatives to ${item.name} for 30% lower emissions`,
        type: 'seasonal',
        impact: 'medium',
        savingsPotential: item.emissions * 0.3,
        difficulty: 'easy',
        targetItems: [item.name],
        icon: Leaf,
        actionText: 'See Seasonal Options'
      });
    }

    // Packaging reduction for high-packaging items
    if (item.emissions > 1) {
      tips.push({
        id: `bulk-${item.name}`,
        title: 'Buy in Bulk',
        description: `Purchase ${item.name} in bulk or with minimal packaging to reduce emissions by 15-25%`,
        type: 'purchase',
        impact: 'low',
        savingsPotential: item.emissions * 0.2,
        difficulty: 'easy',
        targetItems: [item.name],
        icon: Zap,
        actionText: 'Find Bulk Options'
      });
    }

    return tips;
  };

  const getGeneralBehaviorTips = (items: ReceiptItem[]): ReductionTip[] => {
    const tips: ReductionTip[] = [];
    const categories = Array.from(new Set(items.map(item => item.category.toLowerCase())));
    
    // Identify high-emission categories
    const meatItems = items.filter(item => 
      item.category.toLowerCase().includes('beef') || 
      item.category.toLowerCase().includes('lamb') || 
      item.category.toLowerCase().includes('pork') || 
      item.category.toLowerCase().includes('chicken')
    );
    
    const dairyItems = items.filter(item => 
      item.category.toLowerCase().includes('dairy') || 
      item.category.toLowerCase().includes('cheese') || 
      item.category.toLowerCase().includes('milk')
    );

    // Meatless Monday tip for meat consumers
    if (meatItems.length > 0) {
      const avgMeatEmissions = meatItems.reduce((sum, item) => sum + item.emissions, 0) / meatItems.length;
      tips.push({
        id: 'meatless-monday',
        title: 'Try Meatless Monday',
        description: 'Going meat-free one day per week can save 1.6 kg CO₂e weekly (6.4 kg monthly)',
        type: 'behavior',
        impact: 'medium',
        savingsPotential: Math.min(avgMeatEmissions * 4, 6.4), // Weekly * 4 or cap at 6.4
        difficulty: 'easy',
        targetItems: [],
        icon: TrendingDown,
        actionText: 'Start This Week',
        learnMoreUrl: 'https://www.meatlessmonday.com/the-global-movement/'
      });
    }

    // Enhanced meal planning with specific benefits
    if (items.length > 8) {
      tips.push({
        id: 'meal-planning',
        title: 'Plan Your Meals Weekly',
        description: 'Meal planning reduces food waste by 25% and prevents impulse purchases of high-emission foods',
        type: 'behavior',
        impact: 'medium',
        savingsPotential: totalEmissions * 0.25,
        difficulty: 'moderate',
        targetItems: [],
        icon: Target,
        actionText: 'Start Planning',
        learnMoreUrl: 'https://www.fao.org/food-loss-and-food-waste/flw-data'
      });
    }

    // Batch cooking tip for frequent shoppers
    if (items.length > 12) {
      tips.push({
        id: 'batch-cooking',
        title: 'Batch Cook Plant-Based Meals',
        description: 'Cooking large portions of plant-based meals reduces both shopping frequency and meat dependency',
        type: 'behavior',
        impact: 'medium',
        savingsPotential: totalEmissions * 0.2,
        difficulty: 'moderate',
        targetItems: [],
        icon: Zap,
        actionText: 'Learn Techniques'
      });
    }

    // Plant-forward eating pattern
    if (meatItems.length > dairyItems.length * 2) {
      tips.push({
        id: 'plant-forward',
        title: 'Adopt Plant-Forward Eating',
        description: 'Make plants the star of your meals - fill 2/3 of your plate with vegetables, grains, and legumes',
        type: 'behavior',
        impact: 'high',
        savingsPotential: totalEmissions * 0.4,
        difficulty: 'moderate',
        targetItems: [],
        icon: Leaf,
        actionText: 'Get Recipes'
      });
    }

    // Dairy reduction tip
    if (dairyItems.length > 3) {
      tips.push({
        id: 'dairy-reduction',
        title: 'Gradual Dairy Reduction',
        description: 'Replace one dairy item per week with plant alternatives - start with milk in coffee/cereal',
        type: 'behavior',
        impact: 'medium',
        savingsPotential: dairyItems.reduce((sum, item) => sum + item.emissions, 0) * 0.5,
        difficulty: 'easy',
        targetItems: [],
        icon: TrendingDown,
        actionText: 'Start Small'
      });
    }

    // Shopping behavior tips
    if (items.length > 15) {
      tips.push({
        id: 'shopping-list',
        title: 'Stick to Shopping Lists',
        description: 'Shopping with a predetermined list reduces impulse purchases of high-emission processed foods by 30%',
        type: 'behavior',
        impact: 'low',
        savingsPotential: totalEmissions * 0.15,
        difficulty: 'easy',
        targetItems: [],
        icon: Target,
        actionText: 'Make Lists'
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