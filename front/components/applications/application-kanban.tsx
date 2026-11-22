'use client';

import { useRef, useState, useTransition } from 'react';
import {
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  KanbanProvider,
} from '@/components/ui/kanban';
import { ApplicationCardContent } from '@/components/applications/application-card-content';
import type { ProposalOutcomeStatus } from '@/lib/api';
import { BOARD_LANES } from '@/lib/application-flow';
import {
  countByColumn,
  pendingMoves,
  type ApplicationCard as CardData,
  type ApplicationColumn,
} from '@/lib/application-kanban-data';
import type { Dictionary } from '@/i18n/types';
import type { FormActionState } from '@/lib/form-action-state';

const LANE_ACCENTS: Record<ProposalOutcomeStatus, string> = {
  'in-progress': 'bg-muted-foreground/40',
  sent: 'bg-sky-500/70',
  viewed: 'bg-indigo-500/70',
  messaged: 'bg-violet-500/70',
  interviewing: 'bg-amber-500/80',
  hired: 'bg-[var(--dashboard-accent)]',
  declined: 'bg-destructive/60',
  'no-response': 'bg-border',
};

export type MoveApplication = (
  jobAnalysisId: string,
  formData: FormData,
) => Promise<FormActionState>;

export function ApplicationKanban({
  copy,
  initialCards,
  locale,
  moveApplication,
  statusLabels,
  truncatedLanes,
}: {
  copy: Dictionary['applications'];
  initialCards: CardData[];
  locale: string;
  moveApplication: MoveApplication;
  statusLabels: Dictionary['dashboard']['outcomeStatuses'];
  /** Lanes whose server page was capped, so the count shown is a floor. */
  truncatedLanes: readonly ProposalOutcomeStatus[];
}) {
  const [cards, setCards] = useState<CardData[]>(initialCards);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Mirrors state so the drag-end handler reads the settled board rather than
  // a stale closure, and records what the server has actually confirmed.
  const cardsRef = useRef<CardData[]>(initialCards);
  const persisted = useRef(
    new Map(initialCards.map((card) => [card.id, card.column])),
  );

  const columns: ApplicationColumn[] = BOARD_LANES.map((status) => ({
    id: status,
    name: statusLabels[status],
  }));

  function applyCards(next: CardData[]) {
    cardsRef.current = next;
    setCards(next);
  }

  function revert(id: string, to: ProposalOutcomeStatus) {
    persisted.current.set(id, to);
    applyCards(
      cardsRef.current.map((card) =>
        card.id === id ? { ...card, column: to } : card,
      ),
    );
  }

  function handleDragEnd() {
    const moves = pendingMoves(cardsRef.current, persisted.current);
    if (moves.length === 0) return;
    setError(null);

    for (const move of moves) {
      // Optimistic: the card already sits in its new lane. Record it as
      // confirmed so a second drag is measured against this one, and undo only
      // if the server refuses.
      persisted.current.set(move.id, move.to);

      startTransition(async () => {
        const formData = new FormData();
        formData.set('status', move.to);
        const result = await moveApplication(move.jobAnalysisId, formData);
        if (result.status === 'error') {
          revert(move.id, move.from);
          setError(result.message ?? copy.messages.genericError);
        }
      });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">{copy.board.dragHint}</p>

      <KanbanProvider<CardData, ApplicationColumn>
        columns={columns}
        data={cards}
        onDataChange={applyCards}
        onDragEnd={handleDragEnd}
      >
        {(column) => (
          <KanbanBoard
            className="w-72 shrink-0 bg-muted/40"
            id={column.id}
            key={column.id}
          >
            <KanbanHeader className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`size-2 shrink-0 rounded-full ${LANE_ACCENTS[column.id]}`}
              />
              <span className="min-w-0 truncate">{column.name}</span>
              <span className="ml-auto shrink-0 rounded-full bg-background px-2 py-0.5 text-xs tabular-nums font-normal text-muted-foreground">
                {countByColumn(cards, column.id)}
                {truncatedLanes.includes(column.id) ? '+' : ''}
              </span>
            </KanbanHeader>
            <KanbanCards<CardData> className="min-h-24" id={column.id}>
              {(card) => (
                <KanbanCard
                  column={card.column}
                  id={card.id}
                  key={card.id}
                  name={card.name}
                >
                  <ApplicationCardContent
                    card={card}
                    copy={copy.board}
                    locale={locale}
                  />
                </KanbanCard>
              )}
            </KanbanCards>
          </KanbanBoard>
        )}
      </KanbanProvider>
    </div>
  );
}
