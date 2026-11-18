/** @type {import('tailwindcss').Config} */

/**
 * "Portal" design tokens: a learning world at night
 *   ink    violet-black neutrals (void background → starlight text)
 *   neon   electric violet: actions, focus, the active state
 *   plasma magenta glow: art, highlights, gradient edges (never body text on dark)
 *   aqua   success and data (aqua-500 is the validated chart colour on ink-900)
 */
const ink = {
  50: '#F7F4FF',
  100: '#F1ECFF', // starlight: primary text
  200: '#DCD3F5',
  300: '#C3B8E6',
  400: '#A99CCB', // haze: secondary text
  500: '#8D80B3', // muted text
  600: '#66598F',
  700: '#463A6E',
  800: '#2D2150', // borders, raised controls
  900: '#150D2A', // nebula: panels
  950: '#0B0716', // void: page background
};

const neon = {
  50: '#F3F0FF',
  100: '#E6E0FF',
  200: '#CEC2FF',
  300: '#B3A1FF', // accent text on dark
  400: '#7650FF', // filled buttons (white text 5.2:1)
  500: '#6438F0', // pressed / hover on filled
  600: '#5128CC',
  700: '#3F1FA3',
  800: '#2E1878',
  900: '#1F114F',
  950: '#12092F',
};

const plasma = {
  300: '#F29BFF',
  400: '#E040FB',
  500: '#C21FE0',
  600: '#9612B0',
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
