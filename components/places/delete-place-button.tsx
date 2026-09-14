'use client';

import { deletePlace } from '@/lib/actions/places';
import { ConfirmDeleteButton } from '@/components/ui/confirm-delete-button';
import type { Dictionary } from '@/lib/i18n/dictionaries';

/** Binds the place id to the shared destructive row control. */
export function DeletePlaceButton({ id, dict }: { id: string; dict: Dictionary }) {
  return <ConfirmDeleteButton dict={dict} onDelete={() => deletePlace(id)} />;
}
