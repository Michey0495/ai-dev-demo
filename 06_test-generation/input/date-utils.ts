// date-utils.ts
// 日付計算ユーティリティ - 営業日計算・和暦年度対応

// 日本の祝日（簡易版: 固定祝日のみ）
const JAPANESE_HOLIDAYS: Record<string, string> = {
  '01-01': '元日',
  '01-08': '成人の日',       // 1月第2月曜（ここでは簡易的に固定）
  '02-11': '建国記念の日',
  '02-23': '天皇誕生日',
  '03-20': '春分の日',       // 年によって変動するが簡易的に固定
  '04-29': '昭和の日',
  '05-03': '憲法記念日',
  '05-04': 'みどりの日',
  '05-05': 'こどもの日',
  '07-15': '海の日',         // 7月第3月曜（簡易的に固定）
  '08-11': '山の日',
  '09-16': '敬老の日',       // 9月第3月曜（簡易的に固定）
  '09-22': '秋分の日',       // 年によって変動するが簡易的に固定
  '10-14': 'スポーツの日',   // 10月第2月曜（簡易的に固定）
  '11-03': '文化の日',
  '11-23': '勤労感謝の日',
}

type DateFormat = 'yyyy-MM-dd' | 'yyyy/MM/dd' | 'MM/dd' | 'yyyy年MM月dd日'

/**
 * 日付を指定フォーマットの文字列に変換する
 */
export function formatDate(date: Date, format: DateFormat = 'yyyy-MM-dd'): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('無効な日付が渡されました')
  }

  const year = date.getFullYear().toString()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')

  switch (format) {
    case 'yyyy-MM-dd':
      return `${year}-${month}-${day}`
    case 'yyyy/MM/dd':
      return `${year}/${month}/${day}`
    case 'MM/dd':
      return `${month}/${day}`
    case 'yyyy年MM月dd日':
      return `${year}年${month}月${day}日`
    default:
      throw new Error(`未対応のフォーマット: ${format}`)
  }
}

/**
 * 文字列から Date オブジェクトを生成する
 * 対応形式: yyyy-MM-dd, yyyy/MM/dd
 */
export function parseDate(str: string): Date {
  if (!str || typeof str !== 'string') {
    throw new Error('日付文字列が空またはstring型ではありません')
  }

  const normalized = str.replace(/\//g, '-')
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)

  if (!match) {
    throw new Error(`パースできない日付形式です: ${str}`)
  }

  const [, yearStr, monthStr, dayStr] = match
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)

  if (month < 1 || month > 12) {
    throw new Error(`月が範囲外です: ${month}`)
  }

  const lastDay = getLastDayOfMonth(year, month)
  if (day < 1 || day > lastDay) {
    throw new Error(`日が範囲外です: ${year}年${month}月${day}日`)
  }

  return new Date(year, month - 1, day)
}

/**
 * 営業日を加算する（土日をスキップ）
 * 祝日もスキップ対象
 */
export function addBusinessDays(date: Date, days: number): Date {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('無効な日付が渡されました')
  }
  if (!Number.isInteger(days)) {
    throw new Error('営業日数は整数で指定してください')
  }

  const result = new Date(date)
  let remaining = Math.abs(days)
  const direction = days >= 0 ? 1 : -1

  while (remaining > 0) {
    result.setDate(result.getDate() + direction)
    const dayOfWeek = result.getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday(result)) {
      remaining--
    }
  }

  return result
}

/**
 * 指定日が日本の祝日かどうか判定する
 * 振替休日にも対応: 祝日が日曜の場合、翌月曜が振替休日
 */
export function isHoliday(date: Date): boolean {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('無効な日付が渡されました')
  }

  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const key = `${month}-${day}`

  // その日自体が祝日
  if (JAPANESE_HOLIDAYS[key]) {
    return true
  }

  // 振替休日の判定: 前日が日曜かつ祝日なら、この月曜は振替休日
  if (date.getDay() === 1) {
    const yesterday = new Date(date)
    yesterday.setDate(yesterday.getDate() - 1)
    const yMonth = (yesterday.getMonth() + 1).toString().padStart(2, '0')
    const yDay = yesterday.getDate().toString().padStart(2, '0')
    const yKey = `${yMonth}-${yDay}`
    if (JAPANESE_HOLIDAYS[yKey] && yesterday.getDay() === 0) {
      return true
    }
  }

  return false
}

/**
 * 指定日の翌営業日を返す
 */
export function getNextBusinessDay(date: Date): Date {
  return addBusinessDays(date, 1)
}

/**
 * 2つの日付間の営業日数を計算する
 * start と end が同日なら 0 を返す
 */
export function diffInBusinessDays(start: Date, end: Date): number {
  if (!(start instanceof Date) || isNaN(start.getTime())) {
    throw new Error('開始日が無効です')
  }
  if (!(end instanceof Date) || isNaN(end.getTime())) {
    throw new Error('終了日が無効です')
  }

  const startNorm = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const endNorm = new Date(end.getFullYear(), end.getMonth(), end.getDate())

  if (startNorm.getTime() === endNorm.getTime()) {
    return 0
  }

  const direction = endNorm > startNorm ? 1 : -1
  let count = 0
  const cursor = new Date(startNorm)

  while (true) {
    cursor.setDate(cursor.getDate() + direction)
    const dayOfWeek = cursor.getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday(cursor)) {
      count++
    }
    if (cursor.getTime() === endNorm.getTime()) {
      break
    }
  }

  return count * direction
}

/**
 * 指定日の四半期を返す（1-4）
 * Q1: 1-3月, Q2: 4-6月, Q3: 7-9月, Q4: 10-12月
 */
export function getQuarter(date: Date): number {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('無効な日付が渡されました')
  }
  return Math.ceil((date.getMonth() + 1) / 3)
}

/**
 * 日本の会計年度を返す（4月始まり）
 * 2025年4月 -> 2025年度、2026年3月 -> 2025年度
 */
export function getFiscalYear(date: Date): number {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('無効な日付が渡されました')
  }
  const month = date.getMonth() + 1
  const year = date.getFullYear()
  return month >= 4 ? year : year - 1
}

/**
 * うるう年かどうかを判定する
 */
export function isLeapYear(year: number): boolean {
  if (!Number.isInteger(year)) {
    throw new Error('年は整数で指定してください')
  }
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/**
 * 指定した年月の末日を返す
 */
export function getLastDayOfMonth(year: number, month: number): number {
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new Error('年と月は整数で指定してください')
  }
  if (month < 1 || month > 12) {
    throw new Error(`月が範囲外です: ${month}`)
  }
  // 翌月の0日目 = 当月の末日
  return new Date(year, month, 0).getDate()
}
