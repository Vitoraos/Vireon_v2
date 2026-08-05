/**
 * Doctor's note input.
 * Clean, spacious textarea with character count.
 */

interface NoteInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const MAX_LENGTH = 500;

export function NoteInput({ value, onChange, disabled }: NoteInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-ink-tertiary font-medium">
          Note to patient
        </span>
        <span className={`text-[10px] font-mono-data ${value.length > MAX_LENGTH * 0.9 ? 'text-signal-warning' : 'text-ink-tertiary'}`}>
          {value.length}/{MAX_LENGTH}
        </span>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_LENGTH))}
        disabled={disabled}
        placeholder="Add instructions or context for the patient..."
        rows={4}
        className={`
          w-full p-4 rounded-soft bg-canvas border-hairline
          text-sm text-ink-primary placeholder:text-ink-tertiary/60
          resize-none focus:outline-none focus:ring-2 focus:ring-accent/20
          transition-all duration-150
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      />
    </div>
  );
}
