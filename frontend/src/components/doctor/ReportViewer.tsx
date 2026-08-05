/**
 * Structured report display for the doctor dashboard.
 * Folded card model: segments with left-border accents, scannable.
 * No long scrolling paragraphs.
 */

import { Report } from '@/types';
import { SLOT_LABELS } from '@/lib/constants';

interface ReportViewerProps {
  report: Report;
}

export function ReportViewer({ report }: ReportViewerProps) {
  const sections = [
    {
      label: 'Chief Complaint',
      value: report.chief_complaint,
      accent: 'border-accent',
      bg: 'bg-accent/5',
    },
    {
      label: SLOT_LABELS.duration,
      value: report.duration,
      accent: 'border-ink-secondary',
      bg: 'bg-slate-50',
    },
    {
      label: SLOT_LABELS.severity,
      value: report.severity_score !== null ? `${report.severity_score}/10` : null,
      accent: 'border-ink-secondary',
      bg: 'bg-slate-50',
    },
    {
      label: SLOT_LABELS.associated_symptoms,
      value: report.associated_symptoms,
      accent: 'border-ink-secondary',
      bg: 'bg-slate-50',
    },
    {
      label: SLOT_LABELS.relevant_history,
      value: report.relevant_history,
      accent: 'border-ink-secondary',
      bg: 'bg-slate-50',
    },
    {
      label: SLOT_LABELS.anything_else,
      value: report.anything_else,
      accent: 'border-ink-secondary',
      bg: 'bg-slate-50',
    },
  ];

  return (
    <div className="w-full space-y-3">
      {/* Red flag banner */}
      {report.red_flag_detected && (
        <div className="p-4 bg-signal-critical/10 border-l-4 border-signal-critical rounded-soft">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-signal-critical" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-semibold text-signal-critical">
              Red flag detected — emergency recommended
            </span>
          </div>
        </div>
      )}

      {/* Report sections */}
      {sections.map((section, i) => (
        <div
          key={section.label}
          className={`bg-surface rounded-soft border-hairline border-l-4 ${section.accent} p-4`}
          style={{ marginLeft: `${(i % 3) * 8}px` }} // Subtle stair-step offset
        >
          <span className="text-[10px] uppercase tracking-widest text-ink-tertiary font-medium">
            {section.label}
          </span>
          <p className={`text-sm font-medium mt-1 ${section.value ? 'text-ink-primary' : 'text-ink-tertiary italic'}`}>
            {section.value || 'Not provided'}
          </p>
        </div>
      ))}

      {/* Metadata footer */}
      <div className="flex items-center justify-between text-[10px] text-ink-tertiary font-mono-data px-1 pt-2">
        <span>Turns: {report.turns_used}</span>
        <span>Ref: {report.report_id.slice(0, 8)}</span>
      </div>

      {/* Full transcript — collapsible */}
      <details className="group">
        <summary className="text-xs text-ink-secondary cursor-pointer hover:text-ink-primary transition-colors py-2">
          View full transcript
        </summary>
        <div className="mt-2 p-3 bg-canvas rounded-soft text-xs text-ink-secondary leading-relaxed whitespace-pre-wrap font-mono-data">
          {report.full_transcript}
        </div>
      </details>
    </div>
  );
}
