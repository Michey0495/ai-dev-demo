// 注文処理システムの型定義

export interface OrderItem {
  productId: string
  productName: string
  unitPrice: number  // 税抜単価
  quantity: number
}

export interface Coupon {
  code: string
  discountRate: number  // 0.0 ~ 1.0（例: 0.2 = 20%OFF）
  minOrderAmount: number
}

export interface Order {
  orderId: string
  userId: string
  items: OrderItem[]
  pointsUsed: number      // 利用ポイント数（1ポイント=1円）
  coupon: Coupon | null
  orderDate: Date
}

export interface OrderResult {
  orderId: string
  subtotal: number       // 商品合計（税抜）
  taxAmount: number      // 税額
  totalWithTax: number   // 税込合計（割引前）
  pointDiscount: number  // ポイント値引き額
  couponDiscount: number // クーポン値引き額
  finalAmount: number    // 最終請求額
}

export interface DiscountBreakdown {
  couponDiscount: number
  pointDiscount: number
  finalAmount: number
}

export interface TaxRate {
  rate: number
  effectiveFrom: Date
}
