/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* Channel vars + <alpha-value> let bg-primary/10 and friends actually compile. */
        canvas: 'rgb(var(--color-canvas-rgb) / <alpha-value>)',
        section: 'rgb(var(--color-section-rgb) / <alpha-value>)',
        line: 'rgb(var(--color-line-rgb) / <alpha-value>)',
        heading: 'rgb(var(--color-heading-rgb) / <alpha-value>)',
        body: 'rgb(var(--color-body-rgb) / <alpha-value>)',
        muted: 'rgb(var(--color-muted-rgb) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
          hover: 'var(--color-primary-hover)',
          ring: 'var(--color-primary-ring)',
        },
        accent: 'rgb(var(--color-accent-rgb) / <alpha-value>)',
        success: 'rgb(var(--color-success-rgb) / <alpha-value>)',
        danger: 'rgb(var(--color-danger-rgb) / <alpha-value>)',
        preview: 'rgb(var(--color-preview-rgb) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
      },
      maxWidth: {
        page: '1200px',
      },
      borderRadius: {
        card: '12px',
        btn: '8px',
        chip: '9999px',
      },
      boxShadow: {
        soft: '0 1px 2px rgb(30 27 75 / 0.06), 0 8px 24px rgb(30 27 75 / 0.06)',
      },
    },
  },
  plugins: [],
};
