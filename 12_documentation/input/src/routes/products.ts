import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validation";
import { NotFoundError } from "../utils/errors";

const productRouter = Router();

const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.number().positive(),
  stock: z.number().int().min(0),
  categoryId: z.string().uuid(),
  sku: z.string().max(50).optional(),
  weight: z.number().positive().optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
});

const updateProductSchema = createProductSchema.partial();

productRouter.get("/", async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const category = req.query.category as string | undefined;
  const search = req.query.search as string | undefined;
  const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
  const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;
  const sort = (req.query.sort as string) ?? "createdAt";
  const order = (req.query.order as string) ?? "desc";

  const where = {
    ...(category && { categoryId: category }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { description: { contains: search, mode: "insensitive" as const } },
      ],
    }),
    ...(minPrice !== undefined || maxPrice !== undefined
      ? {
          price: {
            ...(minPrice !== undefined && { gte: minPrice }),
            ...(maxPrice !== undefined && { lte: maxPrice }),
          },
        }
      : {}),
  };

  const allowedSortFields = ["createdAt", "price", "name", "stock"];
  const sortField = allowedSortFields.includes(sort) ? sort : "createdAt";
  const sortOrder = order === "asc" ? "asc" : "desc";

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortField]: sortOrder },
      include: { category: true },
    }),
    prisma.product.count({ where }),
  ]);

  res.json({
    data: products,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

productRouter.get("/:id", async (req: Request, res: Response) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: { category: true },
  });

  if (!product) throw new NotFoundError("Product");

  res.json(product);
});

productRouter.post(
  "/",
  authenticate,
  requireRole("admin"),
  validate(createProductSchema),
  async (req: Request, res: Response) => {
    const product = await prisma.product.create({
      data: req.body,
      include: { category: true },
    });
    res.status(201).json(product);
  }
);

productRouter.patch(
  "/:id",
  authenticate,
  requireRole("admin"),
  validate(updateProductSchema),
  async (req: Request, res: Response) => {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new NotFoundError("Product");

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: req.body,
      include: { category: true },
    });
    res.json(product);
  }
);

productRouter.delete(
  "/:id",
  authenticate,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new NotFoundError("Product");

    await prisma.product.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }
);

export { productRouter };
