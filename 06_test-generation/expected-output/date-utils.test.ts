import { describe, it, expect } from 'vitest'
import {
  formatDate,
  parseDate,
  addBusinessDays,
  isHoliday,
  getNextBusinessDay,
  diffInBusinessDays,
  getQuarter,
  getFiscalYear,
  isLeapYear,
  getLastDayOfMonth,
} from '../input/date-utils'

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------
describe('formatDate', () => {
  it('デフォルトフォーマット yyyy-MM-dd で出力される', () => {
    expect(formatDate(new Date(2025, 5, 15))).toBe('2025-06-15')
  })

  it('yyyy/MM/dd フォーマットで出力される', () => {
    expect(formatDate(new Date(2025, 0, 1), 'yyyy/MM/dd')).toBe('2025/01/01')
  })

  it('MM/dd フォーマットで出力される', () => {
    expect(formatDate(new Date(2025, 11, 25), 'MM/dd')).toBe('12/25')
  })

  it('yyyy年MM月dd日 フォーマットで出力される', () => {
    expect(formatDate(new Date(2025, 3, 1), 'yyyy年MM月dd日')).toBe('2025年04月01日')
  })

  it('月・日が1桁のときゼロ埋めされる', () => {
    expect(formatDate(new Date(2025, 0, 5))).toBe('2025-01-05')
  })

  it('年末年始の境界を正しくフォーマットする', () => {
    expect(formatDate(new Date(2025, 11, 31))).toBe('2025-12-31')
    expect(formatDate(new Date(2026, 0, 1))).toBe('2026-01-01')
  })

  it('うるう年の 2月29日 をフォーマットできる', () => {
    expect(formatDate(new Date(2024, 1, 29))).toBe('2024-02-29')
  })

  it('無効な Date を渡すとエラーになる', () => {
    expect(() => formatDate(new Date('invalid'))).toThrow('無効な日付')
  })

  it('Date 以外の値を渡すとエラーになる', () => {
    // @ts-expect-error 型チェック回避: ランタイムでの不正入力を検証
    expect(() => formatDate('2025-01-01')).toThrow()
  })
})

