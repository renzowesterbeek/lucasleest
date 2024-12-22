import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary-text-color': '#000000',
        primary: {
          DEFAULT: '#cc7c5e',
          hover: '#b56a50',
          light: '#f2f0e9',
        },
        secondary: {
          DEFAULT: '#897dc9',
          hover: '#7668b8',
        },
        background: {
          DEFAULT: '#edece4',
          paper: '#ffffff',
          muted: '#dad5dd',
        },
        success: {
          DEFAULT: '#22c55e', // green-500
          light: '#dcfce7', // green-100
        },
        error: {
          DEFAULT: '#ef4444', // red-500
          light: '#fee2e2', // red-100
        },
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'slide-in': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' }
        },
        'slide-out': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(100%)' }
        }
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-out forwards',
        'slide-in': 'slide-in 0.3s ease-out forwards',
        'slide-out': 'slide-out 0.3s ease-out forwards'
      }
    },
  },
  plugins: [],
} satisfies Config;
