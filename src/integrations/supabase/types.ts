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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      employee_benefits: {
        Row: {
          amount: number
          benefit_type: string
          created_at: string
          employee_id: string
          id: string
          is_recurring: boolean
          updated_at: string
        }
        Insert: {
          amount?: number
          benefit_type: string
          created_at?: string
          employee_id: string
          id?: string
          is_recurring?: boolean
          updated_at?: string
        }
        Update: {
          amount?: number
          benefit_type?: string
          created_at?: string
          employee_id?: string
          id?: string
          is_recurring?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_benefits_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          created_at: string
          document_name: string
          document_type: string
          employee_id: string
          id: string
          notes: string | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          document_name: string
          document_type: string
          employee_id: string
          id?: string
          notes?: string | null
          storage_path: string
        }
        Update: {
          created_at?: string
          document_name?: string
          document_type?: string
          employee_id?: string
          id?: string
          notes?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_incidents: {
        Row: {
          created_at: string
          description: string
          employee_id: string
          id: string
          incident_date: string
          resolution: string | null
          severity: string | null
        }
        Insert: {
          created_at?: string
          description: string
          employee_id: string
          id?: string
          incident_date: string
          resolution?: string | null
          severity?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          employee_id?: string
          id?: string
          incident_date?: string
          resolution?: string | null
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_incidents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_salary_history: {
        Row: {
          created_at: string
          effective_date: string
          employee_id: string
          id: string
          notes: string | null
          salary: number
        }
        Insert: {
          created_at?: string
          effective_date: string
          employee_id: string
          id?: string
          notes?: string | null
          salary: number
        }
        Update: {
          created_at?: string
          effective_date?: string
          employee_id?: string
          id?: string
          notes?: string | null
          salary?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_salary_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_timesheets: {
        Row: {
          created_at: string
          employee_id: string
          end_time: string | null
          hours_worked: number | null
          id: string
          is_absent: boolean
          notes: string | null
          period_id: string
          start_time: string | null
          updated_at: string
          work_date: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          end_time?: string | null
          hours_worked?: number | null
          id?: string
          is_absent?: boolean
          notes?: string | null
          period_id: string
          start_time?: string | null
          updated_at?: string
          work_date: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          end_time?: string | null
          hours_worked?: number | null
          id?: string
          is_absent?: boolean
          notes?: string | null
          period_id?: string
          start_time?: string | null
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_timesheets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_timesheets_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_vacations: {
        Row: {
          created_at: string
          employee_id: string
          end_date: string
          id: string
          notes: string | null
          start_date: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          end_date: string
          id?: string
          notes?: string | null
          start_date: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          end_date?: string
          id?: string
          notes?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_vacations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          bank: string | null
          bank_account_number: string | null
          boot_size: string | null
          cedula: string
          created_at: string
          date_of_birth: string | null
          date_of_hire: string
          id: string
          is_active: boolean
          name: string
          pant_size: string | null
          salary: number
          shirt_size: string | null
          updated_at: string
        }
        Insert: {
          bank?: string | null
          bank_account_number?: string | null
          boot_size?: string | null
          cedula: string
          created_at?: string
          date_of_birth?: string | null
          date_of_hire: string
          id?: string
          is_active?: boolean
          name: string
          pant_size?: string | null
          salary?: number
          shirt_size?: string | null
          updated_at?: string
        }
        Update: {
          bank?: string | null
          bank_account_number?: string | null
          boot_size?: string | null
          cedula?: string
          created_at?: string
          date_of_birth?: string | null
          date_of_hire?: string
          id?: string
          is_active?: boolean
          name?: string
          pant_size?: string | null
          salary?: number
          shirt_size?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payroll_periods: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_current: boolean
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_current?: boolean
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_current?: boolean
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      period_employee_benefits: {
        Row: {
          amount: number
          benefit_type: string
          created_at: string
          employee_id: string
          id: string
          period_id: string
        }
        Insert: {
          amount?: number
          benefit_type: string
          created_at?: string
          employee_id: string
          id?: string
          period_id: string
        }
        Update: {
          amount?: number
          benefit_type?: string
          created_at?: string
          employee_id?: string
          id?: string
          period_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "period_employee_benefits_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "period_employee_benefits_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_attachments: {
        Row: {
          attachment_url: string
          created_at: string
          id: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          attachment_url: string
          created_at?: string
          id?: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          attachment_url?: string
          created_at?: string
          id?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      transaction_edits: {
        Row: {
          created_at: string
          document: string | null
          id: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document?: string | null
          id?: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document?: string | null
          id?: string
          transaction_id?: string
          updated_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
    }
    Enums: {
      app_role: "admin" | "accountant"
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
      app_role: ["admin", "accountant"],
    },
  },
} as const
