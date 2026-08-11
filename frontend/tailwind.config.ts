import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#0a1628',
          navy: '#0d1f3c',
          teal: '#0f2a3d',
          gold: '#d4a843',
          'gold-hover': '#e6bc5a',
          'gold-light': '#f5d77a',
          accent: '#2dd4a8',
          muted: '#8b9bb4',
          surface: '#141e35',
          'surface-light': '#1a2a45',
          border: '#1e3a5f',
        },
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
