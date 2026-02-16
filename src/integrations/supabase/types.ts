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
      alert_configurations: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          is_active: boolean
          threshold_value: number | null
          updated_at: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          is_active?: boolean
          threshold_value?: number | null
          updated_at?: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          threshold_value?: number | null
          updated_at?: string
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
      cronograma_entries: {
        Row: {
          created_at: string
          created_by: string | null
          day_of_week: number
          id: string
          is_holiday: boolean | null
          is_vacation: boolean | null
          source_operation_id: string | null
          task: string | null
          time_slot: string
          updated_at: string
          updated_by: string | null
          week_ending_date: string
          worker_id: string | null
          worker_name: string
          worker_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          day_of_week: number
          id?: string
          is_holiday?: boolean | null
          is_vacation?: boolean | null
          source_operation_id?: string | null
          task?: string | null
          time_slot: string
          updated_at?: string
          updated_by?: string | null
          week_ending_date: string
          worker_id?: string | null
          worker_name: string
          worker_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          day_of_week?: number
          id?: string
          is_holiday?: boolean | null
          is_vacation?: boolean | null
          source_operation_id?: string | null
          task?: string | null
          time_slot?: string
          updated_at?: string
          updated_by?: string | null
          week_ending_date?: string
          worker_id?: string | null
          worker_name?: string
          worker_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_entries_source_operation_id_fkey"
            columns: ["source_operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_weeks: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          is_closed: boolean | null
          updated_at: string
          week_ending_date: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          is_closed?: boolean | null
          updated_at?: string
          week_ending_date: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          is_closed?: boolean | null
          updated_at?: string
          week_ending_date?: string
        }
        Relationships: []
      }
      day_labor_attachments: {
        Row: {
          attachment_url: string
          created_at: string
          id: string
          updated_at: string
          week_ending_date: string
        }
        Insert: {
          attachment_url: string
          created_at?: string
          id?: string
          updated_at?: string
          week_ending_date: string
        }
        Update: {
          attachment_url?: string
          created_at?: string
          id?: string
          updated_at?: string
          week_ending_date?: string
        }
        Relationships: []
      }
      day_labor_entries: {
        Row: {
          amount: number
          created_at: string
          field_name: string | null
          id: string
          is_closed: boolean
          operation_description: string
          updated_at: string
          week_ending_date: string
          work_date: string
          worker_name: string
          workers_count: number
        }
        Insert: {
          amount?: number
          created_at?: string
          field_name?: string | null
          id?: string
          is_closed?: boolean
          operation_description: string
          updated_at?: string
          week_ending_date: string
          work_date: string
          worker_name: string
          workers_count?: number
        }
        Update: {
          amount?: number
          created_at?: string
          field_name?: string | null
          id?: string
          is_closed?: boolean
          operation_description?: string
          updated_at?: string
          week_ending_date?: string
          work_date?: string
          worker_name?: string
          workers_count?: number
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
          {
            foreignKeyName: "employee_benefits_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_safe"
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
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_safe"
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
          {
            foreignKeyName: "employee_incidents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_loans: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          is_active: boolean
          loan_amount: number
          loan_date: string
          notes: string | null
          number_of_payments: number
          payment_amount: number
          remaining_payments: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          is_active?: boolean
          loan_amount: number
          loan_date: string
          notes?: string | null
          number_of_payments: number
          payment_amount: number
          remaining_payments: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          is_active?: boolean
          loan_amount?: number
          loan_date?: string
          notes?: string | null
          number_of_payments?: number
          payment_amount?: number
          remaining_payments?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_loans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_loans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_safe"
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
          {
            foreignKeyName: "employee_salary_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_safe"
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
            foreignKeyName: "employee_timesheets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_safe"
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
          {
            foreignKeyName: "employee_vacations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_safe"
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
          boundary: unknown
          created_at: string
          farm_id: string
          hectares: number | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          boundary?: unknown
          created_at?: string
          farm_id: string
          hectares?: number | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          boundary?: unknown
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
          maintenance_interval_hours: number
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
          maintenance_interval_hours?: number
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
          maintenance_interval_hours?: number
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
          last_pump_end_reading: number | null
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
          last_pump_end_reading?: number | null
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
          last_pump_end_reading?: number | null
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
          submission_source: string | null
          submitted_by: string | null
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
          submission_source?: string | null
          submitted_by?: string | null
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
          submission_source?: string | null
          submitted_by?: string | null
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
          cas_number: string | null
          co2_equivalent: number | null
          commercial_name: string
          created_at: string
          current_quantity: number
          function: Database["public"]["Enums"]["inventory_function"]
          id: string
          is_active: boolean
          minimum_stock: number | null
          molecule_name: string | null
          normal_dose_per_ha: number | null
          price_per_purchase_unit: number
          purchase_unit_quantity: number
          purchase_unit_type: string
          sack_weight_kg: number | null
          supplier: string | null
          updated_at: string
          use_unit: string
        }
        Insert: {
          cas_number?: string | null
          co2_equivalent?: number | null
          commercial_name: string
          created_at?: string
          current_quantity?: number
          function?: Database["public"]["Enums"]["inventory_function"]
          id?: string
          is_active?: boolean
          minimum_stock?: number | null
          molecule_name?: string | null
          normal_dose_per_ha?: number | null
          price_per_purchase_unit?: number
          purchase_unit_quantity?: number
          purchase_unit_type?: string
          sack_weight_kg?: number | null
          supplier?: string | null
          updated_at?: string
          use_unit?: string
        }
        Update: {
          cas_number?: string | null
          co2_equivalent?: number | null
          commercial_name?: string
          created_at?: string
          current_quantity?: number
          function?: Database["public"]["Enums"]["inventory_function"]
          id?: string
          is_active?: boolean
          minimum_stock?: number | null
          molecule_name?: string | null
          normal_dose_per_ha?: number | null
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
      jornaleros: {
        Row: {
          cedula: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          cedula: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          cedula?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      operation_followups: {
        Row: {
          created_at: string | null
          days_offset: number
          default_driver_id: string | null
          followup_text: string
          id: string
          is_active: boolean
          trigger_operation_type_id: string
        }
        Insert: {
          created_at?: string | null
          days_offset?: number
          default_driver_id?: string | null
          followup_text: string
          id?: string
          is_active?: boolean
          trigger_operation_type_id: string
        }
        Update: {
          created_at?: string | null
          days_offset?: number
          default_driver_id?: string | null
          followup_text?: string
          id?: string
          is_active?: boolean
          trigger_operation_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operation_followups_default_driver_id_fkey"
            columns: ["default_driver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_followups_default_driver_id_fkey"
            columns: ["default_driver_id"]
            isOneToOne: false
            referencedRelation: "employees_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_followups_trigger_operation_type_id_fkey"
            columns: ["trigger_operation_type_id"]
            isOneToOne: false
            referencedRelation: "operation_types"
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
          driver: string | null
          end_hours: number | null
          field_id: string
          hectares_done: number | null
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
          driver?: string | null
          end_hours?: number | null
          field_id: string
          hectares_done?: number | null
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
          driver?: string | null
          end_hours?: number | null
          field_id?: string
          hectares_done?: number | null
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
      pending_fuel_submissions: {
        Row: {
          created_at: string | null
          expires_at: string | null
          fuel_transaction_id: string | null
          id: string
          photos: Json | null
          submitted_at: string | null
          submitted_by: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          fuel_transaction_id?: string | null
          id?: string
          photos?: Json | null
          submitted_at?: string | null
          submitted_by?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          fuel_transaction_id?: string | null
          id?: string
          photos?: Json | null
          submitted_at?: string | null
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_fuel_submissions_fuel_transaction_id_fkey"
            columns: ["fuel_transaction_id"]
            isOneToOne: false
            referencedRelation: "fuel_transactions"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "period_employee_benefits_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_safe"
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
      rainfall_records: {
        Row: {
          caoba: number | null
          created_at: string
          id: string
          palmarito: number | null
          record_date: string
          solar: number | null
          updated_at: string
          virgencita: number | null
        }
        Insert: {
          caoba?: number | null
          created_at?: string
          id?: string
          palmarito?: number | null
          record_date: string
          solar?: number | null
          updated_at?: string
          virgencita?: number | null
        }
        Update: {
          caoba?: number | null
          created_at?: string
          id?: string
          palmarito?: number | null
          record_date?: string
          solar?: number | null
          updated_at?: string
          virgencita?: number | null
        }
        Relationships: []
      }
      scheduled_user_deletions: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          execute_after: string
          executed_at: string | null
          id: string
          is_cancelled: boolean
          reason: string | null
          scheduled_at: string
          scheduled_by: string
          user_email: string
          user_id: string
          user_role: string | null
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          execute_after?: string
          executed_at?: string | null
          id?: string
          is_cancelled?: boolean
          reason?: string | null
          scheduled_at?: string
          scheduled_by: string
          user_email: string
          user_id: string
          user_role?: string | null
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          execute_after?: string
          executed_at?: string | null
          id?: string
          is_cancelled?: boolean
          reason?: string | null
          scheduled_at?: string
          scheduled_by?: string
          user_email?: string
          user_id?: string
          user_role?: string | null
        }
        Relationships: []
      }
      service_contract_entries: {
        Row: {
          calculated_cost: number
          comments: string | null
          contract_id: string
          cost_override: number | null
          created_at: string
          description: string
          entry_date: string
          id: string
          units_charged: number
          updated_at: string
        }
        Insert: {
          calculated_cost?: number
          comments?: string | null
          contract_id: string
          cost_override?: number | null
          created_at?: string
          description: string
          entry_date?: string
          id?: string
          units_charged?: number
          updated_at?: string
        }
        Update: {
          calculated_cost?: number
          comments?: string | null
          contract_id?: string
          cost_override?: number | null
          created_at?: string
          description?: string
          entry_date?: string
          id?: string
          units_charged?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_contract_entries_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "service_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      service_contract_line_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          entry_id: string
          id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          entry_id: string
          id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          entry_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_contract_line_items_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "service_contract_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      service_contract_payments: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          id: string
          notes: string | null
          payment_date: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          contract_id: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_contract_payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "service_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      service_contracts: {
        Row: {
          bank: string | null
          bank_account: string | null
          comments: string | null
          contract_name: string
          created_at: string
          farm_id: string | null
          id: string
          is_active: boolean
          operation_type: string
          operation_type_other: string | null
          owner_cedula_rnc: string | null
          owner_name: string
          price_per_unit: number
          unit_type: string
          updated_at: string
        }
        Insert: {
          bank?: string | null
          bank_account?: string | null
          comments?: string | null
          contract_name: string
          created_at?: string
          farm_id?: string | null
          id?: string
          is_active?: boolean
          operation_type: string
          operation_type_other?: string | null
          owner_cedula_rnc?: string | null
          owner_name: string
          price_per_unit?: number
          unit_type: string
          updated_at?: string
        }
        Update: {
          bank?: string | null
          bank_account?: string | null
          comments?: string | null
          contract_name?: string
          created_at?: string
          farm_id?: string | null
          id?: string
          is_active?: boolean
          operation_type?: string
          operation_type_other?: string | null
          owner_cedula_rnc?: string | null
          owner_name?: string
          price_per_unit?: number
          unit_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_contracts_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      service_entries: {
        Row: {
          amount: number | null
          comments: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          is_closed: boolean
          master_acct_code: string | null
          provider_id: string
          service_date: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          comments?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_closed?: boolean
          master_acct_code?: string | null
          provider_id: string
          service_date?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          comments?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_closed?: boolean
          master_acct_code?: string | null
          provider_id?: string
          service_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_entries_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_providers: {
        Row: {
          bank: string | null
          bank_account_number: string | null
          bank_account_type: string | null
          cedula: string
          created_at: string
          currency: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          bank?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          cedula: string
          created_at?: string
          currency?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          bank?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          cedula?: string
          created_at?: string
          currency?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      tractor_maintenance: {
        Row: {
          created_at: string
          hour_meter_reading: number
          id: string
          maintenance_date: string
          maintenance_type: string
          notes: string | null
          tractor_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hour_meter_reading: number
          id?: string
          maintenance_date?: string
          maintenance_type?: string
          notes?: string | null
          tractor_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hour_meter_reading?: number
          id?: string
          maintenance_date?: string
          maintenance_type?: string
          notes?: string | null
          tractor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tractor_maintenance_tractor_id_fkey"
            columns: ["tractor_id"]
            isOneToOne: false
            referencedRelation: "fuel_equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_attachments: {
        Row: {
          attachment_category: string
          attachment_url: string
          created_at: string
          id: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          attachment_category?: string
          attachment_url: string
          created_at?: string
          id?: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          attachment_category?: string
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
          is_internal: boolean
          is_void: boolean
          itbis: number | null
          legacy_id: number | null
          master_acct_code: string | null
          name: string | null
          pay_method: string | null
          project_code: string | null
          rnc: string | null
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
          is_internal?: boolean
          is_void?: boolean
          itbis?: number | null
          legacy_id?: number | null
          master_acct_code?: string | null
          name?: string | null
          pay_method?: string | null
          project_code?: string | null
          rnc?: string | null
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
          is_internal?: boolean
          is_void?: boolean
          itbis?: number | null
          legacy_id?: number | null
          master_acct_code?: string | null
          name?: string | null
          pay_method?: string | null
          project_code?: string | null
          rnc?: string | null
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
      vendor_account_rules: {
        Row: {
          cbs_code: string | null
          created_at: string | null
          description_template: string | null
          id: string
          master_acct_code: string
          project_code: string | null
          updated_at: string | null
          vendor_name: string
        }
        Insert: {
          cbs_code?: string | null
          created_at?: string | null
          description_template?: string | null
          id?: string
          master_acct_code: string
          project_code?: string | null
          updated_at?: string | null
          vendor_name: string
        }
        Update: {
          cbs_code?: string | null
          created_at?: string | null
          description_template?: string | null
          id?: string
          master_acct_code?: string
          project_code?: string | null
          updated_at?: string | null
          vendor_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      employees_safe: {
        Row: {
          bank: string | null
          bank_account_number: string | null
          boot_size: string | null
          cedula: string | null
          created_at: string | null
          date_of_birth: string | null
          date_of_hire: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          pant_size: string | null
          position: string | null
          salary: number | null
          shirt_size: string | null
          updated_at: string | null
        }
        Insert: {
          bank?: never
          bank_account_number?: never
          boot_size?: string | null
          cedula?: never
          created_at?: string | null
          date_of_birth?: string | null
          date_of_hire?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          pant_size?: string | null
          position?: string | null
          salary?: number | null
          shirt_size?: string | null
          updated_at?: string | null
        }
        Update: {
          bank?: never
          bank_account_number?: never
          boot_size?: string | null
          cedula?: never
          created_at?: string | null
          date_of_birth?: string | null
          date_of_hire?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          pant_size?: string | null
          position?: string | null
          salary?: number | null
          shirt_size?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_fields_with_boundaries: {
        Args: never
        Returns: {
          boundary: Json
          farm_id: string
          farm_name: string
          hectares: number
          id: string
          name: string
        }[]
      }
      get_hours_until_maintenance: {
        Args: { p_tractor_id: string }
        Returns: number
      }
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
      is_accountant_only: { Args: never; Returns: boolean }
      upsert_field_boundary: {
        Args: { p_field_id: string; p_geojson: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "accountant"
        | "management"
        | "supervisor"
        | "viewer"
        | "driver"
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
        | "condicionador"
        | "adherente"
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
      app_role: [
        "admin",
        "accountant",
        "management",
        "supervisor",
        "viewer",
        "driver",
      ],
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
        "condicionador",
        "adherente",
      ],
    },
  },
} as const
