/** @type {import('tailwindcss').Config} */

/**
 * "Portal" design tokens: jet black, royal amethyst, electric cyan
 *   ink    jet-black neutrals (page background → bright text), faintly amethyst-tinted
 *   neon   royal amethyst: actions, focus, the active state
 *   plasma electric cyan: glow, highlights, gradient edges
 *   aqua   success and data (aqua-500 is the validated chart colour on ink-900)
 */
const ink = {
  50: '#FAF9FC',
  100: '#F2F0F6', // primary text
  200: '#E0DCE8',
  300: '#CBC5D7',
  400: '#ADA6BC', // secondary text
  500: '#8A8299', // muted text
  600: '#5C5568',
  700: '#3A3545',
  800: '#211E29', // borders, raised controls
  900: '#0E0D12', // panels
  950: '#050506', // jet black: page background
};

const neon = {
  50: '#F6F0FE',
  100: '#EBDDFD',
  200: '#D8BDFA',
  300: '#C29BF5', // accent text on black
  400: '#8A4FD6', // royal amethyst: filled buttons
  500: '#7638C2', // pressed / hover on filled
  600: '#622BA3',
  700: '#4E2283',
  800: '#3B1A63',
  900: '#281245',
  950: '#170A29',
};

const plasma = {
  300: '#8FF7FF',
  400: '#00E5FF', // electric cyan
  500: '#00C2DB',
  600: '#0097AD',
};

const aqua = {
  50: '#E8FAFD',
  100: '#C7F1F8',
  200: '#9AE6F2',
  300: '#6FD6E8',
  400: '#3EBDD4',
  500: '#1E9FB8', // validated chart / success colour on nebula
  600: '#18819A',
  700: '#15677C',
  800: '#135262',
  900: '#10414E',
  950: '#08262E',
};

const SCRIPTS = [
  'Anek Latin Variable', 'Anek Devanagari Variable', 'Anek Kannada Variable', 'Anek Tamil Variable',
  'Anek Telugu Variable', 'Anek Malayalam Variable', 'Anek Bangla Variable', 'Anek Gujarati Variable',
];

module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: { ink, neon, plasma, aqua },
      fontFamily: {
        sans: [...SCRIPTS, 'Noto Sans', 'Noto Nastaliq Urdu', 'Noto Sans JP', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        panel: '1.25rem',
      },
      keyframes: {
        'script-in': {
          '0%': { opacity: '0', transform: 'translateY(0.35em)', filter: 'blur(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)', filter: 'blur(0)' },
        },
        'portal-spin': { to: { transform: 'rotate(360deg)' } },
        'portal-breathe': {
          '0%, 100%': { opacity: '0.85', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.03)' },
        },
        drift: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) rotate(var(--r, 0deg))' },
          '50%': { transform: 'translate3d(0, -14px, 0) rotate(calc(var(--r, 0deg) + 6deg))' },
        },
        'menu-in': {
          '0%': { opacity: '0', transform: 'translateX(-24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'script-in': 'script-in 520ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'portal-spin': 'portal-spin 40s linear infinite',
        'portal-spin-rev': 'portal-spin 60s linear infinite reverse',
        'portal-breathe': 'portal-breathe 6s ease-in-out infinite',
        drift: 'drift 9s ease-in-out infinite',
        'menu-in': 'menu-in 420ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
      },
    },
  },
  plugins: [],
};
