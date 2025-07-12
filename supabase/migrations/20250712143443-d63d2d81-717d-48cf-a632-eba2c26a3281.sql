-- Create table for storing scanned items and receipts
CREATE TABLE public.scanned_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('receipt', 'single_item')),
  
  -- Receipt data
  store_name TEXT,
  receipt_date DATE,
  receipt_total DECIMAL(10,2),
  
  -- Single item data
  product_name TEXT,
  brand TEXT,
  barcode TEXT,
  
  -- Carbon footprint data
  carbon_footprint DECIMAL(10,3) NOT NULL,
  carbon_category VARCHAR(20) CHECK (carbon_category IN ('low', 'medium', 'high')),
  
  -- Additional metadata
  image_url TEXT,
  scan_method VARCHAR(20) CHECK (scan_method IN ('camera', 'manual', 'upload')),
  details JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for individual receipt items (when scanning receipts)
CREATE TABLE public.receipt_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scanned_item_id UUID REFERENCES public.scanned_items(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity TEXT,
  unit_price DECIMAL(10,2),
  carbon_footprint DECIMAL(10,3) NOT NULL,
  carbon_category VARCHAR(20) CHECK (carbon_category IN ('low', 'medium', 'high')),
  category TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for user goals and settings
CREATE TABLE public.user_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  weekly_goal DECIMAL(10,3) DEFAULT 15.0,
  monthly_goal DECIMAL(10,3) DEFAULT 60.0,
  yearly_goal DECIMAL(10,3) DEFAULT 700.0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.scanned_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for scanned_items
CREATE POLICY "Users can view their own scanned items" 
ON public.scanned_items 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scanned items" 
ON public.scanned_items 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scanned items" 
ON public.scanned_items 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scanned items" 
ON public.scanned_items 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for receipt_items
CREATE POLICY "Users can view receipt items for their scanned items" 
ON public.receipt_items 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.scanned_items si 
  WHERE si.id = receipt_items.scanned_item_id 
  AND si.user_id = auth.uid()
));

CREATE POLICY "Users can create receipt items for their scanned items" 
ON public.receipt_items 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.scanned_items si 
  WHERE si.id = receipt_items.scanned_item_id 
  AND si.user_id = auth.uid()
));

CREATE POLICY "Users can update receipt items for their scanned items" 
ON public.receipt_items 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.scanned_items si 
  WHERE si.id = receipt_items.scanned_item_id 
  AND si.user_id = auth.uid()
));

CREATE POLICY "Users can delete receipt items for their scanned items" 
ON public.receipt_items 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.scanned_items si 
  WHERE si.id = receipt_items.scanned_item_id 
  AND si.user_id = auth.uid()
));

-- Create RLS policies for user_goals
CREATE POLICY "Users can view their own goals" 
ON public.user_goals 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own goals" 
ON public.user_goals 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals" 
ON public.user_goals 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_scanned_items_updated_at
  BEFORE UPDATE ON public.scanned_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_goals_updated_at
  BEFORE UPDATE ON public.user_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_scanned_items_user_id ON public.scanned_items(user_id);
CREATE INDEX idx_scanned_items_created_at ON public.scanned_items(created_at);
CREATE INDEX idx_receipt_items_scanned_item_id ON public.receipt_items(scanned_item_id);