import { Express } from "express";
import { productRouter } from "./products";
import { orderRouter } from "./orders";
import { authRouter } from "./auth";
import { categoryRouter } from "./categories";

export function registerRoutes(app: Express): void {
  app.use("/api/auth", authRouter);
  app.use("/api/products", productRouter);
  app.use("/api/orders", orderRouter);
  app.use("/api/categories", categoryRouter);
}
