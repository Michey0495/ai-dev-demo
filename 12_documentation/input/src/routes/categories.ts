import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validation";
import { NotFoundError, ConflictError } from "../utils/errors";

const categoryRouter = Router();

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  parentId: z.string().uuid().optional(),
});

const updateCategorySchema = createCategorySchema.partial();

categoryRouter.get("/", async (_req: Request, res: Response) => {
  const categories = await prisma.category.findMany({
    include: {
      _count: { select: { products: true } },
      children: true,
    },
    where: { parentId: null },
    orderBy: { name: "asc" },
  });

  res.json({ data: categories });
});

categoryRouter.get("/:id", async (req: Request, res: Response) => {
  const category = await prisma.category.findUnique({
    where: { id: req.params.id },
    include: {
      _count: { select: { products: true } },
      children: true,
      products: { take: 5, orderBy: { createdAt: "desc" } },
    },
  });

  if (!category) throw new NotFoundError("Category");

  res.json(category);
});

categoryRouter.post(
  "/",
  authenticate,
  requireRole("admin"),
  validate(createCategorySchema),
  async (req: Request, res: Response) => {
    const existing = await prisma.category.findUnique({
      where: { slug: req.body.slug },
    });
    if (existing) throw new ConflictError("Category slug already exists");

    const category = await prisma.category.create({
      data: req.body,
    });
    res.status(201).json(category);
  }
);

categoryRouter.patch(
  "/:id",
  authenticate,
  requireRole("admin"),
  validate(updateCategorySchema),
  async (req: Request, res: Response) => {
    const existing = await prisma.category.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) throw new NotFoundError("Category");

    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(category);
  }
);

categoryRouter.delete(
  "/:id",
  authenticate,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const existing = await prisma.category.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { products: true } } },
    });
    if (!existing) throw new NotFoundError("Category");

    if (existing._count.products > 0) {
      throw new ConflictError("Cannot delete category with existing products");
    }

    await prisma.category.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }
);

export { categoryRouter };
