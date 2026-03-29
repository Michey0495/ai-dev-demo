import { Request, Response, NextFunction } from "express";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? "warn" : "info";
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;

    if (process.env.NODE_ENV !== "test") {
      console[logLevel === "warn" ? "warn" : "log"](
        JSON.stringify({
          level: logLevel,
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          duration,
          userAgent: req.headers["user-agent"],
          ip: req.ip,
          timestamp: new Date().toISOString(),
        })
      );
    }
  });

  next();
}
