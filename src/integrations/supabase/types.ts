export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          daily_cap_km: number
          eur_per_point: number
          id: number
          payout_threshold_eur: number
          points_per_km_bike: number
          points_per_km_car: number
          points_per_km_foot: number
          speed_threshold_bike_kmh: number
          speed_threshold_foot_kmh: number
          updated_at: string
        }
        Insert: {
          daily_cap_km?: number
          eur_per_point?: number
          id?: number
          payout_threshold_eur?: number
          points_per_km_bike?: number
          points_per_km_car?: number
          points_per_km_foot?: number
          speed_threshold_bike_kmh?: number
          speed_threshold_foot_kmh?: number
          updated_at?: string
        }
        Update: {
          daily_cap_km?: number
          eur_per_point?: number
          id?: number
          payout_threshold_eur?: number
          points_per_km_bike?: number
          points_per_km_car?: number
          points_per_km_foot?: number
          speed_threshold_bike_kmh?: number
          speed_threshold_foot_kmh?: number
          updated_at?: string
        }
        Relationships: []
      }
      bike_reports: {
        Row: {
          bike_id: string
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          note: string | null
          photo_url: string | null
          reporter_id: string | null
          type: Database["public"]["Enums"]["bike_report_type"]
        }
        Insert: {
          bike_id: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          note?: string | null
          photo_url?: string | null
          reporter_id?: string | null
          type: Database["public"]["Enums"]["bike_report_type"]
        }
        Update: {
          bike_id?: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          note?: string | null
          photo_url?: string | null
          reporter_id?: string | null
          type?: Database["public"]["Enums"]["bike_report_type"]
        }
        Relationships: [
          {
            foreignKeyName: "bike_reports_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
        ]
      }
      bikes: {
        Row: {
          colore: string | null
          created_at: string
          frame_number: string
          id: string
          marca: string
          modello: string | null
          owner_id: string
          photo_url: string | null
          qr_token: string
          receipt_url: string | null
          status: Database["public"]["Enums"]["bike_status"]
          stolen_at: string | null
          stolen_lat: number | null
          stolen_lng: number | null
          stolen_note: string | null
          updated_at: string
        }
        Insert: {
          colore?: string | null
          created_at?: string
          frame_number: string
          id?: string
          marca: string
          modello?: string | null
          owner_id: string
          photo_url?: string | null
          qr_token?: string
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["bike_status"]
          stolen_at?: string | null
          stolen_lat?: number | null
          stolen_lng?: number | null
          stolen_note?: string | null
          updated_at?: string
        }
        Update: {
          colore?: string | null
          created_at?: string
          frame_number?: string
          id?: string
          marca?: string
          modello?: string | null
          owner_id?: string
          photo_url?: string | null
          qr_token?: string
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["bike_status"]
          stolen_at?: string | null
          stolen_lat?: number | null
          stolen_lng?: number | null
          stolen_note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          code: string
          contact_email: string
          created_at: string
          created_by: string | null
          employee_cap: number
          iban: string | null
          id: string
          kind: Database["public"]["Enums"]["company_kind"]
          name: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          stripe_customer_id: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          vat: string | null
        }
        Insert: {
          code: string
          contact_email: string
          created_at?: string
          created_by?: string | null
          employee_cap?: number
          iban?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["company_kind"]
          name: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          stripe_customer_id?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          vat?: string | null
        }
        Update: {
          code?: string
          contact_email?: string
          created_at?: string
          created_by?: string | null
          employee_cap?: number
          iban?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["company_kind"]
          name?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          stripe_customer_id?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          vat?: string | null
        }
        Relationships: []
      }
      company_subscriptions: {
        Row: {
          company_id: string
          created_at: string
          current_period_end: string | null
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          admin_notes: string | null
          amount_eur: number
          created_at: string
          iban_snapshot: string | null
          id: string
          points_redeemed: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["payout_status"]
          stripe_payout_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount_eur: number
          created_at?: string
          iban_snapshot?: string | null
          id?: string
          points_redeemed: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          stripe_payout_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount_eur?: number
          created_at?: string
          iban_snapshot?: string | null
          id?: string
          points_redeemed?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          stripe_payout_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      point_transactions: {
        Row: {
          created_at: string
          delta_eur: number
          delta_points: number
          id: string
          payout_id: string | null
          reason: string
          trip_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta_eur?: number
          delta_points: number
          id?: string
          payout_id?: string | null
          reason: string
          trip_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta_eur?: number
          delta_points?: number
          id?: string
          payout_id?: string | null
          reason?: string
          trip_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_transactions_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          full_name: string | null
          iban: string | null
          id: string
          stripe_account_id: string | null
          stripe_account_status: string | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          iban?: string | null
          id: string
          stripe_account_id?: string | null
          stripe_account_status?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          iban?: string | null
          id?: string
          stripe_account_id?: string | null
          stripe_account_status?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          anomaly_flag: boolean
          anomaly_reason: string | null
          avg_speed_kmh: number
          calories: number
          co2_saved_kg: number
          created_at: string
          distance_km: number
          ended_at: string
          id: string
          max_speed_kmh: number
          mode: Database["public"]["Enums"]["trip_mode"]
          path: Json | null
          points_earned: number
          started_at: string
          user_id: string
        }
        Insert: {
          anomaly_flag?: boolean
          anomaly_reason?: string | null
          avg_speed_kmh?: number
          calories?: number
          co2_saved_kg?: number
          created_at?: string
          distance_km?: number
          ended_at: string
          id?: string
          max_speed_kmh?: number
          mode: Database["public"]["Enums"]["trip_mode"]
          path?: Json | null
          points_earned?: number
          started_at: string
          user_id: string
        }
        Update: {
          anomaly_flag?: boolean
          anomaly_reason?: string | null
          avg_speed_kmh?: number
          calories?: number
          co2_saved_kg?: number
          created_at?: string
          distance_km?: number
          ended_at?: string
          id?: string
          max_speed_kmh?: number
          mode?: Database["public"]["Enums"]["trip_mode"]
          path?: Json | null
          points_earned?: number
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          eur_balance: number
          lifetime_km: number
          lifetime_points: number
          points_balance: number
          stripe_account_id: string | null
          stripe_onboarding_complete: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          eur_balance?: number
          lifetime_km?: number
          lifetime_points?: number
          points_balance?: number
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          eur_balance?: number
          lifetime_km?: number
          lifetime_points?: number
          points_balance?: number
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_company_code: { Args: { _name: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "user" | "company_manager" | "admin"
      bike_report_type: "sighting" | "recovery"
      bike_status: "libera" | "custodita" | "rubata" | "recuperata"
      company_kind: "company" | "municipality"
      payout_status: "pending" | "approved" | "paid" | "rejected"
      subscription_plan: "starter" | "pro" | "enterprise"
      subscription_status:
        | "trial"
        | "active"
        | "past_due"
        | "canceled"
        | "inactive"
      trip_mode: "foot" | "bike" | "car"
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
    Enums: {
      app_role: ["user", "company_manager", "admin"],
      bike_report_type: ["sighting", "recovery"],
      bike_status: ["libera", "custodita", "rubata", "recuperata"],
      company_kind: ["company", "municipality"],
      payout_status: ["pending", "approved", "paid", "rejected"],
      subscription_plan: ["starter", "pro", "enterprise"],
      subscription_status: [
        "trial",
        "active",
        "past_due",
        "canceled",
        "inactive",
      ],
      trip_mode: ["foot", "bike", "car"],
    },
  },
} as const
