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
      companies: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          segment: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          segment?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          segment?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
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
            foreignKeyName: "customers_company_id_fkey"
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
      messages: {
        Row: {
          content: string
          customer_id: string
          cycle_id: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          id: string
          seller_id: string
          timestamp: string
        }
        Insert: {
          content: string
          customer_id: string
          cycle_id?: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          id?: string
          seller_id: string
          timestamp?: string
        }
        Update: {
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
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
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
      sale_cycles: {
        Row: {
          closed_at: string | null
          created_at: string
          customer_id: string
          id: string
          last_activity_at: string | null
          lost_reason: string | null
          seller_id: string
          status: Database["public"]["Enums"]["lead_status"]
          won_summary: string | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          customer_id: string
          id?: string
          last_activity_at?: string | null
          lost_reason?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["lead_status"]
          won_summary?: string | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          last_activity_at?: string | null
          lost_reason?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["lead_status"]
          won_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_cycles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
    }
    Enums: {
      app_role: "seller" | "manager" | "admin"
      lead_status: "pending" | "in_progress" | "won" | "lost"
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
      lead_status: ["pending", "in_progress", "won", "lost"],
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
