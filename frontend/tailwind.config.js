import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        app: '#f6f8fc',
        surface: '#ffffff',
        panel: '#f9fbff',
        'panel-strong': '#eef3ff',
        'border-subtle': '#dfe5f2',
        'text-primary': '#172033',
        'text-secondary': '#5d687f',
        'text-muted': '#8a94a8',
        'accent-primary': '#4f46e5',
        'accent-ai': '#7c3aed',
        'accent-success': '#22c55e',
        'accent-warning': '#f59e0b',
        'accent-danger': '#ef4444',
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
      borderRadius: {
        control: '12px',
        card: '18px',
        panel: '24px',
        workspace: '28px',
      },
      boxShadow: {
        card: '0 0 0 1px rgba(15,23,42,0.04), 0 10px 30px rgba(15,23,42,0.08)',
      },
    },
  },
  plugins: [typography],
}
