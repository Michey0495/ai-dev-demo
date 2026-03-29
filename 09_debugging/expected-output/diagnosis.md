# 診断結果: 注文金額不整合エラー

## 1. ログ全件の分類

エラーログ25件を条件別に分類した。

| 条件 | 件数 | エラー |
|------|------|--------|
| 割引なし | 6件 (928-001,007 / 1001-001,008,014 / 1001-017は除外、下記) | 0 |
| ポイントのみ | 7件 (928-002,004,006 / 1001-002,005,009,011,015,017) | 0 |
| クーポンのみ | 5件 (928-003,005 / 1001-003,006,012,018) | 0 |
| ポイント+クーポン併用 | 6件 (1001-004,007,010,013,016 / 1002-001) | 6 |

補正: ORD-20251001-017はポイント1500+クーポンなしなのでポイントのみに分類。

エラー発生率は併用注文で100%。ポイント単独・クーポン単独では1件もエラーが出ていない。

9/28以前にポイント+クーポン併用注文が1件も存在しない点にも注目する。10/1のキャンペーン開始でクーポン配布が増え、ポイント保有ユーザーとの併用が初めて発生した。バグは税率変更で生まれたのではなく、以前から潜伏していた。

## 2. 差額の法則性

エラー6件の差額を分解する。

| 注文ID | ポイント利用 | クーポン率 | ポイントxクーポン率 | ログ差額 | 一致 |
|--------|-------------|-----------|-------------------|---------|------|
| 1001-004 | 300 | 0.20 | 60 | 60 | o |
| 1001-007 | 500 | 0.10 | 50 | 50 | o |
| 1001-010 | 1000 | 0.20 | 200 | 200 | o |
| 1001-013 | 200 | 0.10 | 20 | 20 | o |
| 1001-016 | 600 | 0.20 | 120 | 120 | o |
| 1002-001 | 400 | 0.20 | 80 | 80 | o |

全件で差額 = ポイント利用額 x クーポン割引率が成立する。偶然の一致ではない。

## 3. 根本原因

order-service.ts内に2つの金額計算パスが存在する。

calculateTotal（39行目〜）:
  ポイント差引 → クーポン適用の順。
  calculateCouponDiscountに渡す引数がafterPoints（ポイント差引後の残額）。

verifyAmount（65行目〜）:
  discount-service.tsのapplyAllDiscountsに委譲。
  applyAllDiscountsはクーポン適用 → ポイント差引の順。
  calculateCouponDiscountに渡す引数がtotalWithTax（税込金額全体）。

discount-service.tsの仕様コメント（1〜8行目）にこう書かれている。

  併用時の適用順: クーポン → ポイント
  （クーポンは税込金額全体に対する割引率、ポイントは固定額控除）

applyAllDiscounts関数（47行目〜）もこの仕様を実装している。config.tsのDISCOUNT_APPLICATION_ORDER定数も['coupon', 'point']と定義されている。

calculateTotalだけが仕様に反している。関数のコメント（48行目）は「税込金額に対して割引率を適用」と書いてあるが、実際にはafterPoints（ポイント差引後）を渡している。コメントとコードの乖離。

## 4. 数式による証明

変数を定義する。

  T = 税込金額（totalWithTax）
  P = ポイント利用額（pointsUsed）
  r = クーポン割引率（discountRate）

端数処理（Math.floor）は無視して近似する。

calculateTotalの計算（バグあり）:
  クーポン割引 = (T - P) * r
  最終金額 = (T - P) - (T - P) * r = (T - P)(1 - r)

verifyAmountの計算（仕様準拠）:
  クーポン割引 = T * r
  クーポン後 = T - T * r = T(1 - r)
  最終金額 = T(1 - r) - P

差額:
  (T - P)(1 - r) - (T(1 - r) - P)
  = T - P - Tr + Pr - T + Tr + P
  = Pr

差額 = P * r（ポイント利用額 x クーポン割引率）

Math.floorの影響で厳密には +-1円の誤差が出うるが、今回の6件はすべてPとrの積が整数になるため、完全一致する。

## 5. 検算（ORD-20251001-010）

商品合計=8,000円、税率10%、ポイント=1,000、クーポン=CP-AUTUMN20(20%OFF)

calculateTotal:
  taxAmount = floor(8000 * 0.10) = 800
  totalWithTax = 8,800
  pointDiscount = calculatePointDiscount(8800, 1000) = 1,000
  afterPoints = 8,800 - 1,000 = 7,800
  couponDiscount = calculateCouponDiscount(7800, coupon) = floor(7800 * 0.2) = 1,560
  finalAmount = 7,800 - 1,560 = 6,240