// ---------------------------------------------------------------------------
// parseDate
// ---------------------------------------------------------------------------
describe('parseDate', () => {
  it('yyyy-MM-dd 形式をパースできる', () => {
    const result = parseDate('2025-06-15')
    expect(result.getFullYear()).toBe(2025)
    expect(result.getMonth()).toBe(5)
    expect(result.getDate()).toBe(15)
  })

  it('yyyy/MM/dd 形式をパースできる', () => {
    const result = parseDate('2025/06/15')
    expect(result.getFullYear()).toBe(2025)
  })

  it('うるう年の 2月29日 をパースできる', () => {
    const result = parseDate('2024-02-29')
    expect(result.getMonth()).toBe(1)
    expect(result.getDate()).toBe(29)
  })

  it('平年の 2月29日 はエラーになる', () => {
    expect(() => parseDate('2025-02-29')).toThrow('日が範囲外')
  })

  it('400年周期のうるう年と100年周期の平年を区別する', () => {
    expect(parseDate('2000-02-29').getDate()).toBe(29)
    expect(() => parseDate('1900-02-29')).toThrow('日が範囲外')
  })

  it('月が範囲外の場合エラーになる', () => {
    expect(() => parseDate('2025-00-15')).toThrow('月が範囲外')
    expect(() => parseDate('2025-13-01')).toThrow('月が範囲外')
  })

  it('日が0または月末超過の場合エラーになる', () => {
    expect(() => parseDate('2025-01-00')).toThrow('日が範囲外')
    expect(() => parseDate('2025-04-31')).toThrow('日が範囲外')
  })

  it('各月末の最終日をパースできる', () => {
    expect(parseDate('2025-01-31').getDate()).toBe(31)
    expect(parseDate('2025-04-30').getDate()).toBe(30)
    expect(parseDate('2025-06-30').getDate()).toBe(30)
  })

  it('空文字を渡すとエラーになる', () => {
    expect(() => parseDate('')).toThrow()
  })

  it('不正な形式の文字列はエラーになる', () => {
    expect(() => parseDate('2025年6月15日')).toThrow('パースできない日付形式')
    expect(() => parseDate('June 15, 2025')).toThrow('パースできない日付形式')
  })

  it('null / undefined / 数値を渡すとエラーになる', () => {
    // @ts-expect-error 型チェック回避
    expect(() => parseDate(null)).toThrow()
    // @ts-expect-error 型チェック回避
    expect(() => parseDate(undefined)).toThrow()
    // @ts-expect-error 型チェック回避
    expect(() => parseDate(20250615)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// addBusinessDays
// ---------------------------------------------------------------------------
describe('addBusinessDays', () => {
  it('月曜から3営業日後は木曜になる', () => {
    const monday = new Date(2025, 5, 2) // 月曜
    const result = addBusinessDays(monday, 3)
    expect(result.getDay()).toBe(4) // 木曜
    expect(result.getDate()).toBe(5)
  })

  it('金曜から1営業日後は翌週月曜になる', () => {
    const friday = new Date(2025, 5, 6) // 金曜
    const result = addBusinessDays(friday, 1)
    expect(result.getDay()).toBe(1) // 月曜
    expect(result.getDate()).toBe(9)
  })

  it('金曜から5営業日後は翌週金曜になる', () => {
    const result = addBusinessDays(new Date(2025, 5, 6), 5)
    expect(result.getDate()).toBe(13)
  })

  it('0営業日を指定すると同じ日が返る', () => {
    const result = addBusinessDays(new Date(2025, 5, 2), 0)
    expect(result.getDate()).toBe(2)
  })

  it('負の営業日数で過去方向に遡る（週末もスキップ）', () => {
    const wednesday = new Date(2025, 5, 4) // 水曜
    expect(addBusinessDays(wednesday, -2).getDay()).toBe(1) // 月曜
    const monday = new Date(2025, 5, 9) // 月曜
    expect(addBusinessDays(monday, -1).getDay()).toBe(5) // 前週金曜
  })

  it('GW直前から1営業日後は祝日をスキップする', () => {
    // 2025-05-02 金曜 → 5/3土, 5/4日, 5/5月(祝) → 5/6火
    const result = addBusinessDays(new Date(2025, 4, 2), 1)
    expect(result.getDate()).toBe(6)
  })

  it('建国記念の日をスキップして営業日を計算する', () => {
    // 2025-02-10 月曜 → 02-11は建国記念の日 → 02-12水曜
    const result = addBusinessDays(new Date(2025, 1, 10), 1)
    expect(result.getDate()).toBe(12)
  })

  it('元の日付オブジェクトを変更しない', () => {
    const original = new Date(2025, 5, 2)
    const originalTime = original.getTime()
    addBusinessDays(original, 5)
    expect(original.getTime()).toBe(originalTime)
  })

  it('無効な日付や小数の営業日数を渡すとエラーになる', () => {
    expect(() => addBusinessDays(new Date('invalid'), 1)).toThrow('無効な日付')
    expect(() => addBusinessDays(new Date(2025, 5, 2), 1.5)).toThrow('整数')
  })
})

// ---------------------------------------------------------------------------
// isHoliday
// ---------------------------------------------------------------------------
describe('isHoliday', () => {
  it('元日(1/1)は祝日と判定される', () => {
    expect(isHoliday(new Date(2025, 0, 1))).toBe(true)
  })

  it('建国記念の日(2/11)・天皇誕生日(2/23)は祝日', () => {
    expect(isHoliday(new Date(2025, 1, 11))).toBe(true)
    expect(isHoliday(new Date(2025, 1, 23))).toBe(true)
  })

  it('GW期間の祝日が全て判定される', () => {
    expect(isHoliday(new Date(2025, 3, 29))).toBe(true)  // 昭和の日
    expect(isHoliday(new Date(2025, 4, 3))).toBe(true)   // 憲法記念日
    expect(isHoliday(new Date(2025, 4, 4))).toBe(true)   // みどりの日
    expect(isHoliday(new Date(2025, 4, 5))).toBe(true)   // こどもの日
  })

  it('下半期の祝日が判定される', () => {
    expect(isHoliday(new Date(2025, 7, 11))).toBe(true)  // 山の日
    expect(isHoliday(new Date(2025, 10, 3))).toBe(true)  // 文化の日
    expect(isHoliday(new Date(2025, 10, 23))).toBe(true) // 勤労感謝の日
  })

  it('普通の平日・土曜は祝日ではない', () => {
    expect(isHoliday(new Date(2025, 5, 10))).toBe(false) // 火曜
    expect(isHoliday(new Date(2025, 5, 7))).toBe(false)  // 土曜
  })

  it('祝日が日曜の場合、翌月曜が振替休日になる', () => {
    // 2025-11-23 勤労感謝の日 = 日曜 → 11/24月曜が振替休日
    expect(isHoliday(new Date(2025, 10, 24))).toBe(true)
  })

  it('振替休日でない通常の月曜は祝日ではない', () => {
    expect(isHoliday(new Date(2025, 5, 16))).toBe(false)
  })

  it('無効な日付を渡すとエラーになる', () => {
    expect(() => isHoliday(new Date('invalid'))).toThrow('無効な日付')
  })
})

// ---------------------------------------------------------------------------
// getNextBusinessDay
// ---------------------------------------------------------------------------
describe('getNextBusinessDay', () => {
  it('月曜の翌営業日は火曜', () => {
    const result = getNextBusinessDay(new Date(2025, 5, 2))
    expect(result.getDay()).toBe(2) // 火曜
    expect(result.getDate()).toBe(3)
  })

  it('金曜の翌営業日は翌週月曜', () => {
    const result = getNextBusinessDay(new Date(2025, 5, 6))
    expect(result.getDay()).toBe(1) // 月曜
    expect(result.getDate()).toBe(9)
  })

  it('土曜・日曜の翌営業日は翌週月曜', () => {
    expect(getNextBusinessDay(new Date(2025, 5, 7)).getDate()).toBe(9) // 土曜
    expect(getNextBusinessDay(new Date(2025, 5, 8)).getDate()).toBe(9) // 日曜
  })

  it('祝日前日の翌営業日は祝日をスキップする', () => {
    // 2025-02-10 月曜 → 02-11建国記念の日 → 02-12水曜
    expect(getNextBusinessDay(new Date(2025, 1, 10)).getDate()).toBe(12)
  })

  it('年末の翌営業日が翌年になるケース', () => {
    // 2025-12-31 水曜 → 01-01元日 → 2026-01-02金曜
    const result = getNextBusinessDay(new Date(2025, 11, 31))
    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(0)
    expect(result.getDate()).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// diffInBusinessDays
// ---------------------------------------------------------------------------
describe('diffInBusinessDays', () => {
  it('同じ日なら 0 を返す', () => {
    const date = new Date(2025, 5, 2)
    expect(diffInBusinessDays(date, date)).toBe(0)
  })

  it('月曜から金曜までは 4 営業日', () => {
    expect(diffInBusinessDays(
      new Date(2025, 5, 2),
      new Date(2025, 5, 6),
    )).toBe(4)
  })

  it('月曜から翌週月曜までは 5 営業日', () => {
    expect(diffInBusinessDays(
      new Date(2025, 5, 2),
      new Date(2025, 5, 9),
    )).toBe(5)
  })

  it('end が start より前の場合、負の値を返す', () => {
    expect(diffInBusinessDays(
      new Date(2025, 5, 6),
      new Date(2025, 5, 2),
    )).toBe(-4)
  })

  it('祝日を含む期間は祝日分を除外する', () => {
    // 2025-04-28(月) → 2025-05-02(金): 04-29昭和の日を除外 → 3営業日
    expect(diffInBusinessDays(
      new Date(2025, 3, 28),
      new Date(2025, 4, 2),
    )).toBe(3)
  })

  it('週末のみの期間は 0 営業日', () => {
    expect(diffInBusinessDays(
      new Date(2025, 5, 7), // 土曜
      new Date(2025, 5, 8), // 日曜
    )).toBe(0)
  })

  it('開始日または終了日が無効な場合エラーになる', () => {
    expect(() => diffInBusinessDays(new Date('invalid'), new Date(2025, 5, 2))).toThrow('開始日が無効')
    expect(() => diffInBusinessDays(new Date(2025, 5, 2), new Date('invalid'))).toThrow('終了日が無効')
  })
})

// ---------------------------------------------------------------------------
// getQuarter
// ---------------------------------------------------------------------------
describe('getQuarter', () => {
  it('1月はQ1', () => {
    expect(getQuarter(new Date(2025, 0, 15))).toBe(1)
  })

  it('3月末はQ1', () => {
    expect(getQuarter(new Date(2025, 2, 31))).toBe(1)
  })

  it('4月はQ2', () => {
    expect(getQuarter(new Date(2025, 3, 1))).toBe(2)
  })

  it('Q2/Q3 の境界: 6月末はQ2、7月初はQ3', () => {
    expect(getQuarter(new Date(2025, 5, 30))).toBe(2)
    expect(getQuarter(new Date(2025, 6, 1))).toBe(3)
  })

  it('Q3/Q4 の境界: 9月末はQ3、10月初はQ4', () => {
    expect(getQuarter(new Date(2025, 8, 30))).toBe(3)
    expect(getQuarter(new Date(2025, 9, 1))).toBe(4)
  })

  it('12月はQ4', () => {
    expect(getQuarter(new Date(2025, 11, 31))).toBe(4)
  })

  it('無効な日付を渡すとエラーになる', () => {
    expect(() => getQuarter(new Date('invalid'))).toThrow('無効な日付')
  })
})

// ---------------------------------------------------------------------------
// getFiscalYear
// ---------------------------------------------------------------------------
describe('getFiscalYear', () => {
  it('4月1日は当年の年度', () => {
    expect(getFiscalYear(new Date(2025, 3, 1))).toBe(2025)
  })

  it('3月31日は前年の年度', () => {
    expect(getFiscalYear(new Date(2026, 2, 31))).toBe(2025)
  })

  it('年度境界の前後で年度が切り替わる', () => {
    expect(getFiscalYear(new Date(2025, 2, 31))).toBe(2024)
    expect(getFiscalYear(new Date(2025, 3, 1))).toBe(2025)
  })

  it('1月は前年の年度', () => {
    expect(getFiscalYear(new Date(2026, 0, 1))).toBe(2025)
  })

  it('12月は当年の年度', () => {
    expect(getFiscalYear(new Date(2025, 11, 31))).toBe(2025)
  })

  it('年末年始をまたいでも同一年度', () => {
    const dec = getFiscalYear(new Date(2025, 11, 31))
    const jan = getFiscalYear(new Date(2026, 0, 1))
    expect(dec).toBe(jan)
    expect(dec).toBe(2025)
  })

  it('無効な日付を渡すとエラーになる', () => {
    expect(() => getFiscalYear(new Date('invalid'))).toThrow('無効な日付')
  })
})

// ---------------------------------------------------------------------------
// isLeapYear
// ---------------------------------------------------------------------------
describe('isLeapYear', () => {
  it('4で割り切れる年はうるう年', () => {
    expect(isLeapYear(2024)).toBe(true)
    expect(isLeapYear(2028)).toBe(true)
  })

  it('4で割り切れない年はうるう年ではない', () => {
    expect(isLeapYear(2025)).toBe(false)
    expect(isLeapYear(2023)).toBe(false)
  })

  it('100で割り切れる年はうるう年ではない', () => {
    expect(isLeapYear(1900)).toBe(false)
    expect(isLeapYear(2100)).toBe(false)
  })

  it('400で割り切れる年はうるう年', () => {
    expect(isLeapYear(2000)).toBe(true)
    expect(isLeapYear(1600)).toBe(true)
  })

  it('0年・負の年でも判定できる', () => {
    expect(isLeapYear(0)).toBe(true)
    expect(isLeapYear(-4)).toBe(true)
    expect(isLeapYear(-1)).toBe(false)
  })

  it('小数を渡すとエラーになる', () => {
    expect(() => isLeapYear(2024.5)).toThrow('整数')
  })

  it('NaN を渡すとエラーになる', () => {
    expect(() => isLeapYear(NaN)).toThrow('整数')
  })
})

// ---------------------------------------------------------------------------
// getLastDayOfMonth
// ---------------------------------------------------------------------------
describe('getLastDayOfMonth', () => {
  it('31日の月を正しく返す', () => {
    expect(getLastDayOfMonth(2025, 1)).toBe(31)
    expect(getLastDayOfMonth(2025, 7)).toBe(31)
    expect(getLastDayOfMonth(2025, 12)).toBe(31)
  })

  it('30日の月を正しく返す', () => {
    expect(getLastDayOfMonth(2025, 4)).toBe(30)
    expect(getLastDayOfMonth(2025, 6)).toBe(30)
    expect(getLastDayOfMonth(2025, 9)).toBe(30)
    expect(getLastDayOfMonth(2025, 11)).toBe(30)
  })

  it('平年の2月は28日', () => {
    expect(getLastDayOfMonth(2025, 2)).toBe(28)
  })

  it('うるう年の2月は29日', () => {
    expect(getLastDayOfMonth(2024, 2)).toBe(29)
  })

  it('100年・400年周期のうるう年判定が2月末日に反映される', () => {
    expect(getLastDayOfMonth(1900, 2)).toBe(28)  // 100年周期: 平年
    expect(getLastDayOfMonth(2000, 2)).toBe(29)  // 400年周期: うるう年
  })

  it('月が範囲外・小数の場合エラーになる', () => {
    expect(() => getLastDayOfMonth(2025, 0)).toThrow('月が範囲外')
    expect(() => getLastDayOfMonth(2025, 13)).toThrow('月が範囲外')
    expect(() => getLastDayOfMonth(2025.5, 1)).toThrow('整数')
    expect(() => getLastDayOfMonth(2025, 1.5)).toThrow('整数')
  })
})

// ---------------------------------------------------------------------------
// 関数間の整合性
// ---------------------------------------------------------------------------
describe('関数間の整合性', () => {
  it('formatDate と parseDate のラウンドトリップが一致する', () => {
    const original = new Date(2025, 0, 31)
    const parsed = parseDate(formatDate(original))
    expect(parsed.getFullYear()).toBe(2025)
    expect(parsed.getMonth()).toBe(0)
    expect(parsed.getDate()).toBe(31)
  })

  it('うるう年 2月29日 のラウンドトリップが一致する', () => {
    const formatted = formatDate(new Date(2024, 1, 29))
    expect(formatted).toBe('2024-02-29')
    expect(parseDate(formatted).getDate()).toBe(29)
  })

  it('addBusinessDays の結果を formatDate で文字列化できる', () => {
    const result = addBusinessDays(new Date(2025, 5, 2), 5)
    expect(formatDate(result)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('diffInBusinessDays と addBusinessDays の整合性', () => {
    const start = new Date(2025, 5, 2) // 月曜
    const end = addBusinessDays(start, 10)
    expect(diffInBusinessDays(start, end)).toBe(10)
  })
})
