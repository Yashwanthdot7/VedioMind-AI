/** @type {import('tailwindcss').Config} */

/**
 * "Study lamp" design tokens
 *   ink      deep indigo-ink neutrals (background → text)
 *   turmeric the desk-lamp accent: actions, focus, highlights
 *   lagoon   success and data
 */
const ink = {
  50: '#F7F5FC',
  100: '#EEEAF6', // chalk — primary text
  200: '#DAD5EA',
  300: '#C2BCD8',
  400: '#A9A3C2', // fog — secondary text
  500: '#8C86AE', // muted text (4.7:1 on desk)
  600: '#645E8A',
  700: '#433E6B',
  800: '#2C2850',
  900: '#1F1C3B', // desk — panels
  950: '#15132B', // ink — page background
};

const turmeric = {
  50: '#FEF8EA',
  100: '#FDEDC6',
  200: '#FADB8E',
  300: '#F7C862',
  400: '#F2B33D', // the lamp
  500: '#DE9A1E',
  600: '#B97A12',
  700: '#8F5D10',
  800: '#684412',
  900: '#4A3112',
  950: '#2B1C09',
};

const lagoon = {
  50: '#EBFAF6',
  100: '#CDF2E9',
  200: '#9DE4D3',
  300: '#68D1BA',
  400: '#41BCA3',
  500: '#30A893', // validated chart / success colour on desk
  600: '#23877A',
  700: '#1E6C63',
  800: '#1B5550',
  900: '#174542',
  950: '#0A2827',
};

const SCRIPTS = [
  'Anek Latin Variable', 'Anek Devanagari Variable', 'Anek Kannada Variable', 'Anek Tamil Variable',
  'Anek Telugu Variable', 'Anek Malayalam Variable', 'Anek Bangla Variable', 'Anek Gujarati Variable',
];

module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: { ink, turmeric, lagoon },
      fontFamily: {
        sans: [...SCRIPTS, 'Noto Sans', 'Noto Nastaliq Urdu', 'Noto Sans JP', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        panel: '1.5rem',
      },
      keyframes: {
        'script-in': {
          '0%': { opacity: '0', transform: 'translateY(0.35em)', filter: 'blur(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)', filter: 'blur(0)' },
        },
      },
      animation: {
        'script-in': 'script-in 520ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
      },
    },
  },
  plugins: [],
};
