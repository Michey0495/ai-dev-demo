export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export type UserRole = "customer" | "admin";

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ProductCreateInput {
  name: string;
  description?: string;
  price: number;
  stock: number;
  categoryId: string;
  sku?: string;
  weight?: number;
  tags?: string[];
}

export interface OrderCreateInput {
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  shippingAddress: string;
  couponCode?: string;
}

export interface AuthRegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface AuthLoginInput {
  email: string;
  password: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface ShippingRate {
  method: string;
  fee: number;
  estimatedDays: number;
}
