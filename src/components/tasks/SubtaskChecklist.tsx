import React, { useEffect, useRef, useState } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import type { Subtask } from '../../types';

interface SubtaskChecklistProps {
  subtasks: Subtask[];
  onToggle: (subtaskId: string) => void;
  onRemove: (subtaskId: string) => void;
  onReorder: (subtasks: Subtask[]) => void | Promise<void>;
  compact?: boolean;
}

interface ActiveDrag {
  subtaskId: string;
  pointerId: number;
  initialOrder: string[];
}

const sameOrder = (first: string[], second: string[]) =>
  first.length === second.length && first.every((id, index) => id === second[index]);

const moveSubtask = (
  order: string[],
  subtaskId: string,
  targetId: string,
  insertAfter: boolean
): string[] => {
  const sourceIndex = order.indexOf(subtaskId);
  const targetIndex = order.indexOf(targetId);
  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return order;

  const next = [...order];
  next.splice(sourceIndex, 1);
  const insertionIndex = targetIndex + Number(insertAfter) - Number(sourceIndex < targetIndex);
  next.splice(insertionIndex, 0, subtaskId);
  return next;
};

export const SubtaskChecklist: React.FC<SubtaskChecklistProps> = ({
  subtasks,
  onToggle,
  onRemove,
  onReorder,
  compact = false,
}) => {
  const [orderedIds, setOrderedIds] = useState(() => subtasks.map((subtask) => subtask.id));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const orderedIdsRef = useRef(orderedIds);
  const currentSubtasksRef = useRef(subtasks);
  const previousPropOrderRef = useRef(subtasks.map((subtask) => subtask.id));
  const activeDragRef = useRef<ActiveDrag | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const onReorderRef = useRef(onReorder);

  const setOrder = (order: string[]) => {
    orderedIdsRef.current = order;
    setOrderedIds(order);
  };

  useEffect(() => {
    currentSubtasksRef.current = subtasks;
  }, [subtasks]);

  useEffect(() => {
    onReorderRef.current = onReorder;
  }, [onReorder]);

  useEffect(() => {
    const propOrder = subtasks.map((subtask) => subtask.id);
    if (!activeDragRef.current && !sameOrder(previousPropOrderRef.current, propOrder)) {
      previousPropOrderRef.current = propOrder;
      setOrder(propOrder);
    }
  }, [subtasks, draggingId]);

  const persistOrder = async (reordered: Subtask[]) => {
    try {
      await onReorderRef.current(reordered);
    } catch (error) {
      setOrder(currentSubtasksRef.current.map((subtask) => subtask.id));
      console.error('Failed to save subtask order:', error);
    }
  };

  useEffect(() => {
    if (!draggingId) return;
    const activeDrag = activeDragRef.current;
    if (!activeDrag) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== activeDrag.pointerId) return;
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>('[data-subtask-id]');
      if (!target || !listRef.current?.contains(target)) return;

      const targetId = target.dataset.subtaskId;
      if (!targetId) return;
      const rect = target.getBoundingClientRect();
      const nextOrder = moveSubtask(
        orderedIdsRef.current,
        activeDrag.subtaskId,
        targetId,
        event.clientY > rect.top + rect.height / 2
      );
      if (nextOrder !== orderedIdsRef.current) setOrder(nextOrder);
    };

    const finishDrag = (event: PointerEvent, cancelled: boolean) => {
      if (event.pointerId !== activeDrag.pointerId) return;
      activeDragRef.current = null;
      setDraggingId(null);
      if (cancelled) {
        setOrder(activeDrag.initialOrder);
        return;
      }

      const nextOrder = orderedIdsRef.current;
      if (sameOrder(activeDrag.initialOrder, nextOrder)) return;
      const subtasksById = new Map<string, Subtask>(
        currentSubtasksRef.current.map((subtask) => [subtask.id, subtask] as const)
      );
      const reordered = nextOrder
        .map((id) => subtasksById.get(id))
        .filter((subtask): subtask is Subtask => subtask !== undefined);
      void persistOrder(reordered);
    };

    const handlePointerUp = (event: PointerEvent) => finishDrag(event, false);
    const handlePointerCancel = (event: PointerEvent) => finishDrag(event, true);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [draggingId]);

  const subtaskById = new Map(subtasks.map((subtask) => [subtask.id, subtask]));
  const orderedSubtasks = orderedIds
    .map((id) => subtaskById.get(id))
    .filter((subtask): subtask is Subtask => subtask !== undefined);

  const beginDrag = (event: React.PointerEvent<HTMLButtonElement>, subtaskId: string) => {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    const order = subtasks.map((subtask) => subtask.id);
    activeDragRef.current = { subtaskId, pointerId: event.pointerId, initialOrder: order };
    setOrder(order);
    setDraggingId(subtaskId);
  };

  const moveWithKeyboard = (subtaskId: string, direction: -1 | 1) => {
    const order = orderedIdsRef.current;
    const index = order.indexOf(subtaskId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return;
    const nextOrder = [...order];
    [nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]];
    setOrder(nextOrder);
    const subtasksById = new Map<string, Subtask>(
      subtasks.map((subtask) => [subtask.id, subtask] as const)
    );
    const reordered = nextOrder
      .map((id) => subtasksById.get(id))
      .filter((subtask): subtask is Subtask => subtask !== undefined);
    void persistOrder(reordered);
  };

  return (
    <div
      ref={listRef}
      role="list"
      className={compact ? 'space-y-1.5 max-h-36 overflow-y-auto' : 'space-y-2'}
    >
      {orderedSubtasks.map((subtask) => (
        <div
          key={subtask.id}
          data-subtask-id={subtask.id}
          role="listitem"
          className={`flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 text-xs transition-opacity dark:border-slate-800 dark:bg-slate-950/50 ${
            compact ? 'p-2' : 'p-3'
          } ${draggingId === subtask.id ? 'pointer-events-none opacity-50' : ''}`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <button
              type="button"
              aria-label={`Reorder ${subtask.title}`}
              aria-keyshortcuts="ArrowUp ArrowDown"
              title="Drag to reorder; use arrow keys to move"
              onPointerDown={(event) => beginDrag(event, subtask.id)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  moveWithKeyboard(subtask.id, -1);
                } else if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  moveWithKeyboard(subtask.id, 1);
                }
              }}
              className="touch-none cursor-grab rounded p-1 text-slate-400 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:cursor-grabbing dark:hover:text-indigo-400"
            >
              <GripVertical className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
            </button>
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={subtask.isCompleted}
                onChange={() => onToggle(subtask.id)}
                className={`rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 ${
                  compact ? 'h-3.5 w-3.5' : 'h-4 w-4'
                }`}
              />
              <span
                className={`${
                  compact ? 'truncate' : ''
                } ${
                  subtask.isCompleted
                    ? 'line-through text-slate-400 dark:text-slate-500'
                    : 'text-slate-800 dark:text-slate-200'
                }`}
              >
                {subtask.title}
              </span>
            </label>
          </div>
          <button
            type="button"
            onClick={() => onRemove(subtask.id)}
            aria-label={`Remove ${subtask.title}`}
            title="Remove subtask"
            className="p-1 text-slate-400 hover:text-red-500"
          >
            <Trash2 className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          </button>
        </div>
      ))}
    </div>
  );
};
