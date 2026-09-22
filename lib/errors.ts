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
    not_authorized: dict.notAuthorized,
    fields_required: dict.fieldsRequired,
    nothing_changed: dict.nothingChanged,
    still_referenced: dict.stillReferenced,
    // users
    phone_invalid: dict.phoneInvalid,
    phone_taken: dict.phoneTaken,
    password_too_short: dict.passwordTooShort,
    role_not_allowed: dict.roleNotAllowed,
    service_key_missing: dict.serviceKeyMissing,
    // assignments
    need_at_least_one_subtask: dict.needAtLeastOneSubtask,
    reason_required: dict.reasonRequired,
    no_items_selected: dict.noItemsSelected,
    not_in_submitted_state: dict.notInSubmittedState,
    already_closed: dict.alreadyClosed,
    deadline_must_be_future: dict.deadlineMustBeFuture,
    // rounds + week plan (0013)
    need_at_least_one_place: dict.needAtLeastOnePlace,
    round_places_invalid: dict.roundPlacesInvalid,
    invalid_assignee: dict.invalidAssignee,
    past_date: dict.pastDate,
    invalid_plan: dict.invalidPlan,
  };
  return map[code] ?? dict.errorGeneric;
}
