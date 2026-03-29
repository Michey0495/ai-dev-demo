// 注文処理サービス
// 注文の受付から金額計算・保存・通知までを統括する

import { Order, OrderResult } from './types'
import { getTaxRate, calculateTax } from './tax-calculator'
import {
  calculatePointDiscount,
  calculateCouponDiscount,
  applyAllDiscounts,
} from './discount-service'
import { saveOrder } from './order-repository'
import { sendOrderConfirmation } from './notification-service'
import { AMOUNT_TOLERANCE } from './config'

// 注文を処理する
export async function processOrder(order: Order): Promise<OrderResult> {
  // 商品合計（税抜）を算出
  const subtotal = order.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity, 0
  )

  const result = calculateTotal(subtotal, order)

  // 金額の整合性チェック（独立した検証ロジックと突合）
  const expectedFinal = verifyAmount(subtotal, order)
  const diff = Math.abs(result.finalAmount - expectedFinal)
  if (diff > AMOUNT_TOLERANCE) {
    throw new Error(
      `金額不整合エラー: 期待値 ${expectedFinal.toLocaleString()}円 / 実際 ${result.finalAmount.toLocaleString()}円`
    )
  }

  await saveOrder(result)
  await sendOrderConfirmation(order.userId, result)

  return result
}

// 合計金額を計算する
function calculateTotal(subtotal: number, order: Order): OrderResult {
  const taxRate = getTaxRate(order.orderDate)
  const taxAmount = calculateTax(subtotal, taxRate)
  const totalWithTax = subtotal + taxAmount

  // ポイント値引き（税込金額から差し引く）
  const pointDiscount = calculatePointDiscount(totalWithTax, order.pointsUsed)
  const afterPoints = totalWithTax - pointDiscount

  // クーポン値引き（税込金額に対して割引率を適用）
  const couponDiscount = calculateCouponDiscount(afterPoints, order.coupon)

  const finalAmount = afterPoints - couponDiscount

  return {
    orderId: order.orderId,
    subtotal,
    taxAmount,
    totalWithTax,
    pointDiscount,
    couponDiscount,
    finalAmount,
  }
}

// 検証用: 仕様どおりの計算で金額を算出する
// discount-service.ts の applyAllDiscounts に委譲
function verifyAmount(subtotal: number, order: Order): number {
  const taxRate = getTaxRate(order.orderDate)
  const taxAmount = calculateTax(subtotal, taxRate)
  const totalWithTax = subtotal + taxAmount

  const { finalAmount } = applyAllDiscounts(
    totalWithTax, order.pointsUsed, order.coupon
  )
  return finalAmount
}
