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
