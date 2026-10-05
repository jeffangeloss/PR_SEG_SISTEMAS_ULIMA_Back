import type { Context } from "hono";
import type { OfficialGradesService } from "./official-grades.service.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { validateJson, validateParams } from "../../shared/middleware/validate-dto.js";
import { sectionIdParamSchema, upsertSectionScoresSchema } from "./official-grades.schemas.js";

export class OfficialGradesController {
  constructor(readonly service: OfficialGradesService) {}

  private requireTeacherId(c: Context): number {
    const teacherId = c.get("teacherId");
    if (!teacherId) throw new HttpError(401, "No autorizado. Docente no encontrado.", "TEACHER_NOT_FOUND");
    return Number(teacherId);
  }

  // ─── Docente ───────────────────────────────────────────────────────────────

  async getTeacherSections(c: Context) {
    const sections = await this.service.getTeacherSections(this.requireTeacherId(c));
    return c.json({ sections });
  }

  async getSectionGrid(c: Context) {
    const { sectionId } = validateParams(c, sectionIdParamSchema);
    const grid = await this.service.getSectionGrid(this.requireTeacherId(c), sectionId);
    return c.json(grid);
  }

  async saveSectionScores(c: Context) {
    const { sectionId } = validateParams(c, sectionIdParamSchema);
    const body = await validateJson(c, upsertSectionScoresSchema);
    const grid = await this.service.saveSectionScores(this.requireTeacherId(c), sectionId, body.scores);
    return c.json(grid);
  }

  // ─── Alumno ──────────────────────────────────────────────────────────────

  async getMyOfficialCourses(c: Context) {
    const studentId = c.get("studentId");
    const courses = await this.service.getMyOfficialCourses(studentId);
    return c.json({ courses });
  }
}
