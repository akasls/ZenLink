/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        accent: '#4f46e5',
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(0, 0, 0, 0.03)',
        card: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
      },
    },
  },
  plugins: [],
};
