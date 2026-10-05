import type { Context } from "hono";
import { HttpError } from "../../shared/errors/http-error.js";
import { validateJson, validateParams } from "../../shared/middleware/validate-dto.js";
import type { SectionManagementService } from "./section-management.service.js";
import {
  announcementIdParamSchema,
  createAnnouncementSchema,
  sectionIdParamSchema,
  updateAnnouncementSchema,
} from "./section-management.schemas.js";

export class SectionManagementController {
  constructor(readonly service: SectionManagementService) {}

  private requireStudentId(c: Context): number {
    const studentId = c.get("studentId");
    if (!studentId) {
      throw new HttpError(401, "No autorizado. Alumno no encontrado.", "STUDENT_NOT_FOUND");
    }
    return Number(studentId);
  }

  async getRepresentatives(c: Context) {
    return c.json(await this.service.getRepresentatives(this.requireStudentId(c)));
  }

  async getAnnouncements(c: Context) {
    const { sectionId } = validateParams(c, sectionIdParamSchema);
    return c.json(await this.service.getAnnouncements(this.requireStudentId(c), sectionId));
  }

  async getStatistics(c: Context) {
    const { sectionId } = validateParams(c, sectionIdParamSchema);
    return c.json(await this.service.getStatistics(this.requireStudentId(c), sectionId));
  }

  async createAnnouncement(c: Context) {
    const { sectionId } = validateParams(c, sectionIdParamSchema);
    const body = await validateJson(c, createAnnouncementSchema);
    return c.json(
      await this.service.createAnnouncement(this.requireStudentId(c), sectionId, body),
      201,
    );
  }

  async updateAnnouncement(c: Context) {
    const { id } = validateParams(c, announcementIdParamSchema);
    const body = await validateJson(c, updateAnnouncementSchema);
    return c.json(await this.service.updateAnnouncement(this.requireStudentId(c), id, body));
  }

  async deleteAnnouncement(c: Context) {
    const { id } = validateParams(c, announcementIdParamSchema);
    return c.json(await this.service.deleteAnnouncement(this.requireStudentId(c), id));
  }
}
