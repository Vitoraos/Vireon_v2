import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#FAFBFC',
        surface: '#FFFFFF',
        'ink-primary': '#0A1628',
        'ink-secondary': '#5A6B7F',
        'ink-tertiary': '#9AA5B4',
        accent: '#2563EB',
        'accent-soft': '#DBEAFE',
        'accent-deep': '#1E40AF',
        'signal-success': '#059669',
        'signal-warning': '#D97706',
        'signal-critical': '#DC2626',
      },
      fontFamily: {
        display: ['Manrope', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        soft: '16px',
      },
      boxShadow: {
        ring: '0 0 0 4px rgba(37, 99, 235, 0.2)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #2563EB 0%, #1E40AF 50%, #0A1628 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'breathe': 'breathe 4s ease-in-out infinite',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.02)', opacity: '0.9' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
