/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#3b2f27',
        paper: '#faf3e3',
        kraft: '#c79a6b',
        coral: '#e05a47',
        sage: '#8eb87a',
      },
      fontFamily: {
        hand: ['"Comic Sans MS"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        journal: ['"Trebuchet MS"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 10px 30px -8px rgba(59,47,39,0.35), 0 2px 0 rgba(255,255,255,0.6) inset',
        pop: '0 18px 50px -12px rgba(59,47,39,0.5)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '60%': { transform: 'scale(1.03)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s ease-out both',
        'pop-in': 'pop-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
        'spin-slow': 'spin-slow 8s linear infinite',
      },
    },
  },
  plugins: [],
};