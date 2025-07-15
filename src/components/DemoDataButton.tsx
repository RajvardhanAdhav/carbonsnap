import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database, Plus, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DemoDataButtonProps {
  onDataAdded?: () => void;
}

export function DemoDataButton({ onDataAdded }: DemoDataButtonProps) {
  const { user, session } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [hasData, setHasData] = useState(false);
  const { toast } = useToast();

  // Sample demo data with realistic carbon footprints
  const demoData = [
    {
      item_type: 'receipt',
      product_name: 'Organic Beef Ground',
      brand: 'Green Valley Farms',
      carbon_footprint: 15.8,
      carbon_category: 'high',
      scan_method: 'receipt',
      store_name: 'Whole Foods Market',
      details: {
        category: 'Meat & Dairy',
        breakdown: { production: 14.2, packaging: 0.4, transport: 1.0, disposal: 0.2 },
        suggestions: ['Consider plant-based alternatives', 'Look for local grass-fed options']
      }
    },
    {
      item_type: 'barcode',
      product_name: 'Oat Milk Barista Blend',
      brand: 'Oatly',
      barcode: '7394376616426',
      carbon_footprint: 0.9,
      carbon_category: 'low',
      scan_method: 'barcode',
      details: {
        category: 'Plant-Based',
        breakdown: { production: 0.6, packaging: 0.2, transport: 0.1, disposal: 0.0 },
        suggestions: ['Great eco-friendly choice!', 'Support sustainable brands']
      }
    },
    {
      item_type: 'receipt',
      product_name: 'Avocados (Organic)',
      brand: null,
      carbon_footprint: 2.1,
      carbon_category: 'low',
      scan_method: 'receipt',
      store_name: 'Farmers Market',
      details: {
        category: 'Produce',
        breakdown: { production: 1.8, packaging: 0.1, transport: 0.2, disposal: 0.0 },
        suggestions: ['Buy local when possible', 'Choose seasonal produce']
      }
    },
    {
      item_type: 'barcode',
      product_name: 'Quinoa Pasta',
      brand: 'Ancient Harvest',
      barcode: '089125210013',
      carbon_footprint: 1.4,
      carbon_category: 'low',
      scan_method: 'barcode',
      details: {
        category: 'Grains & Starches',
        breakdown: { production: 1.1, packaging: 0.2, transport: 0.1, disposal: 0.0 },
        suggestions: ['Excellent protein alternative', 'Support sustainable farming']
      }
    },
    {
      item_type: 'receipt',
      product_name: 'Wild Alaskan Salmon',
      brand: 'Copper River',
      carbon_footprint: 6.3,
      carbon_category: 'medium',
      scan_method: 'receipt',
      store_name: 'Fresh Market',
      details: {
        category: 'Seafood',
        breakdown: { production: 3.2, packaging: 0.8, transport: 2.1, disposal: 0.2 },
        suggestions: ['Choose sustainably sourced fish', 'Look for MSC certification']
      }
    },
    {
      item_type: 'barcode',
      product_name: 'Fair Trade Dark Chocolate',
      brand: 'Green & Blacks',
      barcode: '8000300295849',
      carbon_footprint: 3.7,
      carbon_category: 'medium',
      scan_method: 'barcode',
      details: {
        category: 'Snacks & Processed',
        breakdown: { production: 2.8, packaging: 0.4, transport: 0.4, disposal: 0.1 },
        suggestions: ['Choose fair trade options', 'Enjoy in moderation']
      }
    }
  ];

  const checkExistingData = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('scanned_items')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (error) throw error;
      setHasData(data && data.length > 0);
    } catch (error) {
      console.error('Error checking existing data:', error);
    }
  };

  const addDemoData = async () => {
    if (!user || !session?.access_token) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to add demo data.",
        variant: "destructive"
      });
      return;
    }

    setIsAdding(true);

    try {
      // Add realistic timestamps (last 2 weeks)
      const items = demoData.map((item, index) => ({
        ...item,
        user_id: user.id,
        created_at: new Date(Date.now() - (index * 2 * 24 * 60 * 60 * 1000)).toISOString() // Spread over 2 weeks
      }));

      const { error } = await supabase
        .from('scanned_items')
        .insert(items);

      if (error) throw error;

      setHasData(true);
      onDataAdded?.();
      
      toast({
        title: "Demo Data Added!",
        description: `Added ${demoData.length} sample items to showcase Carbon Snap features.`,
      });

    } catch (error) {
      console.error('Error adding demo data:', error);
      toast({
        title: "Error",
        description: "Failed to add demo data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAdding(false);
    }
  };

  // Check for existing data on component mount
  useEffect(() => {
    if (user) {
      checkExistingData();
    }
  }, [user]);

  if (!user) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {hasData ? (
        <Badge variant="outline" className="text-success border-success">
          <Check className="h-3 w-3 mr-1" />
          Demo Data Active
        </Badge>
      ) : (
        <Button
          onClick={addDemoData}
          disabled={isAdding}
          variant="outline"
          size="sm"
          className="hover:bg-eco-primary/10 hover:border-eco-primary"
        >
          {isAdding ? (
            <>
              <div className="animate-spin h-3 w-3 border border-eco-primary border-t-transparent rounded-full mr-2" />
              Adding...
            </>
          ) : (
            <>
              <Database className="h-3 w-3 mr-1" />
              Add Demo Data
            </>
          )}
        </Button>
      )}
      
      {!hasData && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          No data to display
        </div>
      )}
    </div>
  );
}