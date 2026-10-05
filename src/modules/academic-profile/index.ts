import { db } from "../../db/index.js";
import { eventBus } from "../../events/index.js";
import { AcademicProfileController } from "./academic-profile.controller.js";
import { AcademicProfileRepository } from "./academic-profile.repository.js";
import { createAcademicProfileRoutes } from "./academic-profile.routes.js";
import { AcademicProfileService } from "./academic-profile.service.js";

const academicProfileRepository = new AcademicProfileRepository(db);
const academicProfileService = new AcademicProfileService(academicProfileRepository, eventBus);
const academicProfileController = new AcademicProfileController(academicProfileService);

export const academicProfileRoutes = createAcademicProfileRoutes(academicProfileController);

export { AcademicProfileController } from "./academic-profile.controller.js";
export { AcademicProfileRepository } from "./academic-profile.repository.js";
export { AcademicProfileService } from "./academic-profile.service.js";
export { specialtiesQuerySchema, updateSpecialtiesSchema } from "./academic-profile.schemas.js";
export type {
  ActiveSpecialty,
  CareerResponse,
  ProfileResponse,
  SpecialtyResponse,
  UpdateSpecialtiesRequest,
  UpdateSpecialtiesResult,
} from "./academic-profile.types.js";
