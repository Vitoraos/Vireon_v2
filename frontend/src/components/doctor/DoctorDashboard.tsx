/**
 * Doctor dashboard container.
 * Fetches report, displays structured data, accepts action + note.
 * Dense, scannable, authoritative.
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Report, DoctorAction } from '@/types';
import { getReport, getLatestReport, submitDoctorResponse } from '@/lib/api';
import { ReportViewer } from './ReportViewer';
import { ActionSelector } from './ActionSelector';
import { NoteInput } from './NoteInput';
import { ErrorFallback } from '@/components/shared/ErrorFallback';
import { DisclaimerBanner } from '@/components/shared/DisclaimerBanner';

export function DoctorDashboard() {
  const searchParams = useSearchParams();
  const reportId = searchParams.get('report_id');

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAction, setSelectedAction] = useState<DoctorAction | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = reportId
        ? await getReport(reportId)
        : await getLatestReport();
      setReport(data);
    } catch (err) {
      console.error('Failed to fetch report:', err);
      setError('Could not load a report. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleSubmit = useCallback(async () => {
    if (!report?.report_id || !selectedAction) return;

    try {
      setSubmitting(true);
      await submitDoctorResponse({
        report_id: report.report_id,
        action: selectedAction,
        note: note.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Failed to submit response:', err);
      setError('Failed to send response. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [report, selectedAction, note]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          <p className="text-sm text-ink-secondary">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas px-6">
        <ErrorFallback
          message={error}
          onRetry={fetchReport}
        />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col bg-canvas">
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="w-16 h-16 rounded-full bg-signal-success/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-signal-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="space-y-2">
              <h2 className="font-display text-xl font-bold text-ink-primary">Response sent</h2>
              <p className="text-sm text-ink-secondary">The patient will be notified of your decision.</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-accent text-white rounded-soft font-medium text-sm hover:bg-accent-deep transition-colors"
            >
              Review another case
            </button>
          </div>
        </main>
        <DisclaimerBanner />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold text-ink-primary">Clinical Report</h1>
          <p className="text-sm text-ink-secondary">Review the intake and select an action.</p>
        </div>

        {/* Report */}
        {report && <ReportViewer report={report} />}

        {/* Action form */}
        <div className="bg-surface rounded-soft border-hairline p-6 space-y-6">
          <ActionSelector
            selected={selectedAction}
            onSelect={setSelectedAction}
            disabled={submitting}
          />

          <NoteInput
            value={note}
            onChange={setNote}
            disabled={submitting}
          />

          <button
            onClick={handleSubmit}
            disabled={!selectedAction || submitting}
            className={`
              w-full py-3 rounded-soft font-medium text-sm text-white
              transition-all duration-150
              ${selectedAction && !submitting
                ? 'bg-accent hover:bg-accent-deep cursor-pointer'
                : 'bg-ink-tertiary/30 cursor-not-allowed'
              }
              focus:outline-none focus:ring-2 focus:ring-accent/30
            `}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sending...
              </span>
            ) : (
              'Send response to patient'
            )}
          </button>
        </div>
      </main>

      <DisclaimerBanner />
    </div>
  );
}
