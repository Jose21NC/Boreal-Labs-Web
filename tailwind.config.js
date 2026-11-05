module.exports = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './app/**/*.{js,jsx}',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
        agrandir: ['Agrandir', 'sans-serif'],
      },
      colors: {
        'boreal-dark': '#010b1d',
        'boreal-aqua': '#69e6af',
        'boreal-purple': '#be58f0',
        'boreal-blue': '#3162ed',
        adm: {
          bg: 'rgb(var(--adm-bg) / <alpha-value>)',
          surface: 'rgb(var(--adm-surface) / <alpha-value>)',
          'surface-2': 'rgb(var(--adm-surface-2) / <alpha-value>)',
          border: 'rgb(var(--adm-border) / <alpha-value>)',
          text: 'rgb(var(--adm-text) / <alpha-value>)',
          muted: 'rgb(var(--adm-muted) / <alpha-value>)',
          accent: 'rgb(var(--adm-accent) / <alpha-value>)',
          'accent-fg': 'rgb(var(--adm-accent-fg) / <alpha-value>)',
          danger: 'rgb(var(--adm-danger) / <alpha-value>)',
          warning: 'rgb(var(--adm-warning) / <alpha-value>)',
          success: 'rgb(var(--adm-success) / <alpha-value>)',
          info: 'rgb(var(--adm-info) / <alpha-value>)',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: 0 },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: 0 },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};