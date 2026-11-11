import React, { useEffect, useMemo, useState } from 'react';
import type { Conflict } from '../../types';

type FieldChoice = 'local' | 'remote' | 'base' | 'custom';

interface ConflictComparisonProps {
  conflict: Conflict;
  onChange: (value: Record<string, unknown>) => void;
}

const RESERVED_FIELDS = new Set(['id', 'createdAt', 'updatedAt', 'version', 'syncStatus']);

export const ConflictComparison: React.FC<ConflictComparisonProps> = ({ conflict, onChange }) => {
  const fields = useMemo(() => Array.from(new Set([
    ...Object.keys(conflict.baseState ?? {}),
    ...Object.keys(conflict.localState),
    ...Object.keys(conflict.remoteState),
  ])).filter((field) => !RESERVED_FIELDS.has(field)).sort(), [conflict]);
  const [choices, setChoices] = useState<Record<string, FieldChoice>>({});
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const nextChoices = Object.fromEntries(fields.map((field) => [field, 'remote'])) as Record<string, FieldChoice>;
    const nextCustom = Object.fromEntries(fields.map((field) => [field, JSON.stringify(conflict.remoteState[field] ?? null, null, 2)]));
    setChoices(nextChoices);
    setCustomValues(nextCustom);
    onChange({ ...conflict.remoteState });
  }, [conflict.id, fields.join('|')]);

  const update = (field: string, choice: FieldChoice, custom = customValues[field]) => {
    const nextChoices = { ...choices, [field]: choice };
    setChoices(nextChoices);
    const result: Record<string, unknown> = {};
    for (const key of fields) {
      const selected = nextChoices[key] ?? 'remote';
      if (selected === 'local') result[key] = conflict.localState[key];
      else if (selected === 'base') result[key] = conflict.baseState?.[key];
      else if (selected === 'custom') {
        try { result[key] = JSON.parse(key === field ? custom : customValues[key]); }
        catch { result[key] = key === field ? custom : customValues[key]; }
      } else result[key] = conflict.remoteState[key];
    }
    onChange(result);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600 dark:text-slate-300">Choose a value for each field. Custom values use JSON syntax.</p>
      <div className="max-h-[48vh] space-y-3 overflow-y-auto pr-1">
        {fields.map((field) => (
          <section key={field} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <h4 className="mb-2 text-sm font-semibold">{field}</h4>
            <div className="grid gap-2 text-xs md:grid-cols-3">
              <Value label="Base" value={conflict.baseState?.[field]} />
              <Value label="Local" value={conflict.localState[field]} />
              <Value label="Remote" value={conflict.remoteState[field]} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="text-xs font-medium" htmlFor={`conflict-choice-${field}`}>Use</label>
              <select
                id={`conflict-choice-${field}`}
                value={choices[field] ?? 'remote'}
                onChange={(event) => update(field, event.target.value as FieldChoice)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="local">Local</option>
                <option value="remote">Remote</option>
                <option value="base" disabled={conflict.baseState?.[field] === undefined}>Base</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            {choices[field] === 'custom' && (
              <textarea
                aria-label={`Custom ${field} value`}
                value={customValues[field] ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  setCustomValues((current) => ({ ...current, [field]: value }));
                  update(field, 'custom', value);
                }}
                rows={3}
                className="mt-2 w-full rounded border border-slate-300 bg-white p-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            )}
          </section>
        ))}
      </div>
    </div>
  );
};

const Value: React.FC<{ label: string; value: unknown }> = ({ label, value }) => (
  <div className="min-w-0 rounded bg-slate-50 p-2 dark:bg-slate-950">
    <div className="mb-1 font-semibold text-slate-500">{label}</div>
    <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(value ?? null, null, 2)}</pre>
  </div>
);
