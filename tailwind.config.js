/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './public/index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      transitionProperty: {
        'width': 'width'
      }
    },
  },
  safelist: [
    'from-rose-500', 'via-amber-400', 'to-green-500'
  ],
  plugins: [],
}

