/**
 * Persistent disclaimer banner.
 * Appears on every screen — patient and doctor.
 * Required by coding rules.
 */

import { UI_COPY } from '@/lib/constants';

export function DisclaimerBanner() {
  return (
    <div className="w-full bg-signal-warning/10 border-t border-signal-warning/20 py-2 px-4 text-center">
      <p className="text-xs font-body text-ink-secondary">
        {UI_COPY.disclaimer}
      </p>
    </div>
  );
}
