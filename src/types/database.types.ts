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
export type BookingSummary = {
  id: string;
  counselor_id: string;
  counselor_name: string;
  start_at: string;
  end_at: string;
  status: "held" | "expired" | "confirmed";
  hold_expires_at: string;
  reschedule_count: number;
};

export type PaymentOrderRecord = {
  id: string;
  booking_id: string;
  customer_id: string;
  provider: "simulator" | "razorpay";
  amount_paise: number;
  currency: "INR";
  external_order_id: string | null;
  creation_state: "reserved" | "creating" | "ready" | "uncertain";
  confirmed_payment_id: string | null;
  review_reason: string | null;
  created_at: string;
  updated_at: string;
  reconciled_at: string | null;
};
type ReadOnlyPaymentTable<T> = { Row: T; Insert: never; Update: never; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      notification_jobs: ReadOnlyPaymentTable<{
        id: string;
        booking_id: string;
        recipient_id: string;
        channel: "email" | "whatsapp";
        template: string;
        schedule_revision: number;
        link_revision: number;
        due_at: string;
        status: string;
        attempts: number;
        next_attempt_at: string;
        lease_token: string | null;
        lease_until: string | null;
        error_code: string | null;
        fail_next: boolean;
        created_at: string;
      }>;

      payment_settings: ReadOnlyPaymentTable<{
        id: boolean;
        amount_paise: number;
        currency: "INR";
      }>;
      payment_orders: ReadOnlyPaymentTable<PaymentOrderRecord>;
      payment_transactions: ReadOnlyPaymentTable<{
        id: string;
        order_id: string;
        booking_id: string;
        provider: string;
        payment_id: string;
        state: string;
        amount_paise: number;
        currency: string;
        outcome: string;
        reason: string | null;
        updated_at: string;
      }>;
      payment_events: ReadOnlyPaymentTable<{
        id: string;
        provider: string;
        event_id: string;
        payload_digest: string;
        order_id: string | null;
        outcome: string;
        created_at: string;
      }>;
      payment_audit_events: ReadOnlyPaymentTable<{
        id: string;
        actor_id: string | null;
        order_id: string | null;
        action: string;
        occurred_at: string;
      }>;
      payment_simulator_orders: ReadOnlyPaymentTable<{
        id: string;
        receipt: string;
        amount: number;
        currency: string;
        status: string;
        payments: Json;
      }>;

      booking_settings: {
        Row: { id: boolean; hold_minutes: number };
        Insert: never;
        Update: never;
        Relationships: [];
      };
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
      get_counselor_workspace: { Args: { p_view?: string; p_page?: number }; Returns: Json };
      get_counselor_session: { Args: { p_booking_id: string }; Returns: Json };
      get_customer_portal: {
        Args: { p_view?: string; p_page?: number; p_booking_id?: string };
        Returns: Json;
      };
      set_booking_meeting: { Args: { p_booking_id: string; p_url: string }; Returns: undefined };
      get_accessible_booking_meetings: {
        Args: Record<string, never>;
        Returns: { booking_id: string; meeting_url: string; revision: number }[];
      };
      get_assigned_confirmed_bookings: {
        Args: Record<string, never>;
        Returns: { id: string; start_at: string; end_at: string; meeting_url: string | null }[];
      };
      get_admin_confirmed_bookings: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          counselor_name: string;
          start_at: string;
          meeting_url: string | null;
        }[];
      };
      retry_notification: { Args: { p_job_id: string }; Returns: undefined };
      fail_next_notification_attempt: { Args: { p_job_id: string }; Returns: undefined };

      reserve_payment_order: {
        Args: { p_booking_id: string; p_provider: string };
        Returns: PaymentOrderRecord;
      };
      claim_payment_order: { Args: { p_order_id: string }; Returns: boolean };
      attach_payment_order: {
        Args: { p_order_id: string; p_external_id: string };
        Returns: undefined;
      };
      note_payment_order_problem: {
        Args: { p_order_id: string; p_reason: string };
        Returns: undefined;
      };
      claim_payment_refresh: { Args: { p_order_id: string }; Returns: boolean };
      claim_payment_reconciliation: {
        Args: { p_limit: number; p_provider: string };
        Returns: PaymentOrderRecord[];
      };
      apply_payment_observation: {
        Args: {
          p_order_id: string;
          p_event_id: string;
          p_digest: string;
          p_payment_id: string;
          p_state: string;
          p_amount: number;
          p_currency: string;
        };
        Returns: string;
      };
      record_unmatched_payment_event: {
        Args: { p_provider: string; p_event_id: string; p_digest: string };
        Returns: undefined;
      };
      simulate_payment_attempt: { Args: { p_order_id: string; p_result: string }; Returns: Json };
      get_payment_exceptions: { Args: Record<string, never>; Returns: PaymentOrderRecord[] };
      get_unmatched_payment_events: {
        Args: Record<string, never>;
        Returns: { provider: string; event_id: string; outcome: string; created_at: string }[];
      };
      set_payment_price: { Args: { p_amount_paise: number }; Returns: undefined };

      create_booking_hold: {
        Args: { p_counselor_id: string; p_start_at: string };
        Returns: string;
      };
      reschedule_booking: {
        Args: { p_booking_id: string; p_counselor_id: string; p_start_at: string };
        Returns: string;
      };
      get_my_bookings: { Args: Record<string, never>; Returns: BookingSummary[] };
      set_booking_hold_minutes: { Args: { p_hold_minutes: number }; Returns: undefined };
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
