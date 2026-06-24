import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Pretendard Variable"',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Noto Sans KR"',
          'sans-serif',
        ],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      zIndex: {
        '60': '60',
      },
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#0F4C81',
          600: '#0a3d6e',
          700: '#082e55',
        },
      },
    },
  },
  plugins: [],
}

export default config
