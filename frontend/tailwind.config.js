/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        scholar: {
          'bg-canvas':  '#f5f6f7',
          'bg-surface': '#ffffff',
          primary:          '#3370ff',
          'primary-hover':  '#2b5fc2',
          academic:         '#164082',
          code:             '#0f6c44',
          discovery:        '#7b2cbf',
          'text-primary':   '#1f2329',
          'text-secondary': '#646a73',
          'text-weak':      '#8f959e',
          border:           '#dee0e3',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}

