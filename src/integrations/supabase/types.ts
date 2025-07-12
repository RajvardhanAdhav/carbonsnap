export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      receipt_items: {
        Row: {
          carbon_category: string | null
          carbon_footprint: number
          category: string | null
          created_at: string
          id: string
          product_name: string
          quantity: string | null
          scanned_item_id: string | null
          unit_price: number | null
        }
        Insert: {
          carbon_category?: string | null
          carbon_footprint: number
          category?: string | null
          created_at?: string
          id?: string
          product_name: string
          quantity?: string | null
          scanned_item_id?: string | null
          unit_price?: number | null
        }
        Update: {
          carbon_category?: string | null
          carbon_footprint?: number
          category?: string | null
          created_at?: string
          id?: string
          product_name?: string
          quantity?: string | null
          scanned_item_id?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_items_scanned_item_id_fkey"
            columns: ["scanned_item_id"]
            isOneToOne: false
            referencedRelation: "scanned_items"
            referencedColumns: ["id"]
          },
        ]
      }
      scanned_items: {
        Row: {
          barcode: string | null
          brand: string | null
          carbon_category: string | null
          carbon_footprint: number
          created_at: string
          details: Json | null
          id: string
          image_url: string | null
          item_type: string
          product_name: string | null
          receipt_date: string | null
          receipt_total: number | null
          scan_method: string | null
          store_name: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          carbon_category?: string | null
          carbon_footprint: number
          created_at?: string
          details?: Json | null
          id?: string
          image_url?: string | null
          item_type: string
          product_name?: string | null
          receipt_date?: string | null
          receipt_total?: number | null
          scan_method?: string | null
          store_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          carbon_category?: string | null
          carbon_footprint?: number
          created_at?: string
          details?: Json | null
          id?: string
          image_url?: string | null
          item_type?: string
          product_name?: string | null
          receipt_date?: string | null
          receipt_total?: number | null
          scan_method?: string | null
          store_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_goals: {
        Row: {
          created_at: string
          id: string
          monthly_goal: number | null
          updated_at: string
          user_id: string | null
          weekly_goal: number | null
          yearly_goal: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          monthly_goal?: number | null
          updated_at?: string
          user_id?: string | null
          weekly_goal?: number | null
          yearly_goal?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          monthly_goal?: number | null
          updated_at?: string
          user_id?: string | null
          weekly_goal?: number | null
          yearly_goal?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
