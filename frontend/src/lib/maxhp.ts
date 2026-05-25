export interface ParsedMaxHP {
  numeric: number
  isInf: boolean
  valid: boolean
}

export function parseMaxHP(s: string | undefined | null): ParsedMaxHP {
  if (!s) return { numeric: 0, isInf: false, valid: false }
  const t = s.trim()
  if (/^inf$/i.test(t) || t === '∞') return { numeric: 0, isInf: true, valid: true }
  const m = t.match(/^(\d+)/)
  if (!m) return { numeric: 0, isInf: false, valid: false }
  const n = parseInt(m[1], 10)
  if (n <= 0) return { numeric: 0, isInf: false, valid: false }
  return { numeric: n, isInf: false, valid: true }
}

export function hpPercent(current: number, maxHP: string | undefined | null): number {
  const { numeric, isInf, valid } = parseMaxHP(maxHP)
  if (isInf || !valid) return 1
  return Math.max(0, current) / Math.max(numeric, 1)
}
