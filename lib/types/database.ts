/**
 * The live "Check List" project (ptonujazlljpkgpfrkpw), as the portal sees it.
 *
 * Hand-curated, NOT generated: the domain unions below, `Insert: never` on the
 * RPC-only tables and the per-column comments do not come out of the
 * generator, so regenerating would silently drop them. Edit by hand after a
 * migration — 0013 added round_templates, rounds, the answer columns and
 * `follow_up`.
 *
 * Legacy/unused relations (_backup_pre_ohouse_*, device_tokens) are omitted;
 * everything the portal or the Flutter app touches is here.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.5' };
  public: {
    Tables: {
      profiles: {
        Row: {
          active: boolean;
          created_at: string;
          department_id: string | null;
          email: string;
          id: string;
          locale: string;
          manager_id: string | null;
          must_change_password: boolean;
          name: string;
          phone: string | null;
          role: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          department_id?: string | null;
          email?: string;
          id: string;
          locale?: string;
          manager_id?: string | null;
          must_change_password?: boolean;
          name?: string;
          phone?: string | null;
          role?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      sites: {
        Row: {
          address: string;
          created_at: string;
          created_by: string | null;
          id: string;
          name_ar: string;
          name_en: string;
        };
        Insert: {
          address?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name_ar?: string;
          name_en?: string;
        };
        Update: Partial<Database['public']['Tables']['sites']['Insert']>;
        Relationships: [];
      };
      departments: {
        Row: { created_at: string; id: string; name_ar: string; name_en: string };
        Insert: { created_at?: string; id?: string; name_ar?: string; name_en?: string };
        Update: Partial<Database['public']['Tables']['departments']['Insert']>;
        Relationships: [];
      };
      templates: {
        Row: {
          category: string;
          created_at: string;
          created_by: string | null;
          department_id: string | null;
          description_ar: string;
          description_en: string;
          end_time: string | null;
          id: string;
          items: Json;
          site_id: string | null;
          start_time: string | null;
          time_windows: Json;
          title_ar: string;
          title_en: string;
        };
        Insert: {
          category?: string;
          created_at?: string;
          created_by?: string | null;
          department_id?: string | null;
          description_ar?: string;
          description_en?: string;
          end_time?: string | null;
          id?: string;
          items?: Json;
          site_id?: string | null;
          start_time?: string | null;
          time_windows?: Json;
          title_ar?: string;
          title_en?: string;
        };
        Update: Partial<Database['public']['Tables']['templates']['Insert']>;
        Relationships: [];
      };
      submissions: {
        Row: {
          answers: Json;
          client_id: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          /** The zone round this task was scheduled from (0013); null for a one-off assignment. */
          round_id: string | null;
          extended_at: string | null;
          extended_by: string | null;
          extended_until: string | null;
          extension_note: string | null;
          id: string;
          inspector_id: string;
          inspector_name: string;
          late_sync: boolean;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          scheduled_date: string | null;
          score: number | null;
          signature_url: string | null;
          site_id: string | null;
          site_name_ar: string | null;
          site_name_en: string | null;
          source_template_id: string | null;
          status: string;
          submitted_at: string | null;
          template_id: string | null;
          template_title_ar: string;
          template_title_en: string;
          title_ar: string;
          title_en: string;
          window_end: string | null;
          window_start: string | null;
        };
        Insert: never; // no INSERT path for the portal — use create_assignment
        Update: never; // submissions has NO RLS UPDATE policy; use the RPCs
        Relationships: [];
      };
      assignment_items: {
        Row: {
          /** The latest answer given (0013): 'yes'|'no', 'pass'|'fail', a number as text, or free text. */
          answer: string | null;
          assignment_id: string;
          /** The item's correct-answer rule, copied from the place (0013). Null = any answer is fine. */
          correct: Json | null;
          critical: boolean;
          done_at: string | null;
          /** The first wrong answer and when it was given — kept after the fix, as history. */
          flagged_answer: string | null;
          flagged_at: string | null;
          id: string;
          note: string | null;
          photo_paths: string[];
          reject_note: string | null;
          requires_photo: boolean;
          sort_order: number;
          status: string;
          template_item_id: string | null;
          text_ar: string;
          text_en: string;
          type: string;
        };
        Insert: never; // created only by create_assignment
        Update: never; // mutated only by mark_item_done / attach_item_photo / reject_items
        Relationships: [];
      };
      template_claims: {
        Row: {
          claim_date: string;
          claimed_at: string;
          id: string;
          inspector_id: string;
          inspector_name: string;
          released_at: string | null;
          released_by: string | null;
          template_id: string;
        };
        Insert: {
          claim_date?: string;
          claimed_at?: string;
          id?: string;
          inspector_id: string;
          inspector_name?: string;
          released_at?: string | null;
          released_by?: string | null;
          template_id: string;
        };
        Update: Partial<Database['public']['Tables']['template_claims']['Insert']>;
        Relationships: [];
      };
      actions: {
        Row: {
          assignment_item_id: string | null;
          closed_at: string | null;
          created_at: string;
          due_date: string | null;
          id: string;
          item_id: string | null;
          note: string;
          owner_id: string | null;
          owner_name: string;
          photo_url: string | null;
          priority: string;
          site_id: string | null;
          status: string;
          submission_id: string | null;
          template_id: string | null;
          title_ar: string;
          title_en: string;
        };
        Insert: Partial<Database['public']['Tables']['actions']['Row']>;
        Update: Partial<Database['public']['Tables']['actions']['Row']>;
        Relationships: [];
      };
      /** A zone round (0013): an ordered list of places, each with its own window. */
      round_templates: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          id: string;
          /** RoundPlace[] — parse with roundPlaces() in lib/rounds.ts. */
          places: Json;
          title_ar: string;
          title_en: string;
        };
        Insert: {
          active?: boolean;
          id?: string;
          places?: Json;
          title_ar?: string;
          title_en?: string;
        };
        Update: Partial<Database['public']['Tables']['round_templates']['Insert']>;
        Relationships: [];
      };
      /** One round template on one day for one person (0013). Written only by schedule_rounds. */
      rounds: {
        Row: {
          /** Null once unassigned while some of its tasks had already started. */
          assignee_id: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          round_template_id: string;
          scheduled_date: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      /** Always read effective_status, never submissions.status. */
      assignments_v: {
        Row: Omit<Database['public']['Tables']['submissions']['Row'], 'id' | 'inspector_id' | 'status'> & {
          id: string | null;
          inspector_id: string | null;
          status: string | null;
          /** COALESCE(extended_until, scheduled_date + window_end AT TIME ZONE 'Africa/Cairo'), +1 day when the window wraps midnight. NULL without a schedule. */
          deadline: string | null;
          effective_status: EffectiveStatus | null;
          was_extended: boolean | null;
          /** The zone round's name when the task came from one (0013). */
          round_title_en: string | null;
          round_title_ar: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Functions: {
      create_assignment: {
        // Only p_client_id and p_source_template_id are optional — every
        // assignment REQUIRES a date and a time window.
        Args: {
          p_title_en: string;
          p_title_ar: string;
          p_site_id: string;
          p_assignee_id: string;
          p_scheduled_date: string;
          p_window_start: string;
          p_window_end: string;
          p_items: Json;
          p_source_template_id?: string;
          p_client_id?: string;
        };
        Returns: string;
      };
      approve_assignment: {
        Args: { p_assignment_id: string; p_score?: number };
        Returns: undefined;
      };
      reject_items: {
        Args: { p_assignment_id: string; p_item_ids: string[]; p_reason: string };
        Returns: undefined;
      };
      extend_assignment: {
        Args: { p_assignment_id: string; p_new_deadline: string; p_note?: string };
        Returns: undefined;
      };
      mark_item_done: {
        Args: { p_item_id: string; p_note?: string; p_answer?: string };
        Returns: undefined;
      };
      /**
       * The week planner's Save (0013). Admin/manager only. Each cell is
       * { round_template_id, date: 'YYYY-MM-DD', assignee_id | null }; raises
       * PAST_DATE / INVALID_ASSIGNEE. Returns the ScheduleResult counts.
       */
      schedule_rounds: { Args: { p_plan: Json }; Returns: Json };
      attach_item_photo: { Args: { p_item_id: string; p_storage_path: string }; Returns: undefined };
      submit_assignment: {
        Args: { p_assignment_id: string; p_signature_path: string; p_completed_at?: string };
        Returns: undefined;
      };
      /**
       * The Users screen's rows. SECURITY DEFINER; admins and managers only
       * (0012), and it raises for anyone else. `phone` comes back populated
       * for an admin and null for a manager, which makes this the only route
       * to profiles.phone now that 0011 took the column off the table's
       * grant.
       */
      admin_staff_list: {
        Args: never;
        Returns: {
          id: string;
          name: string;
          email: string;
          phone: string | null;
          role: string;
          department_id: string | null;
          manager_id: string | null;
          active: boolean;
          must_change_password: boolean;
        }[];
      };
      set_user_role: { Args: { target_user_id: string; new_role: Role }; Returns: undefined };
      set_user_department: { Args: { target_user_id: string; new_department_id: string | null }; Returns: undefined };
      set_user_manager: { Args: { target_user_id: string; new_manager_id: string | null }; Returns: undefined };
      set_action_status: { Args: { p_action_id: string; p_status: 'open' | 'closed' }; Returns: undefined };
      set_locale: { Args: { p_locale: 'en' | 'ar' }; Returns: undefined };
      complete_password_change: { Args: never; Returns: undefined };
      current_role: { Args: never; Returns: string };
      current_department_id: { Args: never; Returns: string };
      template_window_open: { Args: { p_template_id: string }; Returns: boolean };
      template_claimed_by_caller: { Args: { p_template_id: string }; Returns: boolean };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

/* ------------------------------------------------------------------ */
/* Domain unions — text columns with CHECK constraints, not PG enums.  */
/* ------------------------------------------------------------------ */

/** profiles.role. `cleaner` and `inspector` are identical at the DB level. */
export type Role = 'admin' | 'manager' | 'inspector' | 'cleaner';

/**
 * The roles the portal may hand out. `admin` is deliberately absent: an admin
 * is the account that can mint accounts, so minting one from inside the portal
 * would let a single compromised session escalate itself permanently. New
 * admins are made in the Supabase dashboard, by someone holding the project
 * keys — a deliberately slower, better-witnessed path.
 *
 * Lives here rather than in lib/actions/users.ts because a 'use server' module
 * may export nothing but async functions, and both the guard and the <select>
 * need to read the same list.
 */
export const STAFF_ROLES = ['manager', 'inspector', 'cleaner'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(role: string): role is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

/**
 * The staff roles a caller may hand out — and, identically, the roles whose
 * password that caller may set. One function because they are one question:
 * creating an account and taking one over are the same reach by two routes,
 * and 0010's whole argument is that granting one without the other closes
 * nothing.
 *
 * An admin gets STAFF_ROLES, which is exactly what isStaffRole already gated
 * on, so the admin path is unchanged. A manager may not mint or take over a
 * peer — that would let one manager quietly multiply itself — and no caller
 * reaches 'admin' at all, which stays the Supabase dashboard's job.
 */
export function grantableRoles(callerRole: string | undefined | null): readonly StaffRole[] {
  return callerRole === 'admin' ? STAFF_ROLES : (['inspector', 'cleaner'] as const);
}

/**
 * submissions.status — the CHECK-legal stored values. `follow_up` (0013): the
 * round was submitted with at least one answer that missed its correct
 * answer, and stays here — never expiring — until the assignee fixes it.
 */
export type AssignmentStatus =
  | 'pending'
  | 'in_progress'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'follow_up';

/** assignments_v.effective_status — stored values plus computed 'expired'. */
export type EffectiveStatus = AssignmentStatus | 'expired';

/** assignment_items.status. `follow_up`: answered, but not with the correct answer. */
export type ItemStatus = 'pending' | 'done' | 'rejected' | 'follow_up';

/** templates.items[].type — the four the builder emits. */
export type ItemType = 'pass_fail' | 'yesno' | 'text' | 'number';

/**
 * An item's correct answer (0013) — answer_ok() in the database is the judge.
 * `eq` for yes/no ('yes'|'no'), pass/fail ('pass'|'fail') and text (compared
 * ignoring case and surrounding spaces); `min`/`max` for a number, either
 * bound optional, an exact value being min = max.
 */
export type Correct = { eq: string } | { min?: number; max?: number };

/** One entry of templates.items jsonb — also the shape create_assignment's p_items consumes. */
export type TemplateItem = {
  id: string;
  text_en: string;
  text_ar: string;
  type: ItemType;
  critical: boolean;
  requires_photo: boolean;
  /** Absent = any answer is accepted. Setting one turns on follow-up for the item. */
  correct?: Correct;
  /**
   * The legacy inspector web client's keys, carried through untouched so a
   * portal save no longer strips them. That client scores against `expected`
   * and files an `actions` row when the answer equals `follow_up_on`. The new
   * flow never reads them — `correct` is its rule.
   */
  expected?: string | number | boolean;
  follow_up_on?: string | number | boolean;
  scored?: string | number | boolean;
};

/** One place in a round template. Times are "HH:MM"; the order is the walk order. */
export type RoundPlace = { template_id: string; window_start: string; window_end: string };

/** What schedule_rounds reports back for a save. */
export type ScheduleResult = {
  created: number;
  moved: number;
  removed: number;
  kept: number;
  skipped: number;
};

/** One entry of templates.time_windows jsonb. Times are "HH:MM". */
export type TimeWindow = { start_time: string; end_time: string };

/* ------------------------------------------------------------------ */
/* Convenience aliases                                                 */
/* ------------------------------------------------------------------ */

type PublicSchema = Database['public'];

export type Tables<T extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])> =
  (PublicSchema['Tables'] & PublicSchema['Views'])[T] extends { Row: infer R } ? R : never;

export type Profile = Tables<'profiles'>;

/**
 * The profiles columns a signed-in user may SELECT, as a PostgREST column
 * list — every column except `phone`.
 *
 * Migration 0011 revoked the table-wide SELECT on profiles from
 * `authenticated` and granted these columns back individually, so `phone`
 * is unreachable through the table and comes only from admin_staff_list().
 * A `select('*')` anywhere on profiles now fails with a permission error,
 * which is why this string exists rather than being inlined twice.
 */
export const PROFILE_COLUMNS =
  'id, name, email, role, created_at, department_id, manager_id, active, must_change_password, locale';

/** A profile as the portal can read it: everything but the phone number. */
export type PortalProfile = Omit<Profile, 'phone'>;
export type Site = Tables<'sites'>;
export type Department = Tables<'departments'>;
export type Template = Tables<'templates'>;
export type Assignment = Tables<'assignments_v'>;
export type AssignmentItem = Tables<'assignment_items'>;
export type Action = Tables<'actions'>;
export type RoundTemplate = Tables<'round_templates'>;
export type Round = Tables<'rounds'>;
