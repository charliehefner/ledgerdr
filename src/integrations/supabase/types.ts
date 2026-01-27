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
      accounts: {
        Row: {
          code: string
          created_at: string
          english_description: string
          id: string
          spanish_description: string
        }
        Insert: {
          code: string
          created_at?: string
          english_description: string
          id?: string
          spanish_description: string
        }
        Update: {
          code?: string
          created_at?: string
          english_description?: string
          id?: string
          spanish_description?: string
        }
        Relationships: []
      }
      cbs_codes: {
        Row: {
          code: string
          created_at: string
          english_description: string
          id: string
          spanish_description: string
        }
        Insert: {
          code: string
          created_at?: string
          english_description: string
          id?: string
          spanish_description: string
        }
        Update: {
          code?: string
          created_at?: string
          english_description?: string
          id?: string
          spanish_description?: string
        }
        Relationships: []
      }
      day_labor_entries: {
        Row: {
          amount: number
          created_at: string
          id: string
          is_closed: boolean
          operation_description: string
          updated_at: string
          week_ending_date: string
          work_date: string
          worker_name: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          is_closed?: boolean
          operation_description: string
          updated_at?: string
          week_ending_date: string
          work_date: string
          worker_name: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          is_closed?: boolean
          operation_description?: string
          updated_at?: string
          week_ending_date?: string
          work_date?: string
          worker_name?: string
        }
        Relationships: []
      }
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
          is_holiday: boolean
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
          is_holiday?: boolean
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
          is_holiday?: boolean
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
          position: string
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
          position?: string
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
          position?: string
          salary?: number
          shirt_size?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      farms: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      fields: {
        Row: {
          created_at: string
          farm_id: string
          hectares: number | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          farm_id: string
          hectares?: number | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          farm_id?: string
          hectares?: number | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fields_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_equipment: {
        Row: {
          brand: string | null
          created_at: string
          current_hour_meter: number
          equipment_type: string
          hp: number | null
          id: string
          is_active: boolean
          model: string | null
          name: string
          purchase_date: string | null
          purchase_price: number | null
          serial_number: string | null
          updated_at: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          current_hour_meter?: number
          equipment_type: string
          hp?: number | null
          id?: string
          is_active?: boolean
          model?: string | null
          name: string
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          updated_at?: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          current_hour_meter?: number
          equipment_type?: string
          hp?: number | null
          id?: string
          is_active?: boolean
          model?: string | null
          name?: string
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fuel_tanks: {
        Row: {
          capacity_gallons: number
          created_at: string
          current_level_gallons: number
          fuel_type: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          use_type: string
        }
        Insert: {
          capacity_gallons: number
          created_at?: string
          current_level_gallons?: number
          fuel_type?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          use_type: string
        }
        Update: {
          capacity_gallons?: number
          created_at?: string
          current_level_gallons?: number
          fuel_type?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          use_type?: string
        }
        Relationships: []
      }
      fuel_transactions: {
        Row: {
          created_at: string
          equipment_id: string | null
          gallons: number
          gallons_per_hour: number | null
          hour_meter_reading: number | null
          id: string
          notes: string | null
          previous_hour_meter: number | null
          pump_end_reading: number | null
          pump_start_reading: number | null
          tank_id: string
          transaction_date: string
          transaction_type: string
        }
        Insert: {
          created_at?: string
          equipment_id?: string | null
          gallons: number
          gallons_per_hour?: number | null
          hour_meter_reading?: number | null
          id?: string
          notes?: string | null
          previous_hour_meter?: number | null
          pump_end_reading?: number | null
          pump_start_reading?: number | null
          tank_id: string
          transaction_date?: string
          transaction_type: string
        }
        Update: {
          created_at?: string
          equipment_id?: string | null
          gallons?: number
          gallons_per_hour?: number | null
          hour_meter_reading?: number | null
          id?: string
          notes?: string | null
          previous_hour_meter?: number | null
          pump_end_reading?: number | null
          pump_start_reading?: number | null
          tank_id?: string
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_transactions_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "fuel_equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_transactions_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "fuel_tanks"
            referencedColumns: ["id"]
          },
        ]
      }
      implements: {
        Row: {
          brand: string | null
          created_at: string
          id: string
          implement_type: string
          is_active: boolean
          model: string | null
          name: string
          purchase_date: string | null
          purchase_price: number | null
          serial_number: string | null
          updated_at: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          id?: string
          implement_type: string
          is_active?: boolean
          model?: string | null
          name: string
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          updated_at?: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          id?: string
          implement_type?: string
          is_active?: boolean
          model?: string | null
          name?: string
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          co2_equivalent: number | null
          commercial_name: string
          created_at: string
          current_quantity: number
          function: Database["public"]["Enums"]["inventory_function"]
          id: string
          is_active: boolean
          molecule_name: string | null
          price_per_purchase_unit: number
          purchase_unit_quantity: number
          purchase_unit_type: string
          sack_weight_kg: number | null
          supplier: string | null
          updated_at: string
          use_unit: string
        }
        Insert: {
          co2_equivalent?: number | null
          commercial_name: string
          created_at?: string
          current_quantity?: number
          function?: Database["public"]["Enums"]["inventory_function"]
          id?: string
          is_active?: boolean
          molecule_name?: string | null
          price_per_purchase_unit?: number
          purchase_unit_quantity?: number
          purchase_unit_type?: string
          sack_weight_kg?: number | null
          supplier?: string | null
          updated_at?: string
          use_unit?: string
        }
        Update: {
          co2_equivalent?: number | null
          commercial_name?: string
          created_at?: string
          current_quantity?: number
          function?: Database["public"]["Enums"]["inventory_function"]
          id?: string
          is_active?: boolean
          molecule_name?: string | null
          price_per_purchase_unit?: number
          purchase_unit_quantity?: number
          purchase_unit_type?: string
          sack_weight_kg?: number | null
          supplier?: string | null
          updated_at?: string
          use_unit?: string
        }
        Relationships: []
      }
      inventory_purchases: {
        Row: {
          created_at: string
          document_number: string | null
          id: string
          item_id: string
          notes: string | null
          packaging_quantity: number
          packaging_unit: string
          purchase_date: string
          quantity: number
          supplier: string | null
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          document_number?: string | null
          id?: string
          item_id: string
          notes?: string | null
          packaging_quantity?: number
          packaging_unit?: string
          purchase_date?: string
          quantity: number
          supplier?: string | null
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          document_number?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          packaging_quantity?: number
          packaging_unit?: string
          purchase_date?: string
          quantity?: number
          supplier?: string | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_purchases_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_inputs: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          operation_id: string
          quantity_used: number
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          operation_id: string
          quantity_used: number
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          operation_id?: string
          quantity_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "operation_inputs_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_inputs_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_mechanical: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_mechanical?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_mechanical?: boolean
          name?: string
        }
        Relationships: []
      }
      operations: {
        Row: {
          created_at: string
          end_hours: number | null
          field_id: string
          hectares_done: number
          id: string
          implement_id: string | null
          notes: string | null
          operation_date: string
          operation_type_id: string
          start_hours: number | null
          tractor_id: string | null
          updated_at: string
          workers_count: number | null
        }
        Insert: {
          created_at?: string
          end_hours?: number | null
          field_id: string
          hectares_done: number
          id?: string
          implement_id?: string | null
          notes?: string | null
          operation_date?: string
          operation_type_id: string
          start_hours?: number | null
          tractor_id?: string | null
          updated_at?: string
          workers_count?: number | null
        }
        Update: {
          created_at?: string
          end_hours?: number | null
          field_id?: string
          hectares_done?: number
          id?: string
          implement_id?: string | null
          notes?: string | null
          operation_date?: string
          operation_type_id?: string
          start_hours?: number | null
          tractor_id?: string | null
          updated_at?: string
          workers_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "operations_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operations_implement_id_fkey"
            columns: ["implement_id"]
            isOneToOne: false
            referencedRelation: "implements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operations_operation_type_id_fkey"
            columns: ["operation_type_id"]
            isOneToOne: false
            referencedRelation: "operation_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operations_tractor_id_fkey"
            columns: ["tractor_id"]
            isOneToOne: false
            referencedRelation: "fuel_equipment"
            referencedColumns: ["id"]
          },
        ]
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
      projects: {
        Row: {
          code: string
          created_at: string
          english_description: string
          id: string
          spanish_description: string
        }
        Insert: {
          code: string
          created_at?: string
          english_description: string
          id?: string
          spanish_description: string
        }
        Update: {
          code?: string
          created_at?: string
          english_description?: string
          id?: string
          spanish_description?: string
        }
        Relationships: []
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
      transactions: {
        Row: {
          amount: number
          cbs_code: string | null
          comments: string | null
          created_at: string
          currency: string
          description: string
          document: string | null
          id: string
          is_void: boolean
          itbis: number | null
          legacy_id: number | null
          master_acct_code: string | null
          name: string | null
          pay_method: string | null
          project_code: string | null
          transaction_date: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          amount?: number
          cbs_code?: string | null
          comments?: string | null
          created_at?: string
          currency?: string
          description?: string
          document?: string | null
          id?: string
          is_void?: boolean
          itbis?: number | null
          legacy_id?: number | null
          master_acct_code?: string | null
          name?: string | null
          pay_method?: string | null
          project_code?: string | null
          transaction_date: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          amount?: number
          cbs_code?: string | null
          comments?: string | null
          created_at?: string
          currency?: string
          description?: string
          document?: string | null
          id?: string
          is_void?: boolean
          itbis?: number | null
          legacy_id?: number | null
          master_acct_code?: string | null
          name?: string | null
          pay_method?: string | null
          project_code?: string | null
          transaction_date?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
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
      app_role: "admin" | "accountant" | "management" | "supervisor" | "viewer"
      inventory_function:
        | "fertilizer"
        | "fuel"
        | "pre_emergent_herbicide"
        | "post_emergent_herbicide"
        | "pesticide"
        | "fungicide"
        | "insecticide"
        | "seed"
        | "other"
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
      app_role: ["admin", "accountant", "management", "supervisor", "viewer"],
      inventory_function: [
        "fertilizer",
        "fuel",
        "pre_emergent_herbicide",
        "post_emergent_herbicide",
        "pesticide",
        "fungicide",
        "insecticide",
        "seed",
        "other",
      ],
    },
  },
} as const
