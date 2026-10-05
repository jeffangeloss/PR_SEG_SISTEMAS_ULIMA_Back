import type { Context } from "hono";
import type { CurriculumService } from "./curriculum.service.js";
import { validateJson } from "../../shared/middleware/validate-dto.js";
import { updateSimulationSchema } from "./curriculum.schemas.js";

export class CurriculumController {
  constructor(readonly service: CurriculumService) {}

  async getCurriculum(c: Context) {
    const studentId = c.get("studentId");
    const result = await this.service.getCurriculum(studentId);
    return c.json(result);
  }

  async updateSimulation(c: Context) {
    const studentId = c.get("studentId");
    const body = await validateJson(c, updateSimulationSchema);
    const result = await this.service.updateSimulation(studentId, body.curriculumCourseId, body.status);
    return c.json(result);
  }

  async deleteSimulation(c: Context) {
    const studentId = c.get("studentId");
    const curriculumCourseIdParam = c.req.param("curriculumCourseId");
    const curriculumCourseId = parseInt(curriculumCourseIdParam ?? "", 10);
    const result = await this.service.deleteSimulation(studentId, curriculumCourseId);
    return c.json(result);
  }
}