verifyAmount (applyAllDiscounts):
  couponDiscount = calculateCouponDiscount(8800, coupon) = floor(8800 * 0.2) = 1,760
  afterCoupon = 8,800 - 1,760 = 7,040
  pointDiscount = calculatePointDiscount(7040, 1000) = 1,000
  finalAmount = 7,040 - 1,000 = 6,040

差額 = 6,240 - 6,040 = 200 = 1000 * 0.20。ログと一致する。

注目すべき点: 両方ともcalculateCouponDiscountという同じ関数を呼んでいる。関数自体にバグはない。渡される引数が違う。calculateTotalは7,800を渡し、verifyAmountは8,800を渡す。この引数の差がポイント利用額の1,000に等しい。

## 6. なぜ単体テストで検出できなかったか

calculateCouponDiscountを単体テストすると、任意の入力に対して正しい値を返す。テストは通る。

calculatePointDiscountも同様。単体では正常。

calculateTotalをテストする場合も、ポイントだけ・クーポンだけの注文では正しい結果が出る。理由は明快で、ポイント=0ならafterPoints=totalWithTaxとなり引数の差が消える。クーポン=nullならcouponDiscount=0で適用順序が無関係になる。

単体テストで両方の割引を同時に使うケースを書かない限り、このバグは顕在化しない。結合テスト、あるいはプロパティベーステストで「併用」のパラメータ空間をカバーする必要があった。

## 7. 副次的な問題

pricing-engine.ts（38行目〜）のvalidateCouponEligibilityがsubtotal（税抜）でクーポン適用可否を判定している一方、discount-service.tsのcalculateCouponDiscountはamountWithTax（税込）で最低注文金額を判定する。判定基準が異なる。今回のエラー注文はいずれもminOrderAmountを大きく超えているため影響はないが、境界付近の注文で「バリデーションは通ったのにクーポンが適用されない」事象が起きうる。

config.tsのDISCOUNT_APPLICATION_ORDERが定義されているが、calculateTotalから参照されていない。仕様定数が実装と乖離している状態。

## 8. 修正コード

calculateTotal関数を修正する。applyAllDiscountsを使う方法と、個別関数を正しい順序で呼ぶ方法の2案がある。

案A: applyAllDiscountsに委譲する（推奨）

```typescript
function calculateTotal(subtotal: number, order: Order): OrderResult {
  const taxRate = getTaxRate(order.orderDate)
  const taxAmount = calculateTax(subtotal, taxRate)
  const totalWithTax = subtotal + taxAmount

  const { couponDiscount, pointDiscount, finalAmount } = applyAllDiscounts(
    totalWithTax, order.pointsUsed, order.coupon
  )

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
```

applyAllDiscountsを使えば、割引の適用順序を一元管理できる。calculateTotalとverifyAmountが同一関数を呼ぶ構造になるため、今後の仕様変更でも乖離が起きない。

案B: 個別関数を正しい順序で呼ぶ

```typescript
function calculateTotal(subtotal: number, order: Order): OrderResult {
  const taxRate = getTaxRate(order.orderDate)
  const taxAmount = calculateTax(subtotal, taxRate)
  const totalWithTax = subtotal + taxAmount

  // クーポンを税込金額全体に対して適用
  const couponDiscount = calculateCouponDiscount(totalWithTax, order.coupon)
  const afterCoupon = totalWithTax - couponDiscount

  // ポイントをクーポン適用後の金額から差し引く
  const pointDiscount = calculatePointDiscount(afterCoupon, order.pointsUsed)
  const finalAmount = afterCoupon - pointDiscount

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
```

案Aを推奨する理由: 割引ロジックの重複実装を排除できる。verifyAmount関数自体も、calculateTotalがapplyAllDiscountsを使うなら存在意義がなくなり、削除してテストコードに置き換えられる。

## 9. 追加対応

- verifyAmount関数の廃止を検討する。二重実装は「どちらが正しいか」問題の温床になる。金額検証はユニットテストとE2Eテストで担保する方が健全
- ポイント+クーポン併用のテストケースを追加する。パラメータとしてpointsUsed > 0 かつ coupon != null の組み合わせを必ず含める
- pricing-engine.tsのvalidateCouponEligibilityの判定基準を税込金額に統一する（calculateCouponDiscountと同じ基準にする）
- config.tsのDISCOUNT_APPLICATION_ORDERを実際にapplyAllDiscounts内で参照するか、定数を削除して関数のコメントに集約する
- 本番で差額が発生した6件の注文について、正しい金額との差額を返金処理する
