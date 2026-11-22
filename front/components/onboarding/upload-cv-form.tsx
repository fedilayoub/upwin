'use client';

import { FileText, Loader2, Upload } from 'lucide-react';
import { useActionState, useId, useRef, useState } from 'react';
import { uploadCvAction } from '@/app/[lang]/(app)/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import { INITIAL_FORM_ACTION_STATE } from '@/lib/form-action-state';
import { cn } from '@/lib/utils';

const MEGABYTE = 1_024 * 1_024;

export function UploadCvForm({
  copy,
  locale,
}: {
  copy: Dictionary['onboarding']['upload'];
  locale: Locale;
}) {
  const [state, action, pending] = useActionState(
    uploadCvAction.bind(null, locale),
    INITIAL_FORM_ACTION_STATE,
  );
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  // Picking or dropping a file starts the import straight away. The submit
  // button stays as the retry path after an error.
  const startImport = (selected: File | null) => {
    setFile(selected);
    if (selected) formRef.current?.requestSubmit();
  };

  // The drop target writes into the same file input the form submits, so the
  // server action keeps receiving one plain `file` field either way.
  const acceptDroppedFile = (dropped: File | undefined) => {
    if (pending || !dropped || !inputRef.current) return;
    const transfer = new DataTransfer();
    transfer.items.add(dropped);
    inputRef.current.files = transfer.files;
    startImport(dropped);
  };

  return (
    <form action={action} className="space-y-5" ref={formRef}>
      <div
        className={cn(
          'relative rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
          dragging
            ? 'border-[var(--dashboard-accent)] bg-[var(--dashboard-accent-soft)]'
            : 'border-border bg-muted/30 hover:border-[var(--dashboard-accent)]/50',
        )}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          if (!pending) setDragging(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          acceptDroppedFile(event.dataTransfer.files[0]);
        }}
      >
        <input
          accept="application/pdf,.pdf"
          className="sr-only"
          id={inputId}
          name="file"
          onChange={(event) => startImport(event.target.files?.[0] ?? null)}
          ref={inputRef}
          required
          type="file"
        />

        {file ? (
          <div className="flex flex-col items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-[var(--dashboard-accent-soft)] text-[var(--dashboard-accent)]">
              <FileText className="size-5" strokeWidth={2} />
            </span>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {copy.selected}
              </p>
              <p className="break-all text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / MEGABYTE).toFixed(2)} MB
              </p>
            </div>
            <Button
              disabled={pending}
              onClick={() => inputRef.current?.click()}
              size="sm"
              type="button"
              variant="outline"
            >
              {copy.changeFile}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-[var(--dashboard-accent-soft)] text-[var(--dashboard-accent)]">
              <Upload className="size-5" strokeWidth={2} />
            </span>
            <div className="space-y-1">
              {/* The label spans the whole box, so a click anywhere opens the picker. */}
              <label
                className="text-sm font-medium after:absolute after:inset-0 after:content-['']"
                htmlFor={inputId}
              >
                {copy.dropTitle}
              </label>
              <p className="text-sm text-muted-foreground">{copy.dropHint}</p>
            </div>
            <p className="text-xs text-muted-foreground">{copy.fileHint}</p>
          </div>
        )}
      </div>

      {state.message && !pending ? (
        <Alert variant="destructive">
          <AlertDescription aria-live="polite">{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending} type="submit">
          {pending ? <Loader2 className="animate-spin" /> : <Upload />}
          {pending ? copy.submitting : copy.submit}
        </Button>
        <p className="text-xs text-muted-foreground">{copy.privacy}</p>
      </div>
    </form>
  );
}
