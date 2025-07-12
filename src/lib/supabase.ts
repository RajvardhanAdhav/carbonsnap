import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(
  supabaseUrl || '', 
  supabaseAnonKey || '',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);

// Database types
export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  carbon_goal: number;
  created_at: string;
  updated_at: string;
}

export interface CarbonCategory {
  id: string;
  name: string;
  base_emission_factor: number;
  unit: string;
  description?: string;
  created_at: string;
}

export interface Receipt {
  id: string;
  user_id: string;
  store_name?: string;
  receipt_date?: string;
  total_amount?: number;
  image_url?: string;
  ocr_text?: string;
  total_carbon_footprint: number;
  processed: boolean;
  created_at: string;
}

export interface ReceiptItem {
  id: string;
  receipt_id: string;
  item_name: string;
  quantity: number;
  price?: number;
  category_id?: string;
  carbon_footprint: number;
  created_at: string;
}

export interface ScannedItem {
  id: string;
  user_id: string;
  item_name: string;
  barcode?: string;
  brand?: string;
  category_id?: string;
  carbon_footprint: number;
  image_url?: string;
  scan_date: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_type: string;
  title: string;
  description?: string;
  icon?: string;
  earned_date: string;
}

export interface CarbonSummary {
  id: string;
  user_id: string;
  period_type: 'weekly' | 'monthly';
  period_start: string;
  period_end: string;
  total_emissions: number;
  total_items: number;
  top_category?: string;
  created_at: string;
}