/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          page:  '#05050f',
          card:  '#09091a',
          deep:  '#03030a',
          muted: '#0e0e20',
        },
        accent: {
          lime:   '#a3e635',
          cyan:   '#22d3ee',
          violet: '#818cf8',
          rose:   '#fb7185',
          amber:  '#fbbf24',
        },
        status: {
          pass:   '#22c55e',
          fail:   '#ef4444',
          review: '#f59e0b',
        },
        text: {
          primary: '#f0f0ff',
          soft:    '#c8c8e0',
          muted:   '#6b6b8a',
          ghost:   '#3a3a56',
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.07)',
          bright:  'rgba(255,255,255,0.12)',
          glow:    'rgba(163,230,53,0.3)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      animation: {
        'fade-in':    'fadeIn 0.4s ease-out',
        'slide-up':   'slideUp 0.5s cubic-bezier(0.16,1,0.3,1)',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'spin-slow':  'spin 3s linear infinite',
        'float':      'float 4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(20px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        float:   { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
      },
      borderRadius: {
        '2xl': '20px',
        '3xl': '28px',
      },
      backdropBlur: { xs: '2px' },
      boxShadow: {
        'glow-lime':   '0 0 24px rgba(163,230,53,0.3), 0 0 64px rgba(163,230,53,0.08)',
        'glow-cyan':   '0 0 24px rgba(34,211,238,0.3)',
        'glow-violet': '0 0 24px rgba(129,140,248,0.3)',
        'card':        '0 4px 24px rgba(0,0,0,0.5)',
        'card-hover':  '0 8px 40px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
}
