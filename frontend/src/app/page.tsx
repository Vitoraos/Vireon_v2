/**
 * Landing page.
 * Clean entry point with two clear paths: patient intake or doctor dashboard.
 * No clutter, no marketing fluff.
 */

import Link from 'next/link';
import { DisclaimerBanner } from '@/components/shared/DisclaimerBanner';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-10 text-center">
          {/* Logo mark */}
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-soft bg-accent flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="font-display text-3xl font-extrabold text-ink-primary tracking-tight">
              Clinical Intake
            </h1>
            <p className="text-sm text-ink-secondary leading-relaxed">
              Speak naturally. Get reviewed by a doctor. Receive care instructions.
            </p>
          </div>

          <div className="space-y-3">
            <Link
              href="/intake"
              className="block w-full py-3.5 bg-accent text-white rounded-soft font-semibold text-sm
                         hover:bg-accent-deep transition-colors duration-150
                         focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              Start Consultation
            </Link>

            <Link
              href="/doctor"
              className="block w-full py-3.5 bg-surface border-hairline text-ink-primary rounded-soft
                         font-medium text-sm hover:bg-canvas transition-colors duration-150
                         focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              Doctor Dashboard
            </Link>
          </div>
        </div>
      </main>

      <DisclaimerBanner />
    </div>
  );
}
