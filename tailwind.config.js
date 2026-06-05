/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e1e9ff',
          200: '#c8d7ff',
          300: '#a1bbff',
          400: '#7093ff',
          500: '#4365ff', // Cobalt blue
          600: '#263fff',
          700: '#1b2eff',
          800: '#1423d4',
          900: '#1725a3',
          950: '#0c1261',
        },
        accent: {
          teal: '#0ea5e9',
          amber: '#f59e0b',
          rose: '#f43f5e',
          emerald: '#10b981',
        },
        glass: {
          light: 'rgba(255, 255, 255, 0.7)',
          dark: 'rgba(15, 23, 42, 0.6)',
        }
      },
      fontFamily: {
        sans: ['var(--font-outfit)', 'Inter', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'premium': '0 8px 30px rgb(0, 0, 0, 0.04)',
        'premium-hover': '0 20px 40px rgb(0, 0, 0, 0.08)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
      }
    },
  },
  plugins: [],
}
