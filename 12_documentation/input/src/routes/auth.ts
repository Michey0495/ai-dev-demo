import { Router, Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../db/prisma";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validation";
import { BadRequestError, UnauthorizedError } from "../utils/errors";
import { JwtPayload } from "../types";

const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function generateTokens(payload: JwtPayload) {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: "7d",
  });
  return { accessToken, refreshToken };
}

authRouter.post(
  "/register",
  validate(registerSchema),
  async (req: Request, res: Response) => {
    const { email, password, name } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestError("Email already registered");

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name, role: "customer" },
    });

    const tokens = generateTokens({ sub: user.id, email: user.email, role: "customer" });
    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      ...tokens,
    });
  }
);

authRouter.post(
  "/login",
  validate(loginSchema),
  async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedError("Invalid credentials");

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedError("Invalid credentials");

    const tokens = generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role as "customer" | "admin",
    });
    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      ...tokens,
    });
  }
);

authRouter.post("/refresh", async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new BadRequestError("Refresh token required");

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as JwtPayload;
    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user) throw new UnauthorizedError("User not found");

    const tokens = generateTokens({
      sub: decoded.sub,
      email: decoded.email,
      role: user.role as "customer" | "admin",
    });
    res.json(tokens);
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError("Invalid refresh token");
  }
});

authRouter.get("/me", authenticate, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  res.json(user);
});

export { authRouter };
