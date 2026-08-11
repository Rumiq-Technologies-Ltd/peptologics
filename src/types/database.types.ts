/**
 * GENERATED FILE — do not edit by hand.
 *
 * Regenerate with `npm run db:types` after any schema change.
 *
 * Two runtime caveats the generator cannot express, both handled once in
 * src/features/products/mappers/product.mappers.ts:
 *
 *   1. `cost_per_mg` and `strength_mg` are typed `number` here but PostgREST
 *      serialises Postgres `numeric` as a JSON **string** to avoid IEEE-754
 *      loss. They arrive as e.g. "6.0000" and "10.000".
 *   2. `cost_per_mg` is a generated column. It appears in Insert/Update above
 *      but writing it raises 428C9 — the database rejects it.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      notification_log: {
        Row: {
          attempts: number;
          channel: string;
          created_at: string;
          error_message: string | null;
          id: string;
          order_id: string;
          provider_message_id: string | null;
          sent_at: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          channel: string;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          order_id: string;
          provider_message_id?: string | null;
          sent_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          channel?: string;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          order_id?: string;
          provider_message_id?: string | null;
          sent_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_log_order_fk";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          created_at: string;
          id: string;
          order_id: string;
          product_id: string;
          product_name: string;
          product_slug: string;
          quantity: number;
          strength_mg: number;
          subtotal_cents: number;
          unit_price_cents: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          order_id: string;
          product_id: string;
          product_name: string;
          product_slug: string;
          quantity: number;
          strength_mg: number;
          subtotal_cents: number;
          unit_price_cents: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          order_id?: string;
          product_id?: string;
          product_name?: string;
          product_slug?: string;
          quantity?: number;
          strength_mg?: number;
          subtotal_cents?: number;
          unit_price_cents?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_fk";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_fk";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          address: string;
          apartment: string | null;
          city: string;
          country: string;
          coupon_code: string | null;
          created_at: string;
          currency: string;
          customer_name: string;
          deleted_at: string | null;
          discount_cents: number;
          email: string;
          id: string;
          idempotency_key: string;
          item_count: number;
          notes: string | null;
          order_number: string;
          phone: string;
          ruo_acknowledged_at: string | null;
          state: string;
          status: string;
          subtotal_cents: number;
          total_cents: number | null;
          updated_at: string;
          zip_code: string;
        };
        Insert: {
          address: string;
          apartment?: string | null;
          city: string;
          country?: string;
          coupon_code?: string | null;
          created_at?: string;
          currency?: string;
          customer_name: string;
          deleted_at?: string | null;
          discount_cents?: number;
          email: string;
          id?: string;
          idempotency_key: string;
          item_count: number;
          notes?: string | null;
          order_number?: string;
          phone: string;
          ruo_acknowledged_at?: string | null;
          state: string;
          status?: string;
          subtotal_cents: number;
          total_cents?: number | null;
          updated_at?: string;
          zip_code: string;
        };
        Update: {
          address?: string;
          apartment?: string | null;
          city?: string;
          country?: string;
          coupon_code?: string | null;
          created_at?: string;
          currency?: string;
          customer_name?: string;
          deleted_at?: string | null;
          discount_cents?: number;
          email?: string;
          id?: string;
          idempotency_key?: string;
          item_count?: number;
          notes?: string | null;
          order_number?: string;
          phone?: string;
          ruo_acknowledged_at?: string | null;
          state?: string;
          status?: string;
          subtotal_cents?: number;
          total_cents?: number | null;
          updated_at?: string;
          zip_code?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          category: string;
          coa_url: string | null;
          cost_per_mg: number | null;
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          featured: boolean;
          id: string;
          image_url: string | null;
          is_blend: boolean;
          name: string;
          price_cents: number;
          slug: string;
          sort_order: number;
          status: string;
          strength_mg: number;
          strength_unit: string;
          updated_at: string;
        };
        Insert: {
          category?: string;
          coa_url?: string | null;
          cost_per_mg?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          featured?: boolean;
          id?: string;
          image_url?: string | null;
          is_blend?: boolean;
          name: string;
          price_cents: number;
          slug: string;
          sort_order?: number;
          status?: string;
          strength_mg: number;
          strength_unit?: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          coa_url?: string | null;
          cost_per_mg?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          featured?: boolean;
          id?: string;
          image_url?: string | null;
          is_blend?: boolean;
          name?: string;
          price_cents?: number;
          slug?: string;
          sort_order?: number;
          status?: string;
          strength_mg?: number;
          strength_unit?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rate_limit_hits: {
        Row: {
          bucket_key: string;
          created_at: string;
          hit_count: number;
          id: string;
          updated_at: string;
          window_started_at: string;
        };
        Insert: {
          bucket_key: string;
          created_at?: string;
          hit_count?: number;
          id?: string;
          updated_at?: string;
          window_started_at: string;
        };
        Update: {
          bucket_key?: string;
          created_at?: string;
          hit_count?: number;
          id?: string;
          updated_at?: string;
          window_started_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      check_rate_limit: {
        Args: {
          p_bucket_key: string;
          p_max_hits: number;
          p_window_seconds: number;
        };
        Returns: Json;
      };
      create_inquiry: { Args: { p_payload: Json }; Returns: Json };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
