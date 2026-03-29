// 税率計算モジュール
// 注文日に基づいて適用税率を決定し、税額を計算する

import { TAX_RATE_HISTORY } from './config'

// 注文日時点の税率を取得する
export function getTaxRate(orderDate: Date): number {
  // 適用開始日の降順でソートし、注文日以前で最も新しい税率を返す
  const sorted = [...TAX_RATE_HISTORY].sort(
    (a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime()
  )

  for (const entry of sorted) {
    if (orderDate >= entry.effectiveFrom) {
      return entry.rate
    }
  }

  // どの税率にも該当しない場合はデフォルト8%
  return 0.08
}

// 税抜金額に税率を適用して税額を返す
export function calculateTax(preTaxAmount: number, taxRate: number): number {
  return Math.floor(preTaxAmount * taxRate)
}

// 税込金額を計算する
export function calculateAmountWithTax(preTaxAmount: number, taxRate: number): number {
  return preTaxAmount + calculateTax(preTaxAmount, taxRate)
}
