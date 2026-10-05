import { db } from "../../db/index.js";
import { eventBus } from "../../events/index.js";
import { OfficialGradesController } from "./official-grades.controller.js";
import { OfficialGradesRepository } from "./official-grades.repository.js";
import { createOfficialGradesRoutes } from "./official-grades.routes.js";
import { OfficialGradesService } from "./official-grades.service.js";

const officialGradesRepository = new OfficialGradesRepository(db);
const officialGradesService = new OfficialGradesService(officialGradesRepository, eventBus);
const officialGradesController = new OfficialGradesController(officialGradesService);

export const officialGradesRoutes = createOfficialGradesRoutes(officialGradesController);

export { OfficialGradesController } from "./official-grades.controller.js";
export { OfficialGradesRepository } from "./official-grades.repository.js";
export { OfficialGradesService } from "./official-grades.service.js";
