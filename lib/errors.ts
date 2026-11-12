import type { Dictionary } from '@/lib/i18n/dictionaries';

/**
 * One place a server action's error code becomes a sentence.
 *
 * Five components were each keeping their own copy of this table, and they had
 * already drifted — `phone_taken` reached the user as the literal string
 * "phone_taken" because only some of them listed it. Unknown codes fall back
 * to the generic message rather than to the code, so a new one added on the
 * server is never shown raw.
 *
 * Imports only the dictionary type, so a client component can use it without
 * pulling in next/headers.
 */
export function errorMessage(dict: Dictionary, code: string): string {
  const map: Record<string, string> = {
    // shared
    // One refused action, not the portal gate (that is notAuthorized, in the layout).
    not_authorized: dict.noPermission,
    fields_required: dict.fieldsRequired,
    nothing_changed: dict.nothingChanged,
    still_referenced: dict.stillReferenced,
    // users
    phone_invalid: dict.phoneInvalid,
    phone_taken: dict.phoneTaken,
    email_invalid: dict.emailInvalid,
    login_taken: dict.loginTaken,
    password_too_short: dict.passwordTooShort,
    role_not_allowed: dict.roleNotAllowed,
    department_required: dict.departmentRequired,
    // roles
    role_in_use: dict.roleInUse,
    role_locked: dict.roleReadOnlyLocked,
    own_role: dict.roleReadOnlyOwn,
    not_a_subset: dict.roleNotASubset,
    departments_required: dict.roleDepartmentsRequired,
    name_taken: dict.roleNameTaken,
    name_required: dict.roleNameRequired,
    invalid_scope: dict.roleInvalidScope,
    not_found: dict.roleNotFound,
    default_role: dict.roleDefaultError,
    // assignments
    need_at_least_one_subtask: dict.needAtLeastOneSubtask,
    no_items_selected: dict.noItemsSelected,
    reason_required: dict.reasonRequired,
    not_in_submitted_state: dict.notInSubmittedState,
    already_closed: dict.alreadyClosed,
    deadline_must_be_future: dict.deadlineMustBeFuture,
    invalid_end_date: dict.invalidEndDate,
    // multi-place tasks (create_task_group)
    title_en_required: dict.titleEnRequired,
    place_window_overlap: dict.placeWindowOverlap,
    place_not_found: dict.placeNotFound,
    // rounds + week plan (0013)
    need_at_least_one_place: dict.needAtLeastOnePlace,
    round_places_invalid: dict.roundPlacesInvalid,
    invalid_assignee: dict.invalidAssignee,
    past_date: dict.pastDate,
    invalid_plan: dict.invalidPlan,
    // club settings
    location_invalid: dict.locationInvalid,
    location_already_set: dict.locationAlreadySet,
  };
  return map[code] ?? dict.errorGeneric;
}
