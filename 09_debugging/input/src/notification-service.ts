// 通知サービス
// 注文完了時のメール送信・Slack通知を担当する

import { OrderResult } from './types'

// 注文確認メールを送信する
export async function sendOrderConfirmation(
  userId: string,
  result: OrderResult
): Promise<void> {
  console.log(
    `[notification] 注文確認メール送信: userId=${userId}, orderId=${result.orderId}, 金額=${result.finalAmount}円`
  )
}

// エラー発生時にSlackへ通知する
export async function notifyError(
  orderId: string,
  error: Error
): Promise<void> {
  console.error(
    `[notification] Slack通知: orderId=${orderId}, error=${error.message}`
  )
}
