import type { Context } from "hono";
import type { AcademicProfileService } from "./academic-profile.service.js";
import { validateJson, validateQuery } from "../../shared/middleware/validate-dto.js";
import { specialtiesQuerySchema, updateSpecialtiesSchema } from "./academic-profile.schemas.js";
import type { AppRole } from "./academic-profile.types.js";

export class AcademicProfileController {
  constructor(readonly service: AcademicProfileService) {}

  async getProfile(c: Context) {
    const userId = Number(c.get("userId"));
    const role = c.get("role") as AppRole;
    return c.json(await this.service.getProfile(userId, role));
  }

  async getCareers(c: Context) {
    return c.json(await this.service.getCareers());
  }

  async getSpecialties(c: Context) {
    const userId = Number(c.get("userId"));
    const query = validateQuery(c, specialtiesQuerySchema);
    const careerId = query.careerId == null || query.careerId.trim() === ""
      ? undefined
      : Number(query.careerId);
    return c.json(await this.service.getSpecialties(userId, careerId));
  }

  async updateSpecialties(c: Context) {
    const userId = Number(c.get("userId"));
    const body = await validateJson(c, updateSpecialtiesSchema);
    return c.json(await this.service.updateSpecialties(userId, body));
  }
}
