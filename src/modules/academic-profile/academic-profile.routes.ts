import { Hono } from "hono";
import type { AcademicProfileController } from "./academic-profile.controller.js";
import { authMiddleware, requireRole, STUDENT_ROLES } from "../../shared/middleware/auth-middleware.js";
import type { AppRole } from "./academic-profile.types.js";

export const createAcademicProfileRoutes = (controller: AcademicProfileController) => {
  const app = new Hono<{ Variables: { userId: number; role: AppRole } }>();

  app.use("*", authMiddleware);
  app.use("*", requireRole(...STUDENT_ROLES));

  app.get("/me", (c) => controller.getProfile(c));
  app.get("/careers", (c) => controller.getCareers(c));
  app.get("/specialties", (c) => controller.getSpecialties(c));
  app.put("/me/specialties", (c) => controller.updateSpecialties(c));

  return app;
};
