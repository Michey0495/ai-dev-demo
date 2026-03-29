// 割引処理モジュール
// ポイント利用とクーポン適用を扱う
//
// 仕様:
//   ポイント: 税込金額から差し引く（1ポイント = 1円）
//   クーポン: 税込金額に対して割引率を適用
//   併用時の適用順: クーポン → ポイント
//     （クーポンは税込金額全体に対する割引率、ポイントは固定額控除）

import { Coupon, DiscountBreakdown } from './types'
import { POINT_VALUE, MAX_COUPON_DISCOUNT_RATE } from './config'

// ポイント値引き額を計算する
// ポイントは税込金額に対して適用する（1ポイント=1円をそのまま引く）
export function calculatePointDiscount(
  amount: number,
  pointsUsed: number
): number {
  if (pointsUsed <= 0) return 0

  const pointValue = pointsUsed * POINT_VALUE

  // 金額を超えるポイント利用は不可
  return Math.min(pointValue, amount)
}

// クーポン値引き額を計算する
// クーポンは税込金額に対して割引率を適用する
export function calculateCouponDiscount(
  amountWithTax: number,
  coupon: Coupon | null
): number {
  if (!coupon) return 0

  // 最低注文金額チェック
  if (amountWithTax < coupon.minOrderAmount) return 0

  // 割引率の上限チェック
  const effectiveRate = Math.min(coupon.discountRate, MAX_COUPON_DISCOUNT_RATE)

  return Math.floor(amountWithTax * effectiveRate)
}

// 全割引を一括適用する（仕様準拠の適用順序）
// クーポン（税込金額全体ベース） → ポイント（固定額控除）の順
export function applyAllDiscounts(
  totalWithTax: number,
  pointsUsed: number,
  coupon: Coupon | null
): DiscountBreakdown {
  const couponDiscount = calculateCouponDiscount(totalWithTax, coupon)
  const afterCoupon = totalWithTax - couponDiscount

  const pointDiscount = calculatePointDiscount(afterCoupon, pointsUsed)
  const finalAmount = afterCoupon - pointDiscount

  return { couponDiscount, pointDiscount, finalAmount }
}

// ポイントの残高チェック（利用可能かどうかの事前検証）
export function validatePointBalance(
  availablePoints: number,
  requestedPoints: number
): boolean {
  return requestedPoints >= 0 && requestedPoints <= availablePoints
}
