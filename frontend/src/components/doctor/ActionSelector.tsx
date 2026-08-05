/**
 * Doctor action selector.
 * Three clear options with distinct visual treatments.
 * No ambiguous icons — text + color coding.
 */

import { DoctorAction } from '@/types';
import { DOCTOR_ACTION_LABELS } from '@/lib/constants';

interface ActionSelectorProps {
  selected: DoctorAction | null;
  onSelect: (action: DoctorAction) => void;
  disabled?: boolean;
}

const ACTIONS: { value: DoctorAction; color: string; ring: string }[] = [
  {
    value: 'prescribe',
    color: 'hover:bg-signal-success/5 hover:border-signal-success/30',
    ring: 'ring-signal-success/30',
  },
  {
    value: 'request_appointment',
    color: 'hover:bg-accent-soft/30 hover:border-accent/30',
    ring: 'ring-accent/30',
  },
  {
    value: 'recommend_emergency',
    color: 'hover:bg-signal-critical/5 hover:border-signal-critical/30',
    ring: 'ring-signal-critical/30',
  },
];

export function ActionSelector({ selected, onSelect, disabled }: ActionSelectorProps) {
  return (
    <div className="space-y-3">
      <span className="text-[10px] uppercase tracking-widest text-ink-tertiary font-medium">
        Select action
      </span>

      <div className="space-y-2">
        {ACTIONS.map((action) => {
          const isSelected = selected === action.value;
          return (
            <button
              key={action.value}
              onClick={() => onSelect(action.value)}
              disabled={disabled}
              className={`
                w-full p-4 rounded-soft border-hairline text-left
                transition-all duration-150
                ${action.color}
                ${isSelected ? `bg-surface ring-2 ${action.ring} border-transparent` : 'bg-surface'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                focus:outline-none
              `}
            >
              <div className="flex items-center gap-3">
                <div className={`
                  w-4 h-4 rounded-full border-2 flex items-center justify-center
                  ${isSelected ? 'border-accent' : 'border-ink-tertiary/40'}
                `}>
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-accent" />
                  )}
                </div>
                <span className={`text-sm font-medium ${isSelected ? 'text-ink-primary' : 'text-ink-secondary'}`}>
                  {DOCTOR_ACTION_LABELS[action.value]}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
