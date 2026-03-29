import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { errorHandler } from "./utils/errors";
import { requestLogger } from "./middleware/logger";

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(requestLogger);

const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

app.use("/api", apiLimiter);

registerRoutes(app);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    version: process.env.npm_package_version ?? "unknown",
    timestamp: new Date().toISOString(),
  });
});

app.use(errorHandler);

const port = Number(process.env.PORT) || 4000;

app.listen(port, () => {
  console.log(`Server running on port ${port} [${process.env.NODE_ENV ?? "development"}]`);
});

export { app };
