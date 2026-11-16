export function formatAmountInput(raw: string, allowDecimal = false): string {
  if (allowDecimal) {
    const cleaned = raw.replace(/[^0-9.]/g, '')
    const firstDot = cleaned.indexOf('.')
    const sanitized =
      firstDot >= 0
        ? cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '')
        : cleaned
    const [intPart, decPart] = sanitized.split('.')
    const formattedInt = intPart ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''
    return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt
  }
  const digits = raw.replace(/[^0-9]/g, '')
  if (!digits) return ''
  return parseInt(digits, 10).toLocaleString('ko-KR')
}

export function stripCommas(s: string): string {
  return s.replace(/,/g, '')
}

// 원 금액을 짧게: 2.35억, 103만, 9,800원 (부호 유지). 시안의 금액 표기.
export function formatMan(v: number): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 100_000_000) return `${sign}${parseFloat((abs / 100_000_000).toFixed(2))}억`
  if (abs >= 10_000) return `${sign}${Math.round(abs / 10_000).toLocaleString('ko-KR')}만`
  return `${sign}${Math.round(abs).toLocaleString('ko-KR')}원`
}
