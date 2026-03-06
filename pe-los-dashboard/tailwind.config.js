/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        'app-bg': '#0f1117',
        'card-bg': '#1a1d27',
        'app-border': '#2a2d3a',
      },
    },
  },
  plugins: [],
}
