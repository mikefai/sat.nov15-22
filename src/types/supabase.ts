export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      admin_users: {
        Row: {
          granted_at: string;
          reason: string;
          user_id: string;
        };
        Insert: {
          granted_at?: string;
          reason?: string;
          user_id: string;
        };
        Update: {
          granted_at?: string;
          reason?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      course_progress: {
        Row: {
          completed_steps: number;
          correct_questions: number;
          error_log_count: number;
          last_route_hash: string;
          mastered_words: number;
          progress_json: Json;
          solved_questions: number;
          state_version: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_steps?: number;
          correct_questions?: number;
          error_log_count?: number;
          last_route_hash?: string;
          mastered_words?: number;
          progress_json?: Json;
          solved_questions?: number;
          state_version?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed_steps?: number;
          correct_questions?: number;
          error_log_count?: number;
          last_route_hash?: string;
          mastered_words?: number;
          progress_json?: Json;
          solved_questions?: number;
          state_version?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          email: string | null;
          exam_date: string;
          id: string;
          target_score: number;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          exam_date?: string;
          id: string;
          target_score?: number;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          exam_date?: string;
          id?: string;
          target_score?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      claim_instructor_admin: { Args: { passcode: string }; Returns: boolean };
      is_my_account_admin: { Args: never; Returns: boolean };
      verify_instructor_passcode: { Args: { p_passcode: string }; Returns: boolean };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type CourseProgressRow = Database['public']['Tables']['course_progress']['Row'];
export type AdminUserRow = Database['public']['Tables']['admin_users']['Row'];
