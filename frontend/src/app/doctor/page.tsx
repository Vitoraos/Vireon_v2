/**
 * Doctor dashboard page.
 * Wraps the DoctorDashboard in a client-safe boundary for search params.
 */

'use client';

import { Suspense } from 'react';
import { DoctorDashboard } from '@/components/doctor/DoctorDashboard';

function DoctorDashboardFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        <p className="text-sm text-ink-secondary">Loading dashboard...</p>
      </div>
    </div>
  );
}

export default function DoctorPage() {
  return (
    <Suspense fallback={<DoctorDashboardFallback />}>
      <DoctorDashboard />
    </Suspense>
  );
}
