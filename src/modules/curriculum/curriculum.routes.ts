import { Hono } from "hono";
import type { CurriculumController } from "./curriculum.controller.js";
import { authMiddleware, requireRole, STUDENT_ROLES } from "../../shared/middleware/auth-middleware.js";

export const createCurriculumRoutes = (controller: CurriculumController) => {
  const app = new Hono();

  app.use("*", authMiddleware);
  app.use("*", requireRole(...STUDENT_ROLES));

  app.get("/me", (c) => controller.getCurriculum(c));
  app.put("/me/simulation", (c) => controller.updateSimulation(c));
  app.delete("/me/simulation/:curriculumCourseId", (c) => controller.deleteSimulation(c));

  return app;
};
