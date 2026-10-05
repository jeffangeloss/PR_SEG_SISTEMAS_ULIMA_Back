import { db } from "../../db/index.js";
import { eventBus } from "../../events/index.js";
import { ScheduleController } from "./schedule.controller.js";
import { ScheduleRepository } from "./schedule.repository.js";
import { createScheduleRoutes } from "./schedule.routes.js";
import { ScheduleService } from "./schedule.service.js";

const scheduleRepository = new ScheduleRepository(db);
const scheduleService = new ScheduleService(scheduleRepository, eventBus);
const scheduleController = new ScheduleController(scheduleService);

export const scheduleRoutes = createScheduleRoutes(scheduleController);

export { ScheduleController } from "./schedule.controller.js";
export { ScheduleRepository } from "./schedule.repository.js";
export { ScheduleService } from "./schedule.service.js";
export { scheduleService };
export { academicPeriodQuerySchema } from "./schedule.schemas.js";
export type { ScheduleView } from "./schedule.types.js";
