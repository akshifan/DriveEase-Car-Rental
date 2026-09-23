/** Design tokens for the DriveEase interface. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#07080A',
          900: '#0B0D10',
          850: '#111318',
          800: '#161A20',
          700: '#1E242C',
          600: '#2A323C',
        },
        mist: {
          100: '#F4F6F7',
          200: '#D9DEE3',
          300: '#A8B0B8',
          400: '#7C858F',
          500: '#5A636D',
        },
        lime: {
          DEFAULT: '#D7F24B',
          soft: '#E8FA92',
          deep: '#A9C42F',
        },
        ice: '#7FE3FF',
        signal: {
          success: '#4ADE80',
          warning: '#FBBF24',
          danger: '#F87171',
          info: '#60A5FA',
        },
      },
      fontFamily: {
        display: ['"Inter Tight"', '"Helvetica Neue"', 'Arial', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.045em',
      },
      /**
       * The interface uses a fine-grained opacity ramp for hairlines, badges and
       * glass edges, so the scale is extended beyond Tailwind's defaults.
       */
      opacity: {
        12: '0.12',
        15: '0.15',
        35: '0.35',
        45: '0.45',
        55: '0.55',
        65: '0.65',
        85: '0.85',
      },
      borderRadius: {
        xl: '0.9rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        lift: '0 24px 60px -30px rgba(0,0,0,0.85)',
        glow: '0 0 0 1px rgba(215,242,75,0.35), 0 18px 50px -24px rgba(215,242,75,0.35)',
      },
      backgroundImage: {
        'grid-faint':
          'linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)',
        'radial-spot': 'radial-gradient(60% 60% at 50% 0%, rgba(215,242,75,0.10), transparent 70%)',
      },
      keyframes: {
        floaty: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        floaty: 'floaty 6s ease-in-out infinite',
        shimmer: 'shimmer 1.6s infinite',
        fadeUp: 'fadeUp 0.5s ease-out both',
      },
    },
  },
  plugins: [],
};
