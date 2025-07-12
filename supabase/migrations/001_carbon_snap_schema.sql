-- Carbon Snap Database Schema

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  carbon_goal DECIMAL(10,2) DEFAULT 1000.00, -- Monthly carbon goal in kg CO2e
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Carbon categories for footprint calculations
CREATE TABLE public.carbon_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  base_emission_factor DECIMAL(10,4) NOT NULL, -- kg CO2e per unit
  unit TEXT NOT NULL DEFAULT 'item', -- item, kg, liter, etc.
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Receipts table
CREATE TABLE public.receipts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  store_name TEXT,
  receipt_date DATE,
  total_amount DECIMAL(10,2),
  image_url TEXT,
  ocr_text TEXT,
  total_carbon_footprint DECIMAL(10,4) DEFAULT 0,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Receipt items extracted from OCR
CREATE TABLE public.receipt_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  receipt_id UUID REFERENCES public.receipts(id) ON DELETE CASCADE NOT NULL,
  item_name TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  price DECIMAL(10,2),
  category_id UUID REFERENCES public.carbon_categories(id),
  carbon_footprint DECIMAL(10,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual item scans (barcode/image recognition)
CREATE TABLE public.scanned_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_name TEXT NOT NULL,
  barcode TEXT,
  brand TEXT,
  category_id UUID REFERENCES public.carbon_categories(id),
  carbon_footprint DECIMAL(10,4) DEFAULT 0,
  image_url TEXT,
  scan_date TIMESTAMPTZ DEFAULT NOW()
);

-- User achievements/badges
CREATE TABLE public.user_achievements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  achievement_type TEXT NOT NULL, -- 'weekly_goal', 'monthly_goal', 'eco_warrior', etc.
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  earned_date TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_type)
);

-- Weekly/Monthly carbon summaries
CREATE TABLE public.carbon_summaries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_emissions DECIMAL(10,4) DEFAULT 0,
  total_items INTEGER DEFAULT 0,
  top_category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period_type, period_start)
);

-- Row Level Security (RLS) Policies
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scanned_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carbon_summaries ENABLE ROW LEVEL SECURITY;

-- Policies for user_profiles
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Policies for receipts
CREATE POLICY "Users can view own receipts" ON public.receipts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own receipts" ON public.receipts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own receipts" ON public.receipts
  FOR UPDATE USING (auth.uid() = user_id);

-- Policies for receipt_items
CREATE POLICY "Users can view own receipt items" ON public.receipt_items
  FOR SELECT USING (auth.uid() = (SELECT user_id FROM public.receipts WHERE id = receipt_id));
CREATE POLICY "Users can insert own receipt items" ON public.receipt_items
  FOR INSERT WITH CHECK (auth.uid() = (SELECT user_id FROM public.receipts WHERE id = receipt_id));

-- Policies for scanned_items
CREATE POLICY "Users can view own scanned items" ON public.scanned_items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scanned items" ON public.scanned_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for user_achievements
CREATE POLICY "Users can view own achievements" ON public.user_achievements
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own achievements" ON public.user_achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for carbon_summaries
CREATE POLICY "Users can view own summaries" ON public.carbon_summaries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own summaries" ON public.carbon_summaries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Carbon categories are public (read-only for users)
ALTER TABLE public.carbon_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view carbon categories" ON public.carbon_categories
  FOR SELECT TO authenticated, anon USING (true);

-- Insert default carbon categories
INSERT INTO public.carbon_categories (name, base_emission_factor, unit, description) VALUES
('Beef', 60.0, 'kg', 'Beef products - high carbon footprint'),
('Pork', 12.1, 'kg', 'Pork products'),
('Chicken', 6.9, 'kg', 'Chicken and poultry products'),
('Fish', 6.1, 'kg', 'Fish and seafood'),
('Dairy', 3.2, 'kg', 'Milk, cheese, yogurt and dairy products'),
('Vegetables', 2.0, 'kg', 'Fresh vegetables'),
('Fruits', 1.1, 'kg', 'Fresh fruits'),
('Grains', 1.4, 'kg', 'Rice, wheat, bread, pasta'),
('Electronics', 300.0, 'item', 'Electronic devices and gadgets'),
('Clothing', 33.4, 'item', 'Clothing and textiles'),
('Transportation', 0.21, 'km', 'Car transportation per km'),
('Beverages', 0.7, 'liter', 'Soft drinks and beverages'),
('Packaged Foods', 5.5, 'kg', 'Processed and packaged foods'),
('Personal Care', 8.9, 'item', 'Cosmetics, toiletries, personal care'),
('Household Items', 15.2, 'item', 'Cleaning supplies, household goods');

-- Functions for automated calculations
CREATE OR REPLACE FUNCTION public.update_receipt_carbon_footprint()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.receipts 
  SET total_carbon_footprint = (
    SELECT COALESCE(SUM(carbon_footprint), 0)
    FROM public.receipt_items 
    WHERE receipt_id = NEW.receipt_id
  )
  WHERE id = NEW.receipt_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update receipt carbon footprint when items are added/updated
CREATE TRIGGER update_receipt_carbon_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.receipt_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_receipt_carbon_footprint();

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();