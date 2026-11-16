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
        card: '22px', // B 톤 카드·탭바
      },
      boxShadow: {
        warm: '0 4px 14px rgba(120,90,60,.07)',      // 카드
        'warm-up': '0 -4px 16px rgba(120,90,60,.06)', // 하단 탭바
        bar: '0 6px 16px rgba(15,76,129,.3)',         // 가계부 입력 바
      },
      zIndex: {
        '60': '60',
      },
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#b0cbe6',
          300: '#74a0c6',
          400: '#3a74a3',
          500: '#0F4C81',
          600: '#0a3d6e',
          700: '#082e55',
        },
        cream: '#FBF8F3', // 페이지 배경
        sand: '#F5EFE6',  // 막대 빈칸·빈 칸
        line: '#EEE7DD',  // 칩 테두리·구분선
      },
    },
  },
  plugins: [],
}

export default config
