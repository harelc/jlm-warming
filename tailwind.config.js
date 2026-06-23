/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        body: ['Archivo', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        heb: ['Heebo', 'sans-serif'],
      },
      colors: {
        paper: '#f7f1e6',
        ink: '#1c150f',
        ember: '#c2410c',
        sand: '#e7dcc6',
      },
    },
  },
  plugins: [],
}
