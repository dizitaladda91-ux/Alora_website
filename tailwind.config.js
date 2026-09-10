/** @type {import('tailwindcss').Config} */
export default {
  content: ['./frontend/**/*.{html,js}'],
  theme: {
    extend: {
      colors: {
        ink: '#152219',
        'ink-light': '#1F3327',
        'ink-soft': '#28402F',
        parchment: '#F7F2E7',
        card: '#FFFFFF',
        clay: '#A24C3D',
        'clay-light': '#C97E63',
        'clay-dark': '#7E3A2F',
        sage: '#6C8763',
        'sage-light': '#E7ECDF',
        gold: '#BB9556',
        ash: '#6B685F'
      },
      fontFamily: {
        serif: ['Fraunces', 'Fraunces-Fallback', 'Georgia', 'serif'],
        sans: ['PT Sans', 'PTSans-Fallback', 'Manrope', 'Manrope-Fallback', 'Arial', 'sans-serif'],
        roboto: ['Roboto Mono', 'monospace']
      }
    }
  }
};
