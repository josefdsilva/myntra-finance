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
      bank_imports: {
        Row: {
          created_at: string
          file_name: string | null
          household_id: string
          id: string
          raw_extract: Json | null
          status: Database["public"]["Enums"]["import_status"]
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          household_id: string
          id?: string
          raw_extract?: Json | null
          status?: Database["public"]["Enums"]["import_status"]
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string | null
          household_id?: string
          id?: string
          raw_extract?: Json | null
          status?: Database["public"]["Enums"]["import_status"]
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_imports_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      buckets: {
        Row: {
          color: string | null
          created_at: string
          household_id: string
          id: string
          name: string
          sort_order: number
          target_deadline: string | null
          target_type: Database["public"]["Enums"]["bucket_target_type"]
          target_value: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          household_id: string
          id?: string
          name: string
          sort_order?: number
          target_deadline?: string | null
          target_type?: Database["public"]["Enums"]["bucket_target_type"]
          target_value?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          household_id?: string
          id?: string
          name?: string
          sort_order?: number
          target_deadline?: string | null
          target_type?: Database["public"]["Enums"]["bucket_target_type"]
          target_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buckets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          added_by_user_id: string | null
          amount: number
          category: string
          created_at: string
          household_id: string
          id: string
          merchant: string | null
          note: string | null
          occurred_at: string
          source: Database["public"]["Enums"]["expense_source"]
          source_meta: Json | null
        }
        Insert: {
          added_by_user_id?: string | null
          amount: number
          category?: string
          created_at?: string
          household_id: string
          id?: string
          merchant?: string | null
          note?: string | null
          occurred_at?: string
          source?: Database["public"]["Enums"]["expense_source"]
          source_meta?: Json | null
        }
        Update: {
          added_by_user_id?: string | null
          amount?: number
          category?: string
          created_at?: string
          household_id?: string
          id?: string
          merchant?: string | null
          note?: string | null
          occurred_at?: string
          source?: Database["public"]["Enums"]["expense_source"]
          source_meta?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_expenses: {
        Row: {
          category: string | null
          created_at: string
          household_id: string
          id: string
          label: string
          monthly_amount: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          household_id: string
          id?: string
          label: string
          monthly_amount?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          household_id?: string
          id?: string
          label?: string
          monthly_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_expenses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          household_id: string
          id: string
          invited_by: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          household_id: string
          id?: string
          invited_by: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          household_id?: string
          id?: string
          invited_by?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_invitations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          household_id: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          household_id: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          household_id?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          baseline_budget: number
          created_at: string
          created_by: string
          currency: string
          id: string
          margin_pct: number
          name: string
          updated_at: string
        }
        Insert: {
          baseline_budget?: number
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          margin_pct?: number
          name?: string
          updated_at?: string
        }
        Update: {
          baseline_budget?: number
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          margin_pct?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      incomes: {
        Row: {
          created_at: string
          household_id: string
          id: string
          label: string
          monthly_amount: number
          owner_user_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          label: string
          monthly_amount?: number
          owner_user_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          label?: string
          monthly_amount?: number
          owner_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incomes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
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
      [_ in never]: never
    }
    Enums: {
      bucket_target_type: "pct_surplus" | "fixed_monthly" | "fixed_yearly"
      expense_source: "manual" | "ai_memo" | "ai_voice" | "statement"
      import_status: "pending" | "parsed" | "approved" | "failed"
      member_role: "owner" | "member"
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
      bucket_target_type: ["pct_surplus", "fixed_monthly", "fixed_yearly"],
      expense_source: ["manual", "ai_memo", "ai_voice", "statement"],
      import_status: ["pending", "parsed", "approved", "failed"],
      member_role: ["owner", "member"],
    },
  },
} as const
