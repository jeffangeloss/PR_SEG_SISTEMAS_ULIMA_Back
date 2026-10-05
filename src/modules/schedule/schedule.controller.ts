import type { Context } from "hono";
import type { ScheduleService } from "./schedule.service.js";

export class ScheduleController {
  constructor(readonly service: ScheduleService) {}

  async getSessions(c: Context) {
    const studentId = Number(c.get("studentId"));
    return c.json(await this.service.getSessions(studentId));
  }

  async getAssessments(c: Context) {
    const studentId = Number(c.get("studentId"));
    return c.json(await this.service.getAssessments(studentId));
  }

  async getWeeklyLoad(c: Context) {
    const studentId = Number(c.get("studentId"));
    return c.json(await this.service.getWeeklyLoad(studentId));
  }

  async getTeacherSessions(c: Context) {
    const teacherId = Number(c.get("teacherId"));
    return c.json(await this.service.getTeacherSessions(teacherId));
  }

  async getTeacherAssessments(c: Context) {
    const teacherId = Number(c.get("teacherId"));
    return c.json(await this.service.getTeacherAssessments(teacherId));
  }

  async getTeacherAssessmentsStatus(c: Context) {
    const teacherId = Number(c.get("teacherId"));
    const sectionId = Number(c.req.param("sectionId"));
    return c.json(await this.service.getTeacherAssessmentsStatus(teacherId, sectionId));
  }

  async notifyGrades(c: Context) {
    const teacherId = Number(c.get("teacherId"));
    const sectionId = Number(c.req.param("sectionId"));
    const assessmentId = Number(c.req.param("assessmentId"));
    return c.json(await this.service.notifyGrades(teacherId, sectionId, assessmentId));
  }
}
