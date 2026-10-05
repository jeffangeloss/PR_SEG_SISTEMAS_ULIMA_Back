import { db } from "../../db/index.js";
import { eventBus } from "../../events/index.js";
import { AlertsController } from "./alerts.controller.js";
import { AlertsRepository } from "./alerts.repository.js";
import { createAlertsRoutes } from "./alerts.routes.js";
import { AlertsService } from "./alerts.service.js";

const alertsRepository = new AlertsRepository(db);
const alertsService = new AlertsService(alertsRepository, eventBus);
const alertsController = new AlertsController(alertsService);

export const alertsRoutes = createAlertsRoutes(alertsController);

export { AlertsController } from "./alerts.controller.js";
export { AlertsRepository } from "./alerts.repository.js";
export { AlertsService } from "./alerts.service.js";
export { markAlertReadSchema } from "./alerts.schemas.js";
export type { AlertType } from "./alerts.types.js";
