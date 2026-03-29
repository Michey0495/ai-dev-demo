// 設定定数

// 税率変更履歴
export const TAX_RATE_HISTORY = [
  { rate: 0.08, effectiveFrom: new Date('2019-10-01') },
  { rate: 0.10, effectiveFrom: new Date('2025-10-01') },
] as const

// ポイント関連
export const POINT_VALUE = 1  // 1ポイント = 1円

// クーポン設定
export const MAX_COUPON_DISCOUNT_RATE = 0.5  // クーポン最大割引率50%

// 割引適用順序（仕様: クーポン率割引を先に適用し、ポイント固定額控除を後に適用する）
export const DISCOUNT_APPLICATION_ORDER = ['coupon', 'point'] as const
export type DiscountType = typeof DISCOUNT_APPLICATION_ORDER[number]

// 金額検証の許容誤差（円）
export const AMOUNT_TOLERANCE = 0

// データベース接続
export const DB_HOST = 'localhost'
export const DB_PORT = 5432
export const DB_NAME = 'order_db'
