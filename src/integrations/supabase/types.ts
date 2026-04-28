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
      balls: {
        Row: {
          ball_in_over: number
          bowler: string | null
          commentary: string | null
          created_at: string
          extra_runs: number
          extra_type: string | null
          id: string
          innings_number: number
          is_legal: boolean
          is_wicket: boolean
          match_id: string
          non_striker: string | null
          out_player: string | null
          over_number: number
          runs: number
          striker: string | null
          wicket_type: string | null
        }
        Insert: {
          ball_in_over: number
          bowler?: string | null
          commentary?: string | null
          created_at?: string
          extra_runs?: number
          extra_type?: string | null
          id?: string
          innings_number: number
          is_legal?: boolean
          is_wicket?: boolean
          match_id: string
          non_striker?: string | null
          out_player?: string | null
          over_number: number
          runs?: number
          striker?: string | null
          wicket_type?: string | null
        }
        Update: {
          ball_in_over?: number
          bowler?: string | null
          commentary?: string | null
          created_at?: string
          extra_runs?: number
          extra_type?: string | null
          id?: string
          innings_number?: number
          is_legal?: boolean
          is_wicket?: boolean
          match_id?: string
          non_striker?: string | null
          out_player?: string | null
          over_number?: number
          runs?: number
          striker?: string | null
          wicket_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "balls_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      innings_state: {
        Row: {
          balls: number
          batting_team: string
          bowler: string | null
          bowling_team: string
          created_at: string
          extras: number
          id: string
          innings_number: number
          is_complete: boolean
          match_id: string
          non_striker: string | null
          runs: number
          striker: string | null
          target: number | null
          updated_at: string
          wickets: number
        }
        Insert: {
          balls?: number
          batting_team: string
          bowler?: string | null
          bowling_team: string
          created_at?: string
          extras?: number
          id?: string
          innings_number: number
          is_complete?: boolean
          match_id: string
          non_striker?: string | null
          runs?: number
          striker?: string | null
          target?: number | null
          updated_at?: string
          wickets?: number
        }
        Update: {
          balls?: number
          batting_team?: string
          bowler?: string | null
          bowling_team?: string
          created_at?: string
          extras?: number
          id?: string
          innings_number?: number
          is_complete?: boolean
          match_id?: string
          non_striker?: string | null
          runs?: number
          striker?: string | null
          target?: number | null
          updated_at?: string
          wickets?: number
        }
        Relationships: [
          {
            foreignKeyName: "innings_state_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string
          current_innings: number
          format: string
          id: string
          scorer_name: string | null
          scorer_token: string
          status: string
          team_a: string
          team_a_players: Json
          team_b: string
          team_b_players: Json
          toss_decision: string | null
          toss_winner: string | null
          total_overs: number
          updated_at: string
          view_token: string
        }
        Insert: {
          created_at?: string
          current_innings?: number
          format?: string
          id?: string
          scorer_name?: string | null
          scorer_token?: string
          status?: string
          team_a: string
          team_a_players?: Json
          team_b: string
          team_b_players?: Json
          toss_decision?: string | null
          toss_winner?: string | null
          total_overs?: number
          updated_at?: string
          view_token?: string
        }
        Update: {
          created_at?: string
          current_innings?: number
          format?: string
          id?: string
          scorer_name?: string | null
          scorer_token?: string
          status?: string
          team_a?: string
          team_a_players?: Json
          team_b?: string
          team_b_players?: Json
          toss_decision?: string | null
          toss_winner?: string | null
          total_overs?: number
          updated_at?: string
          view_token?: string
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
