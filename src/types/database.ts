export interface Database {
  public: {
    Tables: {
      households: {
        Row: Household
        Insert: Omit<Household, 'id' | 'created_at'>
        Update: Partial<Omit<Household, 'id'>>
        Relationships: []
      }
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at'> & { total_xp?: number }
        Update: Partial<Omit<Profile, 'id'>>
        Relationships: []
      }
      session_statistics: {
        Row: SessionStatistics
        Insert: Omit<SessionStatistics, 'created_at' | 'updated_at' | 'duration_seconds'> & {
          duration_seconds?: number
        }
        Update: Partial<Omit<SessionStatistics, 'id'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      upsert_session_statistics: {
        Args: {
          p_id: string
          p_auth_action: string
          p_section_seconds: Record<string, number>
        }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export interface Household {
  id: string
  name: string
  schema_name: string
  invite_code: string
  monthly_income: number | null
  created_at: string
}

export interface SessionStatistics {
  id: string
  created_at: string
  updated_at: string
  auth_action: 'sign_in' | 'sign_up' | 'password_recovery'
  section_seconds: Record<string, number>
  duration_seconds: number
}

export interface AnalysisReportConfig {
  headline?: boolean
  kpiCards?: boolean
  fixedDiscretionary?: boolean
  categoryTrend?: boolean
  deltaDrivers?: boolean
  memberSpending?: boolean
  topVendors?: boolean
  cardCategorySplit?: boolean
  budgetVsActual?: boolean
  recurring?: boolean
  comparisonTable?: boolean
  calendarHeatmap?: boolean
  advisorNotes?: boolean
  velocityGauge?: boolean
  savingsProjection?: boolean
  /** 'grouped' (default) rolls subcategories up to parent; 'detailed' shows all separately. */
  subcategoryDisplay?: 'grouped' | 'detailed'
}

export interface SavedProjection {
  categoryIds: string[]
  cutPct: number
  savedAt: string
}

export interface UiPrefs {
  comparisonView?: 'bars' | 'cards'
  assumedInflationRate?: number
  savedProjection?: SavedProjection
  savedProjectionHistory?: SavedProjection[]
  analysisReportConfig?: AnalysisReportConfig
}

export interface Profile {
  id: string
  household_id: string | null
  display_name: string
  avatar_url: string | null
  total_xp: number
  ui_prefs: UiPrefs
  created_at: string
}

export interface Transaction {
  id: string
  uploaded_by: string | null
  merchant_raw: string
  merchant_clean: string | null
  amount: number
  tx_date: string
  billing_month: string
  account_last4: string | null
  category: string | null
  status: 'auto' | 'manual' | 'pending' | 'flagged' | 'transfer' | 'offset'
  classified_by: string | null
  /** When this row was last classified / confirmed / marked transfer (server time). */
  classified_at?: string | null
  batch_id: string | null
  /** Optional note from the classify screen; persisted per transaction. */
  user_note?: string | null
  created_at: string
}

export type AccountType = 'credit' | 'debit'

export interface AccountAlias {
  last4: string
  label: string
  account_type: AccountType | null
}

export interface MerchantKnowledge {
  id: string
  merchant_pattern: string
  category: string
  confidence: number
  created_at: string
}


