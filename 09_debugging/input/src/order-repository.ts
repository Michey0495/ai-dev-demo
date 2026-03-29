// 注文データベース操作
// 注文結果の永続化を担当する

import { OrderResult } from './types'

// 注文結果をデータベースに保存する
export async function saveOrder(result: OrderResult): Promise<void> {
  // 実際にはDBへのINSERT処理が入る
  console.log(
    `[order-repository] 注文保存: ${result.orderId}, 最終金額=${result.finalAmount}円`
  )
}

// 注文IDで注文結果を取得する
export async function findOrderById(orderId: string): Promise<OrderResult | null> {
  // 実際にはDBへのSELECT処理が入る
  console.log(`[order-repository] 注文検索: ${orderId}`)
  return null
}
