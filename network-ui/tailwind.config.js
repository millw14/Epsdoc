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
        typewriter: ['Space Mono', 'JetBrains Mono', 'Consolas', 'monospace'],
      },
      colors: {
        ink: {
          50: '#f5f5f4',
          100: '#e7e5e4',
          200: '#d6d3d1',
          300: '#a8a29e',
          400: '#78716c',
          500: '#57534e',
          600: '#44403c',
          700: '#292524',
          800: '#1c1917',
          900: '#0c0a09',
          950: '#0a0908',
        },
        paper: {
          50: '#fdfcfb',
          100: '#f5f3f0',
          200: '#e8e4de',
          300: '#d4cec4',
        },
        accent: {
          red: '#b91c1c',
          glow: '#dc2626',
        }
      },
      letterSpacing: {
        typewriter: '0.05em',
      }
    },
  },
  plugins: [],
}
