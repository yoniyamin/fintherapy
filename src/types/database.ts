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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
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

export interface Profile {
  id: string
  household_id: string | null
  display_name: string
  avatar_url: string | null
  total_xp: number
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
  batch_id: string | null
  /** Optional note from the classify screen; persisted per transaction. */
  user_note?: string | null
  created_at: string
}

export interface MerchantKnowledge {
  id: string
  merchant_pattern: string
  category: string
  confidence: number
  created_at: string
}

export interface Guess {
  id: string
  user_id: string
  month: string
  category: string
  predicted_amount: number
  created_at: string
}
