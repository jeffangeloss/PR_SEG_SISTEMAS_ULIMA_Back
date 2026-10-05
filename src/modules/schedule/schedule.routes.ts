import { Hono } from "hono";
import type { ScheduleController } from "./schedule.controller.js";
import { authMiddleware, requireRole, STUDENT_ROLES } from "../../shared/middleware/auth-middleware.js";

export const createScheduleRoutes = (controller: ScheduleController) => {
  const app = new Hono<{ Variables: { studentId: number; teacherId: number } }>();

  app.use("*", authMiddleware);

  // Student routes
  app.get("/me/sessions", requireRole(...STUDENT_ROLES), (c) => controller.getSessions(c));
  app.get("/me/assessments", requireRole(...STUDENT_ROLES), (c) => controller.getAssessments(c));
  app.get("/me/load", requireRole(...STUDENT_ROLES), (c) => controller.getWeeklyLoad(c));

  // Teacher routes
  app.get("/teacher/sessions", requireRole("teacher"), (c) => controller.getTeacherSessions(c));
  app.get("/teacher/assessments", requireRole("teacher"), (c) => controller.getTeacherAssessments(c));
  app.get("/teacher/sections/:sectionId/assessments-status", requireRole("teacher"), (c) => controller.getTeacherAssessmentsStatus(c));
  app.post("/teacher/sections/:sectionId/assessments/:assessmentId/notify-grades", requireRole("teacher"), (c) => controller.notifyGrades(c));

  return app;
};
