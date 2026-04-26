import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        parchment: '#f4e4bc',
        gold: '#a88c52',
        'gold-light': '#d4af70',
        dark: '#1a1814',
        'dark-card': '#2c2821',
        'dark-border': '#4a4338',
        'dark-hover': '#352f28',
        ember: '#c0392b',
        'ember-dark': '#922b21',
        steel: '#34495e',
        'steel-light': '#5d6d7e',
      },
      fontFamily: {
        fantasy: ['Cinzel', 'serif'],
        body: ['Crimson Text', 'Georgia', 'serif'],
        mono: ['Fira Code', 'monospace'],
      },
      backgroundImage: {
        'dark-texture': "url('/textures/dark-stone.png')",
      },
      animation: {
        'pulse-gold': 'pulse-gold 1.5s ease-in-out infinite',
        'fade-in': 'fadeIn 0.2s ease-in-out',
      },
      keyframes: {
        'pulse-gold': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(212, 175, 112, 0.7)' },
          '50%': { opacity: '0.8', boxShadow: '0 0 0 8px rgba(212, 175, 112, 0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

export default config
