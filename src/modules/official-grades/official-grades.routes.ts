import { Hono } from "hono";
import type { OfficialGradesController } from "./official-grades.controller.js";
import { authMiddleware, requireRole, STUDENT_ROLES } from "../../shared/middleware/auth-middleware.js";

export const createOfficialGradesRoutes = (controller: OfficialGradesController) => {
  const app = new Hono<{ Variables: { teacherId: number; studentId: number; role: string } }>();

  app.use("*", authMiddleware);

  // Alumno: lee sus notas oficiales (la nota final la calcula el cliente).
  app.get("/me", requireRole(...STUDENT_ROLES), (c) => controller.getMyOfficialCourses(c));

  // Docente (profesor/JP): califica las secciones que dicta.
  app.get("/teacher/sections", requireRole("teacher"), (c) => controller.getTeacherSections(c));
  app.get("/teacher/sections/:sectionId/scores", requireRole("teacher"), (c) => controller.getSectionGrid(c));
  app.put("/teacher/sections/:sectionId/scores", requireRole("teacher"), (c) => controller.saveSectionScores(c));

  return app;
};
