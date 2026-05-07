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
          status: string
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
          status?: string
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
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      accrual_entries: {
        Row: {
          accrual_date: string
          accrual_journal_id: string | null
          amount: number
          cost_center: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string
          entity_id: string
          expense_account_id: string
          id: string
          liability_account_id: string
          reference: string | null
          reversal_date: string
          reversal_journal_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accrual_date: string
          accrual_journal_id?: string | null
          amount: number
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description: string
          entity_id: string
          expense_account_id: string
          id?: string
          liability_account_id: string
          reference?: string | null
          reversal_date: string
          reversal_journal_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accrual_date?: string
          accrual_journal_id?: string | null
          amount?: number
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          entity_id?: string
          expense_account_id?: string
          id?: string
          liability_account_id?: string
          reference?: string | null
          reversal_date?: string
          reversal_journal_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accrual_entries_accrual_journal_id_fkey"
            columns: ["accrual_journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accrual_entries_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accrual_entries_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accrual_entries_liability_account_id_fkey"
            columns: ["liability_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accrual_entries_reversal_journal_id_fkey"
            columns: ["reversal_journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "advance_allocations_advance_doc_id_fkey"
            columns: ["advance_doc_id"]
            isOneToOne: false
            referencedRelation: "v_ap_ar_aging"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_allocations_invoice_doc_id_fkey"
            columns: ["invoice_doc_id"]
            isOneToOne: false
            referencedRelation: "ap_ar_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_allocations_invoice_doc_id_fkey"
            columns: ["invoice_doc_id"]
            isOneToOne: false
            referencedRelation: "v_ap_ar_aging"
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
            foreignKeyName: "ap_ar_document_transactions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "v_ap_ar_aging"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_ar_document_transactions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_ar_document_transactions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transactions_with_dop"
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
          entity_id: string
          exchange_rate_used: number | null
          id: string
          notes: string | null
          status: string
          total_amount: number
          total_amount_dop: number | null
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
          entity_id?: string
          exchange_rate_used?: number | null
          id?: string
          notes?: string | null
          status?: string
          total_amount?: number
          total_amount_dop?: number | null
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
          entity_id?: string
          exchange_rate_used?: number | null
          id?: string
          notes?: string | null
          status?: string
          total_amount?: number
          total_amount_dop?: number | null
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
          {
            foreignKeyName: "ap_ar_documents_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
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
            foreignKeyName: "ap_ar_payments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "v_ap_ar_aging"
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
      app_error_log: {
        Row: {
          component_name: string | null
          created_at: string
          error_message: string
          id: string
          page_url: string | null
          stack_trace: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          component_name?: string | null
          created_at?: string
          error_message: string
          id?: string
          page_url?: string | null
          stack_trace?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          component_name?: string | null
          created_at?: string
          error_message?: string
          id?: string
          page_url?: string | null
          stack_trace?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      approval_policies: {
        Row: {
          amount_threshold: number
          applies_to: string
          approver_role: Database["public"]["Enums"]["app_role"]
          created_at: string
          entity_id: string | null
          id: string
          is_active: boolean
          role_submitter: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          amount_threshold?: number
          applies_to: string
          approver_role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          entity_id?: string | null
          id?: string
          is_active?: boolean
          role_submitter: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          amount_threshold?: number
          applies_to?: string
          approver_role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          entity_id?: string | null
          id?: string
          is_active?: boolean
          role_submitter?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_policies_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          amount: number
          applies_to: string
          created_at: string
          currency: string
          description: string | null
          entity_id: string | null
          id: string
          record_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          submitted_by: string
        }
        Insert: {
          amount: number
          applies_to: string
          created_at?: string
          currency?: string
          description?: string | null
          entity_id?: string | null
          id?: string
          record_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by: string
        }
        Update: {
          amount?: number
          applies_to?: string
          created_at?: string
          currency?: string
          description?: string | null
          entity_id?: string | null
          id?: string
          record_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
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
          entity_id: string | null
          fixed_amount: number | null
          id: string
          is_active: boolean | null
          is_shared: boolean
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
          entity_id?: string | null
          fixed_amount?: number | null
          id?: string
          is_active?: boolean | null
          is_shared?: boolean
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
          entity_id?: string | null
          fixed_amount?: number | null
          id?: string
          is_active?: boolean | null
          is_shared?: boolean
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
          {
            foreignKeyName: "bank_accounts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
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
          {
            foreignKeyName: "bank_statement_lines_matched_transaction_id_fkey"
            columns: ["matched_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transactions_with_dop"
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
          entity_id: string | null
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
          parent_line_id: string | null
          project_code: string | null
          sub_label: string | null
          updated_at: string
        }
        Insert: {
          annual_budget?: number
          budget_type: string
          created_at?: string
          created_by?: string | null
          current_forecast?: number
          entity_id?: string | null
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
          parent_line_id?: string | null
          project_code?: string | null
          sub_label?: string | null
          updated_at?: string
        }
        Update: {
          annual_budget?: number
          budget_type?: string
          created_at?: string
          created_by?: string | null
          current_forecast?: number
          entity_id?: string | null
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
          parent_line_id?: string | null
          project_code?: string | null
          sub_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_lines_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_parent_line_id_fkey"
            columns: ["parent_line_id"]
            isOneToOne: false
            referencedRelation: "budget_lines"
            referencedColumns: ["id"]
          },
        ]
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
          dgii_bs_type: string | null
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
          dgii_bs_type?: string | null
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
          dgii_bs_type?: string | null
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
          entity_id: string | null
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
          entity_id?: string | null
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
          entity_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          rnc?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_entries: {
        Row: {
          created_at: string
          created_by: string | null
          cronograma_week_id: string
          day_of_week: number
          entity_id: string
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
          cronograma_week_id: string
          day_of_week: number
          entity_id?: string
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
          cronograma_week_id?: string
          day_of_week?: number
          entity_id?: string
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
            foreignKeyName: "cronograma_entries_cronograma_week_id_fkey"
            columns: ["cronograma_week_id"]
            isOneToOne: false
            referencedRelation: "cronograma_weeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_entries_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_entries_source_operation_id_fkey"
            columns: ["source_operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_entries_audit: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          day_of_week: number
          entity_id: string | null
          entry_id: string
          id: string
          new_is_holiday: boolean | null
          new_is_vacation: boolean | null
          new_task: string | null
          old_is_holiday: boolean | null
          old_is_vacation: boolean | null
          old_task: string | null
          time_slot: string
          week_ending_date: string
          worker_id: string | null
          worker_name: string
          worker_type: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          day_of_week: number
          entity_id?: string | null
          entry_id: string
          id?: string
          new_is_holiday?: boolean | null
          new_is_vacation?: boolean | null
          new_task?: string | null
          old_is_holiday?: boolean | null
          old_is_vacation?: boolean | null
          old_task?: string | null
          time_slot: string
          week_ending_date: string
          worker_id?: string | null
          worker_name: string
          worker_type: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          day_of_week?: number
          entity_id?: string | null
          entry_id?: string
          id?: string
          new_is_holiday?: boolean | null
          new_is_vacation?: boolean | null
          new_task?: string | null
          old_is_holiday?: boolean | null
          old_is_vacation?: boolean | null
          old_task?: string | null
          time_slot?: string
          week_ending_date?: string
          worker_id?: string | null
          worker_name?: string
          worker_type?: string
        }
        Relationships: []
      }
      cronograma_weeks: {
        Row: {
          closed_at: string | null
          created_at: string
          entity_id: string
          id: string
          is_closed: boolean | null
          updated_at: string
          week_ending_date: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          entity_id?: string
          id?: string
          is_closed?: boolean | null
          updated_at?: string
          week_ending_date: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          entity_id?: string
          id?: string
          is_closed?: boolean | null
          updated_at?: string
          week_ending_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_weeks_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
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
          entity_id: string
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
          entity_id?: string
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
          entity_id?: string
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
        Relationships: [
          {
            foreignKeyName: "day_labor_entries_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
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
          entity_id: string
          id: string
          is_recurring: boolean
          updated_at: string
        }
        Insert: {
          amount?: number
          benefit_type: string
          created_at?: string
          employee_id: string
          entity_id?: string
          id?: string
          is_recurring?: boolean
          updated_at?: string
        }
        Update: {
          amount?: number
          benefit_type?: string
          created_at?: string
          employee_id?: string
          entity_id?: string
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
          {
            foreignKeyName: "employee_benefits_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
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
          entity_id: string
          id: string
          letter_metadata: Json | null
          letter_type: string | null
          notes: string | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          document_name: string
          document_type: string
          employee_id: string
          entity_id?: string
          id?: string
          letter_metadata?: Json | null
          letter_type?: string | null
          notes?: string | null
          storage_path: string
        }
        Update: {
          created_at?: string
          document_name?: string
          document_type?: string
          employee_id?: string
          entity_id?: string
          id?: string
          letter_metadata?: Json | null
          letter_type?: string | null
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
          {
            foreignKeyName: "employee_documents_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_incidents: {
        Row: {
          created_at: string
          description: string
          employee_id: string
          entity_id: string
          id: string
          incident_date: string
          resolution: string | null
          severity: string | null
        }
        Insert: {
          created_at?: string
          description: string
          employee_id: string
          entity_id?: string
          id?: string
          incident_date: string
          resolution?: string | null
          severity?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          employee_id?: string
          entity_id?: string
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
          {
            foreignKeyName: "employee_incidents_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_loans: {
        Row: {
          created_at: string
          employee_id: string
          entity_id: string
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
          entity_id?: string
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
          entity_id?: string
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
          {
            foreignKeyName: "employee_loans_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_salary_history: {
        Row: {
          created_at: string
          effective_date: string
          employee_id: string
          entity_id: string
          id: string
          notes: string | null
          salary: number
        }
        Insert: {
          created_at?: string
          effective_date: string
          employee_id: string
          entity_id?: string
          id?: string
          notes?: string | null
          salary: number
        }
        Update: {
          created_at?: string
          effective_date?: string
          employee_id?: string
          entity_id?: string
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
          {
            foreignKeyName: "employee_salary_history_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_timesheets: {
        Row: {
          created_at: string
          employee_id: string
          end_time: string | null
          entity_id: string
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
          entity_id?: string
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
          entity_id?: string
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
            foreignKeyName: "employee_timesheets_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_timesheets_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_timesheets_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "v_payroll_summary"
            referencedColumns: ["period_id"]
          },
        ]
      }
      employee_vacations: {
        Row: {
          created_at: string
          employee_id: string
          end_date: string
          entity_id: string
          id: string
          notes: string | null
          start_date: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          end_date: string
          entity_id?: string
          id?: string
          notes?: string | null
          start_date: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          end_date?: string
          entity_id?: string
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
          {
            foreignKeyName: "employee_vacations_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          apodo: string | null
          bank: string | null
          bank_account_number: string | null
          boot_size: string | null
          cedula: string
          created_at: string
          date_of_birth: string | null
          date_of_hire: string
          date_of_termination: string | null
          entity_id: string
          id: string
          is_active: boolean
          name: string
          pant_size: string | null
          position: string
          salary: number
          sex: string | null
          shirt_size: string | null
          updated_at: string
        }
        Insert: {
          apodo?: string | null
          bank?: string | null
          bank_account_number?: string | null
          boot_size?: string | null
          cedula: string
          created_at?: string
          date_of_birth?: string | null
          date_of_hire: string
          date_of_termination?: string | null
          entity_id?: string
          id?: string
          is_active?: boolean
          name: string
          pant_size?: string | null
          position?: string
          salary?: number
          sex?: string | null
          shirt_size?: string | null
          updated_at?: string
        }
        Update: {
          apodo?: string | null
          bank?: string | null
          bank_account_number?: string | null
          boot_size?: string | null
          cedula?: string
          created_at?: string
          date_of_birth?: string | null
          date_of_hire?: string
          date_of_termination?: string | null
          entity_id?: string
          id?: string
          is_active?: boolean
          name?: string
          pant_size?: string | null
          position?: string
          salary?: number
          sex?: string | null
          shirt_size?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          code: string
          country_code: string
          created_at: string
          currency: string
          description: string | null
          entity_group_id: string | null
          id: string
          is_active: boolean
          name: string
          rnc: string | null
          tss_nomina_code: string | null
          updated_at: string
        }
        Insert: {
          code: string
          country_code?: string
          created_at?: string
          currency?: string
          description?: string | null
          entity_group_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          rnc?: string | null
          tss_nomina_code?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          country_code?: string
          created_at?: string
          currency?: string
          description?: string | null
          entity_group_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          rnc?: string | null
          tss_nomina_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entities_entity_group_id_fkey"
            columns: ["entity_group_id"]
            isOneToOne: false
            referencedRelation: "entity_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_groups: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
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
          entity_id: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_id?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "farms_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
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
      fixed_asset_depreciation_entries: {
        Row: {
          accumulated_at_period_end: number
          asset_id: string
          created_at: string
          depreciation_amount: number
          id: string
          journal_id: string | null
          notes: string | null
          period_id: string
        }
        Insert: {
          accumulated_at_period_end?: number
          asset_id: string
          created_at?: string
          depreciation_amount?: number
          id?: string
          journal_id?: string | null
          notes?: string | null
          period_id: string
        }
        Update: {
          accumulated_at_period_end?: number
          asset_id?: string
          created_at?: string
          depreciation_amount?: number
          id?: string
          journal_id?: string | null
          notes?: string | null
          period_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_asset_depreciation_entries_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "fixed_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_asset_depreciation_entries_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_asset_depreciation_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
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
          entity_id: string | null
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
          entity_id?: string | null
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
          entity_id?: string | null
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
            foreignKeyName: "fixed_assets_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
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
          entity_id: string
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
          entity_id?: string
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
          entity_id?: string
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
        Relationships: [
          {
            foreignKeyName: "fuel_equipment_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_tanks: {
        Row: {
          capacity_gallons: number
          created_at: string
          current_level_gallons: number
          entity_id: string
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
          entity_id?: string
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
          entity_id?: string
          fuel_type?: string
          id?: string
          is_active?: boolean
          last_pump_end_reading?: number | null
          name?: string
          updated_at?: string
          use_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_tanks_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_transactions: {
        Row: {
          created_at: string
          destination_tank_id: string | null
          entity_id: string
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
          entity_id?: string
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
          entity_id?: string
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
            foreignKeyName: "fuel_transactions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
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
      hr_audit_log: {
        Row: {
          changed_at: string
          changed_by: string
          changed_fields: string[] | null
          entity_id: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          operation: string
          record_id: string
          table_name: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          changed_fields?: string[] | null
          entity_id?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          record_id: string
          table_name: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          changed_fields?: string[] | null
          entity_id?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          record_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_audit_log_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      implements: {
        Row: {
          brand: string | null
          created_at: string
          entity_id: string
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
          entity_id?: string
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
          entity_id?: string
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
        Relationships: [
          {
            foreignKeyName: "implements_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      industrial_carretas: {
        Row: {
          created_at: string
          created_by: string | null
          datetime_in: string | null
          datetime_out: string | null
          entity_id: string | null
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
          entity_id?: string | null
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
          entity_id?: string | null
          id?: string
          identifier?: string | null
          notes?: string | null
          payload?: number | null
          tare?: number | null
          updated_at?: string
          weigh_ticket_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "industrial_carretas_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      industrial_plant_hours: {
        Row: {
          created_at: string
          created_by: string | null
          date: string | null
          entity_id: string | null
          estimated_diesel_liters: number | null
          estimated_tons: number | null
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
          entity_id?: string | null
          estimated_diesel_liters?: number | null
          estimated_tons?: number | null
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
          entity_id?: string | null
          estimated_diesel_liters?: number | null
          estimated_tons?: number | null
          finish_hour_meter?: number | null
          id?: string
          notes?: string | null
          start_hour_meter?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "industrial_plant_hours_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      industrial_trucks: {
        Row: {
          created_at: string
          created_by: string | null
          datetime_in: string | null
          datetime_out: string | null
          destination_payload: string | null
          entity_id: string | null
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
          entity_id?: string | null
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
          entity_id?: string | null
          id?: string
          identifier?: string | null
          notes?: string | null
          payload?: number | null
          tare?: number | null
          updated_at?: string
          weigh_ticket_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "industrial_trucks_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      intercompany_account_config: {
        Row: {
          created_at: string
          group_id: string
          id: string
          payable_account_id: string
          receivable_account_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          payable_account_id: string
          receivable_account_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          payable_account_id?: string
          receivable_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intercompany_account_config_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "entity_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intercompany_account_config_payable_account_id_fkey"
            columns: ["payable_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intercompany_account_config_receivable_account_id_fkey"
            columns: ["receivable_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      intercompany_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          group_id: string
          id: string
          is_settled: boolean
          journal_id_source: string | null
          journal_id_target: string | null
          settled_at: string | null
          source_entity_id: string
          target_entity_id: string
          transaction_date: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          description?: string | null
          group_id: string
          id?: string
          is_settled?: boolean
          journal_id_source?: string | null
          journal_id_target?: string | null
          settled_at?: string | null
          source_entity_id: string
          target_entity_id: string
          transaction_date: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          group_id?: string
          id?: string
          is_settled?: boolean
          journal_id_source?: string | null
          journal_id_target?: string | null
          settled_at?: string | null
          source_entity_id?: string
          target_entity_id?: string
          transaction_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "intercompany_transactions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "entity_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intercompany_transactions_journal_id_source_fkey"
            columns: ["journal_id_source"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intercompany_transactions_journal_id_target_fkey"
            columns: ["journal_id_target"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intercompany_transactions_source_entity_id_fkey"
            columns: ["source_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intercompany_transactions_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          cas_number: string | null
          co2_equivalent: number | null
          commercial_name: string
          created_at: string
          current_quantity: number
          entity_id: string
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
          entity_id?: string
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
          entity_id?: string
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
        Relationships: [
          {
            foreignKeyName: "inventory_items_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_purchases: {
        Row: {
          created_at: string
          document_number: string | null
          entity_id: string
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
          entity_id?: string
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
          entity_id?: string
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
            foreignKeyName: "inventory_purchases_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_purchases_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_purchases_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_low_stock"
            referencedColumns: ["id"]
          },
        ]
      }
      isr_brackets: {
        Row: {
          annual_from: number
          annual_to: number | null
          bracket_order: number
          created_at: string
          effective_year: number
          id: string
          marginal_rate: number
        }
        Insert: {
          annual_from: number
          annual_to?: number | null
          bracket_order: number
          created_at?: string
          effective_year: number
          id?: string
          marginal_rate: number
        }
        Update: {
          annual_from?: number
          annual_to?: number | null
          bracket_order?: number
          created_at?: string
          effective_year?: number
          id?: string
          marginal_rate?: number
        }
        Relationships: []
      }
      jornaleros: {
        Row: {
          apodo: string | null
          cedula: string
          cedula_attachment_url: string | null
          created_at: string
          entity_id: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          apodo?: string | null
          cedula: string
          cedula_attachment_url?: string | null
          created_at?: string
          entity_id?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          apodo?: string | null
          cedula?: string
          cedula_attachment_url?: string | null
          created_at?: string
          entity_id?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jornaleros_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
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
          entity_id: string | null
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
          entity_id?: string | null
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
          entity_id?: string | null
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
            foreignKeyName: "journals_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "journals_transaction_source_id_fkey"
            columns: ["transaction_source_id"]
            isOneToOne: false
            referencedRelation: "v_transactions_with_dop"
            referencedColumns: ["id"]
          },
        ]
      }
      liquidation_cases: {
        Row: {
          calculation_payload: Json
          case_status: Database["public"]["Enums"]["liquidation_case_status"]
          cesantia_amount: number
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          include_loans: boolean
          loan_deductions: number
          manual_adjustments: number
          manual_deductions: number
          notes: string | null
          pending_vacation_days: number | null
          preaviso_amount: number
          regalía_amount: number
          salary_basis_daily: number
          salary_basis_monthly: number
          scenario: Database["public"]["Enums"]["prestaciones_scenario"]
          service_days: number
          service_months: number
          service_years: number
          termination_date: string
          total_amount: number
          updated_at: string
          vacation_amount: number
          worked_notice: boolean
        }
        Insert: {
          calculation_payload?: Json
          case_status?: Database["public"]["Enums"]["liquidation_case_status"]
          cesantia_amount?: number
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          include_loans?: boolean
          loan_deductions?: number
          manual_adjustments?: number
          manual_deductions?: number
          notes?: string | null
          pending_vacation_days?: number | null
          preaviso_amount?: number
          regalía_amount?: number
          salary_basis_daily?: number
          salary_basis_monthly?: number
          scenario: Database["public"]["Enums"]["prestaciones_scenario"]
          service_days?: number
          service_months?: number
          service_years?: number
          termination_date: string
          total_amount?: number
          updated_at?: string
          vacation_amount?: number
          worked_notice?: boolean
        }
        Update: {
          calculation_payload?: Json
          case_status?: Database["public"]["Enums"]["liquidation_case_status"]
          cesantia_amount?: number
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          include_loans?: boolean
          loan_deductions?: number
          manual_adjustments?: number
          manual_deductions?: number
          notes?: string | null
          pending_vacation_days?: number | null
          preaviso_amount?: number
          regalía_amount?: number
          salary_basis_daily?: number
          salary_basis_monthly?: number
          scenario?: Database["public"]["Enums"]["prestaciones_scenario"]
          service_days?: number
          service_months?: number
          service_years?: number
          termination_date?: string
          total_amount?: number
          updated_at?: string
          vacation_amount?: number
          worked_notice?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "liquidation_cases_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liquidation_cases_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      operation_followups: {
        Row: {
          alert_days_prior: number
          created_at: string | null
          days_offset: number
          default_driver_id: string | null
          followup_text: string
          id: string
          is_active: boolean
          trigger_operation_type_id: string
        }
        Insert: {
          alert_days_prior?: number
          created_at?: string | null
          days_offset?: number
          default_driver_id?: string | null
          followup_text: string
          id?: string
          is_active?: boolean
          trigger_operation_type_id: string
        }
        Update: {
          alert_days_prior?: number
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
          entity_id: string
          id: string
          inventory_item_id: string
          operation_id: string
          quantity_used: number
        }
        Insert: {
          created_at?: string
          entity_id?: string
          id?: string
          inventory_item_id: string
          operation_id: string
          quantity_used: number
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          inventory_item_id?: string
          operation_id?: string
          quantity_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "operation_inputs_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_inputs_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_inputs_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_low_stock"
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
          entity_id: string
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
          entity_id?: string
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
          entity_id?: string
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
            foreignKeyName: "operations_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
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
          entity_id: string
          id: string
          is_current: boolean
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          entity_id?: string
          id?: string
          is_current?: boolean
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          entity_id?: string
          id?: string
          is_current?: boolean
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_periods_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_snapshots: {
        Row: {
          absence_deduction: number
          base_pay: number
          created_at: string
          employee_id: string
          entity_id: string
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
          entity_id?: string
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
          entity_id?: string
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
            foreignKeyName: "payroll_snapshots_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_snapshots_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_snapshots_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "v_payroll_summary"
            referencedColumns: ["period_id"]
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
          entity_id: string
          id: string
          period_id: string
        }
        Insert: {
          amount?: number
          benefit_type: string
          created_at?: string
          employee_id: string
          entity_id?: string
          id?: string
          period_id: string
        }
        Update: {
          amount?: number
          benefit_type?: string
          created_at?: string
          employee_id?: string
          entity_id?: string
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
            foreignKeyName: "period_employee_benefits_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "period_employee_benefits_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "period_employee_benefits_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "v_payroll_summary"
            referencedColumns: ["period_id"]
          },
        ]
      }
      posting_rule_applications: {
        Row: {
          applied_at: string
          applied_by: string | null
          applied_fields: Json
          context: string
          id: string
          rule_id: string
          transaction_id: string | null
        }
        Insert: {
          applied_at?: string
          applied_by?: string | null
          applied_fields?: Json
          context?: string
          id?: string
          rule_id: string
          transaction_id?: string | null
        }
        Update: {
          applied_at?: string
          applied_by?: string | null
          applied_fields?: Json
          context?: string
          id?: string
          rule_id?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posting_rule_applications_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "posting_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posting_rule_applications_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posting_rule_applications_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transactions_with_dop"
            referencedColumns: ["id"]
          },
        ]
      }
      posting_rules: {
        Row: {
          actions: Json
          applies_to: string
          conditions: Json
          created_at: string
          created_by: string | null
          description: string | null
          entity_id: string | null
          id: string
          is_active: boolean
          name: string
          priority: number
          updated_at: string
        }
        Insert: {
          actions?: Json
          applies_to?: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          entity_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          priority?: number
          updated_at?: string
        }
        Update: {
          actions?: Json
          applies_to?: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          entity_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          priority?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posting_rules_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      prestaciones_parameters: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          numeric_value: number | null
          parameter_key: string
          scope: string
          text_value: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          numeric_value?: number | null
          parameter_key: string
          scope?: string
          text_value?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          numeric_value?: number | null
          parameter_key?: string
          scope?: string
          text_value?: string | null
          updated_at?: string
        }
        Relationships: []
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
          entity_id: string
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
          entity_id?: string
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
          entity_id?: string
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
          {
            foreignKeyName: "service_contract_entries_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
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
          entity_id: string
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
          entity_id?: string
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
          entity_id?: string
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
            foreignKeyName: "service_contract_payments_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_contract_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_contract_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transactions_with_dop"
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
          entity_id: string
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
          entity_id?: string
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
          entity_id?: string
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
            foreignKeyName: "service_contracts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
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
          ap_document_id: string | null
          comments: string | null
          committed_amount: number
          created_at: string
          currency: string
          description: string | null
          entity_id: string
          id: string
          is_closed: boolean
          master_acct_code: string | null
          paid_amount: number
          pay_method: string | null
          provider_id: string
          remaining_amount: number
          service_date: string
          settlement_status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          ap_document_id?: string | null
          comments?: string | null
          committed_amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          entity_id?: string
          id?: string
          is_closed?: boolean
          master_acct_code?: string | null
          paid_amount?: number
          pay_method?: string | null
          provider_id: string
          remaining_amount?: number
          service_date?: string
          settlement_status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          ap_document_id?: string | null
          comments?: string | null
          committed_amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          entity_id?: string
          id?: string
          is_closed?: boolean
          master_acct_code?: string | null
          paid_amount?: number
          pay_method?: string | null
          provider_id?: string
          remaining_amount?: number
          service_date?: string
          settlement_status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_entries_ap_document_id_fkey"
            columns: ["ap_document_id"]
            isOneToOne: false
            referencedRelation: "ap_ar_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_entries_ap_document_id_fkey"
            columns: ["ap_document_id"]
            isOneToOne: false
            referencedRelation: "v_ap_ar_aging"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_entries_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "service_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transactions_with_dop"
            referencedColumns: ["id"]
          },
        ]
      }
      service_entry_payments: {
        Row: {
          amount: number
          ap_payment_id: string | null
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_final_payment: boolean
          ncf: string | null
          notes: string | null
          payment_date: string
          service_entry_id: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          ap_payment_id?: string | null
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_final_payment?: boolean
          ncf?: string | null
          notes?: string | null
          payment_date: string
          service_entry_id: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          ap_payment_id?: string | null
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_final_payment?: boolean
          ncf?: string | null
          notes?: string | null
          payment_date?: string
          service_entry_id?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_entry_payments_ap_payment_id_fkey"
            columns: ["ap_payment_id"]
            isOneToOne: false
            referencedRelation: "ap_ar_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_entry_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_entry_payments_service_entry_id_fkey"
            columns: ["service_entry_id"]
            isOneToOne: false
            referencedRelation: "service_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_entry_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_entry_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transactions_with_dop"
            referencedColumns: ["id"]
          },
        ]
      }
      service_providers: {
        Row: {
          apodo: string | null
          bank: string | null
          bank_account_number: string | null
          bank_account_type: string | null
          cedula: string
          cedula_attachment_url: string | null
          created_at: string
          currency: string | null
          entity_id: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          apodo?: string | null
          bank?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          cedula: string
          cedula_attachment_url?: string | null
          created_at?: string
          currency?: string | null
          entity_id?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          apodo?: string | null
          bank?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          cedula?: string
          cedula_attachment_url?: string | null
          created_at?: string
          currency?: string | null
          entity_id?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_providers_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_count_lines: {
        Row: {
          counted_at: string | null
          counted_by: string | null
          counted_quantity: number | null
          created_at: string
          entity_id: string
          id: string
          inventory_item_id: string
          notes: string | null
          session_id: string
          system_quantity: number
          unit: string
          updated_at: string
          variance: number | null
        }
        Insert: {
          counted_at?: string | null
          counted_by?: string | null
          counted_quantity?: number | null
          created_at?: string
          entity_id: string
          id?: string
          inventory_item_id: string
          notes?: string | null
          session_id: string
          system_quantity: number
          unit: string
          updated_at?: string
          variance?: number | null
        }
        Update: {
          counted_at?: string | null
          counted_by?: string | null
          counted_quantity?: number | null
          created_at?: string
          entity_id?: string
          id?: string
          inventory_item_id?: string
          notes?: string | null
          session_id?: string
          system_quantity?: number
          unit?: string
          updated_at?: string
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_count_lines_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_lines_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_lines_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_low_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_lines_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "stock_count_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_count_sessions: {
        Row: {
          created_at: string
          entity_id: string
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          reconciled_at: string | null
          reconciled_by: string | null
          session_name: string
          status: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          reconciled_at?: string | null
          reconciled_by?: string | null
          session_name: string
          status?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          reconciled_at?: string | null
          reconciled_by?: string | null
          session_name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_count_sessions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
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
      telegram_recipients: {
        Row: {
          categories: string[]
          chat_id: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          updated_at: string
        }
        Insert: {
          categories?: string[]
          chat_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          updated_at?: string
        }
        Update: {
          categories?: string[]
          chat_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      tractor_maintenance: {
        Row: {
          created_at: string
          entity_id: string
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
          entity_id?: string
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
          entity_id?: string
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
            foreignKeyName: "tractor_maintenance_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "transaction_attachments_transaction_uuid_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transactions_with_dop"
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
          {
            foreignKeyName: "transaction_audit_log_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transactions_with_dop"
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
          {
            foreignKeyName: "transaction_edits_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "v_transactions_with_dop"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          amount_base_currency: number | null
          approval_status: string
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
          dgii_tipo_retencion_isr: string | null
          document: string | null
          due_date: string | null
          entity_id: string
          exchange_rate: number | null
          exchange_rate_used: number | null
          id: string
          is_internal: boolean
          is_void: boolean
          isc: number
          isr_percibido: number
          isr_retenido: number | null
          itbis: number
          itbis_al_costo: number
          itbis_override_reason: string | null
          itbis_percibido: number
          itbis_proporcionalidad: number
          itbis_retenido: number | null
          legacy_id: number | null
          manual_credit_account_code: string | null
          master_acct_code: string | null
          monto_bienes: number | null
          monto_servicios: number | null
          name: string | null
          ncf_modificado: string | null
          otros_impuestos: number
          pay_method: string | null
          project_code: string | null
          project_id: string | null
          propina_legal: number
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
          amount_base_currency?: number | null
          approval_status?: string
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
          dgii_tipo_retencion_isr?: string | null
          document?: string | null
          due_date?: string | null
          entity_id?: string
          exchange_rate?: number | null
          exchange_rate_used?: number | null
          id?: string
          is_internal?: boolean
          is_void?: boolean
          isc?: number
          isr_percibido?: number
          isr_retenido?: number | null
          itbis?: number
          itbis_al_costo?: number
          itbis_override_reason?: string | null
          itbis_percibido?: number
          itbis_proporcionalidad?: number
          itbis_retenido?: number | null
          legacy_id?: number | null
          manual_credit_account_code?: string | null
          master_acct_code?: string | null
          monto_bienes?: number | null
          monto_servicios?: number | null
          name?: string | null
          ncf_modificado?: string | null
          otros_impuestos?: number
          pay_method?: string | null
          project_code?: string | null
          project_id?: string | null
          propina_legal?: number
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
          amount_base_currency?: number | null
          approval_status?: string
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
          dgii_tipo_retencion_isr?: string | null
          document?: string | null
          due_date?: string | null
          entity_id?: string
          exchange_rate?: number | null
          exchange_rate_used?: number | null
          id?: string
          is_internal?: boolean
          is_void?: boolean
          isc?: number
          isr_percibido?: number
          isr_retenido?: number | null
          itbis?: number
          itbis_al_costo?: number
          itbis_override_reason?: string | null
          itbis_percibido?: number
          itbis_proporcionalidad?: number
          itbis_retenido?: number | null
          legacy_id?: number | null
          manual_credit_account_code?: string | null
          master_acct_code?: string | null
          monto_bienes?: number | null
          monto_servicios?: number | null
          name?: string | null
          ncf_modificado?: string | null
          otros_impuestos?: number
          pay_method?: string | null
          project_code?: string | null
          project_id?: string | null
          propina_legal?: number
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
            foreignKeyName: "transactions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
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
          entity_group_id: string | null
          entity_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_group_id?: string | null
          entity_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          entity_group_id?: string | null
          entity_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_entity_group_id_fkey"
            columns: ["entity_group_id"]
            isOneToOne: false
            referencedRelation: "entity_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
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
          apodo: string | null
          bank: string | null
          bank_account_number: string | null
          boot_size: string | null
          cedula: string | null
          created_at: string | null
          date_of_birth: string | null
          date_of_hire: string | null
          date_of_termination: string | null
          entity_id: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          pant_size: string | null
          position: string | null
          salary: number | null
          sex: string | null
          shirt_size: string | null
          updated_at: string | null
        }
        Insert: {
          apodo?: string | null
          bank?: string | null
          bank_account_number?: never
          boot_size?: string | null
          cedula?: never
          created_at?: string | null
          date_of_birth?: string | null
          date_of_hire?: string | null
          date_of_termination?: string | null
          entity_id?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          pant_size?: string | null
          position?: string | null
          salary?: number | null
          sex?: string | null
          shirt_size?: string | null
          updated_at?: string | null
        }
        Update: {
          apodo?: string | null
          bank?: string | null
          bank_account_number?: never
          boot_size?: string | null
          cedula?: never
          created_at?: string | null
          date_of_birth?: string | null
          date_of_hire?: string | null
          date_of_termination?: string | null
          entity_id?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          pant_size?: string | null
          position?: string | null
          salary?: number | null
          sex?: string | null
          shirt_size?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
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
      v_ap_ar_aging: {
        Row: {
          aging_bucket: string | null
          currency: string | null
          days_overdue: number | null
          direction: string | null
          document_date: string | null
          document_number: string | null
          due_date: string | null
          entity_id: string | null
          entity_name: string | null
          id: string | null
          status: string | null
          total_amount: number | null
          total_amount_dop: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ap_ar_documents_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      v_fuel_consumption: {
        Row: {
          avg_gallons_per_hour: number | null
          dispense_count: number | null
          entity_id: string | null
          entity_name: string | null
          equipment_name: string | null
          equipment_type: string | null
          gallons_dispensed: number | null
          month: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_equipment_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      v_inventory_low_stock: {
        Row: {
          commercial_name: string | null
          current_quantity: number | null
          entity_id: string | null
          entity_name: string | null
          function: Database["public"]["Enums"]["inventory_function"] | null
          id: string | null
          minimum_stock: number | null
          shortage: number | null
          use_unit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      v_payroll_summary: {
        Row: {
          employee_count: number | null
          end_date: string | null
          entity_id: string | null
          entity_name: string | null
          period_id: string | null
          start_date: string | null
          status: string | null
          total_benefits: number | null
          total_gross: number | null
          total_isr: number | null
          total_net: number | null
          total_tss: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_periods_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      v_transactions_by_cost_center: {
        Row: {
          cost_center: string | null
          currency: string | null
          entity_id: string | null
          entity_name: string | null
          month: string | null
          total_amount: number | null
          transaction_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      v_transactions_with_dop: {
        Row: {
          account_id: string | null
          amount: number | null
          amount_base_currency: number | null
          amount_dop: number | null
          cbs_code: string | null
          cbs_id: string | null
          comments: string | null
          cost_center: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          destination_acct_code: string | null
          destination_amount: number | null
          dgii_tipo_anulacion: string | null
          dgii_tipo_bienes_servicios: string | null
          dgii_tipo_ingreso: string | null
          document: string | null
          due_date: string | null
          entity_id: string | null
          entity_name: string | null
          exchange_rate: number | null
          exchange_rate_used: number | null
          id: string | null
          is_internal: boolean | null
          is_void: boolean | null
          isr_retenido: number | null
          itbis: number | null
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
          transaction_date: string | null
          transaction_direction: string | null
          updated_at: string | null
          void_reason: string | null
          voided_at: string | null
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
            foreignKeyName: "transactions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
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
      v_trial_balance: {
        Row: {
          account_code: string | null
          account_name: string | null
          account_type: string | null
          balance: number | null
          entity_id: string | null
          entity_name: string | null
          total_credits: number | null
          total_debits: number | null
        }
        Relationships: [
          {
            foreignKeyName: "journals_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
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
              balance_dop: number
              currency: string
              total_credit: number
              total_debit: number
            }[]
          }
      approve_request: {
        Args: { p_note?: string; p_request_id: string }
        Returns: boolean
      }
      begin_stock_count: {
        Args: { p_entity_id: string; p_session_name?: string }
        Returns: string
      }
      calculate_annual_isr: {
        Args: { p_annual_taxable: number; p_year?: number }
        Returns: number
      }
      calculate_payroll_for_period: {
        Args: { p_commit?: boolean; p_entity_id?: string; p_period_id: string }
        Returns: {
          absence_deduction: number
          base_pay: number
          committed: boolean
          days_absent: number
          days_holiday: number
          days_worked: number
          employee_id: string
          employee_name: string
          gross_pay: number
          holiday_pay: number
          isr: number
          loan_deduction: number
          net_pay: number
          overtime_hours: number
          overtime_pay: number
          salary: number
          sunday_pay: number
          total_benefits: number
          total_deductions: number
          tss: number
          vacation_deduction: number
        }[]
      }
      calculate_prestaciones: {
        Args: {
          p_employee_id: string
          p_include_loans?: boolean
          p_manual_adjustments?: number
          p_manual_deductions?: number
          p_pending_vacation_days?: number
          p_scenario?: string
          p_termination_date: string
          p_worked_notice?: boolean
        }
        Returns: Json
      }
      cancel_stock_count: { Args: { p_session_id: string }; Returns: boolean }
      close_day_labor_week:
        | { Args: { p_week_ending: string }; Returns: string }
        | {
            Args: { p_entity_id?: string; p_week_ending: string }
            Returns: string
          }
      compute_period_fx_translation: {
        Args: {
          p_closing_rate: number
          p_end_date: string
          p_entity_id?: string
        }
        Returns: {
          account_code: string
          account_id: string
          account_name: string
          book_dop_balance: number
          fx_impact: number
          reported_dop_balance: number
          usd_balance: number
        }[]
      }
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
      create_transaction_with_ap_ar: {
        Args: {
          p_amount?: number
          p_cbs_code?: string
          p_comments?: string
          p_cost_center?: string
          p_currency?: string
          p_description: string
          p_destination_acct_code?: string
          p_destination_amount?: number
          p_dgii_tipo_bienes_servicios?: string
          p_dgii_tipo_ingreso?: string
          p_dgii_tipo_retencion_isr?: string
          p_document?: string
          p_due_date?: string
          p_entity_id?: string
          p_exchange_rate?: number
          p_is_internal?: boolean
          p_isc?: number
          p_isr_percibido?: number
          p_isr_retenido?: number
          p_itbis?: number
          p_itbis_al_costo?: number
          p_itbis_override_reason?: string
          p_itbis_percibido?: number
          p_itbis_proporcionalidad?: number
          p_itbis_retenido?: number
          p_master_acct_code: string
          p_monto_bienes?: number
          p_monto_servicios?: number
          p_name?: string
          p_ncf_modificado?: string
          p_otros_impuestos?: number
          p_pay_method?: string
          p_project_code?: string
          p_propina_legal?: number
          p_purchase_date?: string
          p_rnc?: string
          p_transaction_date: string
          p_transaction_direction?: string
        }
        Returns: Json
      }
      current_user_entity_id: { Args: never; Returns: string }
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
      dgii_fmt_amount: { Args: { p_amount: number }; Returns: string }
      dgii_id_type: { Args: { p_rnc: string }; Returns: string }
      dgii_pay_method: { Args: { p_method: string }; Returns: string }
      evaluate_posting_rules: {
        Args: { p_entity_id: string; p_payload: Json }
        Returns: {
          actions: Json
          priority: number
          rule_id: string
          rule_name: string
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
      generate_closing_journal:
        | {
            Args: {
              p_end_date: string
              p_period_id: string
              p_start_date: string
              p_user_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_end_date: string
              p_entity_id?: string
              p_period_id: string
              p_start_date: string
              p_user_id: string
            }
            Returns: string
          }
      generate_dgii_606: {
        Args: {
          p_entity_id?: string
          p_month: number
          p_own_rnc?: string
          p_year: number
        }
        Returns: string
      }
      generate_dgii_607: {
        Args: {
          p_entity_id?: string
          p_month: number
          p_own_rnc?: string
          p_year: number
        }
        Returns: string
      }
      generate_dgii_608: {
        Args: {
          p_entity_id?: string
          p_month: number
          p_own_rnc?: string
          p_year: number
        }
        Returns: string
      }
      generate_due_recurring_journals: {
        Args: { p_user_id: string }
        Returns: number
      }
      generate_tss_autodeterminacion: {
        Args: {
          p_entity_id?: string
          p_month: number
          p_nomina_code?: string
          p_own_rnc?: string
          p_retroactiva?: boolean
          p_year: number
        }
        Returns: string
      }
      get_all_public_tables: {
        Args: never
        Returns: {
          row_estimate: number
          table_name: string
        }[]
      }
      get_balance_sheet: {
        Args: { p_as_of_date?: string; p_entity_id?: string }
        Returns: {
          account_code: string
          account_name: string
          account_type: string
          balance: number
        }[]
      }
      get_cost_per_field: {
        Args: { p_end_date: string; p_entity_id?: string; p_start_date: string }
        Returns: {
          farm_name: string
          field_id: string
          field_name: string
          input_cost: number
          operation_count: number
          total_hectares: number
        }[]
      }
      get_exchange_rate: {
        Args: { p_currency: string; p_date: string; p_rate_type?: string }
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
      get_pending_approvals: {
        Args: { p_entity_id?: string }
        Returns: {
          amount: number
          applies_to: string
          currency: string
          description: string
          entity_id: string
          entity_name: string
          record_id: string
          request_id: string
          submitted_at: string
          submitted_by: string
        }[]
      }
      get_profit_loss: {
        Args: {
          p_cost_center?: string
          p_end_date: string
          p_entity_id?: string
          p_start_date: string
        }
        Returns: {
          account_code: string
          account_name: string
          account_type: string
          currency: string
          total_amount: number
        }[]
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
      has_role_for_entity: {
        Args: {
          p_entity_id: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
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
      is_global_admin: { Args: never; Returns: boolean }
      is_mfa_verified: { Args: never; Returns: boolean }
      post_journal: {
        Args: { p_journal_id: string; p_user: string }
        Returns: undefined
      }
      reconcile_stock_count: {
        Args: { p_notes?: string; p_session_id: string }
        Returns: {
          adjusted: boolean
          counted_qty: number
          item_name: string
          system_qty: number
          unit: string
          variance: number
        }[]
      }
      register_service_partial_payment: {
        Args: {
          p_amount: number
          p_bank_account_id: string
          p_is_final_payment?: boolean
          p_ncf?: string
          p_notes?: string
          p_payment_date: string
          p_service_entry_id: string
        }
        Returns: Json
      }
      reject_request: {
        Args: { p_note?: string; p_request_id: string }
        Returns: boolean
      }
      revalue_open_ap_ar:
        | {
            Args: {
              p_period_id: string
              p_posted_by: string
              p_revaluation_date: string
            }
            Returns: number
          }
        | {
            Args: {
              p_entity_id?: string
              p_period_id: string
              p_revaluation_date: string
              p_user_id: string
            }
            Returns: number
          }
      save_operation_inputs: {
        Args: {
          p_inputs?: Json
          p_operation_id: string
          p_restore_original?: boolean
        }
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
      tss_ascii: { Args: { p_len: number; p_text: string }; Returns: string }
      tss_fmt_amount: {
        Args: { p_amount: number; p_int_len?: number }
        Returns: string
      }
      upsert_field_boundary: {
        Args: { p_field_id: string; p_geojson: string }
        Returns: undefined
      }
      user_entity_ids: { Args: never; Returns: string[] }
      user_has_entity_access: {
        Args: { p_entity_id: string }
        Returns: boolean
      }
      user_has_group_access: { Args: { p_group_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "accountant"
        | "management"
        | "supervisor"
        | "viewer"
        | "driver"
        | "office"
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
      liquidation_case_status: "draft" | "final"
      prestaciones_scenario: "desahucio" | "dimision"
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
        "office",
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
      liquidation_case_status: ["draft", "final"],
      prestaciones_scenario: ["desahucio", "dimision"],
    },
  },
} as const
