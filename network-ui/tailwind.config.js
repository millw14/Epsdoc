/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Space Mono', 'Consolas', 'monospace'],
      },
      colors: {
        // Black backgrounds
        dark: {
          900: '#0a0a0a',
          800: '#111111',
          700: '#1a1a1a',
          600: '#222222',
          500: '#2a2a2a',
          400: '#333333',
        },
        // Red accents (matching logo)
        brand: {
          red: '#dc2626',
          dark: '#991b1b',
          light: '#ef4444',
          glow: '#f87171',
        },
        // Text colors - high contrast
        txt: {
          white: '#ffffff',
          light: '#e5e5e5',
          muted: '#a3a3a3',
          dim: '#737373',
        }
      },
    },
  },
  plugins: [],
}
