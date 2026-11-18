export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
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
    Views: { [_ in never]: never };
    Functions: {
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
