export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AvailabilityRule = {
  id: string;
  counselor_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
};
export type AvailabilityException = {
  id: string;
  counselor_id: string;
  local_date: string;
  kind: string;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
};
export type AvailabilitySettings = {
  id: boolean;
  session_minutes: number;
  buffer_minutes: number;
  min_notice_minutes: number;
  max_advance_days: number;
};

export type Database = {
  public: {
    Tables: {
      availability_rules: {
        Row: AvailabilityRule;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      availability_exceptions: {
        Row: AvailabilityException;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      availability_settings: {
        Row: AvailabilitySettings;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      counselors: {
        Row: {
          id: string;
          profile_id: string;
          display_name: string;
          bio: string;
          qualifications: string;
          experience: string;
          specialties: string;
          languages: string;
          photo_url: string;
          published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          display_name: string;
          bio: string;
          qualifications: string;
          experience: string;
          specialties: string;
          languages: string;
          photo_url: string;
          published?: boolean;
        };
        Update: {
          display_name?: string;
          bio?: string;
          qualifications?: string;
          experience?: string;
          specialties?: string;
          languages?: string;
          photo_url?: string;
          published?: boolean;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          preferred_name: string | null;
          phone: string;
          email: string | null;
          role: Database["public"]["Enums"]["profile_role"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          preferred_name?: string | null;
          phone: string;
          email?: string | null;
          role?: Database["public"]["Enums"]["profile_role"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          preferred_name?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      public_session_settings: { Row: Omit<AvailabilitySettings, "id">; Relationships: [] };
      public_counselors: {
        Row: {
          id: string;
          display_name: string;
          bio: string;
          qualifications: string;
          experience: string;
          specialties: string;
          languages: string;
          photo_url: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      save_availability_rule: {
        Args: {
          p_counselor_id: string;
          p_id: string | null;
          p_weekday: number;
          p_start_time: string;
          p_end_time: string;
        };
        Returns: string;
      };
      save_availability_exception: {
        Args: {
          p_counselor_id: string;
          p_id: string | null;
          p_local_date: string;
          p_kind: string;
          p_all_day: boolean;
          p_start_time: string | null;
          p_end_time: string | null;
        };
        Returns: string;
      };
      delete_availability: {
        Args: { p_counselor_id: string; p_id: string; p_kind: string };
        Returns: undefined;
      };
      set_availability_settings: {
        Args: {
          p_session_minutes: number;
          p_buffer_minutes: number;
          p_min_notice_minutes: number;
          p_max_advance_days: number;
        };
        Returns: undefined;
      };
      get_public_availability: {
        Args: { p_counselor_id: string };
        Returns: { start_at: string; end_at: string }[];
      };
      set_own_contact_email: {
        Args: {
          p_email: string;
        };
        Returns: undefined;
      };
      grant_profile_role: {
        Args: {
          p_target_user_id: string;
          p_new_role: Database["public"]["Enums"]["profile_role"];
          p_reason: string;
          p_counselor_verification_reference?: string | null;
        };
        Returns: undefined;
      };
    };
    Enums: {
      profile_role: "customer" | "counselor" | "admin";
    };
    CompositeTypes: { [_ in never]: never };
  };
};
