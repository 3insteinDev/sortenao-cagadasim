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
      achievements: {
        Row: {
          code: string
          earned_at: string
          icon: string | null
          id: string
          title: string
          user_id: string
        }
        Insert: {
          code: string
          earned_at?: string
          icon?: string | null
          id?: string
          title: string
          user_id: string
        }
        Update: {
          code?: string
          earned_at?: string
          icon?: string | null
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      groups: {
        Row: {
          letter: string
          name: string
        }
        Insert: {
          letter: string
          name: string
        }
        Update: {
          letter?: string
          name?: string
        }
        Relationships: []
      }
      leaderboard_entries: {
        Row: {
          avatar_url: string | null
          id: string
          nickname: string
          prev_rank: number | null
          total_hits: number
          total_points: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          id: string
          nickname: string
          prev_rank?: number | null
          total_hits?: number
          total_points?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          id?: string
          nickname?: string
          prev_rank?: number | null
          total_hits?: number
          total_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_entries_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_placeholder: string | null
          away_score: number | null
          away_team_id: string | null
          created_at: string
          external_id: number | null
          group_letter: string | null
          home_placeholder: string | null
          home_score: number | null
          home_team_id: string | null
          id: string
          kickoff_at: string
          last_synced_at: string | null
          manual_override: boolean
          match_code: string | null
          phase: Database["public"]["Enums"]["match_phase"]
          round: number | null
          status: Database["public"]["Enums"]["match_status"]
        }
        Insert: {
          away_placeholder?: string | null
          away_score?: number | null
          away_team_id?: string | null
          created_at?: string
          external_id?: number | null
          group_letter?: string | null
          home_placeholder?: string | null
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          kickoff_at: string
          last_synced_at?: string | null
          manual_override?: boolean
          match_code?: string | null
          phase: Database["public"]["Enums"]["match_phase"]
          round?: number | null
          status?: Database["public"]["Enums"]["match_status"]
        }
        Update: {
          away_placeholder?: string | null
          away_score?: number | null
          away_team_id?: string | null
          created_at?: string
          external_id?: number | null
          group_letter?: string | null
          home_placeholder?: string | null
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          kickoff_at?: string
          last_synced_at?: string | null
          manual_override?: boolean
          match_code?: string | null
          phase?: Database["public"]["Enums"]["match_phase"]
          round?: number | null
          status?: Database["public"]["Enums"]["match_status"]
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_group_letter_fkey"
            columns: ["group_letter"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["letter"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      points_history: {
        Row: {
          created_at: string
          id: string
          meta: Json | null
          points: number
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta?: Json | null
          points: number
          source: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meta?: Json | null
          points?: number
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      predictions: {
        Row: {
          away_score: number
          home_score: number
          id: string
          match_id: string
          points: number
          submitted_at: string
          user_id: string
        }
        Insert: {
          away_score: number
          home_score: number
          id?: string
          match_id: string
          points?: number
          submitted_at?: string
          user_id: string
        }
        Update: {
          away_score?: number
          home_score?: number
          id?: string
          match_id?: string
          points?: number
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          blocked: boolean
          created_at: string
          full_name: string
          id: string
          nickname: string
          predictions_submitted_at: string | null
          prev_rank: number | null
          total_hits: number
          total_points: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          blocked?: boolean
          created_at?: string
          full_name?: string
          id: string
          nickname?: string
          predictions_submitted_at?: string | null
          prev_rank?: number | null
          total_hits?: number
          total_points?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          blocked?: boolean
          created_at?: string
          full_name?: string
          id?: string
          nickname?: string
          predictions_submitted_at?: string | null
          prev_rank?: number | null
          total_hits?: number
          total_points?: number
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      teams: {
        Row: {
          created_at: string
          flag: string
          group_letter: string | null
          id: string
          name: string
          sigla: string
        }
        Insert: {
          created_at?: string
          flag: string
          group_letter?: string | null
          id?: string
          name: string
          sigla: string
        }
        Update: {
          created_at?: string
          flag?: string
          group_letter?: string | null
          id?: string
          name?: string
          sigla?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_group_letter_fkey"
            columns: ["group_letter"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["letter"]
          },
        ]
      }
      tournament_predictions: {
        Row: {
          group_letter: string | null
          id: string
          points: number
          pred_type: Database["public"]["Enums"]["tp_type"]
          submitted_at: string
          team_id: string | null
          user_id: string
        }
        Insert: {
          group_letter?: string | null
          id?: string
          points?: number
          pred_type: Database["public"]["Enums"]["tp_type"]
          submitted_at?: string
          team_id?: string | null
          user_id: string
        }
        Update: {
          group_letter?: string | null
          id?: string
          points?: number
          pred_type?: Database["public"]["Enums"]["tp_type"]
          submitted_at?: string
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_predictions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_results: {
        Row: {
          group_letter: string | null
          id: string
          result_type: Database["public"]["Enums"]["tp_type"]
          team_id: string | null
        }
        Insert: {
          group_letter?: string | null
          id?: string
          result_type: Database["public"]["Enums"]["tp_type"]
          team_id?: string | null
        }
        Update: {
          group_letter?: string | null
          id?: string
          result_type?: Database["public"]["Enums"]["tp_type"]
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      get_leaderboard: {
        Args: never
        Returns: {
          avatar_url: string
          id: string
          nickname: string
          prev_rank: number
          total_hits: number
          total_points: number
        }[]
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
      app_role: "admin" | "user"
      match_phase: "group" | "r32" | "r16" | "qf" | "sf" | "third" | "final"
      match_status: "scheduled" | "live" | "finished"
      tp_type:
        | "group_1st"
        | "group_2nd"
        | "r16"
        | "qf"
        | "sf"
        | "finalist"
        | "champion"
        | "runner_up"
        | "third"
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
      app_role: ["admin", "user"],
      match_phase: ["group", "r32", "r16", "qf", "sf", "third", "final"],
      match_status: ["scheduled", "live", "finished"],
      tp_type: [
        "group_1st",
        "group_2nd",
        "r16",
        "qf",
        "sf",
        "finalist",
        "champion",
        "runner_up",
        "third",
      ],
    },
  },
} as const
