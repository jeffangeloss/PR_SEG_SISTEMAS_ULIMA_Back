import { Hono } from "hono";
import type { SectionManagementController } from "./section-management.controller.js";
import {
  authMiddleware,
  requireRole,
  STUDENT_ROLES,
  type AuthVariables,
} from "../../shared/middleware/auth-middleware.js";

export const createSectionManagementRoutes = (controller: SectionManagementController) => {
  const app = new Hono<{ Variables: AuthVariables }>();

  app.use("*", authMiddleware);
  app.use("*", requireRole(...STUDENT_ROLES));

  app.get("/representatives", (c) => controller.getRepresentatives(c));

  app.get(
    "/sections/:sectionId/announcements",
    requireRole("delegate", "subdelegate"),
    (c) => controller.getAnnouncements(c),
  );
  // HU11: estadísticas del salón (solo el delegado/subdelegado de la sección).
  app.get(
    "/sections/:sectionId/statistics",
    requireRole("delegate", "subdelegate"),
    (c) => controller.getStatistics(c),
  );
  app.post(
    "/sections/:sectionId/announcements",
    requireRole("delegate", "subdelegate"),
    (c) => controller.createAnnouncement(c),
  );
  app.put(
    "/announcements/:id",
    requireRole("delegate", "subdelegate"),
    (c) => controller.updateAnnouncement(c),
  );
  app.delete(
    "/announcements/:id",
    requireRole("delegate", "subdelegate"),
    (c) => controller.deleteAnnouncement(c),
  );

  return app;
};
