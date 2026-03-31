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
      accounting_audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      accounting_periods: {
        Row: {
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          end_date: string
          id: string
          is_closed: boolean | null
          period_name: string
          start_date: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          end_date: string
          id?: string
          is_closed?: boolean | null
          period_name: string
          start_date: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          end_date?: string
          id?: string
          is_closed?: boolean | null
          period_name?: string
          start_date?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      advance_allocations: {
        Row: {
          advance_doc_id: string
          allocated_by: string | null
          amount: number
          created_at: string | null
          id: string
          invoice_doc_id: string
        }
        Insert: {
          advance_doc_id: string
          allocated_by?: string | null
          amount: number
          created_at?: string | null
          id?: string
          invoice_doc_id: string
        }
        Update: {
          advance_doc_id?: string
          allocated_by?: string | null
          amount?: number
          created_at?: string | null
          id?: string
          invoice_doc_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "advance_allocations_advance_doc_id_fkey"
            columns: ["advance_doc_id"]
            isOneToOne: false
            referencedRelation: "ap_ar_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_allocations_invoice_doc_id_fkey"
            columns: ["invoice_doc_id"]
            isOneToOne: false
            referencedRelation: "ap_ar_documents"
            referencedColumns: ["id"]
          },
        ]
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
      ap_ar_document_transactions: {
        Row: {
          created_at: string
          document_id: string
          id: string
          transaction_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          transaction_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ap_ar_document_transactions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "ap_ar_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_ar_document_transactions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      ap_ar_documents: {
        Row: {
          account_id: string | null
          amount_paid: number
          balance_remaining: number | null
          contact_name: string
          contact_rnc: string | null
          created_at: string
          created_by: string | null
          currency: string
          direction: string
          document_date: string
          document_number: string | null
          document_type: string
          due_date: string | null
          id: string
          notes: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount_paid?: number
          balance_remaining?: number | null
          contact_name: string
          contact_rnc?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          direction: string
          document_date?: string
          document_number?: string | null
          document_type?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount_paid?: number
          balance_remaining?: number | null
          contact_name?: string
          contact_rnc?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          direction?: string
          document_date?: string
          document_number?: string | null
          document_type?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ap_ar_documents_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ap_ar_payments: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          document_id: string
          id: string
          journal_id: string | null
          notes: string | null
          payment_date: string
          payment_method: string | null
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          document_id: string
          id?: string
          journal_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string
          id?: string
          journal_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ap_ar_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_ar_payments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "ap_ar_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_ar_payments_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_depreciation_rules: {
        Row: {
          accumulated_depreciation_account: string | null
          asset_account_code: string | null
          category: string
          depreciation_expense_account: string | null
          id: string
        }
        Insert: {
          accumulated_depreciation_account?: string | null
          asset_account_code?: string | null
          category: string
          depreciation_expense_account?: string | null
          id?: string
        }
        Update: {
          accumulated_depreciation_account?: string | null
          asset_account_code?: string | null
          category?: string
          depreciation_expense_account?: string | null
          id?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_name: string
          account_number: string | null
          account_type: string
          bank_name: string
          chart_account_id: string | null
          created_at: string | null
          currency: string | null
          fixed_amount: number | null
          id: string
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          account_name: string
          account_number?: string | null
          account_type?: string
          bank_name: string
          chart_account_id?: string | null
          created_at?: string | null
          currency?: string | null
          fixed_amount?: number | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          account_name?: string
          account_number?: string | null
          account_type?: string
          bank_name?: string
          chart_account_id?: string | null
          created_at?: string | null
          currency?: string | null
          fixed_amount?: number | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_chart_account_id_fkey"
            columns: ["chart_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statement_lines: {
        Row: {
          amount: number
          balance: number | null
          bank_account_id: string
          created_at: string | null
          description: string | null
          id: string
          is_reconciled: boolean | null
          matched_journal_id: string | null
          matched_transaction_id: string | null
          reference: string | null
          statement_date: string
        }
        Insert: {
          amount?: number
          balance?: number | null
          bank_account_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_reconciled?: boolean | null
          matched_journal_id?: string | null
          matched_transaction_id?: string | null
          reference?: string | null
          statement_date: string
        }
        Update: {
          amount?: number
          balance?: number | null
          bank_account_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_reconciled?: boolean | null
          matched_journal_id?: string | null
          matched_transaction_id?: string | null
          reference?: string | null
          statement_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_statement_lines_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_matched_journal_id_fkey"
            columns: ["matched_journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_matched_transaction_id_fkey"
            columns: ["matched_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_lines: {
        Row: {
          annual_budget: number
          budget_type: string
          created_at: string
          created_by: string | null
          current_forecast: number
          fiscal_year: number
          id: string
          line_code: string
          month_1: number
          month_10: number
          month_11: number
          month_12: number
          month_2: number
          month_3: number
          month_4: number
          month_5: number
          month_6: number
          month_7: number
          month_8: number
          month_9: number
          project_code: string | null
          updated_at: string
        }
        Insert: {
          annual_budget?: number
          budget_type: string
          created_at?: string
          created_by?: string | null
          current_forecast?: number
          fiscal_year: number
          id?: string
          line_code: string
          month_1?: number
          month_10?: number
          month_11?: number
          month_12?: number
          month_2?: number
          month_3?: number
          month_4?: number
          month_5?: number
          month_6?: number
          month_7?: number
          month_8?: number
          month_9?: number
          project_code?: string | null
          updated_at?: string
        }
        Update: {
          annual_budget?: number
          budget_type?: string
          created_at?: string
          created_by?: string | null
          current_forecast?: number
          fiscal_year?: number
          id?: string
          line_code?: string
          month_1?: number
          month_10?: number
          month_11?: number
          month_12?: number
          month_2?: number
          month_3?: number
          month_4?: number
          month_5?: number
          month_6?: number
          month_7?: number
          month_8?: number
          month_9?: number
          project_code?: string | null
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
      chart_of_accounts: {
        Row: {
          account_code: string
          account_name: string
          account_type: string
          allow_posting: boolean | null
          base_currency: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          deleted_at: string | null
          english_description: string | null
          id: string
          parent_id: string | null
          spanish_description: string | null
          updated_at: string | null
        }
        Insert: {
          account_code: string
          account_name: string
          account_type: string
          allow_posting?: boolean | null
          base_currency?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          deleted_at?: string | null
          english_description?: string | null
          id?: string
          parent_id?: string | null
          spanish_description?: string | null
          updated_at?: string | null
        }
        Update: {
          account_code?: string
          account_name?: string
          account_type?: string
          allow_posting?: boolean | null
          base_currency?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          deleted_at?: string | null
          english_description?: string | null
          id?: string
          parent_id?: string | null
          spanish_description?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_bank_accounts: {
        Row: {
          account_number: string
          account_type: string | null
          bank_name: string
          contact_id: string
          created_at: string
          currency: string
          id: string
          is_default: boolean
        }
        Insert: {
          account_number: string
          account_type?: string | null
          bank_name: string
          contact_id: string
          created_at?: string
          currency?: string
          id?: string
          is_default?: boolean
        }
        Update: {
          account_number?: string
          account_type?: string | null
          bank_name?: string
          contact_id?: string
          created_at?: string
          currency?: string
          id?: string
          is_default?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "contact_bank_accounts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          contact_person: string | null
          contact_type: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          rnc: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          contact_type?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          rnc?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          contact_type?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          rnc?: string | null
          updated_at?: string
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
          {
            foreignKeyName: "fk_cronograma_entries_week"
            columns: ["week_ending_date"]
            isOneToOne: false
            referencedRelation: "cronograma_weeks"
            referencedColumns: ["week_ending_date"]
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
      depreciation_schedule: {
        Row: {
          asset_id: string
          created_at: string
          depreciation_amount: number
          id: string
          journal_id: string | null
          period_date: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          depreciation_amount?: number
          id?: string
          journal_id?: string | null
          period_date: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          depreciation_amount?: number
          id?: string
          journal_id?: string | null
          period_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "depreciation_schedule_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "fixed_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depreciation_schedule_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
        ]
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
          date_of_termination: string | null
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
          date_of_termination?: string | null
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
          date_of_termination?: string | null
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
      exchange_rates: {
        Row: {
          buy_rate: number
          created_at: string
          currency_pair: string
          id: string
          rate_date: string
          sell_rate: number
          source: string
        }
        Insert: {
          buy_rate: number
          created_at?: string
          currency_pair?: string
          id?: string
          rate_date: string
          sell_rate: number
          source?: string
        }
        Update: {
          buy_rate?: number
          created_at?: string
          currency_pair?: string
          id?: string
          rate_date?: string
          sell_rate?: number
          source?: string
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
      fixed_assets: {
        Row: {
          accumulated_depreciation: number
          accumulated_depreciation_account: string | null
          acquisition_date: string | null
          acquisition_value: number
          asset_account_code: string | null
          asset_code: string | null
          category: string
          created_at: string
          deleted_at: string | null
          depreciation_expense_account: string | null
          depreciation_method: string
          disposal_date: string | null
          disposal_value: number | null
          equipment_id: string | null
          id: string
          implement_id: string | null
          in_service_date: string | null
          is_active: boolean
          name: string
          notes: string | null
          salvage_value: number
          serial_number: string | null
          source_project_id: string | null
          updated_at: string
          useful_life_years: number
        }
        Insert: {
          accumulated_depreciation?: number
          accumulated_depreciation_account?: string | null
          acquisition_date?: string | null
          acquisition_value?: number
          asset_account_code?: string | null
          asset_code?: string | null
          category?: string
          created_at?: string
          deleted_at?: string | null
          depreciation_expense_account?: string | null
          depreciation_method?: string
          disposal_date?: string | null
          disposal_value?: number | null
          equipment_id?: string | null
          id?: string
          implement_id?: string | null
          in_service_date?: string | null
          is_active?: boolean
          name: string
          notes?: string | null
          salvage_value?: number
          serial_number?: string | null
          source_project_id?: string | null
          updated_at?: string
          useful_life_years?: number
        }
        Update: {
          accumulated_depreciation?: number
          accumulated_depreciation_account?: string | null
          acquisition_date?: string | null
          acquisition_value?: number
          asset_account_code?: string | null
          asset_code?: string | null
          category?: string
          created_at?: string
          deleted_at?: string | null
          depreciation_expense_account?: string | null
          depreciation_method?: string
          disposal_date?: string | null
          disposal_value?: number | null
          equipment_id?: string | null
          id?: string
          implement_id?: string | null
          in_service_date?: string | null
          is_active?: boolean
          name?: string
          notes?: string | null
          salvage_value?: number
          serial_number?: string | null
          source_project_id?: string | null
          updated_at?: string
          useful_life_years?: number
        }
        Relationships: [
          {
            foreignKeyName: "fixed_assets_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "fuel_equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_implement_id_fkey"
            columns: ["implement_id"]
            isOneToOne: false
            referencedRelation: "implements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_source_project_id_fkey"
            columns: ["source_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
          front_tire_size: string | null
          gpsgate_user_id: number | null
          hp: number | null
          id: string
          is_active: boolean
          maintenance_interval_hours: number
          model: string | null
          name: string
          purchase_date: string | null
          purchase_price: number | null
          rear_tire_size: string | null
          serial_number: string | null
          updated_at: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          current_hour_meter?: number
          equipment_type: string
          front_tire_size?: string | null
          gpsgate_user_id?: number | null
          hp?: number | null
          id?: string
          is_active?: boolean
          maintenance_interval_hours?: number
          model?: string | null
          name: string
          purchase_date?: string | null
          purchase_price?: number | null
          rear_tire_size?: string | null
          serial_number?: string | null
          updated_at?: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          current_hour_meter?: number
          equipment_type?: string
          front_tire_size?: string | null
          gpsgate_user_id?: number | null
          hp?: number | null
          id?: string
          is_active?: boolean
          maintenance_interval_hours?: number
          model?: string | null
          name?: string
          purchase_date?: string | null
          purchase_price?: number | null
          rear_tire_size?: string | null
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
          destination_tank_id: string | null
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
          destination_tank_id?: string | null
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
          destination_tank_id?: string | null
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
            foreignKeyName: "fuel_transactions_destination_tank_id_fkey"
            columns: ["destination_tank_id"]
            isOneToOne: false
            referencedRelation: "fuel_tanks"
            referencedColumns: ["id"]
          },
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
          working_width_m: number | null
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
          working_width_m?: number | null
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
          working_width_m?: number | null
        }
        Relationships: []
      }
      industrial_carretas: {
        Row: {
          created_at: string
          created_by: string | null
          datetime_in: string | null
          datetime_out: string | null
          id: string
          identifier: string | null
          notes: string | null
          payload: number | null
          tare: number | null
          updated_at: string
          weigh_ticket_number: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          datetime_in?: string | null
          datetime_out?: string | null
          id?: string
          identifier?: string | null
          notes?: string | null
          payload?: number | null
          tare?: number | null
          updated_at?: string
          weigh_ticket_number?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          datetime_in?: string | null
          datetime_out?: string | null
          id?: string
          identifier?: string | null
          notes?: string | null
          payload?: number | null
          tare?: number | null
          updated_at?: string
          weigh_ticket_number?: string | null
        }
        Relationships: []
      }
      industrial_plant_hours: {
        Row: {
          created_at: string
          created_by: string | null
          date: string | null
          finish_hour_meter: number | null
          id: string
          notes: string | null
          start_hour_meter: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date?: string | null
          finish_hour_meter?: number | null
          id?: string
          notes?: string | null
          start_hour_meter?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string | null
          finish_hour_meter?: number | null
          id?: string
          notes?: string | null
          start_hour_meter?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      industrial_trucks: {
        Row: {
          created_at: string
          created_by: string | null
          datetime_in: string | null
          datetime_out: string | null
          destination_payload: string | null
          id: string
          identifier: string | null
          notes: string | null
          payload: number | null
          tare: number | null
          updated_at: string
          weigh_ticket_number: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          datetime_in?: string | null
          datetime_out?: string | null
          destination_payload?: string | null
          id?: string
          identifier?: string | null
          notes?: string | null
          payload?: number | null
          tare?: number | null
          updated_at?: string
          weigh_ticket_number?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          datetime_in?: string | null
          datetime_out?: string | null
          destination_payload?: string | null
          id?: string
          identifier?: string | null
          notes?: string | null
          payload?: number | null
          tare?: number | null
          updated_at?: string
          weigh_ticket_number?: string | null
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
          system_key: string | null
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
          system_key?: string | null
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
          system_key?: string | null
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
      journal_lines: {
        Row: {
          account_id: string
          cbs_code: string | null
          created_at: string | null
          created_by: string | null
          credit: number | null
          debit: number | null
          deleted_at: string | null
          description: string | null
          id: string
          journal_id: string
          project_code: string | null
          tax_code_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          cbs_code?: string | null
          created_at?: string | null
          created_by?: string | null
          credit?: number | null
          debit?: number | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          journal_id: string
          project_code?: string | null
          tax_code_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          cbs_code?: string | null
          created_at?: string | null
          created_by?: string | null
          credit?: number | null
          debit?: number | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          journal_id?: string
          project_code?: string | null
          tax_code_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_tax_code_id_fkey"
            columns: ["tax_code_id"]
            isOneToOne: false
            referencedRelation: "tax_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      journals: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          deleted_at: string | null
          description: string | null
          exchange_rate: number | null
          id: string
          is_reconciled: boolean | null
          journal_date: string
          journal_number: string | null
          journal_type: string
          period_id: string | null
          posted: boolean | null
          posted_at: string | null
          posted_by: string | null
          reference_description: string | null
          rejection_reason: string | null
          reversal_of_id: string | null
          transaction_source_id: string | null
          updated_at: string | null
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          deleted_at?: string | null
          description?: string | null
          exchange_rate?: number | null
          id?: string
          is_reconciled?: boolean | null
          journal_date: string
          journal_number?: string | null
          journal_type?: string
          period_id?: string | null
          posted?: boolean | null
          posted_at?: string | null
          posted_by?: string | null
          reference_description?: string | null
          rejection_reason?: string | null
          reversal_of_id?: string | null
          transaction_source_id?: string | null
          updated_at?: string | null
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          deleted_at?: string | null
          description?: string | null
          exchange_rate?: number | null
          id?: string
          is_reconciled?: boolean | null
          journal_date?: string
          journal_number?: string | null
          journal_type?: string
          period_id?: string | null
          posted?: boolean | null
          posted_at?: string | null
          posted_by?: string | null
          reference_description?: string | null
          rejection_reason?: string | null
          reversal_of_id?: string | null
          transaction_source_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journals_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journals_reversal_of_id_fkey"
            columns: ["reversal_of_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journals_transaction_source_id_fkey"
            columns: ["transaction_source_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
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
      payment_method_accounts: {
        Row: {
          account_id: string
          created_at: string
          id: string
          pay_method: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          pay_method: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          pay_method?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_method_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
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
      payroll_snapshots: {
        Row: {
          absence_deduction: number
          base_pay: number
          created_at: string
          employee_id: string
          gross_pay: number
          holiday_pay: number
          id: string
          isr: number
          loan_deduction: number
          net_pay: number
          overtime_pay: number
          period_id: string
          sunday_pay: number
          total_benefits: number
          tss: number
          vacation_deduction: number
        }
        Insert: {
          absence_deduction?: number
          base_pay?: number
          created_at?: string
          employee_id: string
          gross_pay?: number
          holiday_pay?: number
          id?: string
          isr?: number
          loan_deduction?: number
          net_pay?: number
          overtime_pay?: number
          period_id: string
          sunday_pay?: number
          total_benefits?: number
          tss?: number
          vacation_deduction?: number
        }
        Update: {
          absence_deduction?: number
          base_pay?: number
          created_at?: string
          employee_id?: string
          gross_pay?: number
          holiday_pay?: number
          id?: string
          isr?: number
          loan_deduction?: number
          net_pay?: number
          overtime_pay?: number
          period_id?: string
          sunday_pay?: number
          total_benefits?: number
          tss?: number
          vacation_deduction?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_snapshots_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_snapshots_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_snapshots_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
        ]
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
          is_active: boolean
          spanish_description: string
        }
        Insert: {
          code: string
          created_at?: string
          english_description: string
          id?: string
          is_active?: boolean
          spanish_description: string
        }
        Update: {
          code?: string
          created_at?: string
          english_description?: string
          id?: string
          is_active?: boolean
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
      recurring_journal_template_lines: {
        Row: {
          account_id: string
          cbs_code: string | null
          created_at: string | null
          credit: number | null
          debit: number | null
          id: string
          project_code: string | null
          template_id: string
        }
        Insert: {
          account_id: string
          cbs_code?: string | null
          created_at?: string | null
          credit?: number | null
          debit?: number | null
          id?: string
          project_code?: string | null
          template_id: string
        }
        Update: {
          account_id?: string
          cbs_code?: string | null
          created_at?: string | null
          credit?: number | null
          debit?: number | null
          id?: string
          project_code?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_journal_template_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_journal_template_lines_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "recurring_journal_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_journal_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          currency: string | null
          description: string | null
          frequency: string
          id: string
          is_active: boolean | null
          next_run_date: string
          template_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          next_run_date: string
          template_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          next_run_date?: string
          template_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      revaluation_log: {
        Row: {
          closing_rate: number
          created_at: string
          created_by: string | null
          id: string
          journal_id: string | null
          period_id: string
          revaluation_date: string
          total_adjustment: number
        }
        Insert: {
          closing_rate: number
          created_at?: string
          created_by?: string | null
          id?: string
          journal_id?: string | null
          period_id: string
          revaluation_date: string
          total_adjustment?: number
        }
        Update: {
          closing_rate?: number
          created_at?: string
          created_by?: string | null
          id?: string
          journal_id?: string | null
          period_id?: string
          revaluation_date?: string
          total_adjustment?: number
        }
        Relationships: [
          {
            foreignKeyName: "revaluation_log_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revaluation_log_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
        ]
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
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          contract_id: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          transaction_id?: string | null
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
          {
            foreignKeyName: "service_contract_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
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
          pay_method: string | null
          provider_id: string
          service_date: string
          transaction_id: string | null
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
          pay_method?: string | null
          provider_id: string
          service_date?: string
          transaction_id?: string | null
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
          pay_method?: string | null
          provider_id?: string
          service_date?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_entries_pay_method_fkey"
            columns: ["pay_method"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_entries_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
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
      tax_codes: {
        Row: {
          affects_isr: boolean | null
          affects_itbis: boolean | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          description: string | null
          dgii_code: string
          id: string
          rate: number | null
          updated_at: string | null
        }
        Insert: {
          affects_isr?: boolean | null
          affects_itbis?: boolean | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          dgii_code: string
          id?: string
          rate?: number | null
          updated_at?: string | null
        }
        Update: {
          affects_isr?: boolean | null
          affects_itbis?: boolean | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          dgii_code?: string
          id?: string
          rate?: number | null
          updated_at?: string | null
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
      tractor_operators: {
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
        Relationships: [
          {
            foreignKeyName: "transaction_attachments_transaction_uuid_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_audit_log: {
        Row: {
          change_reason: string | null
          changed_at: string
          changed_by: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          transaction_id: string
        }
        Insert: {
          change_reason?: string | null
          changed_at?: string
          changed_by: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          transaction_id: string
        }
        Update: {
          change_reason?: string | null
          changed_at?: string
          changed_by?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_audit_log_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_edits: {
        Row: {
          created_at: string
          document: string | null
          id: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          document?: string | null
          id?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          document?: string | null
          id?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_edits_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          cbs_code: string | null
          cbs_id: string | null
          comments: string | null
          cost_center: string
          created_at: string
          currency: string
          description: string
          destination_acct_code: string | null
          destination_amount: number | null
          dgii_tipo_anulacion: string | null
          dgii_tipo_bienes_servicios: string | null
          dgii_tipo_ingreso: string | null
          document: string | null
          due_date: string | null
          exchange_rate: number | null
          id: string
          is_internal: boolean
          is_void: boolean
          isr_retenido: number | null
          itbis: number
          itbis_override_reason: string | null
          itbis_retenido: number | null
          legacy_id: number | null
          master_acct_code: string | null
          name: string | null
          pay_method: string | null
          project_code: string | null
          project_id: string | null
          purchase_date: string | null
          rnc: string | null
          transaction_date: string
          transaction_direction: string | null
          updated_at: string
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          account_id?: string | null
          amount?: number
          cbs_code?: string | null
          cbs_id?: string | null
          comments?: string | null
          cost_center?: string
          created_at?: string
          currency?: string
          description?: string
          destination_acct_code?: string | null
          destination_amount?: number | null
          dgii_tipo_anulacion?: string | null
          dgii_tipo_bienes_servicios?: string | null
          dgii_tipo_ingreso?: string | null
          document?: string | null
          due_date?: string | null
          exchange_rate?: number | null
          id?: string
          is_internal?: boolean
          is_void?: boolean
          isr_retenido?: number | null
          itbis?: number
          itbis_override_reason?: string | null
          itbis_retenido?: number | null
          legacy_id?: number | null
          master_acct_code?: string | null
          name?: string | null
          pay_method?: string | null
          project_code?: string | null
          project_id?: string | null
          purchase_date?: string | null
          rnc?: string | null
          transaction_date: string
          transaction_direction?: string | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          cbs_code?: string | null
          cbs_id?: string | null
          comments?: string | null
          cost_center?: string
          created_at?: string
          currency?: string
          description?: string
          destination_acct_code?: string | null
          destination_amount?: number | null
          dgii_tipo_anulacion?: string | null
          dgii_tipo_bienes_servicios?: string | null
          dgii_tipo_ingreso?: string | null
          document?: string | null
          due_date?: string | null
          exchange_rate?: number | null
          id?: string
          is_internal?: boolean
          is_void?: boolean
          isr_retenido?: number | null
          itbis?: number
          itbis_override_reason?: string | null
          itbis_retenido?: number | null
          legacy_id?: number | null
          master_acct_code?: string | null
          name?: string | null
          pay_method?: string | null
          project_code?: string | null
          project_id?: string | null
          purchase_date?: string | null
          rnc?: string | null
          transaction_date?: string
          transaction_direction?: string | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_transactions_account"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_transactions_cbs"
            columns: ["cbs_id"]
            isOneToOne: false
            referencedRelation: "cbs_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_transactions_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_cbs_id_fkey"
            columns: ["cbs_id"]
            isOneToOne: false
            referencedRelation: "cbs_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      transportation_units: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          unit_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          unit_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          unit_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      tss_parameters: {
        Row: {
          created_at: string | null
          description: string | null
          effective_date: string
          id: string
          parameter_key: string
          parameter_value: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          effective_date?: string
          id?: string
          parameter_key: string
          parameter_value: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          effective_date?: string
          id?: string
          parameter_key?: string
          parameter_value?: number
          updated_at?: string | null
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
          date_of_termination: string | null
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
          date_of_termination?: string | null
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
          date_of_termination?: string | null
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
      general_ledger: {
        Row: {
          account_code: string | null
          account_name: string | null
          credit: number | null
          credit_base: number | null
          debit: number | null
          debit_base: number | null
          description: string | null
          journal_date: string | null
          journal_number: string | null
          running_balance_base: number | null
        }
        Relationships: []
      }
      trial_balance_all: {
        Row: {
          account_code: string | null
          account_name: string | null
          account_type: string | null
          balance_base: number | null
          total_credit_base: number | null
          total_debit_base: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      account_balances_from_journals:
        | {
            Args: { p_end?: string; p_start?: string }
            Returns: {
              account_code: string
              account_name: string
              account_type: string
              balance: number
              currency: string
              total_credit: number
              total_debit: number
            }[]
          }
        | {
            Args: { p_cost_center?: string; p_end?: string; p_start?: string }
            Returns: {
              account_code: string
              account_name: string
              account_type: string
              balance: number
              currency: string
              total_credit: number
              total_debit: number
            }[]
          }
      close_day_labor_week: { Args: { p_week_ending: string }; Returns: string }
      count_unlinked_transactions: {
        Args: { p_end?: string; p_start?: string }
        Returns: number
      }
      create_journal_from_transaction:
        | {
            Args: {
              p_created_by?: string
              p_date: string
              p_description: string
              p_transaction_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_created_by?: string
              p_date: string
              p_description: string
              p_journal_type?: string
              p_transaction_id: string
            }
            Returns: string
          }
      create_reversal_journal: {
        Args: {
          p_created_by: string
          p_description: string
          p_original_journal_id: string
          p_reversal_date: string
        }
        Returns: string
      }
      dgii_507_report: {
        Args: { p_end: string; p_start: string }
        Returns: {
          dgii_code: string
          journal_date: string
          retained_amount: number
          transaction_id: string
        }[]
      }
      dgii_509_report: {
        Args: { p_end: string; p_start: string }
        Returns: {
          dgii_code: string
          itbis_withheld: number
          journal_date: string
          transaction_id: string
        }[]
      }
      foreign_currency_balances: {
        Args: { p_end: string; p_start: string }
        Returns: {
          account_code: string
          account_id: string
          account_name: string
          booked_dop_total: number
          usd_balance: number
        }[]
      }
      generate_closing_journal: {
        Args: {
          p_end_date: string
          p_period_id: string
          p_start_date: string
          p_user_id: string
        }
        Returns: string
      }
      generate_due_recurring_journals: {
        Args: { p_user_id: string }
        Returns: number
      }
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
      income_statement: {
        Args: { p_end: string; p_start: string }
        Returns: {
          account_type: string
          net_result: number
          total_expense: number
          total_income: number
        }[]
      }
      income_statement_detail: {
        Args: { p_end: string; p_start: string }
        Returns: {
          account_code: string
          account_name: string
          account_type: string
          total_amount: number
        }[]
      }
      is_accountant_only: { Args: never; Returns: boolean }
      post_journal: {
        Args: { p_journal_id: string; p_user: string }
        Returns: undefined
      }
      trial_balance: {
        Args: { p_end?: string; p_start?: string }
        Returns: {
          account_code: string
          account_name: string
          account_type: string
          balance_base: number
          total_credit_base: number
          total_debit_base: number
        }[]
      }
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
