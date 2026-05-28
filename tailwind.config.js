/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        retro: ['"Press Start 2P"', 'monospace'],
      },
      colors: {
        'game-bg': '#FFFADE',
        'team-a': '#E47D79',
        'team-b': '#4A90E2',
        'game-primary': '#01006B',
        'hud-green': '#00B074',
        'hud-teal': '#0F5F6B',
      },
    },
  },
  plugins: [],
};
