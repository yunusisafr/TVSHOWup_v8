import typography from '@tailwindcss/typography';

const colors = require('tailwindcss/colors');

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        'xs': '480px',
      },
      colors: {
        primary: {
          50: '#e6f7fe',
          100: '#cceefa',
          200: '#99ddf5',
          300: '#66cbf0',
          400: '#33baeb',
          500: '#0395D1', // Logo blue
          600: '#0277a7',
          700: '#02597d',
          800: '#013c54',
          900: '#011e2a',
        },
      },
    },
  },
  plugins: [typography],
};