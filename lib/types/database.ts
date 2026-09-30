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
          /** A mirror of role_id for the old clients (custom roles read 'cleaner'). Never decide on it. */
          role: string;
          /** The person's role (custom roles). Changed only through assign_role. */
          role_id: string;
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
          role_id?: string;
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
          /**
           * The OWNER: the one assignee, or whichever of several acted first
           * (answer, photo or submit). Null while several assignees have not
           * started.
           */
          inspector_id: string | null;
          inspector_name: string | null;
          /** Everyone the task was given to (sorted). One id for a single-assignee task. */
          assignee_ids: string[];
          /** The last day of a multi-day task; null = one day (scheduled_date). */
          end_date: string | null;
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
          /** The staff member's optional note at submit (notes migration). */
          submit_note: string | null;
          submitted_at: string | null;
          /** Optional instructions from whoever created the task (notes migration). */
          task_note: string | null;
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
          /** The first of assignee_ids, kept for the portal build on main. Read assignee_ids. */
          assignee_id: string | null;
          /** The cell's people. Empty once unassigned while some of its tasks had already started. */
          assignee_ids: string[];
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
      /** The staff app's About and Policies text. Everyone reads; only set_club_page (admins) writes. */
      club_pages: {
        Row: {
          key: ClubPageKey;
          body_en: string;
          body_ar: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      /** The club's zone: one row at most, written once by set_club_location (admins). */
      club_location: {
        Row: {
          id: boolean;
          lat: number;
          lng: number;
          radius_m: number;
          set_by: string | null;
          set_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      /**
       * What a phone's outbox parked, and why (SY-6, SY-10). Written only by
       * record_sync_refusal (the API, as the user). Readable by the staff
       * member, their manager and admins. No foreign key to submissions on
       * purpose: a planner delete must not erase the record.
       */
      sync_refusals: {
        Row: {
          assignment_id: string | null;
          code: string;
          created_at: string;
          id: string;
          idempotency_key: string | null;
          item_id: string | null;
          message: string | null;
          /** answer | photos | submit | locale (the API route's last segment) */
          op: string;
          user_id: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      /**
       * A task's status history, written only by the trigger on submissions.
       * Readable by whoever can see the task. Rows before 27 Sep 2026 are a
       * backfill from the timestamps the task still held.
       */
      submission_events: {
        Row: {
          id: number;
          submission_id: string;
          event: SubmissionEvent;
          actor_id: string | null;
          at: string;
          note: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      /**
       * The permission catalog, seeded by migrations only: key = module.action.
       * Everyone signed in reads it and the role tables below; writes go
       * through create_role / update_role / delete_role / assign_role.
       */
      permissions: {
        Row: {
          key: string;
          section: string;
          module: string;
          action: PermissionAction;
          label_en: string;
          label_ar: string;
          sort: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      /** A club's roles. `key` names the four defaults; custom roles have none. */
      roles: {
        Row: {
          id: string;
          key: 'admin' | 'manager' | 'inspector' | 'cleaner' | null;
          name_en: string;
          name_ar: string;
          scope: RoleScope;
          /** The Admin role: nobody edits, deletes or assigns it. */
          locked: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      role_permissions: {
        Row: { role_id: string; permission_key: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      /** The departments of a role whose scope is 'departments'. */
      role_departments: {
        Row: { role_id: string; department_id: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      /** Which roles a role may create users with or assign. The Admin role's list is a rule, not rows. */
      role_assignable: {
        Row: { role_id: string; assignable_role_id: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      /** Every role change and assignment. Readable with roles.view. */
      role_audit: {
        Row: {
          id: number;
          at: string;
          actor: string | null;
          action: string;
          role_id: string | null;
          target_user: string | null;
          before: Json | null;
          after: Json | null;
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
          /** assignee_ids' names, in the same order (profiles RLS applies). */
          assignee_names: string[] | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Functions: {
      create_assignment: {
        // Only p_client_id, p_source_template_id, p_task_note and p_end_date are
        // optional — every assignment REQUIRES a date and a time window.
        // (An older p_assignee_id signature survives for the build on main.)
        Args: {
          p_title_en: string;
          p_title_ar: string;
          p_site_id: string;
          /** One id: that person owns it. Several: the first to act claims it. */
          p_assignee_ids: string[];
          p_scheduled_date: string;
          p_window_start: string;
          p_window_end: string;
          p_items: Json;
          p_source_template_id?: string;
          p_client_id?: string;
          p_task_note?: string;
          /** The last day, for a task that runs over several days. */
          p_end_date?: string;
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
       * { round_template_id, date: 'YYYY-MM-DD', assignee_ids: string[] } (empty
       * clears the cell); raises
       * PAST_DATE / INVALID_ASSIGNEE. Returns the ScheduleResult counts.
       */
      schedule_rounds: { Args: { p_plan: Json }; Returns: Json };
      set_club_page: {
        Args: { p_key: ClubPageKey; p_body_en: string; p_body_ar: string };
        Returns: undefined;
      };
      /** Admin only, once; raises LOCATION_ALREADY_SET after that. */
      set_club_location: {
        Args: { p_lat: number; p_lng: number; p_radius_m: number };
        Returns: undefined;
      };
      attach_item_photo: { Args: { p_item_id: string; p_storage_path: string }; Returns: undefined };
      submit_assignment: {
        Args: { p_assignment_id: string; p_signature_path: string; p_completed_at?: string; p_note?: string };
        Returns: undefined;
      };
      /**
       * The Users screen's rows: the caller's staff list. SECURITY DEFINER;
       * needs users.view and raises without it. `phone` is populated only
       * with phones.view, which makes this the only route to profiles.phone
       * now that 0011 took the column off the table's grant. `role` is the
       * mirror; the role itself is profiles.role_id.
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
      /**
       * The caller's role, scope, permissions and the roles they may assign,
       * or null without an active role. Parse with parseAccess (lib/access.ts).
       */
      my_access: { Args: never; Returns: Json };
      /**
       * Roles need roles.create / roles.edit and scope 'all'. Raise NAME_REQUIRED,
       * NAME_TAKEN, INVALID_SCOPE, DEPARTMENTS_REQUIRED, NOT_A_SUBSET, and on
       * update NOT_FOUND, ROLE_LOCKED, OWN_ROLE.
       */
      create_role: {
        Args: {
          p_name_en: string;
          p_name_ar: string;
          p_scope: RoleScope;
          p_permissions: string[];
          p_department_ids: string[];
          p_assignable_role_ids: string[];
        };
        Returns: string;
      };
      update_role: {
        Args: {
          p_role_id: string;
          p_name_en: string;
          p_name_ar: string;
          p_scope: RoleScope;
          p_permissions: string[];
          p_department_ids: string[];
          p_assignable_role_ids: string[];
        };
        Returns: undefined;
      };
      /** Also raises DEFAULT_ROLE and ROLE_IN_USE. */
      delete_role: { Args: { p_role_id: string }; Returns: undefined };
      /** can_manage_user(p_user_id), and the new role one the caller may assign. */
      assign_role: { Args: { p_user_id: string; p_role_id: string }; Returns: undefined };
      can_assign_role: { Args: { p_role_id: string; p_department_id?: string | null }; Returns: boolean };
      can_manage_user: { Args: { p_user_id: string }; Returns: boolean };
      has_permission: { Args: { p_key: string }; Returns: boolean };
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

/**
 * roles.scope — whose work a role sees. Your own work is always visible.
 *   own          only your own
 *   team         your direct reports (profiles.manager_id)
 *   departments  work in the role's role_departments
 *   all          everything
 */
export const ROLE_SCOPES = ['own', 'team', 'departments', 'all'] as const;
export type RoleScope = (typeof ROLE_SCOPES)[number];

/** permissions.action — the matrix's four columns, in order. */
export const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete'] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

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

/** submission_events.event — one step of a task's history. */
export type SubmissionEvent =
  | 'created'
  | 'claimed'
  | 'reassigned'
  | 'started'
  | 'submitted'
  | 'follow_up'
  | 'sent_back'
  | 'approved'
  | 'extended';

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
 *
 * role_id (custom roles) needs a column grant like the rest the day 0011's
 * column grants are restored: without `grant select (role_id)` every read
 * through this list fails. (Live on 29 Sep the table-wide grant is back, so
 * it reads.)
 */
export const PROFILE_COLUMNS =
  'id, name, email, role, role_id, created_at, department_id, manager_id, active, must_change_password, locale';

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
export type SyncRefusal = Tables<'sync_refusals'>;
export type SubmissionEventRow = Tables<'submission_events'>;
export const CLUB_PAGE_KEYS = ['about', 'policies'] as const;
export type ClubPageKey = (typeof CLUB_PAGE_KEYS)[number];
export type ClubPage = Tables<'club_pages'>;
export type Permission = Tables<'permissions'>;
export type RoleRow = Tables<'roles'>;
