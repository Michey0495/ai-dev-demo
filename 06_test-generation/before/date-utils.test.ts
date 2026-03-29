import { describe, it, expect } from 'vitest'
import {
  formatDate,
  parseDate,
  addBusinessDays,
  getQuarter,
  isLeapYear,
} from '../input/date-utils'

// 正常系テストのみ。5関数 x 1ケース = 合計5件
// isHoliday, getNextBusinessDay, diffInBusinessDays, getFiscalYear, getLastDayOfMonth は未テスト

describe('date-utils', () => {
  it('formatDate で日付をフォーマットできる', () => {
    const date = new Date(2025, 5, 15) // 2025年6月15日
    expect(formatDate(date)).toBe('2025-06-15')
  })

  it('parseDate で文字列から日付を生成できる', () => {
    const result = parseDate('2025-06-15')
    expect(result.getFullYear()).toBe(2025)
    expect(result.getMonth()).toBe(5)
    expect(result.getDate()).toBe(15)
  })

  it('addBusinessDays で営業日を加算できる', () => {
    const monday = new Date(2025, 5, 2) // 2025年6月2日 月曜
    const result = addBusinessDays(monday, 3)
    expect(result.getDate()).toBe(5) // 木曜
  })

  it('getQuarter で四半期を取得できる', () => {
    const jan = new Date(2025, 0, 15) // 1月
    expect(getQuarter(jan)).toBe(1)
  })

  it('isLeapYear でうるう年を判定できる', () => {
    expect(isLeapYear(2024)).toBe(true)
  })
})
