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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          awarded_at: string
          badge_type: string
          id: string
          vendor_id: string
        }
        Insert: {
          awarded_at?: string
          badge_type: string
          id?: string
          vendor_id: string
        }
        Update: {
          awarded_at?: string
          badge_type?: string
          id?: string
          vendor_id?: string
        }
        Relationships: []
      }
      ai_scripts: {
        Row: {
          ai_persona: string | null
          closing_techniques: string | null
          company_id: string
          created_at: string
          example_responses: string | null
          forbidden_phrases: string | null
          id: string
          is_active: boolean
          objection_handling: string | null
          opening_messages: string | null
          product_context: string | null
          recommended_phrases: string | null
          sales_playbook: string | null
          script_name: string
          tone_of_voice: string | null
          updated_at: string
        }
        Insert: {
          ai_persona?: string | null
          closing_techniques?: string | null
          company_id: string
          created_at?: string
          example_responses?: string | null
          forbidden_phrases?: string | null
          id?: string
          is_active?: boolean
          objection_handling?: string | null
          opening_messages?: string | null
          product_context?: string | null
          recommended_phrases?: string | null
          sales_playbook?: string | null
          script_name: string
          tone_of_voice?: string | null
          updated_at?: string
        }
        Update: {
          ai_persona?: string | null
          closing_techniques?: string | null
          company_id?: string
          created_at?: string
          example_responses?: string | null
          forbidden_phrases?: string | null
          id?: string
          is_active?: boolean
          objection_handling?: string | null
          opening_messages?: string | null
          product_context?: string | null
          recommended_phrases?: string | null
          sales_playbook?: string | null
          script_name?: string
          tone_of_voice?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_scripts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          alert_type: string
          created_at: string
          customer_id: string
          cycle_id: string | null
          id: string
          message: string
          metadata: Json | null
          seller_id: string
          severity: string
          updated_at: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          customer_id: string
          cycle_id?: string | null
          id?: string
          message: string
          metadata?: Json | null
          seller_id: string
          severity?: string
          updated_at?: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          customer_id?: string
          cycle_id?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          seller_id?: string
          severity?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "sale_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_daily_company: {
        Row: {
          ai_audio_analyses: number
          ai_image_analyses: number
          ai_text_analyses: number
          avg_response_time_seconds: number | null
          cold_leads: number
          company_id: string
          created_at: string
          date: string
          hot_leads: number
          id: string
          incoming_messages: number
          new_leads: number
          outgoing_messages: number
          total_in_progress: number
          total_leads: number
          total_lost: number
          total_messages: number
          total_pending: number
          total_won: number
          updated_at: string
          warm_leads: number
        }
        Insert: {
          ai_audio_analyses?: number
          ai_image_analyses?: number
          ai_text_analyses?: number
          avg_response_time_seconds?: number | null
          cold_leads?: number
          company_id: string
          created_at?: string
          date: string
          hot_leads?: number
          id?: string
          incoming_messages?: number
          new_leads?: number
          outgoing_messages?: number
          total_in_progress?: number
          total_leads?: number
          total_lost?: number
          total_messages?: number
          total_pending?: number
          total_won?: number
          updated_at?: string
          warm_leads?: number
        }
        Update: {
          ai_audio_analyses?: number
          ai_image_analyses?: number
          ai_text_analyses?: number
          avg_response_time_seconds?: number | null
          cold_leads?: number
          company_id?: string
          created_at?: string
          date?: string
          hot_leads?: number
          id?: string
          incoming_messages?: number
          new_leads?: number
          outgoing_messages?: number
          total_in_progress?: number
          total_leads?: number
          total_lost?: number
          total_messages?: number
          total_pending?: number
          total_won?: number
          updated_at?: string
          warm_leads?: number
        }
        Relationships: [
          {
            foreignKeyName: "analytics_daily_company_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_daily_seller: {
        Row: {
          avg_response_time_seconds: number | null
          cold_leads: number
          company_id: string
          created_at: string
          date: string
          hot_leads: number
          id: string
          incoming_messages: number
          leads_in_progress: number
          leads_lost: number
          leads_pending: number
          leads_won: number
          new_leads: number
          outgoing_messages: number
          seller_id: string
          total_leads: number
          total_messages: number
          updated_at: string
          warm_leads: number
        }
        Insert: {
          avg_response_time_seconds?: number | null
          cold_leads?: number
          company_id: string
          created_at?: string
          date: string
          hot_leads?: number
          id?: string
          incoming_messages?: number
          leads_in_progress?: number
          leads_lost?: number
          leads_pending?: number
          leads_won?: number
          new_leads?: number
          outgoing_messages?: number
          seller_id: string
          total_leads?: number
          total_messages?: number
          updated_at?: string
          warm_leads?: number
        }
        Update: {
          avg_response_time_seconds?: number | null
          cold_leads?: number
          company_id?: string
          created_at?: string
          date?: string
          hot_leads?: number
          id?: string
          incoming_messages?: number
          leads_in_progress?: number
          leads_lost?: number
          leads_pending?: number
          leads_won?: number
          new_leads?: number
          outgoing_messages?: number
          seller_id?: string
          total_leads?: number
          total_messages?: number
          updated_at?: string
          warm_leads?: number
        }
        Relationships: [
          {
            foreignKeyName: "analytics_daily_seller_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      buyers: {
        Row: {
          client_id: string
          company_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          cnpj: string | null
          company_id: string
          created_at: string
          id: string
          name: string
          notes: string | null
          segment: string | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          company_id: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          segment?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          segment?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          allow_followups: boolean
          cnpj: string | null
          created_at: string
          description: string | null
          free_end_date: string | null
          free_start_date: string | null
          id: string
          is_active: boolean
          name: string
          plan_id: string | null
          segment: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          allow_followups?: boolean
          cnpj?: string | null
          created_at?: string
          description?: string | null
          free_end_date?: string | null
          free_start_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          plan_id?: string | null
          segment?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          allow_followups?: boolean
          cnpj?: string | null
          created_at?: string
          description?: string | null
          free_end_date?: string | null
          free_start_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          plan_id?: string | null
          segment?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      company_limits: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_throttled: boolean
          max_ai_ops_per_minute: number
          max_messages_per_day: number
          max_requests_per_second: number
          priority_level: string
          throttle_reason: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_throttled?: boolean
          max_ai_ops_per_minute?: number
          max_messages_per_day?: number
          max_requests_per_second?: number
          priority_level?: string
          throttle_reason?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_throttled?: boolean
          max_ai_ops_per_minute?: number
          max_messages_per_day?: number
          max_requests_per_second?: number
          priority_level?: string
          throttle_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_limits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          company_id: string
          created_at: string
          followup_delay_hours: number
          followups_enabled: boolean
          id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          followup_delay_hours?: number
          followups_enabled?: boolean
          id?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          followup_delay_hours?: number
          followups_enabled?: boolean
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          company_id: string
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          next_billing_date: string | null
          plan_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          company_id: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          next_billing_date?: string | null
          plan_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          company_id?: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          next_billing_date?: string | null
          plan_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          buyer_id: string | null
          client_id: string | null
          company_id: string | null
          created_at: string
          email: string | null
          id: string
          is_incomplete: boolean
          lead_status: Database["public"]["Enums"]["lead_status"]
          name: string
          phone: string | null
          seller_id: string | null
          updated_at: string
        }
        Insert: {
          buyer_id?: string | null
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_incomplete?: boolean
          lead_status?: Database["public"]["Enums"]["lead_status"]
          name: string
          phone?: string | null
          seller_id?: string | null
          updated_at?: string
        }
        Update: {
          buyer_id?: string | null
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_incomplete?: boolean
          lead_status?: Database["public"]["Enums"]["lead_status"]
          name?: string
          phone?: string | null
          seller_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      default_ai_script: {
        Row: {
          ai_persona: string | null
          closing_techniques: string | null
          created_at: string
          example_responses: string | null
          forbidden_phrases: string | null
          id: string
          objection_handling: string | null
          opening_messages: string | null
          product_context: string | null
          recommended_phrases: string | null
          sales_playbook: string | null
          script_name: string
          tone_of_voice: string | null
          updated_at: string
        }
        Insert: {
          ai_persona?: string | null
          closing_techniques?: string | null
          created_at?: string
          example_responses?: string | null
          forbidden_phrases?: string | null
          id?: string
          objection_handling?: string | null
          opening_messages?: string | null
          product_context?: string | null
          recommended_phrases?: string | null
          sales_playbook?: string | null
          script_name?: string
          tone_of_voice?: string | null
          updated_at?: string
        }
        Update: {
          ai_persona?: string | null
          closing_techniques?: string | null
          created_at?: string
          example_responses?: string | null
          forbidden_phrases?: string | null
          id?: string
          objection_handling?: string | null
          opening_messages?: string | null
          product_context?: string | null
          recommended_phrases?: string | null
          sales_playbook?: string | null
          script_name?: string
          tone_of_voice?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gamification_points: {
        Row: {
          company_id: string
          created_at: string
          id: string
          points: number
          reason: string
          sale_id: string | null
          vendor_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          points: number
          reason: string
          sale_id?: string | null
          vendor_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          points?: number
          reason?: string
          sale_id?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamification_points_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_points_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_vendors: {
        Row: {
          current_value: number
          goal_id: string
          id: string
          progress: number | null
          status: string
          target_value: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          current_value?: number
          goal_id: string
          id?: string
          progress?: number | null
          status?: string
          target_value: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          current_value?: number
          goal_id?: string
          id?: string
          progress?: number | null
          status?: string
          target_value?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_vendors_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          end_date: string
          goal_type: string
          id: string
          start_date: string
          target_value: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          end_date: string
          goal_type: string
          id?: string
          start_date: string
          target_value: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          end_date?: string
          goal_type?: string
          id?: string
          start_date?: string
          target_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      insights: {
        Row: {
          created_at: string
          id: string
          image_analysis_data: Json | null
          insight_type: string | null
          intention: string | null
          message_id: string
          next_action: string | null
          objection: string | null
          sentiment: string | null
          suggestion: string | null
          temperature: Database["public"]["Enums"]["lead_temperature"] | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_analysis_data?: Json | null
          insight_type?: string | null
          intention?: string | null
          message_id: string
          next_action?: string | null
          objection?: string | null
          sentiment?: string | null
          suggestion?: string | null
          temperature?: Database["public"]["Enums"]["lead_temperature"] | null
        }
        Update: {
          created_at?: string
          id?: string
          image_analysis_data?: Json | null
          insight_type?: string | null
          intention?: string | null
          message_id?: string
          next_action?: string | null
          objection?: string | null
          sentiment?: string | null
          suggestion?: string | null
          temperature?: Database["public"]["Enums"]["lead_temperature"] | null
        }
        Relationships: [
          {
            foreignKeyName: "insights_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard: {
        Row: {
          company_id: string
          id: string
          period: string
          period_start: string
          position: number | null
          total_points: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          company_id: string
          id?: string
          period: string
          period_start: string
          position?: number | null
          total_points?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          company_id?: string
          id?: string
          period?: string
          period_start?: string
          position?: number | null
          total_points?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          buyer_id: string | null
          client_id: string | null
          content: string
          customer_id: string
          cycle_id: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          id: string
          seller_id: string
          timestamp: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          buyer_id?: string | null
          client_id?: string | null
          content: string
          customer_id: string
          cycle_id?: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          id?: string
          seller_id: string
          timestamp?: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          buyer_id?: string | null
          client_id?: string | null
          content?: string
          customer_id?: string
          cycle_id?: string | null
          direction?: Database["public"]["Enums"]["message_direction"]
          id?: string
          seller_id?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "sale_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_history: {
        Row: {
          amount_cents: number
          company_id: string
          created_at: string
          currency: string
          description: string | null
          id: string
          paid_at: string | null
          status: string
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount_cents: number
          company_id: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          paid_at?: string | null
          status: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount_cents?: number
          company_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          paid_at?: string | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          annual_price: number
          created_at: string
          description: string | null
          features: Json | null
          id: string
          is_active: boolean
          monthly_price: number
          name: string
          seller_limit: number | null
          stripe_annual_price_id: string | null
          stripe_monthly_price_id: string | null
          updated_at: string
          visible_to_managers: boolean
        }
        Insert: {
          annual_price?: number
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          monthly_price?: number
          name: string
          seller_limit?: number | null
          stripe_annual_price_id?: string | null
          stripe_monthly_price_id?: string | null
          updated_at?: string
          visible_to_managers?: boolean
        }
        Update: {
          annual_price?: number
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          monthly_price?: number
          name?: string
          seller_limit?: number | null
          stripe_annual_price_id?: string | null
          stripe_monthly_price_id?: string | null
          updated_at?: string
          visible_to_managers?: boolean
        }
        Relationships: []
      }
      processing_queue: {
        Row: {
          attempts: number
          company_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          max_attempts: number
          payload: Json
          priority: number
          started_at: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          company_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          payload?: Json
          priority?: number
          started_at?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          company_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          payload?: Json
          priority?: number
          started_at?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          seller_followups_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          name: string
          seller_followups_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          seller_followups_enabled?: boolean
          updated_at?: string
          user_id?: string
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
      queue_usage_hourly: {
        Row: {
          ai_ops_count: number
          avg_processing_time_ms: number | null
          company_id: string
          created_at: string
          hour: string
          id: string
          messages_count: number
          queue_size_peak: number
          requests_count: number
        }
        Insert: {
          ai_ops_count?: number
          avg_processing_time_ms?: number | null
          company_id: string
          created_at?: string
          hour: string
          id?: string
          messages_count?: number
          queue_size_peak?: number
          requests_count?: number
        }
        Update: {
          ai_ops_count?: number
          avg_processing_time_ms?: number | null
          company_id?: string
          created_at?: string
          hour?: string
          id?: string
          messages_count?: number
          queue_size_peak?: number
          requests_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "queue_usage_hourly_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_cycles: {
        Row: {
          buyer_id: string | null
          client_id: string | null
          closed_at: string | null
          created_at: string
          customer_id: string
          cycle_type: string
          id: string
          last_activity_at: string | null
          lost_reason: string | null
          seller_id: string
          start_message_id: string | null
          start_message_timestamp: string | null
          status: Database["public"]["Enums"]["lead_status"]
          won_summary: string | null
        }
        Insert: {
          buyer_id?: string | null
          client_id?: string | null
          closed_at?: string | null
          created_at?: string
          customer_id: string
          cycle_type?: string
          id?: string
          last_activity_at?: string | null
          lost_reason?: string | null
          seller_id: string
          start_message_id?: string | null
          start_message_timestamp?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          won_summary?: string | null
        }
        Update: {
          buyer_id?: string | null
          client_id?: string | null
          closed_at?: string | null
          created_at?: string
          customer_id?: string
          cycle_type?: string
          id?: string
          last_activity_at?: string | null
          lost_reason?: string | null
          seller_id?: string
          start_message_id?: string | null
          start_message_timestamp?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          won_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_cycles_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_cycles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_cycles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_cycles_start_message_id_fkey"
            columns: ["start_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          company_id: string | null
          created_at: string
          customer_id: string
          id: string
          reason: string | null
          seller_id: string
          status: Database["public"]["Enums"]["sale_status"]
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          customer_id: string
          id?: string
          reason?: string | null
          seller_id: string
          status: Database["public"]["Enums"]["sale_status"]
        }
        Update: {
          company_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          reason?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["sale_status"]
        }
        Relationships: [
          {
            foreignKeyName: "sales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
      whatsapp_sessions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          last_connected_at: string | null
          phone_number: string | null
          seller_id: string
          session_data: Json | null
          status: Database["public"]["Enums"]["whatsapp_session_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_connected_at?: string | null
          phone_number?: string | null
          seller_id: string
          session_data?: Json | null
          status?: Database["public"]["Enums"]["whatsapp_session_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_connected_at?: string | null
          phone_number?: string | null
          seller_id?: string
          session_data?: Json | null
          status?: Database["public"]["Enums"]["whatsapp_session_status"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      close_sale_cycle: {
        Args: {
          _cycle_id: string
          _reason?: string
          _status: Database["public"]["Enums"]["lead_status"]
          _summary?: string
        }
        Returns: undefined
      }
      get_or_create_active_cycle: {
        Args: { _customer_id: string; _seller_id: string }
        Returns: string
      }
      get_user_company: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_user_company_active: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "seller" | "manager" | "admin"
      lead_status: "pending" | "in_progress" | "won" | "lost" | "closed"
      lead_temperature: "hot" | "warm" | "cold"
      message_direction: "incoming" | "outgoing"
      sale_status: "won" | "lost"
      whatsapp_session_status:
        | "connected"
        | "disconnected"
        | "pending"
        | "expired"
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
      app_role: ["seller", "manager", "admin"],
      lead_status: ["pending", "in_progress", "won", "lost", "closed"],
      lead_temperature: ["hot", "warm", "cold"],
      message_direction: ["incoming", "outgoing"],
      sale_status: ["won", "lost"],
      whatsapp_session_status: [
        "connected",
        "disconnected",
        "pending",
        "expired",
      ],
    },
  },
} as const
