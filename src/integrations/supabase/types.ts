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
      account_deletion_requests: {
        Row: {
          cancelled_at: string | null
          created_at: string
          id: string
          reason: string | null
          scheduled_for: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          scheduled_for?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          scheduled_for?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          body: string | null
          company_id: string | null
          created_at: string
          id: string
          payload: Json
          read_at: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
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
      badges: {
        Row: {
          code: string
          description: string | null
          earned_at: string
          icon: string | null
          id: string
          title: string
          user_id: string
        }
        Insert: {
          code: string
          description?: string | null
          earned_at?: string
          icon?: string | null
          id?: string
          title: string
          user_id: string
        }
        Update: {
          code?: string
          description?: string | null
          earned_at?: string
          icon?: string | null
          id?: string
          title?: string
          user_id?: string
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
      challenges: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string
          goal: number
          icon: string | null
          id: string
          is_active: boolean
          period: Database["public"]["Enums"]["challenge_period"]
          reward_points: number
          starts_at: string
          title: string
          type: Database["public"]["Enums"]["challenge_type"]
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at: string
          goal: number
          icon?: string | null
          id?: string
          is_active?: boolean
          period?: Database["public"]["Enums"]["challenge_period"]
          reward_points?: number
          starts_at?: string
          title: string
          type: Database["public"]["Enums"]["challenge_type"]
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string
          goal?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          period?: Database["public"]["Enums"]["challenge_period"]
          reward_points?: number
          starts_at?: string
          title?: string
          type?: Database["public"]["Enums"]["challenge_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          approved_at: string | null
          approved_by: string | null
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
          rejection_reason: string | null
          status: Database["public"]["Enums"]["company_status"]
          stripe_customer_id: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          tracking_days: number[] | null
          tracking_end: string | null
          tracking_start: string | null
          updated_at: string
          vat: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
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
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          stripe_customer_id?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          tracking_days?: number[] | null
          tracking_end?: string | null
          tracking_start?: string | null
          updated_at?: string
          vat?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
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
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          stripe_customer_id?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          tracking_days?: number[] | null
          tracking_end?: string | null
          tracking_start?: string | null
          updated_at?: string
          vat?: string | null
        }
        Relationships: []
      }
      company_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          actor_role: string | null
          company_id: string
          created_at: string
          details: Json
          document_name: string | null
          document_path: string | null
          id: string
          reason: string | null
          review_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          company_id: string
          created_at?: string
          details?: Json
          document_name?: string | null
          document_path?: string | null
          id?: string
          reason?: string | null
          review_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          company_id?: string
          created_at?: string
          details?: Json
          document_name?: string | null
          document_path?: string | null
          id?: string
          reason?: string | null
          review_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_email_log: {
        Row: {
          channel: string
          company_id: string
          created_at: string
          decision: string | null
          error_message: string | null
          id: string
          idempotency_key: string | null
          recipient_email: string
          review_id: string | null
          sent_by: string | null
          status: string
          template_name: string
          updated_at: string
        }
        Insert: {
          channel?: string
          company_id: string
          created_at?: string
          decision?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          recipient_email: string
          review_id?: string | null
          sent_by?: string | null
          status?: string
          template_name?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          company_id?: string
          created_at?: string
          decision?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          recipient_email?: string
          review_id?: string | null
          sent_by?: string | null
          status?: string
          template_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_email_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_reviews: {
        Row: {
          company_id: string
          created_at: string
          documents: Json
          id: string
          kind: string
          notes: string | null
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          documents?: Json
          id?: string
          kind?: string
          notes?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          documents?: Json
          id?: string
          kind?: string
          notes?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_subscriptions: {
        Row: {
          company_id: string
          created_at: string
          current_period_end: string | null
          discount_code: string | null
          id: string
          monthly_price_eur: number
          plan: Database["public"]["Enums"]["subscription_plan"]
          seats: number
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          current_period_end?: string | null
          discount_code?: string | null
          id?: string
          monthly_price_eur?: number
          plan?: Database["public"]["Enums"]["subscription_plan"]
          seats?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          current_period_end?: string | null
          discount_code?: string | null
          id?: string
          monthly_price_eur?: number
          plan?: Database["public"]["Enums"]["subscription_plan"]
          seats?: number
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
      cookie_consents: {
        Row: {
          analytics: boolean
          consented_at: string
          id: string
          ip_hash: string | null
          marketing: boolean
          necessary: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          analytics?: boolean
          consented_at?: string
          id?: string
          ip_hash?: string | null
          marketing?: boolean
          necessary?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          analytics?: boolean
          consented_at?: string
          id?: string
          ip_hash?: string | null
          marketing?: boolean
          necessary?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      data_export_requests: {
        Row: {
          error: string | null
          expires_at: string | null
          file_path: string | null
          id: string
          ready_at: string | null
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          error?: string | null
          expires_at?: string | null
          file_path?: string | null
          id?: string
          ready_at?: string | null
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          error?: string | null
          expires_at?: string | null
          file_path?: string | null
          id?: string
          ready_at?: string | null
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          last_seen: string
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen?: string
          platform: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      discount_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          label: string | null
          max_redemptions: number | null
          percent_off: number
          plan: Database["public"]["Enums"]["subscription_plan"] | null
          redeemed_count: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          max_redemptions?: number | null
          percent_off?: number
          plan?: Database["public"]["Enums"]["subscription_plan"] | null
          redeemed_count?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          max_redemptions?: number | null
          percent_off?: number
          plan?: Database["public"]["Enums"]["subscription_plan"] | null
          redeemed_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          email_bike: boolean
          email_challenges: boolean
          email_company: boolean
          email_product: boolean
          email_rewards: boolean
          email_streak: boolean
          email_trip_flag: boolean
          inapp_bike: boolean
          inapp_challenges: boolean
          inapp_company: boolean
          inapp_rewards: boolean
          inapp_streak: boolean
          inapp_trip_flag: boolean
          push_bike: boolean
          push_challenges: boolean
          push_company: boolean
          push_rewards: boolean
          push_streak: boolean
          push_trip_flag: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          email_bike?: boolean
          email_challenges?: boolean
          email_company?: boolean
          email_product?: boolean
          email_rewards?: boolean
          email_streak?: boolean
          email_trip_flag?: boolean
          inapp_bike?: boolean
          inapp_challenges?: boolean
          inapp_company?: boolean
          inapp_rewards?: boolean
          inapp_streak?: boolean
          inapp_trip_flag?: boolean
          push_bike?: boolean
          push_challenges?: boolean
          push_company?: boolean
          push_rewards?: boolean
          push_streak?: boolean
          push_trip_flag?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          email_bike?: boolean
          email_challenges?: boolean
          email_company?: boolean
          email_product?: boolean
          email_rewards?: boolean
          email_streak?: boolean
          email_trip_flag?: boolean
          inapp_bike?: boolean
          inapp_challenges?: boolean
          inapp_company?: boolean
          inapp_rewards?: boolean
          inapp_streak?: boolean
          inapp_trip_flag?: boolean
          push_bike?: boolean
          push_challenges?: boolean
          push_company?: boolean
          push_rewards?: boolean
          push_streak?: boolean
          push_trip_flag?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          phone: string | null
          preferences: Json
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
          phone?: string | null
          preferences?: Json
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
          phone?: string | null
          preferences?: Json
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
      reward_redemptions: {
        Row: {
          code: string
          expires_at: string | null
          id: string
          points_spent: number
          redeemed_at: string
          reward_id: string
          status: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          expires_at?: string | null
          id?: string
          points_spent: number
          redeemed_at?: string
          reward_id: string
          status?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          expires_at?: string | null
          id?: string
          points_spent?: number
          redeemed_at?: string
          reward_id?: string
          status?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards_catalog: {
        Row: {
          active: boolean
          cash_value_eur: number | null
          category: string
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          partner: string | null
          points_cost: number
          region: string | null
          scope: string
          stock: number | null
          terms: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cash_value_eur?: number | null
          category?: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          partner?: string | null
          points_cost: number
          region?: string | null
          scope?: string
          stock?: number | null
          terms?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cash_value_eur?: number | null
          category?: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          partner?: string | null
          points_cost?: number
          region?: string | null
          scope?: string
          stock?: number | null
          terms?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rewards_catalog_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      streaks: {
        Row: {
          best_days: number
          current_days: number
          last_active_date: string | null
          multiplier: number
          updated_at: string
          user_id: string
        }
        Insert: {
          best_days?: number
          current_days?: number
          last_active_date?: string | null
          multiplier?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          best_days?: number
          current_days?: number
          last_active_date?: string | null
          multiplier?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      telemetry_events: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          event: string
          id: string
          meta: Json | null
          source: string
          status: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          event: string
          id?: string
          meta?: Json | null
          source: string
          status: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          event?: string
          id?: string
          meta?: Json | null
          source?: string
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      trip_flags: {
        Row: {
          company_id: string | null
          created_at: string
          declared_mode: string
          id: string
          predicted_mode: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          score: number
          status: string
          trip_id: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          declared_mode: string
          id?: string
          predicted_mode: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score: number
          status?: string
          trip_id: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          declared_mode?: string
          id?: string
          predicted_mode?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number
          status?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_flags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_flags_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
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
      user_challenges: {
        Row: {
          challenge_id: string
          completed_at: string | null
          created_at: string
          id: string
          progress: number
          reward_claimed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: number
          reward_claimed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: number
          reward_claimed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_challenges_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          body: string | null
          company_id: string | null
          created_at: string
          id: string
          payload: Json
          read_at: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      apply_trip_to_challenges: {
        Args: {
          _company_id: string
          _distance_km: number
          _mode: string
          _user_id: string
        }
        Returns: undefined
      }
      bump_streak: {
        Args: { _mode: string; _user_id: string }
        Returns: undefined
      }
      company_leaderboard: {
        Args: { _company_id: string }
        Returns: {
          current_streak: number
          full_name: string
          lifetime_km: number
          lifetime_points: number
          user_id: string
        }[]
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      generate_company_code: { Args: { _name: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      owns_company: { Args: { _company_id: string }; Returns: boolean }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      redeem_reward_for_user: {
        Args: { _reward_id: string; _user_id: string }
        Returns: {
          code: string
          expires_at: string | null
          id: string
          points_spent: number
          redeemed_at: string
          reward_id: string
          status: string
          used_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "reward_redemptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_payout_for_user: {
        Args: { _iban: string; _points: number; _user_id: string }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "payout_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "user" | "company_manager" | "admin"
      bike_report_type: "sighting" | "recovery"
      bike_status: "libera" | "custodita" | "rubata" | "recuperata"
      challenge_period: "weekly" | "monthly" | "one_off"
      challenge_type:
        | "km_bike"
        | "km_foot"
        | "streak_days"
        | "trip_count"
        | "co2_saved"
      company_kind: "company" | "municipality"
      company_status: "pending" | "approved" | "rejected" | "suspended"
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
      challenge_period: ["weekly", "monthly", "one_off"],
      challenge_type: [
        "km_bike",
        "km_foot",
        "streak_days",
        "trip_count",
        "co2_saved",
      ],
      company_kind: ["company", "municipality"],
      company_status: ["pending", "approved", "rejected", "suspended"],
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
