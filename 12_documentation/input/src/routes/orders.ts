import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validation";
import { BadRequestError, NotFoundError } from "../utils/errors";
import { OrderStatus } from "../types";
import { calculateSubtotalWithTax, calculateShippingFee, isEligibleForFreeShipping } from "../utils/tax";

const orderRouter = Router();

const createOrderSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive().max(99),
    })
  ).min(1).max(50),
  shippingAddress: z.string().min(1).max(500),
  couponCode: z.string().max(20).optional(),
});

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

orderRouter.get("/", authenticate, async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const status = req.query.status as OrderStatus | undefined;

  const where = {
    userId: req.user!.id,
    ...(status && { status }),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { items: { include: { product: true } } },
    }),
    prisma.order.count({ where }),
  ]);

  res.json({
    data: orders,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

orderRouter.get("/:id", authenticate, async (req: Request, res: Response) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: { items: { include: { product: true } } },
  });

  if (!order) throw new NotFoundError("Order");

  res.json(order);
});

orderRouter.post(
  "/",
  authenticate,
  validate(createOrderSchema),
  async (req: Request, res: Response) => {
    const { items, shippingAddress, couponCode } = req.body;

    const products = await prisma.product.findMany({
      where: { id: { in: items.map((i: { productId: string }) => i.productId) } },
    });

    let subtotal = 0;
    let totalWeight = 0;

    for (const item of items as Array<{ productId: string; quantity: number }>) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) throw new NotFoundError("Product");
      if (product.stock < item.quantity) {
        throw new BadRequestError(
          `Insufficient stock for ${product.name}`,
          "INSUFFICIENT_STOCK"
        );
      }
      subtotal += product.price * item.quantity;
      totalWeight += (product.weight ?? 0) * item.quantity;
    }

    let discount = 0;
    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({
        where: { code: couponCode },
      });
      if (coupon && coupon.active && new Date() < coupon.expiresAt) {
        discount = coupon.type === "percentage"
          ? Math.floor(subtotal * coupon.value / 100)
          : coupon.value;
      }
    }

    const adjustedSubtotal = Math.max(0, subtotal - discount);
    const { tax, total: totalWithTax } = calculateSubtotalWithTax(adjustedSubtotal);
    const shippingFee = isEligibleForFreeShipping(adjustedSubtotal)
      ? 0
      : calculateShippingFee(totalWeight);
    const totalAmount = totalWithTax + shippingFee;

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId: req.user!.id,
          status: "pending",
          subtotal: adjustedSubtotal,
          tax,
          shippingFee,
          discount,
          totalAmount,
          shippingAddress,
          couponCode: couponCode ?? null,
          items: {
            create: items.map((item: { productId: string; quantity: number }) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: products.find((p) => p.id === item.productId)!.price,
            })),
          },
        },
        include: { items: { include: { product: true } } },
      });

      for (const item of items as Array<{ productId: string; quantity: number }>) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      return created;
    });

    res.status(201).json(order);
  }
);

orderRouter.patch(
  "/:id/status",
  authenticate,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const { status } = req.body as { status: OrderStatus };

    const order = await prisma.order.findFirst({
      where: { id: req.params.id },
    });

    if (!order) throw new NotFoundError("Order");

    const allowed = STATUS_TRANSITIONS[order.status as OrderStatus];
    if (!allowed.includes(status)) {
      throw new BadRequestError(
        `Cannot transition from "${order.status}" to "${status}"`,
        "INVALID_STATUS_TRANSITION"
      );
    }

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
      include: { items: { include: { product: true } } },
    });

    res.json(updated);
  }
);

orderRouter.get(
  "/:id/cancel",
  authenticate,
  async (req: Request, res: Response) => {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });

    if (!order) throw new NotFoundError("Order");

    const allowed = STATUS_TRANSITIONS[order.status as OrderStatus];
    if (!allowed.includes("cancelled")) {
      throw new BadRequestError(
        `Cannot cancel order in "${order.status}" status`,
        "CANCEL_NOT_ALLOWED"
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const cancelled = await tx.order.update({
        where: { id: req.params.id },
        data: { status: "cancelled" },
        include: { items: true },
      });

      for (const item of cancelled.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      return cancelled;
    });

    res.json(updated);
  }
);

export { orderRouter };
