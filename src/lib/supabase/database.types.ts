// Supabaseスキーマに対応する手書きの型定義。
// `supabase gen types typescript` で生成される形式に準拠している
// （Relationships を含む）ため、embedded select（例: `student:students(*)`）も型が付く。
// 実際のプロジェクトに接続できるようになったら生成コマンドで置き換えても良い。

export type StudentStatus = "enrolled" | "graduated" | "withdrawn";
export type ClassType = "homeroom" | "elective";
export type SymbolCategory =
  | "attendance"
  | "absence"
  | "late"
  | "early_leave"
  | "excused"
  | "excluded";
export type EventReplaceMode = "all" | "partial" | "none";
export type StaffRole = "admin" | "full_time" | "part_time";

export interface Database {
  public: {
    Tables: {
      terms: {
        Row: {
          id: string;
          name: string;
          start_date: string;
          end_date: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          start_date: string;
          end_date: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["terms"]["Insert"]>;
        Relationships: [];
      };
      staff: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: StaffRole;
          login_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          email: string;
          role?: StaffRole;
          login_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["staff"]["Insert"]>;
        Relationships: [];
      };
      staff_permissions: {
        Row: {
          staff_id: string;
          can_view_summary: boolean;
          can_manage_students: boolean;
          can_manage_classes: boolean;
          can_manage_staff: boolean;
          can_manage_settings: boolean;
          can_view_individual_records: boolean;
        };
        Insert: {
          staff_id: string;
          can_view_summary?: boolean;
          can_manage_students?: boolean;
          can_manage_classes?: boolean;
          can_manage_staff?: boolean;
          can_manage_settings?: boolean;
          can_view_individual_records?: boolean;
        };
        Update: Partial<
          Database["public"]["Tables"]["staff_permissions"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "staff_permissions_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: true;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
        ];
      };
      students: {
        Row: {
          id: string;
          student_number: string;
          name: string;
          furigana: string;
          photo_url: string | null;
          enrollment_date: string;
          status: StudentStatus;
          status_date: string | null;
          status_note: string | null;
          nationality: string | null;
          gender: string | null;
          date_of_birth: string | null;
          expected_graduation_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_number: string;
          name: string;
          furigana: string;
          photo_url?: string | null;
          enrollment_date: string;
          status?: StudentStatus;
          status_date?: string | null;
          status_note?: string | null;
          nationality?: string | null;
          gender?: string | null;
          date_of_birth?: string | null;
          expected_graduation_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["students"]["Insert"]>;
        Relationships: [];
      };
      classes: {
        Row: {
          id: string;
          term_id: string;
          name: string;
          type: ClassType;
          created_at: string;
        };
        Insert: {
          id?: string;
          term_id: string;
          name: string;
          type: ClassType;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["classes"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "classes_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      class_enrollments: {
        Row: {
          id: string;
          student_id: string;
          class_id: string;
          seq_no: number | null;
          valid_from: string;
          valid_to: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          class_id: string;
          seq_no?: number | null;
          valid_from: string;
          valid_to?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["class_enrollments"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "class_enrollments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_enrollments_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      elective_memberships: {
        Row: {
          id: string;
          student_id: string;
          class_id: string;
          valid_from: string;
          valid_to: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          class_id: string;
          valid_from: string;
          valid_to?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["elective_memberships"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "elective_memberships_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "elective_memberships_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      timetable_versions: {
        Row: {
          id: string;
          class_id: string;
          effective_from: string;
          effective_to: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          effective_from: string;
          effective_to?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["timetable_versions"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "timetable_versions_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      timetable_slots: {
        Row: {
          id: string;
          timetable_version_id: string;
          day_of_week: number;
          period_no: number;
          period_label: string;
          subject: string;
          teacher_name: string | null;
          is_elective_slot: boolean;
        };
        Insert: {
          id?: string;
          timetable_version_id: string;
          day_of_week: number;
          period_no: number;
          period_label: string;
          subject: string;
          teacher_name?: string | null;
          is_elective_slot?: boolean;
        };
        Update: Partial<
          Database["public"]["Tables"]["timetable_slots"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "timetable_slots_timetable_version_id_fkey";
            columns: ["timetable_version_id"];
            isOneToOne: false;
            referencedRelation: "timetable_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          id: string;
          term_id: string;
          name: string;
          date_from: string;
          date_to: string;
          credit_periods: number;
          replace_mode: EventReplaceMode;
          created_at: string;
        };
        Insert: {
          id?: string;
          term_id: string;
          name: string;
          date_from: string;
          date_to: string;
          credit_periods?: number;
          replace_mode?: EventReplaceMode;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["events"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "events_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      event_replaced_periods: {
        Row: { event_id: string; period_no: number };
        Insert: { event_id: string; period_no: number };
        Update: Partial<
          Database["public"]["Tables"]["event_replaced_periods"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "event_replaced_periods_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      event_classes: {
        Row: { event_id: string; class_id: string };
        Insert: { event_id: string; class_id: string };
        Update: Partial<
          Database["public"]["Tables"]["event_classes"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "event_classes_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_classes_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      symbols: {
        Row: {
          id: string;
          term_id: string;
          order_no: number;
          symbol_char: string;
          label: string;
          category: SymbolCategory;
          counts_as_required: boolean;
          is_late_early_target: boolean;
        };
        Insert: {
          id?: string;
          term_id: string;
          order_no: number;
          symbol_char: string;
          label: string;
          category: SymbolCategory;
          counts_as_required?: boolean;
          is_late_early_target?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["symbols"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "symbols_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      conversion_rules: {
        Row: {
          term_id: string;
          late_n: number;
          early_n: number;
          combined_n: number;
        };
        Insert: {
          term_id: string;
          late_n?: number;
          early_n?: number;
          combined_n?: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["conversion_rules"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "conversion_rules_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: true;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      color_rules: {
        Row: {
          id: string;
          term_id: string;
          tier_no: number;
          lower_pct: number;
          upper_pct: number;
          color_hex: string;
          label: string | null;
        };
        Insert: {
          id?: string;
          term_id: string;
          tier_no: number;
          lower_pct: number;
          upper_pct: number;
          color_hex: string;
          label?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["color_rules"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "color_rules_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      term_settings: {
        Row: {
          term_id: string;
          percent_decimal_digits: number;
          credit_hours_per_period: number;
        };
        Insert: {
          term_id: string;
          percent_decimal_digits?: number;
          credit_hours_per_period?: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["term_settings"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "term_settings_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: true;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      holidays: {
        Row: {
          id: string;
          term_id: string;
          date: string;
          label: string;
          color_hex: string | null;
        };
        Insert: {
          id?: string;
          term_id: string;
          date: string;
          label: string;
          color_hex?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["holidays"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "holidays_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance_records: {
        Row: {
          id: string;
          student_id: string;
          class_id: string;
          date: string;
          period_no: number;
          symbol_id: string;
          time_value: string | null;
          reason: string | null;
          recorded_by: string;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          class_id: string;
          date: string;
          period_no: number;
          symbol_id: string;
          time_value?: string | null;
          reason?: string | null;
          recorded_by: string;
          recorded_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["attendance_records"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "attendance_records_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_records_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_records_symbol_id_fkey";
            columns: ["symbol_id"];
            isOneToOne: false;
            referencedRelation: "symbols";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_records_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
        ];
      };
      event_attendance: {
        Row: {
          id: string;
          event_id: string;
          student_id: string;
          symbol_id: string;
          recorded_by: string;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          student_id: string;
          symbol_id: string;
          recorded_by: string;
          recorded_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["event_attendance"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "event_attendance_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_attendance_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_attendance_symbol_id_fkey";
            columns: ["symbol_id"];
            isOneToOne: false;
            referencedRelation: "symbols";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_attendance_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_class_permissions: {
        Row: {
          staff_id: string;
          class_id: string;
          can_input: boolean;
          can_view_summary: boolean;
        };
        Insert: {
          staff_id: string;
          class_id: string;
          can_input?: boolean;
          can_view_summary?: boolean;
        };
        Update: Partial<
          Database["public"]["Tables"]["staff_class_permissions"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "staff_class_permissions_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_class_permissions_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      schedule_change_overrides: {
        Row: {
          id: string;
          class_id: string;
          date: string;
          period_no: number;
          subject: string | null;
          teacher_name: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          date: string;
          period_no: number;
          subject?: string | null;
          teacher_name?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["schedule_change_overrides"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "schedule_change_overrides_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      historical_monthly_summaries: {
        Row: {
          id: string;
          student_id: string;
          year_month: string;
          required_days: number;
          attended_days: number;
          absent_days: number;
          late_count: number;
          early_leave_count: number;
          excused_days: number;
          excluded_days: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          year_month: string;
          required_days?: number;
          attended_days?: number;
          absent_days?: number;
          late_count?: number;
          early_leave_count?: number;
          excused_days?: number;
          excluded_days?: number;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["historical_monthly_summaries"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "historical_monthly_summaries_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      staff_login_email: {
        Args: { p_login_id: string };
        Returns: string;
      };
    };
  };
}
