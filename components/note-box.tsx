import { cn } from '@/lib/utils';

/**
 * A note in its own box, coloured by who wrote it (decided 26 Nov), so it
 * stands out from the checklist rows on the checklist page, the report and the
 * PDF (which is that report page printed):
 *   staff    — amber: a question's comment, the sign-off note
 *   manager  — red tint: the send-back reason
 *   info     — neutral: the task's instructions
 * The label says what it is; the colour says whose it is.
 */
export type NoteTone = 'staff' | 'manager' | 'info';

const TONES: Record<NoteTone, string> = {
  staff: 'bg-note-tint text-note-deep border-note-edge',
  manager: 'bg-magenta-tint text-magenta-deep border-magenta',
  info: 'bg-surface text-text border-divider',
};

export function NoteBox({
  tone,
  label,
  children,
  className,
}: {
  tone: NoteTone;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // border-s: the start edge, so it moves to the right under Arabic.
        'max-w-2xl rounded-card border-s-4 px-3 py-2 text-sm whitespace-pre-line print:break-inside-avoid',
        TONES[tone],
        className,
      )}
    >
      <span className="me-2 text-label uppercase">{label}</span>
      {children}
    </div>
  );
}
