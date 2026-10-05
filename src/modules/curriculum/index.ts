import { db } from "../../db/index.js";
import { eventBus } from "../../events/index.js";
import { CurriculumController } from "./curriculum.controller.js";
import { CurriculumRepository } from "./curriculum.repository.js";
import { createCurriculumRoutes } from "./curriculum.routes.js";
import { CurriculumService } from "./curriculum.service.js";

const curriculumRepository = new CurriculumRepository(db);
const curriculumService = new CurriculumService(curriculumRepository, eventBus);
const curriculumController = new CurriculumController(curriculumService);

export const curriculumRoutes = createCurriculumRoutes(curriculumController);

export { CurriculumController } from "./curriculum.controller.js";
export { CurriculumRepository } from "./curriculum.repository.js";
export { CurriculumService } from "./curriculum.service.js";
export { updateCourseProgressSchema, updateSimulationSchema } from "./curriculum.schemas.js";
export type { CourseProgressStatus } from "./curriculum.types.js";
