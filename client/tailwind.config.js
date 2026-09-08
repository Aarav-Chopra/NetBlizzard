/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 0.6s cubic-bezier(0.4,0,0.6,1) infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'ticker': 'ticker 20s linear infinite',
        'ping-slow': 'ping 2s cubic-bezier(0,0,0.2,1) infinite',
        'ping-fast': 'ping 0.5s cubic-bezier(0,0,0.2,1) infinite',
      },
      keyframes: {
        ticker: {
          '0%':   { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
      },
      colors: {
        cyber: {
          900: '#020818',
          800: '#040f24',
          700: '#071630',
          600: '#0a2040',
          500: '#0d2d58',
        },
      },
    },
  },
  plugins: [],
};
