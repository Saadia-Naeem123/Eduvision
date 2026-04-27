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
      chat_messages: {
        Row: {
          attachments: Json | null
          content: string
          created_at: string
          critic_notes: string | null
          id: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          created_at?: string
          critic_notes?: string | null
          id?: string
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string
          critic_notes?: string | null
          id?: string
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          context_material_id: string | null
          created_at: string
          id: string
          title: string
          topic_id: string | null
          user_id: string
        }
        Insert: {
          context_material_id?: string | null
          created_at?: string
          id?: string
          title?: string
          topic_id?: string | null
          user_id: string
        }
        Update: {
          context_material_id?: string | null
          created_at?: string
          id?: string
          title?: string
          topic_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_context_material_id_fkey"
            columns: ["context_material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          ai_summary: string | null
          created_at: string
          extracted_text: string | null
          id: string
          mime_type: string | null
          size_bytes: number | null
          status: string
          storage_path: string
          title: string
          user_id: string
        }
        Insert: {
          ai_summary?: string | null
          created_at?: string
          extracted_text?: string | null
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          status?: string
          storage_path: string
          title: string
          user_id: string
        }
        Update: {
          ai_summary?: string | null
          created_at?: string
          extracted_text?: string | null
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      performance: {
        Row: {
          attempts: number
          correct: number
          id: string
          mastery: number
          subject: string
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          correct?: number
          id?: string
          mastery?: number
          subject: string
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          correct?: number
          id?: string
          mastery?: number
          subject?: string
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          grade: string | null
          id: string
          learning_goal: string | null
          onboarded: boolean
          streak_days: number
          subjects: string[] | null
          total_xp: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          grade?: string | null
          id: string
          learning_goal?: string | null
          onboarded?: boolean
          streak_days?: number
          subjects?: string[] | null
          total_xp?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          grade?: string | null
          id?: string
          learning_goal?: string | null
          onboarded?: boolean
          streak_days?: number
          subjects?: string[] | null
          total_xp?: number
          updated_at?: string
        }
        Relationships: []
      }
      quiz_answers: {
        Row: {
          attempt_id: string
          correct_answer: string | null
          created_at: string
          critic_feedback: string | null
          difficulty: string | null
          explanation: string | null
          id: string
          is_correct: boolean | null
          options: Json | null
          question: string
          question_type: string
          user_answer: string | null
          user_id: string
        }
        Insert: {
          attempt_id: string
          correct_answer?: string | null
          created_at?: string
          critic_feedback?: string | null
          difficulty?: string | null
          explanation?: string | null
          id?: string
          is_correct?: boolean | null
          options?: Json | null
          question: string
          question_type?: string
          user_answer?: string | null
          user_id: string
        }
        Update: {
          attempt_id?: string
          correct_answer?: string | null
          created_at?: string
          critic_feedback?: string | null
          difficulty?: string | null
          explanation?: string | null
          id?: string
          is_correct?: boolean | null
          options?: Json | null
          question?: string
          question_type?: string
          user_answer?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          completed: boolean
          created_at: string
          difficulty: string
          id: string
          mode: string
          score: number
          topic_id: string | null
          topic_title: string | null
          total: number
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          difficulty?: string
          id?: string
          mode?: string
          score?: number
          topic_id?: string | null
          topic_title?: string | null
          total?: number
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          difficulty?: string
          id?: string
          mode?: string
          score?: number
          topic_id?: string | null
          topic_title?: string | null
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          created_at: string
          dismissed: boolean
          id: string
          kind: string
          payload: Json | null
          reason: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dismissed?: boolean
          id?: string
          kind: string
          payload?: Json | null
          reason?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          dismissed?: boolean
          id?: string
          kind?: string
          payload?: Json | null
          reason?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          created_at: string
          difficulty: string
          grade: string | null
          id: string
          subject: string
          summary: string | null
          tags: string[] | null
          title: string
        }
        Insert: {
          created_at?: string
          difficulty?: string
          grade?: string | null
          id?: string
          subject: string
          summary?: string | null
          tags?: string[] | null
          title: string
        }
        Update: {
          created_at?: string
          difficulty?: string
          grade?: string | null
          id?: string
          subject?: string
          summary?: string | null
          tags?: string[] | null
          title?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "student"
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
      app_role: ["admin", "student"],
    },
  },
} as const
