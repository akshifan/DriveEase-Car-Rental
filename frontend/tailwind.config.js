/** Design tokens for the DriveEase interface - glassmorphism edition. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        /**
         * Base surfaces. Slightly blue-tinted darks so the frosted glass
         * panels have something warm to refract. Pure black would flatten
         * the effect.
         */
        ink: {
          950: '#0A0E17',   // page background
          900: '#0E1420',   // base surface
          850: '#131A2A',   // raised surface
          800: '#1A2333',   // hover / active surface
          700: '#243047',   // strong border
          600: '#3A4864',   // strong divider
        },

        /**
         * Text scale. Cool-tinted whites instead of pure #FFF so the type
         * sits in the same temperature as the background.
         */
        mist: {
          100: '#F1F5FB',
          200: '#D5DCE8',
          300: '#A8B3C7',
          400: '#7A879F',
          500: '#515D75',
        },

        /**
         * Brand accent — a single saturated cyan-teal. Reads as "electric
         * vehicle" without being as loud as lime.
         */
        accent: {
          DEFAULT: '#22D3EE',
          soft: '#67E8F9',
          deep: '#0891B2',
        },

        /**
         * Legacy alias so existing `bg-lime` / `text-lime` references keep
         * working while you migrate. Delete this block once you've replaced
         * every `lime-*` class with `accent-*`.
         */
        lime: {
          DEFAULT: '#22D3EE',
          soft: '#67E8F9',
          deep: '#0891B2',
        },

        /** Secondary accents (info, danger, warning, success) unchanged. */
        ice: '#7FE3FF',
        signal: {
          success: '#34D399',
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

      opacity: {
        8: '0.08',
        12: '0.12',
        15: '0.15',
        22: '0.22',
        35: '0.35',
        45: '0.45',
        55: '0.55',
        65: '0.65',
        85: '0.85',
      },

      borderRadius: {
        xl: '1rem',
        '2xl': '1.35rem',
        '3xl': '1.85rem',
      },

      /**
       * Glass shadows. Coloured lifts instead of black — this is what makes
       * a panel feel like it's floating in a warm scene rather than sitting
       * in a dark room.
       */
      boxShadow: {
        // Base panel elevation
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.36), inset 0 1px 0 0 rgba(255, 255, 255, 0.06)',
        // Raised panel (hover, focus, active card)
        glassLg:
          '0 16px 48px 0 rgba(0, 0, 0, 0.42), inset 0 1px 0 0 rgba(255, 255, 255, 0.08)',
        // Floating modal / dialog
        glassFloat:
          '0 24px 64px 0 rgba(0, 0, 0, 0.55), inset 0 1px 0 0 rgba(255, 255, 255, 0.10)',
        // Accent glow — replaces the old lime glow
        glow:
          '0 0 0 1px rgba(34, 211, 238, 0.35), 0 20px 50px -24px rgba(34, 211, 238, 0.45)',
        // Legacy alias
        lift:
          '0 24px 60px -30px rgba(0, 0, 0, 0.85), inset 0 1px 0 0 rgba(255, 255, 255, 0.06)',
      },

      /**
       * Backdrop blur scales. Tailwind ships `backdrop-blur-sm/md/lg/xl/2xl/3xl`
       * but the middle values are what glass actually needs — blur-sm flattens
       * and blur-xl loses the layering. These are the ones that read as glass.
       */
      backdropBlur: {
        glass: '18px',
        glassLg: '28px',
        glassSm: '12px',
      },

      backgroundImage: {
        /**
         * Ambient scene background — three overlapping radial spots in the
         * brand accent, cool blue, and a warm neutral. Rendered behind the
         * page so glass panels have coloured light to refract.
         */
        'glass-scene':
          "radial-gradient(60% 50% at 15% 0%, rgba(34, 211, 238, 0.10), transparent 60%), radial-gradient(50% 60% at 85% 10%, rgba(96, 165, 250, 0.08), transparent 65%), radial-gradient(70% 70% at 50% 100%, rgba(34, 211, 238, 0.06), transparent 70%)",

        /**
         * Frosted panel interior. A very subtle top-to-bottom white fade —
         * the "inner glow" that makes a flat rectangle read as a curved
         * glass pane. This is the single most important trick.
         */
        'glass-panel':
          'linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 40%, rgba(255, 255, 255, 0.005) 100%)',

        /** Accent panel gradient — used on primary buttons and badges. */
        'glass-accent':
          'linear-gradient(180deg, rgba(34, 211, 238, 0.22) 0%, rgba(34, 211, 238, 0.10) 100%)',

        /** The subtle grid, now more legible on the new background. */
        'grid-faint':
          'linear-gradient(to right, rgba(255, 255, 255, 0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.035) 1px, transparent 1px)',

        /** Radial spotlight behind the 3D scene. */
        'radial-spot':
          'radial-gradient(60% 60% at 50% 0%, rgba(34, 211, 238, 0.14), transparent 70%)',
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
        /** Subtle highlight sweep used on hero glass panels. */
        sheen: {
          '0%': { transform: 'translateX(-60%) skewX(-12deg)' },
          '100%': { transform: 'translateX(160%) skewX(-12deg)' },
        },
      },

      animation: {
        floaty: 'floaty 6s ease-in-out infinite',
        shimmer: 'shimmer 1.6s infinite',
        fadeUp: 'fadeUp 0.5s ease-out both',
        sheen: 'sheen 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
