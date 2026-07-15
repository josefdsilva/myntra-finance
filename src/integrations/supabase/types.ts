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
      account_movements: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          from_id: string | null
          from_type: Database["public"]["Enums"]["movement_account_type"] | null
          household_id: string
          id: string
          kind: Database["public"]["Enums"]["movement_kind"]
          note: string | null
          period: string
          principal_after: number | null
          principal_before: number | null
          reason: string | null
          recompute_mode: string | null
          to_id: string | null
          to_type: Database["public"]["Enums"]["movement_account_type"] | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          from_id?: string | null
          from_type?:
            | Database["public"]["Enums"]["movement_account_type"]
            | null
          household_id: string
          id?: string
          kind: Database["public"]["Enums"]["movement_kind"]
          note?: string | null
          period: string
          principal_after?: number | null
          principal_before?: number | null
          reason?: string | null
          recompute_mode?: string | null
          to_id?: string | null
          to_type?: Database["public"]["Enums"]["movement_account_type"] | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          from_id?: string | null
          from_type?:
            | Database["public"]["Enums"]["movement_account_type"]
            | null
          household_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["movement_kind"]
          note?: string | null
          period?: string
          principal_after?: number | null
          principal_before?: number | null
          reason?: string | null
          recompute_mode?: string | null
          to_id?: string | null
          to_type?: Database["public"]["Enums"]["movement_account_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "account_movements_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_overviews: {
        Row: {
          content: string
          cycle_start: string
          generated_at: string
          household_id: string
          model: string | null
        }
        Insert: {
          content: string
          cycle_start: string
          generated_at?: string
          household_id: string
          model?: string | null
        }
        Update: {
          content?: string
          cycle_start?: string
          generated_at?: string
          household_id?: string
          model?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_overviews_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
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
      bucket_allocations: {
        Row: {
          amount: number
          bucket_id: string
          confirmed_at: string
          confirmed_by: string
          created_at: string
          household_id: string
          id: string
          note: string | null
          period: string
          updated_at: string
        }
        Insert: {
          amount: number
          bucket_id: string
          confirmed_at?: string
          confirmed_by: string
          created_at?: string
          household_id: string
          id?: string
          note?: string | null
          period: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bucket_id?: string
          confirmed_at?: string
          confirmed_by?: string
          created_at?: string
          household_id?: string
          id?: string
          note?: string | null
          period?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bucket_allocations_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bucket_allocations_household_id_fkey"
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
          initial_balance: number
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
          initial_balance?: number
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
          initial_balance?: number
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
      credit_usage: {
        Row: {
          created_at: string
          credits: number
          household_id: string
          id: string
          input_tokens: number | null
          meta: Json
          operation: string
          output_tokens: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          credits?: number
          household_id: string
          id?: string
          input_tokens?: number | null
          meta?: Json
          operation: string
          output_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          credits?: number
          household_id?: string
          id?: string
          input_tokens?: number | null
          meta?: Json
          operation?: string
          output_tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_usage_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_reports: {
        Row: {
          cycle_start: string
          generated_at: string
          household_id: string
          model: string | null
          narrative: string
        }
        Insert: {
          cycle_start: string
          generated_at?: string
          household_id: string
          model?: string | null
          narrative: string
        }
        Update: {
          cycle_start?: string
          generated_at?: string
          household_id?: string
          model?: string | null
          narrative?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_reports_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_rules: {
        Row: {
          category: string
          created_at: string
          household_id: string
          id: string
          merchant_key: string
          source: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          household_id: string
          id?: string
          merchant_key: string
          source?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          household_id?: string
          id?: string
          merchant_key?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_rules_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          created_at: string
          deduced_rate_pct: number | null
          household_id: string
          id: string
          kind: string
          label: string
          last_recompute_at: string | null
          maturity_date: string | null
          monthly_amount: number
          note: string | null
          opened_at: string | null
          principal_remaining: number | null
          sort_order: number
          starting_principal: number | null
          taeg_pct: number | null
          tan_pct: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deduced_rate_pct?: number | null
          household_id: string
          id?: string
          kind?: string
          label: string
          last_recompute_at?: string | null
          maturity_date?: string | null
          monthly_amount?: number
          note?: string | null
          opened_at?: string | null
          principal_remaining?: number | null
          sort_order?: number
          starting_principal?: number | null
          taeg_pct?: number | null
          tan_pct?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deduced_rate_pct?: number | null
          household_id?: string
          id?: string
          kind?: string
          label?: string
          last_recompute_at?: string | null
          maturity_date?: string | null
          monthly_amount?: number
          note?: string | null
          opened_at?: string | null
          principal_remaining?: number | null
          sort_order?: number
          starting_principal?: number | null
          taeg_pct?: number | null
          tan_pct?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "debts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          household_id: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_household_id_fkey"
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
          is_salary: boolean
          kind: Database["public"]["Enums"]["entry_kind"]
          labels: string[]
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
          is_salary?: boolean
          kind?: Database["public"]["Enums"]["entry_kind"]
          labels?: string[]
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
          is_salary?: boolean
          kind?: Database["public"]["Enums"]["entry_kind"]
          labels?: string[]
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
          adults: number
          baseline_budget: number
          children: number
          country: string
          created_at: string
          created_by: string
          credit_cap: number
          currency: string
          id: string
          margin_pct: number
          name: string
          onboarded_at: string | null
          updated_at: string
        }
        Insert: {
          adults?: number
          baseline_budget?: number
          children?: number
          country?: string
          created_at?: string
          created_by: string
          credit_cap?: number
          currency?: string
          id?: string
          margin_pct?: number
          name?: string
          onboarded_at?: string | null
          updated_at?: string
        }
        Update: {
          adults?: number
          baseline_budget?: number
          children?: number
          country?: string
          created_at?: string
          created_by?: string
          credit_cap?: number
          currency?: string
          id?: string
          margin_pct?: number
          name?: string
          onboarded_at?: string | null
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
      notification_log: {
        Row: {
          id: string
          kind: string
          payload_hash: string
          sent_at: string
          user_id: string
        }
        Insert: {
          id?: string
          kind: string
          payload_hash: string
          sent_at?: string
          user_id: string
        }
        Update: {
          id?: string
          kind?: string
          payload_hash?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_prefs: {
        Row: {
          baseline_warn: boolean
          emergency_warn: boolean
          updated_at: string
          user_id: string
          weekly_digest: boolean
        }
        Insert: {
          baseline_warn?: boolean
          emergency_warn?: boolean
          updated_at?: string
          user_id: string
          weekly_digest?: boolean
        }
        Update: {
          baseline_warn?: boolean
          emergency_warn?: boolean
          updated_at?: string
          user_id?: string
          weekly_digest?: boolean
        }
        Relationships: []
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          household_id: string | null
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          household_id?: string | null
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          household_id?: string | null
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      variable_estimates: {
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
            foreignKeyName: "variable_estimates_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fund_deposit: {
        Args: {
          p_amount: number
          p_bucket: string
          p_household: string
          p_note?: string
          p_period?: string
          p_reason?: string
        }
        Returns: string
      }
      fund_transfer: {
        Args: {
          p_amount: number
          p_from_bucket: string
          p_household: string
          p_note?: string
          p_period?: string
          p_reason?: string
          p_to_bucket: string
        }
        Returns: string
      }
      fund_withdrawal: {
        Args: {
          p_amount: number
          p_bucket: string
          p_household: string
          p_note?: string
          p_period?: string
          p_reason?: string
        }
        Returns: string
      }
      service_debt: {
        Args: {
          p_amount: number
          p_as_of?: string
          p_debt: string
          p_household: string
          p_new_installment?: number
          p_new_maturity?: string
          p_new_principal?: number
          p_note?: string
          p_period?: string
          p_reason?: string
          p_recompute_mode?: string
          p_source_bucket?: string
          p_source_type: string
        }
        Returns: string
      }
    }
    Enums: {
      bucket_target_type:
        | "pct_surplus"
        | "fixed_monthly"
        | "fixed_yearly"
        | "goal_by_date"
      entry_kind: "expense" | "income"
      expense_source:
        | "manual"
        | "ai_memo"
        | "ai_voice"
        | "statement"
        | "ai_photo"
      import_status: "pending" | "parsed" | "approved" | "failed"
      member_role: "owner" | "member"
      movement_account_type: "cash" | "bucket" | "debt"
      movement_kind: "deposit" | "withdrawal" | "transfer" | "debt_payment"
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
      bucket_target_type: [
        "pct_surplus",
        "fixed_monthly",
        "fixed_yearly",
        "goal_by_date",
      ],
      entry_kind: ["expense", "income"],
      expense_source: [
        "manual",
        "ai_memo",
        "ai_voice",
        "statement",
        "ai_photo",
      ],
      import_status: ["pending", "parsed", "approved", "failed"],
      member_role: ["owner", "member"],
      movement_account_type: ["cash", "bucket", "debt"],
      movement_kind: ["deposit", "withdrawal", "transfer", "debt_payment"],
    },
  },
} as const
