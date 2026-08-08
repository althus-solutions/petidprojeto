/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F3F1FC',
          100: '#EDE9FB',
          200: '#D9CFF7',
          300: '#C4B5F5',
          500: '#6C4FE0',
          600: '#5A3FD0',
          700: '#4A32B8',
          800: '#352270',
          900: '#2D1B69',
          vivid: '#7C5CE8',
          dark: '#2D1B69',
        },
        surface: {
          border: '#E7E2F9',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        display: ['Sora', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '20px',
        input: '12px',
      },
      boxShadow: {
        soft: '0 10px 30px rgba(76, 55, 150, 0.08)',
        card: '0 4px 20px rgba(76, 55, 150, 0.06)',
        'btn-primary': '0 8px 20px rgba(108, 79, 224, 0.28)',
      },
    },
  },
}
