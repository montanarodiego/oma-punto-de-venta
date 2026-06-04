import type { Config } from 'tailwindcss';

export default {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg:       'var(--bg)',
        surface:  { DEFAULT: 'var(--surface)', 2: 'var(--surface-2)', 3: 'var(--surface-3)' },
        border:   { DEFAULT: 'var(--border)',   sub: 'var(--border-sub)' },
        accent:   { DEFAULT: 'var(--accent)',    hover: 'var(--accent-h)' },
        text:     { DEFAULT: 'var(--text)',      muted: 'var(--text-muted)', subtle: 'var(--text-subtle)' },
        success:  { DEFAULT: 'var(--success)',   hover: 'var(--success-h)' },
        danger:   { DEFAULT: 'var(--danger)',    hover: 'var(--danger-h)' },
        warning:  'var(--warning)',
      },
      borderRadius: {
        DEFAULT: 'var(--r)',
        card:    'var(--r-card)',
        inner:   'var(--r-in)',
      },
      animation: {
        'fade-in':   'fadeIn 0.2s ease-out',
        'slide-up':  'slideUp 0.25s ease-out',
        'slide-down':'slideDown 0.25s ease-out',
        'scale-in':  'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' },                           '100%': { opacity: '1' } },
        slideUp:   { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideDown: { '0%': { opacity: '0', transform: 'translateY(-12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        scaleIn:   { '0%': { opacity: '0', transform: 'scale(0.95)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
} satisfies Config;
