import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#171514',          // luxury black
        charcoal: '#211B1B',     // deep charcoal
        gold: { DEFAULT: '#B9945A', soft: '#D9B77C', deep: '#7A5C2B' }, // deep = AA-safe gold text on ivory
        ivory: '#F6F0E8',
        line: '#E7DFD5',
        muted: '#6B625C',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: { wordmark: '0.18em' },
      borderRadius: { card: '4px' },
      boxShadow: { lift: '0 12px 32px -16px rgba(23,21,20,0.35)' },
    },
  },
  plugins: [],
};
export default config;
