import { Hono } from "hono";
import type { AlertsController } from "./alerts.controller.js";
import { authMiddleware, requireRole, STUDENT_ROLES } from "../../shared/middleware/auth-middleware.js";

export const createAlertsRoutes = (controller: AlertsController) => {
  const app = new Hono();

  app.use("*", authMiddleware);
  app.use("*", requireRole(...STUDENT_ROLES));

  app.get("/me", (c) => controller.getAlerts(c));
  app.put("/me/:alertId/read", (c) => controller.markRead(c));

  return app;
};

