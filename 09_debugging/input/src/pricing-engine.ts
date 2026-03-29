// 価格計算パイプライン
// 注文データのバリデーションから金額計算までの一連の流れを実行する

import { Order, OrderResult } from './types'
import { processOrder } from './order-service'

// バリデーションを実行した上で注文処理に渡す
export async function execute(order: Order): Promise<OrderResult> {
  validateOrder(order)
  validateCouponEligibility(order)
  return processOrder(order)
}

// 注文データの基本バリデーション
function validateOrder(order: Order): void {
  if (!order.items || order.items.length === 0) {
    throw new Error('注文に商品が含まれていません')
  }

  if (order.pointsUsed < 0) {
    throw new Error('ポイント利用数が不正です')
  }

  for (const item of order.items) {
    if (item.unitPrice < 0 || item.quantity <= 0) {
      throw new Error(`商品データが不正です: ${item.productId}`)
    }
  }

  if (order.coupon && (order.coupon.discountRate < 0 || order.coupon.discountRate > 1)) {
    throw new Error(`クーポン割引率が不正です: ${order.coupon.code}`)
  }
}

// クーポン利用可否の事前チェック
// 税抜の商品合計がクーポンの最低注文金額を下回っていないか検証する
function validateCouponEligibility(order: Order): void {
  if (!order.coupon) return

  const subtotal = order.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity, 0
  )

  if (subtotal < order.coupon.minOrderAmount) {
    throw new Error(
      `クーポン最低注文金額未達: ${order.coupon.code} (最低${order.coupon.minOrderAmount.toLocaleString()}円, 注文${subtotal.toLocaleString()}円)`
    )
  }
}
