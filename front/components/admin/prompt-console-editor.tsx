'use client';

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  FlaskConical,
  History,
  Loader2,
  RotateCcw,
  Save,
  Send,
  SlidersHorizontal,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import {
  activatePromptRevisionAction,
  dryRunPromptRevisionAction,
  previewPromptRevisionAction,
  resetPromptCapabilityAction,
  savePromptDraftAction,
} from '@/app/[lang]/(app)/settings/prompts/actions';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { StarBorder } from '@/components/ui/star-border';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import type {
  AnalyzerTemplateContent,
  PromptAnchorScore,
  PromptConsoleResponse,
  PromptDryRunResponse,
  PromptPreviewResponse,
  PromptRevision,
} from '@/lib/api/types';
import { cn } from '@/lib/utils';

type ConsoleTab = 'compose' | 'preview' | 'dryRun' | 'history';

export function PromptConsoleEditor({
  consoleData,
  copy,
  locale,
  revisions,
}: {
  consoleData: PromptConsoleResponse;
  copy: Dictionary['promptConsole'];
  locale: Locale;
  revisions: PromptRevision[];
}) {
  const latestDraft = consoleData.drafts[0] ?? null;
  const initialContent =
    latestDraft?.content ??
    consoleData.active?.content ??
    consoleData.codeDefault;
  const [content, setContent] = useState<AnalyzerTemplateContent>(initialContent);
  const [notes, setNotes] = useState(latestDraft?.notes ?? '');
  const [revisionId, setRevisionId] = useState<string | null>(latestDraft?.id ?? null);
  const [revisionNumber, setRevisionNumber] = useState<number | null>(
    latestDraft?.revisionNumber ?? null,
  );
  const [revisionStatus, setRevisionStatus] = useState<
    PromptRevision['status'] | null
  >(latestDraft?.status ?? null);
  // What the server last accepted, so the header can tell edited from saved.
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    snapshot(initialContent, latestDraft?.notes ?? ''),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [preview, setPreview] = useState<PromptPreviewResponse | null>(null);
  const [dryRun, setDryRun] = useState<PromptDryRunResponse | null>(null);
  const [tab, setTab] = useState<ConsoleTab>('compose');
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const dirty = snapshot(content, notes) !== savedSnapshot;
  const progress = useMemo(
    () => templateProgress(consoleData, content),
    [consoleData, content],
  );

  const selectRevision = (revision: PromptRevision) => {
    setContent(structuredClone(revision.content));
    setNotes(revision.notes ?? '');
    setRevisionId(revision.id);
    setRevisionNumber(revision.revisionNumber);
    setRevisionStatus(revision.status);
    setSavedSnapshot(snapshot(revision.content, revision.notes ?? ''));
    setPreview(null);
    setDryRun(null);
    setMessage(null);
    setTab('compose');
  };

  const save = () => {
    startTransition(async () => {
      const editableId = revisionStatus === 'draft' ? revisionId : null;
      const result = await savePromptDraftAction(
        locale,
        editableId,
        content,
        notes,
      );
      setMessage(result.message);
      setError(result.status === 'error');
      if (result.revision) {
        setRevisionId(result.revision.id);
        setRevisionNumber(result.revision.revisionNumber);
        setRevisionStatus(result.revision.status);
        setSavedSnapshot(snapshot(content, notes));
        router.refresh();
      }
    });
  };

  const assemblePreview = () => {
    if (!revisionId) return;
    startTransition(async () => {
      const result = await previewPromptRevisionAction(locale, revisionId);
      setMessage(result.message);
      setError(result.status === 'error');
      setPreview(result.preview ?? null);
      if (result.preview) setTab('preview');
    });
  };

  const runDryRun = () => {
    if (!revisionId) return;
    startTransition(async () => {
      const result = await dryRunPromptRevisionAction(locale, revisionId);
      setMessage(result.message);
      setError(result.status === 'error');
      setDryRun(result.dryRun ?? null);
      if (result.dryRun) setTab('dryRun');
    });
  };

  const activate = (id: string) => {
    startTransition(async () => {
      const result = await activatePromptRevisionAction(locale, id);
      setMessage(result.message);
      setError(result.status === 'error');
      if (result.status === 'success') {
        setRevisionId(null);
        setRevisionNumber(null);
        setRevisionStatus(null);
        setSavedSnapshot(snapshot(content, notes));
        setPreview(null);
        setDryRun(null);
        router.refresh();
      }
    });
  };

  const reset = () => {
    startTransition(async () => {
      const result = await resetPromptCapabilityAction(locale);
      setMessage(result.message);
      setError(result.status === 'error');
      if (result.status === 'success') {
        const next = structuredClone(consoleData.codeDefault);
        setRevisionId(null);
        setRevisionNumber(null);
        setRevisionStatus(null);
        setContent(next);
        setNotes('');
        setSavedSnapshot(snapshot(next, ''));
        setPreview(null);
        setDryRun(null);
        setTab('compose');
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-5">
      <StatusStrip
        active={consoleData.active}
        copy={copy}
        dirty={dirty}
        locale={locale}
        progress={progress}
        revisionNumber={revisionNumber}
        revisionStatus={revisionStatus}
      />

      <Tabs
        onValueChange={(value) => setTab(value as ConsoleTab)}
        value={tab}
      >
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="compose">
            <SlidersHorizontal />
            {copy.tabs.compose}
          </TabsTrigger>
          <TabsTrigger value="preview">
            <Eye />
            {copy.tabs.preview}
          </TabsTrigger>
          <TabsTrigger value="dryRun">
            <FlaskConical />
            {copy.tabs.dryRun}
          </TabsTrigger>
          <TabsTrigger value="history">
            <History />
            {copy.tabs.history}
          </TabsTrigger>
        </TabsList>

        <TabsContent className="space-y-4" value="compose">
          <StarBorder className="bg-card px-5 sm:px-6">
            <Accordion
              className="w-full"
              defaultValue={['base']}
              type="multiple"
            >
              <AccordionItem value="base">
                <AccordionTrigger>
                  <SectionHeading
                    description={copy.compose.baseDescription}
                    title={copy.compose.baseTitle}
                  />
                </AccordionTrigger>
                <AccordionContent className="space-y-5">
                  <EditorField
                    id="systemPersona"
                    label={copy.editor.persona}
                    maxLength={consoleData.blocks.systemPersona.maxLength}
                    onChange={(value) =>
                      setContent((current) => ({
                        ...current,
                        systemPersona: value,
                      }))
                    }
                    value={content.systemPersona}
                  />
                  <EditorField
                    id="policy"
                    label={copy.editor.policy}
                    maxLength={consoleData.blocks.policy.maxLength}
                    onChange={(value) =>
                      setContent((current) => ({ ...current, policy: value }))
                    }
                    rows={10}
                    value={content.policy}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="strategies">
                <AccordionTrigger>
                  <SectionHeading
                    badge={
                      <CountBadge
                        filled={progress.strategiesFilled}
                        label={copy.compose.strategiesFilled}
                        total={progress.strategiesTotal}
                      />
                    }
                    description={copy.editor.strategiesDescription}
                    title={copy.editor.strategies}
                  />
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-5 md:grid-cols-2">
                    {consoleData.blocks.goalStrategies.map((block) => (
                      <EditorField
                        id={`strategy-${block.objective}`}
                        key={block.objective}
                        label={block.label}
                        maxLength={block.maxLength}
                        onChange={(value) =>
                          setContent((current) => ({
                            ...current,
                            goalStrategies: {
                              ...current.goalStrategies,
                              [block.objective]: value,
                            },
                          }))
                        }
                        rows={4}
                        value={content.goalStrategies[block.objective]}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="anchors">
                <AccordionTrigger>
                  <SectionHeading
                    badge={
                      <CountBadge
                        filled={progress.anchorsFilled}
                        label={copy.compose.anchorsFilled}
                        total={progress.anchorsTotal}
                      />
                    }
                    description={copy.editor.anchorsDescription}
                    title={copy.editor.anchors}
                  />
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  {consoleData.blocks.sections.map((section) => (
                    <Accordion
                      className="rounded-xl border border-border/70 bg-muted/25 px-4"
                      key={section.id}
                      type="multiple"
                    >
                      <AccordionItem className="border-b-0" value={section.id}>
                        <AccordionTrigger className="text-sm">
                          <span className="flex flex-wrap items-center gap-2">
                            {section.label}
                            <CountBadge
                              filled={progress.sections[section.id]?.filled ?? 0}
                              label={copy.compose.anchorsFilled}
                              total={progress.sections[section.id]?.total ?? 0}
                            />
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-2">
                          {section.criteria.map((criterion) => {
                            const state = progress.criteria[criterion.id];
                            const complete =
                              state !== undefined && state.filled === state.total;

                            return (
                              <Accordion
                                className="rounded-lg border border-border/70 bg-background px-3"
                                key={criterion.id}
                                type="multiple"
                              >
                                <AccordionItem
                                  className="border-b-0"
                                  value={criterion.id}
                                >
                                  <AccordionTrigger className="text-sm">
                                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                                      <span className="font-medium">
                                        {criterion.label}
                                      </span>
                                      <span className="font-mono text-xs font-normal text-muted-foreground">
                                        {criterion.id}
                                      </span>
                                      <Badge
                                        className={cn(
                                          'gap-1 font-normal',
                                          complete &&
                                            'border-[var(--dashboard-accent)]/30 bg-[var(--dashboard-accent-soft)] text-[var(--dashboard-accent)]',
                                        )}
                                        variant={complete ? 'outline' : 'secondary'}
                                      >
                                        {complete ? (
                                          <Check className="size-3" strokeWidth={3} />
                                        ) : (
                                          <AlertTriangle className="size-3" />
                                        )}
                                        {complete
                                          ? copy.compose.complete
                                          : copy.compose.incomplete}
                                      </Badge>
                                    </span>
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <div className="grid gap-4 md:grid-cols-2">
                                      {criterion.anchors.map((anchor) => {
                                        const score = String(
                                          anchor.score,
                                        ) as PromptAnchorScore;

                                        return (
                                          <EditorField
                                            id={`${criterion.id}-${score}`}
                                            key={score}
                                            label={`${copy.editor.score} ${anchor.label}`}
                                            maxLength={anchor.maxLength}
                                            onChange={(value) =>
                                              setContent((current) => ({
                                                ...current,
                                                criterionAnchors: {
                                                  ...current.criterionAnchors,
                                                  [criterion.id]: {
                                                    ...current.criterionAnchors[
                                                      criterion.id
                                                    ],
                                                    [score]: value,
                                                  },
                                                },
                                              }))
                                            }
                                            rows={4}
                                            value={
                                              content.criterionAnchors[
                                                criterion.id
                                              ]?.[score] ?? ''
                                            }
                                          />
                                        );
                                      })}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              </Accordion>
                            );
                          })}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  ))}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="notes">
                <AccordionTrigger>
                  <SectionHeading
                    description={copy.compose.notesDescription}
                    title={copy.compose.notesTitle}
                  />
                </AccordionTrigger>
                <AccordionContent>
                  <EditorField
                    id="revisionNotes"
                    label={copy.editor.notes}
                    maxLength={2_000}
                    onChange={setNotes}
                    rows={3}
                    value={notes}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </StarBorder>
        </TabsContent>

        <TabsContent value="preview">
          {preview ? (
            <PromptComparison copy={copy} preview={preview} />
          ) : (
            <TabEmptyState
              description={copy.preview.empty}
              icon={Eye}
              title={copy.preview.title}
            />
          )}
        </TabsContent>

        <TabsContent value="dryRun">
          {dryRun ? (
            <DryRunComparison copy={copy} result={dryRun} />
          ) : (
            <TabEmptyState
              description={copy.dryRun.empty}
              icon={FlaskConical}
              title={copy.dryRun.title}
            />
          )}
        </TabsContent>

        <TabsContent value="history">
          <RevisionHistory
            activeId={consoleData.active?.id ?? null}
            copy={copy}
            locale={locale}
            onEdit={selectRevision}
            onRollback={activate}
            pending={pending}
            revisions={revisions}
          />
        </TabsContent>
      </Tabs>

      {message ? (
        <Alert variant={error ? 'destructive' : 'accent'}>
          {error ? <AlertTriangle /> : <CheckCircle2 />}
          <AlertDescription aria-live="polite">{message}</AlertDescription>
        </Alert>
      ) : null}

      {/* A first draft is worth saving even unedited; an existing one is not. */}
      <ActionBar
        canRevise={revisionId !== null}
        copy={copy}
        hasActive={consoleData.active !== null}
        onDryRun={runDryRun}
        onPreview={assemblePreview}
        onPublish={() => revisionId && activate(revisionId)}
        onReset={reset}
        onSave={save}
        pending={pending}
        publishable={revisionId !== null && revisionStatus === 'draft'}
        savable={dirty || revisionId === null}
      />
    </div>
  );
}

/**
 * What is live, what is being edited, and how much of the template is written.
 * Sits above the tabs so it stays true whichever tab is open.
 */
function StatusStrip({
  active,
  copy,
  dirty,
  locale,
  progress,
  revisionNumber,
  revisionStatus,
}: {
  active: PromptRevision | null;
  copy: Dictionary['promptConsole'];
  dirty: boolean;
  locale: Locale;
  progress: TemplateProgress;
  revisionNumber: number | null;
  revisionStatus: PromptRevision['status'] | null;
}) {
  return (
    <StarBorder as="section" className="bg-card">
      <div className="flex flex-col gap-3 border-b border-dashed p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-[-0.015em]">
              {copy.active.title}
            </h2>
            <Badge className="border-[var(--dashboard-accent)]/30 bg-[var(--dashboard-accent-soft)] text-[var(--dashboard-accent)]">
              {copy.editorState.liveLabel}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {active
              ? copy.active.revision.replace(
                  '{revision}',
                  String(active.revisionNumber),
                )
              : copy.active.codeDefault}
          </p>
        </div>
        <Badge
          className="w-fit gap-1.5 px-2.5 py-1"
          variant={dirty ? 'secondary' : 'outline'}
        >
          {dirty ? (
            <AlertTriangle className="size-3.5" />
          ) : (
            <Check className="size-3.5" strokeWidth={3} />
          )}
          {dirty
            ? copy.editorState.unsaved
            : revisionNumber !== null && revisionStatus === 'draft'
              ? copy.editorState.editingDraft.replace(
                  '{revision}',
                  String(revisionNumber),
                )
              : revisionNumber === null
                ? copy.editorState.newDraft
                : copy.editorState.saved}
        </Badge>
      </div>

      <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.2fr)]">
        <Summary label={copy.active.author}>
          {active?.createdByUserId ?? copy.active.codeOwned}
        </Summary>
        <Summary label={copy.active.activated}>
          {formatDate(active?.activatedAt, locale) ?? '—'}
        </Summary>
        <Summary label={copy.active.notes}>
          {active?.notes ?? copy.active.noNotes}
        </Summary>
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {copy.editor.anchors}
            </p>
            <p className="text-sm font-semibold tabular-nums">
              {progress.anchorsFilled}/{progress.anchorsTotal}
            </p>
          </div>
          <Progress
            className="h-2 bg-[var(--dashboard-accent-soft)] [&>[data-slot=progress-indicator]]:bg-[var(--dashboard-accent)]"
            value={
              progress.anchorsTotal === 0
                ? 0
                : Math.round(
                    (progress.anchorsFilled / progress.anchorsTotal) * 100,
                  )
            }
          />
        </div>
      </div>
    </StarBorder>
  );
}

/**
 * Sticky, because the compose tab is long and every one of these buttons is a
 * step in the same save → preview → dry-run → publish loop.
 */
function ActionBar({
  canRevise,
  copy,
  hasActive,
  onDryRun,
  onPreview,
  onPublish,
  onReset,
  onSave,
  pending,
  publishable,
  savable,
}: {
  canRevise: boolean;
  copy: Dictionary['promptConsole'];
  hasActive: boolean;
  onDryRun: () => void;
  onPreview: () => void;
  onPublish: () => void;
  onReset: () => void;
  onSave: () => void;
  pending: boolean;
  publishable: boolean;
  savable: boolean;
}) {
  return (
    <StarBorder className="sticky bottom-0 flex flex-col gap-2 bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={pending || !savable} onClick={onSave} type="button">
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          {copy.actions.saveDraft}
        </Button>
        <Button
          disabled={pending || !canRevise}
          onClick={onPreview}
          type="button"
          variant="outline"
        >
          <Eye /> {copy.actions.preview}
        </Button>
        <Button
          disabled={pending || !canRevise}
          onClick={onDryRun}
          type="button"
          variant="outline"
        >
          <FlaskConical /> {copy.actions.dryRun}
        </Button>

        <span aria-hidden="true" className="mx-1 h-6 w-px bg-border" />

        <ConfirmButton
          confirmCopy={copy.confirmPublish}
          disabled={pending || !publishable}
          icon={Send}
          label={copy.actions.publish}
          onConfirm={onPublish}
          variant="secondary"
        />
        <ConfirmButton
          confirmCopy={copy.confirmReset}
          destructive
          disabled={pending || !hasActive}
          icon={RotateCcw}
          label={copy.actions.reset}
          onConfirm={onReset}
          variant="ghost"
        />
      </div>
      {!canRevise ? (
        <p className="text-xs text-muted-foreground">
          {copy.actions.saveBeforePreview}
        </p>
      ) : null}
    </StarBorder>
  );
}

function ConfirmButton({
  confirmCopy,
  destructive = false,
  disabled,
  icon: Icon,
  label,
  onConfirm,
  variant,
}: {
  confirmCopy: { action: string; cancel: string; description: string; title: string };
  destructive?: boolean;
  disabled: boolean;
  icon: typeof Send;
  label: string;
  onConfirm: () => void;
  variant: 'secondary' | 'ghost';
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          className={destructive ? 'text-destructive hover:text-destructive' : undefined}
          disabled={disabled}
          type="button"
          variant={variant}
        >
          <Icon /> {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmCopy.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirmCopy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{confirmCopy.cancel}</AlertDialogCancel>
          <AlertDialogAction
            className={
              destructive
                ? 'bg-destructive text-white hover:bg-destructive/90'
                : undefined
            }
            onClick={onConfirm}
          >
            {confirmCopy.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RevisionHistory({
  activeId,
  copy,
  locale,
  onEdit,
  onRollback,
  pending,
  revisions,
}: {
  activeId: string | null;
  copy: Dictionary['promptConsole'];
  locale: Locale;
  onEdit: (revision: PromptRevision) => void;
  onRollback: (id: string) => void;
  pending: boolean;
  revisions: PromptRevision[];
}) {
  return (
    <StarBorder as="section" className="bg-card p-5 sm:p-6">
      <div className="mb-4 space-y-1">
        <h2 className="text-base font-semibold tracking-[-0.015em]">
          {copy.history.title}
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {copy.history.description}
        </p>
      </div>

      {revisions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.history.empty}</p>
      ) : (
        <ol className="space-y-2">
          {revisions.map((revision) => (
            <StarBorder
              as="li"
              className={cn(
                'flex flex-wrap items-center justify-between gap-3 px-4 py-3',
                revision.id === activeId
                  ? 'border-[var(--dashboard-accent)]/30 bg-[var(--dashboard-accent-soft)]'
                  : undefined,
              )}
              key={revision.id}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-medium tabular-nums">
                    r{revision.revisionNumber}
                  </span>
                  <Badge
                    className="font-normal"
                    variant={
                      revision.status === 'active' ? 'default' : 'outline'
                    }
                  >
                    {revision.id === activeId
                      ? copy.history.live
                      : copy.status[revision.status]}
                  </Badge>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  {revision.notes ?? copy.active.noNotes} ·{' '}
                  {formatDate(revision.createdAt, locale)}
                </p>
              </div>
              {revision.status === 'draft' ? (
                <Button
                  disabled={pending}
                  onClick={() => onEdit(revision)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {copy.actions.editDraft}
                </Button>
              ) : revision.status === 'retired' ? (
                <Button
                  disabled={pending}
                  onClick={() => onRollback(revision.id)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RotateCcw /> {copy.actions.rollback}
                </Button>
              ) : null}
            </StarBorder>
          ))}
        </ol>
      )}
    </StarBorder>
  );
}

function TabEmptyState({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: typeof Eye;
  title: string;
}) {
  return (
    <StarBorder as="section" className="flex flex-col items-start gap-3 p-6 sm:p-8">
      <StarBorder
        aria-hidden="true"
        as="span"
        className="grid size-10 place-items-center bg-[var(--dashboard-accent-soft)] text-[var(--dashboard-accent)]"
      >
        <Icon className="size-5" strokeWidth={2} />
      </StarBorder>
      <h2 className="text-base font-semibold tracking-[-0.015em]">{title}</h2>
      <p className="max-w-prose text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </StarBorder>
  );
}

function SectionHeading({
  badge,
  description,
  title,
}: {
  badge?: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <span className="flex min-w-0 flex-col gap-1 text-left">
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold tracking-[-0.015em]">
          {title}
        </span>
        {badge}
      </span>
      <span className="text-sm font-normal leading-6 text-muted-foreground">
        {description}
      </span>
    </span>
  );
}

function CountBadge({
  filled,
  label,
  total,
}: {
  filled: number;
  label: string;
  total: number;
}) {
  const complete = total > 0 && filled === total;

  return (
    <Badge
      className={cn(
        'font-normal tabular-nums',
        complete &&
          'border-[var(--dashboard-accent)]/30 bg-[var(--dashboard-accent-soft)] text-[var(--dashboard-accent)]',
      )}
      variant={complete ? 'outline' : 'secondary'}
    >
      {label
        .replace('{filled}', String(filled))
        .replace('{total}', String(total))}
    </Badge>
  );
}

function EditorField({
  id,
  label,
  maxLength,
  onChange,
  rows = 5,
  value,
}: {
  id: string;
  label: string;
  maxLength: number;
  onChange: (value: string) => void;
  rows?: number;
  value: string;
}) {
  const nearLimit = value.length > maxLength * 0.9;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <span
          className={cn(
            'text-xs tabular-nums',
            nearLimit ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
          )}
        >
          {value.length} / {maxLength}
        </span>
      </div>
      <Textarea
        id={id}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        required
        rows={rows}
        value={value}
      />
    </div>
  );
}

function Summary({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-words text-sm">{children}</p>
    </div>
  );
}

function PromptComparison({
  copy,
  preview,
}: {
  copy: Dictionary['promptConsole'];
  preview: PromptPreviewResponse;
}) {
  return (
    <StarBorder as="section" className="bg-card p-5 sm:p-6">
      <div className="mb-4 space-y-1">
        <h2 className="text-base font-semibold tracking-[-0.015em]">
          {copy.preview.title}
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {copy.preview.description}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <PromptText label={copy.preview.baseline} value={preview.baseline} />
        <PromptText label={copy.preview.candidate} value={preview.candidate} />
      </div>
    </StarBorder>
  );
}

function PromptText({
  label,
  value,
}: {
  label: string;
  value: PromptPreviewResponse['candidate'];
}) {
  const text = `SYSTEM\n${value.system}\n\n${value.prompt}`;

  return (
    <section className="min-w-0 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">
          {label}{' '}
          <span className="font-mono font-normal text-muted-foreground">
            {value.promptVersion}
          </span>
        </h3>
        <Button
          onClick={() => void navigator.clipboard?.writeText(text)}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Copy />
        </Button>
      </div>
      <pre className="max-h-[36rem] overflow-auto whitespace-pre-wrap rounded-xl border border-border/70 bg-muted/50 p-4 text-xs leading-relaxed">
        {text}
      </pre>
    </section>
  );
}

function DryRunComparison({
  copy,
  result,
}: {
  copy: Dictionary['promptConsole'];
  result: PromptDryRunResponse;
}) {
  const baselineScores = new Map(
    result.baseline.sectionScores.map((section) => [section.id, section.score]),
  );
  const delta = result.candidate.winningScore - result.baseline.winningScore;

  return (
    <StarBorder as="section" className="space-y-5 bg-card p-5 sm:p-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-[-0.015em]">
          {copy.dryRun.title}
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {copy.dryRun.description}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ScoreCard
          label={copy.preview.baseline}
          score={result.baseline.winningScore}
        />
        <ScoreCard
          delta={delta}
          featured
          label={copy.preview.candidate}
          score={result.candidate.winningScore}
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {copy.dryRun.sectionScores}
        </p>
        <div className="grid gap-2 md:grid-cols-2">
          {result.candidate.sectionScores.map((section) => {
            const sectionDelta =
              section.score - (baselineScores.get(section.id) ?? 0);

            return (
              <StarBorder
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                key={section.id}
              >
                <span className="min-w-0 truncate">{section.id}</span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className="font-mono font-medium tabular-nums">
                    {section.score}
                  </span>
                  <DeltaBadge delta={sectionDelta} />
                </span>
              </StarBorder>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PromptText label={copy.preview.baseline} value={result.baseline.prompt} />
        <PromptText label={copy.preview.candidate} value={result.candidate.prompt} />
      </div>
    </StarBorder>
  );
}

function ScoreCard({
  delta,
  featured = false,
  label,
  score,
}: {
  delta?: number;
  featured?: boolean;
  label: string;
  score: number;
}) {
  return (
    <StarBorder
      as="article"
      className={cn(
        'p-5',
        featured
          ? 'border-[var(--dashboard-accent)]/30 bg-[var(--dashboard-accent-soft)]'
          : undefined,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        {delta === undefined ? null : <DeltaBadge delta={delta} />}
      </div>
      <p className="mt-2 text-4xl font-semibold tracking-[-0.035em] tabular-nums">
        {score}
        <span className="text-base font-normal text-muted-foreground">/100</span>
      </p>
    </StarBorder>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  return (
    <Badge
      className="font-mono font-normal tabular-nums"
      variant={delta === 0 ? 'outline' : delta > 0 ? 'secondary' : 'destructive'}
    >
      {formatDelta(delta)}
    </Badge>
  );
}

interface TemplateProgress {
  anchorsFilled: number;
  anchorsTotal: number;
  criteria: Record<string, { filled: number; total: number }>;
  sections: Record<string, { filled: number; total: number }>;
  strategiesFilled: number;
  strategiesTotal: number;
}

/**
 * How much of the template actually has text in it. The console can otherwise
 * only tell you a criterion is short an anchor by making you open it.
 */
function templateProgress(
  consoleData: PromptConsoleResponse,
  content: AnalyzerTemplateContent,
): TemplateProgress {
  const criteria: TemplateProgress['criteria'] = {};
  const sections: TemplateProgress['sections'] = {};
  let anchorsFilled = 0;
  let anchorsTotal = 0;

  for (const section of consoleData.blocks.sections) {
    let sectionFilled = 0;
    let sectionTotal = 0;

    for (const criterion of section.criteria) {
      const written = criterion.anchors.filter((anchor) =>
        (content.criterionAnchors[criterion.id]?.[
          String(anchor.score) as PromptAnchorScore
        ] ?? '').trim(),
      ).length;

      criteria[criterion.id] = { filled: written, total: criterion.anchors.length };
      sectionFilled += written;
      sectionTotal += criterion.anchors.length;
    }

    sections[section.id] = { filled: sectionFilled, total: sectionTotal };
    anchorsFilled += sectionFilled;
    anchorsTotal += sectionTotal;
  }

  return {
    anchorsFilled,
    anchorsTotal,
    criteria,
    sections,
    strategiesFilled: consoleData.blocks.goalStrategies.filter((block) =>
      (content.goalStrategies[block.objective] ?? '').trim(),
    ).length,
    strategiesTotal: consoleData.blocks.goalStrategies.length,
  };
}

function snapshot(content: AnalyzerTemplateContent, notes: string): string {
  return JSON.stringify({ content, notes });
}

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

function formatDate(value: string | null | undefined, locale: Locale) {
  if (!value) return null;
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}
