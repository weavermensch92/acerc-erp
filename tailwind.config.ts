import type { Config } from 'tailwindcss';

// ERP 디자인 토큰 (ERP/theme.js 매핑)
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#FAFAFA',
          subtle: '#F4F4F2',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F8F8F6',
        },
        border: {
          DEFAULT: '#E8E8E5',
          strong: '#D4D4D0',
        },
        divider: '#EFEFEC',
        foreground: {
          DEFAULT: '#0A0A0A',
          secondary: '#4A4A47',
          muted: '#7A7A75',
          dim: '#A8A8A2',
        },
        primary: {
          DEFAULT: '#0A0A0A',
          hover: '#1F1F1F',
          foreground: '#FFFFFF',
        },
        // shadcn 호환 alias
        input: '#E8E8E5',
        ring: '#0A0A0A',
        muted: {
          DEFAULT: '#F4F4F2',
          foreground: '#7A7A75',
        },
        secondary: {
          DEFAULT: '#F8F8F6',
          foreground: '#4A4A47',
        },
        destructive: {
          DEFAULT: '#B91C1C',
          foreground: '#FFFFFF',
        },
        // semantic
        success: {
          DEFAULT: '#15803D',
          bg: '#DCFCE7',
        },
        warning: {
          DEFAULT: '#A16207',
          bg: '#FEF3C7',
        },
        danger: {
          DEFAULT: '#B91C1C',
          bg: '#FEE2E2',
        },
        info: {
          DEFAULT: '#1D4ED8',
          bg: '#DBEAFE',
        },
        accent: '#84CC16',
      },
      fontFamily: {
        sans: ['var(--font-noto-sans-kr)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        sm: '6px',
        md: '7px',
        lg: '12px',
      },
      boxShadow: {
        DEFAULT: '0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.03)',
        md: '0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.04)',
        lg: '0 4px 8px rgba(0,0,0,0.04), 0 12px 32px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
