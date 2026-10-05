import { db } from "../../db/index.js";
import { eventBus } from "../../events/index.js";
import { CourseDetailController } from "./course-detail.controller.js";
import { CourseDetailRepository } from "./course-detail.repository.js";
import { createCourseDetailRoutes } from "./course-detail.routes.js";
import { CourseDetailService } from "./course-detail.service.js";

const courseDetailRepository = new CourseDetailRepository(db);
const courseDetailService = new CourseDetailService(courseDetailRepository, eventBus);
const courseDetailController = new CourseDetailController(courseDetailService);

export const courseDetailRoutes = createCourseDetailRoutes(courseDetailController);

export { CourseDetailController } from "./course-detail.controller.js";
export { CourseDetailRepository } from "./course-detail.repository.js";
export { CourseDetailService } from "./course-detail.service.js";
export { sectionIdParamSchema } from "./course-detail.schemas.js";
export type { CourseDetailTab } from "./course-detail.types.js";
