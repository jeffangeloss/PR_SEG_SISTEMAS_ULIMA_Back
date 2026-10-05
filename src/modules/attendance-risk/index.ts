import { db } from "../../db/index.js";
import { eventBus } from "../../events/index.js";
import { AttendanceRiskController } from "./attendance-risk.controller.js";
import { AttendanceRiskRepository } from "./attendance-risk.repository.js";
import { createAttendanceRiskRoutes } from "./attendance-risk.routes.js";
import { AttendanceRiskService } from "./attendance-risk.service.js";

const attendanceRiskRepository = new AttendanceRiskRepository(db);
const attendanceRiskService = new AttendanceRiskService(attendanceRiskRepository, eventBus);
const attendanceRiskController = new AttendanceRiskController(attendanceRiskService);

export const attendanceRiskRoutes = createAttendanceRiskRoutes(attendanceRiskController);

export { AttendanceRiskController } from "./attendance-risk.controller.js";
export { AttendanceRiskRepository } from "./attendance-risk.repository.js";
export { AttendanceRiskService } from "./attendance-risk.service.js";
