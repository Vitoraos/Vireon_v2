/**
 * Patient intake page.
 * Wraps the InterviewStage in a client-safe boundary.
 */

'use client';

import { InterviewStage } from '@/components/patient/InterviewStage';

export default function IntakePage() {
  return <InterviewStage />;
}
