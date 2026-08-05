/**
 * Catch-all for unknown routes.
 * Redirects to home instead of showing a dead-end 404.
 * Defensive: prevents user from getting stuck.
 */

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-canvas px-6">
      <div className="text-center space-y-6">
        <h2 className="font-display text-2xl font-bold text-ink-primary">
          Page not found
        </h2>
        <p className="text-sm text-ink-secondary">
          The page you are looking for does not exist.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-2.5 bg-accent text-white rounded-soft font-medium text-sm
                     hover:bg-accent-deep transition-colors duration-150"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
