import type { Dictionary } from '@/lib/i18n/dictionaries';

/** The refusal code as a supervisor reads it: what happened and what to do. */
export function refusalLabel(code: string, dict: Dictionary): string {
  switch (code) {
    case 'ASSIGNMENT_EXPIRED':
      return dict.refusalExpired;
    case 'ASSIGNMENT_CLOSED':
      return dict.refusalClosed;
    case 'ASSIGNMENT_NOT_FOUND':
    case 'ITEM_NOT_FOUND':
      return dict.refusalNotFound;
    case 'NOT_AUTHORIZED':
      return dict.refusalNotAuthorized;
    case 'MISSING_PHOTO':
      return dict.refusalMissingPhoto;
    case 'EMPTY_SUBMISSION':
      return dict.refusalEmpty;
    case 'MISSING_FILE':
      return dict.refusalMissingFile;
    default:
      return dict.refusalOther;
  }
}

export function refusalOp(op: string, dict: Dictionary): string {
  return op === 'photos' || op === 'photo'
    ? dict.syncOpPhoto
    : op === 'submit'
      ? dict.syncOpSubmit
      : dict.syncOpAnswer;
}
