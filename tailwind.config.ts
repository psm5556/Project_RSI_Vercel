import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'app-bg':      '#000000',
        'app-surface': '#0d1117',
        'app-sidebar': '#0a0a0a',
        'app-card':    '#111827',
        'app-border':  '#1e2535',
        'app-muted':   '#8b92a0',
        'app-accent':  '#4fc3f7',
        'app-green':   '#26a69a',
        'app-red':     '#ef5350',
      },
    },
  },
  plugins: [],
};

export default config;
